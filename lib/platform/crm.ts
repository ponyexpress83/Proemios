import { linkLeadsToAuthor } from "./lead-linking";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import {
  leadOwnership,
  leadNotes,
  quoteRecords,
  quoteClaims,
  platformSettings,
  projects,
  quoteVersions,
  notifications,
  emailOutbox,
} from "@/db/platform-schema";
import { leadAccess, leadPredicate, demandAvailable, demand, audit, type Actor } from "./access";
import { readBody, json, notFound, forbidden, PlatformError, hashToken, csvCell } from "./http";
import { limitRequest } from "./rate-limit";
import { computeQuote, type QuotePackage } from "@/lib/pricing";
import { pricingInputSchema } from "@/lib/validation";
import {
  pricingVersion,
  appOrigin,
  paymentPolicySchema,
  commissionRuleSchema,
  moneyBreakdown,
  mailConfigured,
  defaultPaymentPolicy,
  type PaymentPolicy,
} from "./config";
import { impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { enqueueMail, protectMailHtml } from "./mail";
import { purchaseRuleSchema, defaultPurchaseRule, journeyStage, purchasePath, type PurchaseRule } from "./commercial";
import { recordFunnel } from "./funnel";
import { paymentOrders, affiliateConversions } from "@/db/platform-schema";

export async function getSetting(key: string) {
  const [row] = await getDb()
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return row?.value;
}
/** La policy approvata dall'owner, oppure quella predefinita. */
export async function resolvePaymentPolicy(): Promise<PaymentPolicy> {
  const saved = paymentPolicySchema.safeParse(await getSetting("payment-policy"));
  return saved.success ? saved.data : defaultPaymentPolicy;
}
/** La regola di acquistabilità approvata dall'owner, oppure quella predefinita (prudente). */
export async function resolvePurchaseRule(): Promise<PurchaseRule> {
  const saved = purchaseRuleSchema.safeParse(await getSetting("purchase-rule"));
  return saved.success ? saved.data : defaultPurchaseRule;
}
/**
 * Le condizioni fiscali di una proposta. Se lo snapshot è vuoto (proposta
 * nata prima che esistesse una policy) viene completato una volta sola con la
 * policy corrente, così la proposta torna accettabile e pagabile.
 */
export async function ensureQuotePolicy(
  record: typeof quoteRecords.$inferSelect,
): Promise<PaymentPolicy> {
  const saved = paymentPolicySchema.safeParse(record.taxPolicy);
  if (saved.success) return saved.data;
  const policy = await resolvePaymentPolicy();
  await getDb()
    .update(quoteRecords)
    .set({ taxPolicy: policy })
    .where(and(eq(quoteRecords.quoteId, record.quoteId), sql`${quoteRecords.taxPolicy} is null`));
  record.taxPolicy = policy;
  return policy;
}
export async function leadCollection(request: Request, actor: Actor) {
  demandAvailable(actor, request.method === "POST" ? "crm.write" : "crm.read");
  if (request.method === "GET") {
    const search = new URL(request.url).searchParams.get("q")?.slice(0, 100);
    const rows = await getDb()
      .select({ lead: leads, owner: leadOwnership })
      .from(leads)
      .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
      .where(
        and(
          leadPredicate(actor, "crm.read"),
          search
            ? or(ilike(leads.nome, `%${search}%`), ilike(leads.email, `%${search}%`))
            : undefined,
        ),
      )
      .orderBy(desc(leads.createdAt))
      .limit(150);
    return json({
      leads: rows.map((r) => ({ ...r.lead, assignedTo: r.owner?.assignedTo ?? null })),
    });
  }
  if (request.method !== "POST") throw notFound();
  await limitRequest("lead-create", actor.id, 50, 3600);
  const body = await readBody(
    request,
    z
      .object({
        nome: z.string().trim().min(2).max(200),
        email: z.string().trim().email().max(320),
        telefono: z.string().max(40).optional(),
        note: z.string().max(5000).optional(),
        consensoPrivacy: z.boolean().default(false),
      })
      .strict(),
  );
  const lead = await getDb().transaction(async (tx) => {
    const [saved] = await tx
      .insert(leads)
      .values({
        ...body,
        email: body.email.toLowerCase(),
        fonte: "contatto",
        consensoMarketing: false,
      })
      .returning();
    await tx.insert(leadOwnership).values({ leadId: saved!.id, assignedTo: actor.id });
    return saved!;
  });
  await audit(actor, "lead.created", "lead", lead.id);
  return json({ lead }, 201);
}
export async function leadDetail(request: Request, actor: Actor, id: string) {
  await leadAccess(actor, id, request.method === "PATCH" ? "crm.write" : "crm.read");
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, id));
  if (!lead) throw notFound();
  if (request.method === "GET") {
    const notes = await getDb()
      .select({
        id: leadNotes.id,
        body: leadNotes.body,
        name: user.name,
        createdAt: leadNotes.createdAt,
      })
      .from(leadNotes)
      .innerJoin(user, eq(user.id, leadNotes.authorId))
      .where(eq(leadNotes.leadId, id))
      .orderBy(desc(leadNotes.createdAt));
    const savedQuotes = await getDb()
      .select({
        id: quotes.id,
        createdAt: quotes.createdAt,
        stato: quotes.stato,
        prezzoTotale: quotes.prezzoTotale,
      })
      .from(quotes)
      .where(eq(quotes.leadId, id));
    return json({ lead, notes, quotes: savedQuotes });
  }
  if (request.method !== "PATCH") throw notFound();
  const body = await readBody(
    request,
    z
      .object({
        stage: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]).optional(),
        nome: z.string().trim().min(2).max(200).optional(),
        telefono: z.string().max(40).optional(),
        assignedTo: z.string().min(1).max(100).optional(),
        lostReason: z.string().trim().max(1000).optional(),
      })
      .strict(),
  );
  if (body.assignedTo) {
    if (body.stage === "lost" && !body.lostReason) throw new PlatformError(422, "MISSING_REASON", "Indica il motivo della chiusura.");
    demand(actor, "crm.assign");
    const [target] = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, body.assignedTo), eq(user.emailVerified, true)));
    if (!target)
      throw new PlatformError(422, "INVALID_ASSIGNEE", "Seleziona un utente verificato.");
    await getDb()
      .insert(leadOwnership)
      .values({ leadId: id, assignedTo: body.assignedTo })
      .onConflictDoUpdate({
        target: leadOwnership.leadId,
        set: { assignedTo: body.assignedTo, updatedAt: new Date() },
      });
  }
  if (body.stage === "lost" && !body.lostReason)
    throw new PlatformError(422, "MISSING_REASON", "Indica il motivo della chiusura.");
  if (body.stage || body.nome || body.telefono !== undefined)
    await getDb()
      .update(leads)
      .set({ stage: body.stage, nome: body.nome, telefono: body.telefono })
      .where(eq(leads.id, id));
  if (body.lostReason)
    await getDb()
      .insert(leadNotes)
      .values({ leadId: id, authorId: actor.id, body: `Motivo chiusura: ${body.lostReason}` });
  await audit(actor, "lead.updated", "lead", id, {
    stage: body.stage,
    assignedTo: body.assignedTo,
  });
  return json({ ok: true });
}
export async function leadNote(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  await leadAccess(actor, id, "crm.write");
  const body = await readBody(
    request,
    z.object({ body: z.string().trim().min(1).max(5000) }).strict(),
  );
  const [note] = await getDb()
    .insert(leadNotes)
    .values({ leadId: id, authorId: actor.id, body: body.body })
    .returning();
  return json({ note }, 201);
}
export async function createQuoteForLead(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  await leadAccess(actor, id, "quote.write");
  const body = await readBody(request, z.object({ input: pricingInputSchema }).strict());
  const result = computeQuote(body.input),
    recommended = result.packages.find((p) => p.recommended)!;
  const tax = await resolvePaymentPolicy(),
    commissions = commissionRuleSchema.safeParse(await getSetting("commission-rule"));
  const quote = await getDb().transaction(async (tx) => {
    const [saved] = await tx
      .insert(quotes)
      .values({
        leadId: id,
        input: body.input,
        pacchettiGenerati: result.packages,
        prezzoTotale: recommended.total,
        acconto: recommended.deposit,
        stato: "draft",
      })
      .returning();
    await tx
      .insert(quoteRecords)
      .values({
        quoteId: saved!.id,
        createdBy: actor.id,
        pricingVersion,
        taxPolicy: tax,
        commissionPolicy: commissions.success ? commissions.data : null,
        // Una proposta costruita dal team è già una proposta, non una stima.
        commercialState: "offer",
        offeredAt: new Date(),
        offeredBy: actor.id,
        salesAssisted: true,
      });
    return saved!;
  });
  await audit(actor, "quote.created", "quote", quote.id);
  return json({ quote, packages: result.packages }, 201);
}
export async function quoteAccess(
  actor: Actor,
  id: string,
  permission: "quote.read" | "quote.accept" | "quote.send" | "quote.write" = "quote.read",
) {
  const [quote] = await getDb().select().from(quotes).where(eq(quotes.id, id));
  if (!quote) throw notFound();
  await leadAccess(actor, quote.leadId, permission);
  const [record] = await getDb().select().from(quoteRecords).where(eq(quoteRecords.quoteId, id));
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, quote.leadId));
  if (!record || !lead)
    throw new PlatformError(
      409,
      "QUOTE_REVIEW_REQUIRED",
      "Questa proposta deve essere confermata dal team prima di proseguire.",
    );
  return { quote, record, lead };
}
export async function quoteCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "quote.read");
  // L'autore vede anche le richieste fatte dal sito con la sua email verificata
  // (la sessione esiste solo dopo la verifica): rete di sicurezza se la
  // richiesta è arrivata dopo la registrazione.
  if (!actor.staff) await linkLeadsToAuthor(actor.id, actor.email).catch(() => {});
  const rows = await getDb()
    .select({ quote: quotes, record: quoteRecords, name: leads.nome })
    .from(quotes)
    .innerJoin(leads, eq(leads.id, quotes.leadId))
    .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
    .leftJoin(quoteRecords, eq(quoteRecords.quoteId, quotes.id))
    .where(leadPredicate(actor, "quote.read"))
    .orderBy(desc(quotes.createdAt))
    .limit(100);
  const ids = rows.map((r) => r.quote.id);
  const orders = ids.length
    ? await getDb().select({ quoteId: paymentOrders.quoteId, kind: paymentOrders.kind, status: paymentOrders.status }).from(paymentOrders).where(sql`${paymentOrders.quoteId} in ${ids}`)
    : [];
  return json({
    quotes: rows.map((r) => {
      const own = orders.filter((o) => o.quoteId === r.quote.id);
      const record = r.record ?? { version: 1, acceptedAt: null, expiresAt: null, commercialState: "offer", preferredTier: null, selectedTier: null, reviewRequestedAt: null };
      return {
        ...r.quote,
        version: record.version,
        acceptedAt: record.acceptedAt,
        expiresAt: record.expiresAt,
        commercialState: record.commercialState,
        preferredTier: record.preferredTier,
        selectedTier: record.selectedTier,
        reviewRequestedAt: record.reviewRequestedAt,
        journey: journeyStage(record, own),
        depositPaid: own.some((o) => o.kind === "deposit" && o.status === "paid"),
        balancePaid: own.some((o) => o.kind === "balance" && o.status === "paid"),
        paymentPending: own.some((o) => o.status === "pending"),
        name: r.name,
      };
    }),
  });
}
/** Chi segue la proposta, per nome: l'autore deve sapere con chi parla. */
async function quoteReferente(leadId: string) {
  const [ownership] = await getDb().select().from(leadOwnership).where(eq(leadOwnership.leadId, leadId));
  if (!ownership?.assignedTo) return null;
  const [person] = await getDb().select({ name: user.name }).from(user).where(eq(user.id, ownership.assignedTo));
  return person ? { name: person.name } : null;
}
type PricingInputLike = { projectType: "romanzo" | "saggio" | "memoir" | "libro-professionale" | "solo-grafica"; textState: "finito-revisionato" | "finito-da-revisionare" | "bozza-incompleta" | "solo-materiali"; singleService?: "editing" | "proofreading" | "layout" | "epub" | "cover" | "kdp" | "isbn" | "amazonListing" };
/**
 * Chi ha fatto cosa su una proposta: responsabile del contatto, origine,
 * affiliazione, intervento commerciale e regola provvigionale congelata.
 * Sono fatti distinti: assegnare un contatto non è vendere.
 */
async function quoteAttribution(access: Awaited<ReturnType<typeof quoteAccess>>) {
  const [ownership] = await getDb().select().from(leadOwnership).where(eq(leadOwnership.leadId, access.quote.leadId));
  const [owner] = ownership?.assignedTo ? await getDb().select({ id: user.id, name: user.name }).from(user).where(eq(user.id, ownership.assignedTo)) : [];
  const [offeredBy] = access.record.offeredBy ? await getDb().select({ id: user.id, name: user.name }).from(user).where(eq(user.id, access.record.offeredBy)) : [];
  const [conversion] = await getDb().select().from(affiliateConversions).where(eq(affiliateConversions.quoteId, access.quote.id));
  const rule = commissionRuleSchema.safeParse(access.record.commissionPolicy);
  return {
    responsible: owner ?? null,
    source: { channel: access.lead.fonte, attribution: access.lead.attribution ?? null },
    affiliate: conversion ? { ruleVersion: conversion.ruleVersion, createdAt: conversion.createdAt } : null,
    salesAssisted: access.record.salesAssisted,
    offeredBy: offeredBy ?? null,
    acceptedSellerId: access.record.acceptedSellerId,
    commissionRule: rule.success ? { version: rule.data.version, sellerBps: rule.data.sellerBps, affiliateBps: rule.data.affiliateBps, assistedSalesOnly: rule.data.assistedSalesOnly } : null,
  };
}
export async function quoteDetail(request: Request, actor: Actor, id: string) {
  if (request.method === "PATCH") {
    const access = await quoteAccess(actor, id, "quote.write");
    const body = await readBody(request, z.object({ input: pricingInputSchema, version: z.number().int().positive(), expiresAt: z.string().datetime().optional() }).strict());
    const result = computeQuote(body.input), recommended = result.packages.find(p => p.recommended)!;
    const tax = await resolvePaymentPolicy();
    const rule = commissionRuleSchema.safeParse(await getSetting("commission-rule"));
    await getDb().transaction(async tx => {
      const [current] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, id)).for("update");
      if (!current || current.version !== body.version) throw new PlatformError(409, "STALE_QUOTE", "La proposta è cambiata. Aggiorna la pagina.");
      if (current.acceptedAt) throw new PlatformError(409, "ACCEPTED_QUOTE", "Una proposta accettata richiede un nuovo accordo, non una sovrascrittura.");
      await tx.insert(quoteVersions).values({ quoteId: id, version: current.version, snapshot: { quote: access.quote, record: current }, createdBy: actor.id }).onConflictDoNothing();
      await tx.update(quotes).set({ input: body.input, pacchettiGenerati: result.packages, prezzoTotale: recommended.total, acconto: recommended.deposit, stato: "draft", updatedAt: new Date() }).where(eq(quotes.id, id));
      await tx.update(quoteRecords).set({ version: current.version + 1, pricingVersion, expiresAt: body.expiresAt ? new Date(body.expiresAt) : current.expiresAt, taxPolicy: tax, commissionPolicy: rule.success ? rule.data : null, salesAssisted: true }).where(eq(quoteRecords.quoteId, id));
    });
    await audit(actor, "quote.revised", "quote", id, { version: body.version + 1 });
    return json({ ok: true });
  }
  if (request.method !== "GET") throw notFound();
  const access = await quoteAccess(actor, id);
  const current = await ensureQuotePolicy(access.record);
  const policy = { success: true as const, data: current };
  const orders = await getDb().select({ kind: paymentOrders.kind, status: paymentOrders.status }).from(paymentOrders).where(eq(paymentOrders.quoteId, id));
  return json({
    quote: access.quote,
    history: await getDb().select({ version: quoteVersions.version, createdAt: quoteVersions.createdAt }).from(quoteVersions).where(eq(quoteVersions.quoteId, id)).orderBy(desc(quoteVersions.version)).limit(100),
    record: {
      version: access.record.version,
      pricingVersion: access.record.pricingVersion,
      acceptedAt: access.record.acceptedAt,
      selectedTier: access.record.selectedTier,
      termsVersion: access.record.termsVersion,
      expiresAt: access.record.expiresAt,
      commercialState: access.record.commercialState,
      reviewRequestedAt: access.record.reviewRequestedAt,
      reviewNote: access.record.reviewNote,
      offeredAt: access.record.offeredAt,
      preferredTier: access.record.preferredTier,
      remindersPausedAt: access.record.remindersPausedAt,
    },
    journey: journeyStage(access.record, orders),
    purchasePath: purchasePath(access.quote.input as PricingInputLike),
    referente: await quoteReferente(access.quote.leadId),
    attribution: actor.staff ? await quoteAttribution(access) : undefined,
    packages: (access.quote.pacchettiGenerati as QuotePackage[]).map((p) => ({
      ...p,
      money: moneyBreakdown(p.total, policy.data),
      depositMoney: moneyBreakdown(p.deposit, policy.data),
    })),
    paymentPolicy: policy.success
      ? {
          version: policy.data.version,
          vatMode: policy.data.vatMode,
          vatRateBps: policy.data.vatRateBps,
          termsVersion: policy.data.termsVersion,
        }
      : null,
  });
}
export const acceptBodySchema = z
  .object({
    tier: z.enum(["essenziale", "consigliato", "signature"]),
    version: z.number().int().positive(),
    policyVersion: z.string().min(1),
    termsAccepted: z.literal(true),
  })
  .strict();
export async function quoteAccept(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const body = await readBody(request, acceptBodySchema);
  await acceptQuote(actor, id, body);
  return json({ ok: true });
}
/**
 * Accettazione di una proposta acquistabile. Idempotente: ripetere con lo
 * stesso pacchetto non cambia nulla. Solo una proposta in stato "offer" si
 * può accettare: una stima o una richiesta in valutazione no.
 */
export async function acceptQuote(actor: Actor, id: string, body: z.infer<typeof acceptBodySchema>) {
  const access = await quoteAccess(actor, id, "quote.accept");
  const [ownership] = await getDb()
    .select()
    .from(leadOwnership)
    .where(eq(leadOwnership.leadId, access.quote.leadId));
  if (ownership?.authorId !== actor.id) throw forbidden();
  if (!["offer", "accepted"].includes(access.record.commercialState))
    throw new PlatformError(
      409,
      "NOT_PURCHASABLE",
      access.record.commercialState === "review"
        ? "La proposta è in valutazione dal team: riceverai la versione definitiva prima di confermare."
        : "Questa è una stima indicativa. Chiedi la proposta definitiva prima di confermare.",
    );
  const policy = { success: true as const, data: await ensureQuotePolicy(access.record) };
  if (policy.data.version !== body.policyVersion)
    throw new PlatformError(
      409,
      "POLICY_REVIEW_REQUIRED",
      "Le condizioni della proposta sono cambiate. Aggiorna la pagina e rileggile prima di accettare.",
    );
  const selected = (access.quote.pacchettiGenerati as QuotePackage[]).find(
    (p) => p.tier === body.tier,
  );
  if (!selected) throw new PlatformError(422, "INVALID_PACKAGE", "Seleziona un pacchetto valido.");
  await getDb().transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(quoteRecords)
      .where(eq(quoteRecords.quoteId, id))
      .for("update");
    if (!record || record.version !== body.version)
      throw new PlatformError(
        409,
        "STALE_QUOTE",
        "La proposta è cambiata. Aggiorna prima di accettare.",
      );
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) throw new PlatformError(409, "QUOTE_EXPIRED", "La proposta è scaduta. Chiedi al team una nuova versione.");
    if (record.acceptedAt && record.selectedTier !== body.tier)
      throw new PlatformError(
        409,
        "ALREADY_ACCEPTED",
        "La proposta è già stata accettata con un altro pacchetto.",
      );
    if (record.acceptedAt) return;
    const [acceptedOwnership] = await tx.select().from(leadOwnership).where(eq(leadOwnership.leadId, access.quote.leadId));
    await tx
      .update(quoteRecords)
      .set({
        acceptedSellerId: acceptedOwnership?.assignedTo ?? null,
        acceptedAt: new Date(),
        acceptedBy: actor.id,
        selectedTier: body.tier,
        termsVersion: policy.data.termsVersion,
        commercialState: "accepted",
      })
      .where(eq(quoteRecords.quoteId, id));
    await recordFunnel(tx, "quote_accepted", id, { tier: body.tier });
    await tx
      .update(quotes)
      .set({
        pacchettoScelto: body.tier,
        prezzoTotale: selected.total,
        acconto: selected.deposit,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id));
    const existing = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.quoteId, id))
      .limit(1);
    if (!existing.length)
      await tx
        .insert(projects)
        .values({
          authorId: actor.id,
          title: `Il libro di ${actor.name}`,
          type: (access.quote.input as { projectType: string }).projectType,
          quoteId: id,
          stage: "materials",
        });
    // Chi segue la vendita e il team: l'accettazione precede il pagamento.
    const importo = `€ ${selected.total.toLocaleString("it-IT")}`;
    const seller = acceptedOwnership?.assignedTo ?? null;
    if (seller && seller !== actor.id) {
      await tx.insert(notifications).values({
        userId: seller,
        title: "Proposta accettata",
        body: `${actor.name} ha accettato ${selected.name} (${importo}, IVA esclusa). In attesa dell'acconto.`,
        href: `/spazio?preventivo=${id}`,
      });
      const [person] = await tx.select({ email: user.email }).from(user).where(eq(user.id, seller));
      if (person)
        await tx.insert(emailOutbox).values({
          eventKey: `quote:${id}:accepted:seller`,
          recipient: person.email,
          subject: "Proposta accettata · Proemios",
          html: await protectMailHtml(impaginaEmail("Proposta accettata", `<p>${esc(actor.name)} ha accettato ${esc(selected.name)} (${esc(importo)}, IVA esclusa). Il pagamento dell'acconto arriverà con una notifica separata.</p><p><a href="${esc(appOrigin())}/spazio?preventivo=${esc(id)}">Apri la proposta</a></p>`)),
        }).onConflictDoNothing();
    }
    await tx.insert(emailOutbox).values({
      eventKey: `quote:${id}:accepted:team`,
      recipient: destinatarioInterno(),
      subject: `Proposta accettata · ${importo} · Proemios`,
      html: await protectMailHtml(impaginaEmail("Proposta accettata", `<p>${esc(actor.name)} (${esc(actor.email)}) ha accettato ${esc(selected.name)} per ${esc(importo)}, IVA esclusa. In attesa dell'acconto.</p><p><a href="${esc(appOrigin())}/spazio?preventivo=${esc(id)}">Apri nello spazio del team</a></p>`)),
    }).onConflictDoNothing();
  });
  await audit(actor, "quote.accepted", "quote", id, { version: body.version, tier: body.tier });
}
/** L'autore chiede la proposta definitiva: la stima passa in valutazione al team. */
export async function quoteReview(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.read");
  const [ownership] = await getDb().select().from(leadOwnership).where(eq(leadOwnership.leadId, access.quote.leadId));
  if (ownership?.authorId !== actor.id) throw forbidden();
  const body = await readBody(request, z.object({ note: z.string().trim().max(3000).optional() }).strict());
  const expiredOffer = access.record.commercialState === "offer" && access.record.expiresAt !== null && access.record.expiresAt.getTime() <= Date.now();
  if (access.record.commercialState !== "estimate" && !expiredOffer)
    throw new PlatformError(409, "REVIEW_NOT_NEEDED", access.record.commercialState === "review" ? "La richiesta è già in valutazione." : "Questa proposta è già definitiva.");
  await limitRequest("quote-review", actor.id, 10, 3600);
  await getDb().transaction(async (tx) => {
    await tx.update(quoteRecords).set({ commercialState: "review", reviewRequestedAt: new Date(), reviewNote: body.note ?? null }).where(eq(quoteRecords.quoteId, id));
    const seller = ownership?.assignedTo ?? null;
    const summary = `${actor.name} chiede la proposta definitiva per ${access.quote.id.slice(0, 8)}${body.note ? `: "${body.note}"` : "."}`;
    if (seller && seller !== actor.id) {
      await tx.insert(notifications).values({ userId: seller, title: "Richiesta di proposta definitiva", body: summary, href: `/spazio?preventivo=${id}` });
      const [person] = await tx.select({ email: user.email }).from(user).where(eq(user.id, seller));
      if (person) await tx.insert(emailOutbox).values({ eventKey: `quote:${id}:review:seller`, recipient: person.email, subject: "Richiesta di proposta definitiva · Proemios", html: await protectMailHtml(impaginaEmail("Proposta da definire", `<p>${esc(summary)}</p><p><a href="${esc(appOrigin())}/spazio?preventivo=${esc(id)}">Apri la proposta</a></p>`)) }).onConflictDoNothing();
    }
    await tx.insert(emailOutbox).values({ eventKey: `quote:${id}:review:team`, recipient: destinatarioInterno(), subject: "Richiesta di proposta definitiva · Proemios", html: await protectMailHtml(impaginaEmail("Proposta da definire", `<p>${esc(summary)}</p><p>${esc(actor.email)}</p><p><a href="${esc(appOrigin())}/spazio?preventivo=${esc(id)}">Apri nello spazio del team</a></p>`)) }).onConflictDoNothing();
    await tx.insert(notifications).values({ userId: actor.id, title: "Richiesta ricevuta", body: "Il team valuta il progetto e ti manda la proposta definitiva. Nel frattempo non devi fare nulla.", href: `/area-autore/conferma/${id}` });
    await recordFunnel(tx, "review_requested", id);
  });
  await audit(actor, "quote.review_requested", "quote", id);
  return json({ ok: true, commercialState: "review" });
}
/** Il team rende la proposta acquistabile: prezzo e condizioni definitivi, con eventuale scadenza. */
export async function quoteOffer(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.write");
  const body = await readBody(request, z.object({ expiresAt: z.string().datetime().optional(), validityDays: z.number().int().min(1).max(365).optional(), message: z.string().trim().max(2000).optional() }).strict());
  if (access.record.acceptedAt) throw new PlatformError(409, "ACCEPTED_QUOTE", "La proposta è già stata accettata.");
  const rule = await resolvePurchaseRule();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + (body.validityDays ?? rule.validityDays) * 86400_000);
  const [ownership] = await getDb().select().from(leadOwnership).where(eq(leadOwnership.leadId, access.quote.leadId));
  await getDb().transaction(async (tx) => {
    await tx.update(quoteRecords).set({ commercialState: "offer", offeredAt: new Date(), offeredBy: actor.id, salesAssisted: true, expiresAt }).where(eq(quoteRecords.quoteId, id));
    if (ownership?.authorId) {
      await tx.insert(notifications).values({ userId: ownership.authorId, title: "La tua proposta definitiva è pronta", body: `Prezzo e condizioni sono confermati${body.message ? `: ${body.message}` : "."} Puoi confermare dalla tua area.`, href: `/area-autore/conferma/${id}` });
      await tx.insert(emailOutbox).values({
        eventKey: `quote:${id}:offer:${access.record.version}`,
        recipient: access.lead.email,
        subject: "La tua proposta definitiva · Proemios",
        html: await protectMailHtml(impaginaEmail("La proposta è pronta", `<p>Ciao ${esc(access.lead.nome)}, il team ha verificato il progetto: la proposta è definitiva${expiresAt ? ` e vale fino al ${expiresAt.toLocaleDateString("it-IT")}` : ""}.</p>${body.message ? `<p>${esc(body.message)}</p>` : ""}<p><a href="${esc(appOrigin())}/area-autore/conferma/${esc(id)}">Leggi e conferma la proposta</a></p>`)),
      }).onConflictDoNothing();
    }
    await recordFunnel(tx, "offer_made", id, { by: actor.id });
  });
  await audit(actor, "quote.offered", "quote", id, { expiresAt: expiresAt.toISOString() });
  // Senza account collegato, la proposta viaggia con il collegamento personale.
  if (!ownership?.authorId && mailConfigured()) return quoteSend(new Request(request.url, { method: "POST", headers: request.headers }), actor, id);
  return json({ ok: true, commercialState: "offer", expiresAt });
}
/** Il responsabile sospende o riattiva i promemoria automatici di una proposta. */
export async function quoteReminders(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  await quoteAccess(actor, id, "quote.write");
  const body = await readBody(request, z.object({ paused: z.boolean() }).strict());
  await getDb().update(quoteRecords).set({ remindersPausedAt: body.paused ? new Date() : null }).where(eq(quoteRecords.quoteId, id));
  await audit(actor, body.paused ? "quote.reminders_paused" : "quote.reminders_resumed", "quote", id);
  return json({ ok: true, paused: body.paused });
}
export async function quoteSend(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.send");
  if (!mailConfigured())
    throw new PlatformError(
      503,
      "MAIL_UNAVAILABLE",
      "L'invio delle proposte non è disponibile al momento.",
    );
  await limitRequest("quote-send", actor.id, 20, 3600);
  const token = randomBytes(32).toString("base64url");
  await getDb()
    .insert(quoteClaims)
    .values({
      quoteId: id,
      email: access.lead.email.toLowerCase(),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
  const link = `${appOrigin()}/collega-preventivo?token=${token}`;
  await enqueueMail(`quote-send:${id}:${access.record.version}:${hashToken(token)}`, {
    to: access.lead.email,
    subject: "La tua proposta Proemios",
    html: impaginaEmail(
      "Il tuo percorso editoriale",
      `<p>Ciao ${esc(access.lead.nome)}, la tua proposta è pronta.</p><p><a href="${esc(link)}">Apri la proposta nel tuo account</a></p><p>Accedi o crea un account con questo indirizzo verificato. Il collegamento scade tra 48 ore.</p>`,
    ),
  });
  await getDb()
    .update(quotes)
    .set({ stato: "sent", updatedAt: new Date() })
    .where(eq(quotes.id, id));
  // Inviare una proposta è un atto commerciale: diventa acquistabile e l'intervento resta tracciato.
  if (!access.record.acceptedAt)
    await getDb()
      .update(quoteRecords)
      .set({ salesAssisted: true, commercialState: "offer", offeredAt: access.record.offeredAt ?? new Date(), offeredBy: access.record.offeredBy ?? actor.id })
      .where(eq(quoteRecords.quoteId, id));
  await audit(actor, "quote.sent", "quote", id);
  return json({ ok: true, emailStatus: "queued" });
}
export async function quoteClaim(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  await limitRequest("quote-claim", actor.id, 10, 3600);
  const body = await readBody(request, z.object({ token: z.string().min(30).max(200) }).strict());
  let quoteId: string;
  await getDb().transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(quoteClaims)
      .where(eq(quoteClaims.tokenHash, hashToken(body.token)))
      .for("update");
    if (
      !claim ||
      claim.usedAt ||
      claim.expiresAt.getTime() < Date.now() ||
      claim.email.toLowerCase() !== actor.email.toLowerCase()
    )
      throw new PlatformError(
        403,
        "INVALID_CLAIM",
        "Il collegamento è scaduto o non corrisponde al tuo indirizzo verificato.",
      );
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, claim.quoteId));
    if (!quote) throw notFound();
    const [owner] = await tx
      .select()
      .from(leadOwnership)
      .where(eq(leadOwnership.leadId, quote.leadId))
      .for("update");
    if (owner?.authorId && owner.authorId !== actor.id) throw forbidden();
    await tx
      .insert(leadOwnership)
      .values({ leadId: quote.leadId, authorId: actor.id })
      .onConflictDoUpdate({
        target: leadOwnership.leadId,
        set: { authorId: actor.id, updatedAt: new Date() },
      });
    await tx.update(quoteClaims).set({ usedAt: new Date() }).where(eq(quoteClaims.id, claim.id));
    quoteId = quote.id;
  });
  await audit(actor, "quote.claimed", "quote", quoteId!);
  return json({ quoteId: quoteId! });
}
export async function crmExport(actor: Actor) {
  demand(actor, "export");
  demandAvailable(actor, "crm.read");
  const rows = await getDb()
    .select({
      nome: leads.nome,
      email: leads.email,
      telefono: leads.telefono,
      stage: leads.stage,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
    .where(leadPredicate(actor, "crm.read"))
    .limit(1000);
  const csv = [
    "nome,email,telefono,stato,creato",
    ...rows.map((r) =>
      [r.nome, r.email, r.telefono, r.stage, r.createdAt.toISOString()].map(csvCell).join(","),
    ),
  ].join("\r\n");
  await audit(actor, "crm.exported", "lead", undefined, { rows: rows.length });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": "attachment; filename=contatti-proemios.csv",
      "Cache-Control": "private, no-store",
    },
  });
}
