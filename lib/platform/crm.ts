import { and, desc, eq, ilike, or } from "drizzle-orm";
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
} from "./config";
import { impaginaEmail, esc } from "@/lib/email";
import { enqueueMail } from "./mail";

export async function getSetting(key: string) {
  const [row] = await getDb()
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return row?.value;
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
  const tax = paymentPolicySchema.safeParse(await getSetting("payment-policy")),
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
        taxPolicy: tax.success ? tax.data : null,
        commissionPolicy: commissions.success ? commissions.data : null,
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
  const rows = await getDb()
    .select({ quote: quotes, record: quoteRecords, name: leads.nome })
    .from(quotes)
    .innerJoin(leads, eq(leads.id, quotes.leadId))
    .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
    .leftJoin(quoteRecords, eq(quoteRecords.quoteId, quotes.id))
    .where(leadPredicate(actor, "quote.read"))
    .orderBy(desc(quotes.createdAt))
    .limit(100);
  return json({
    quotes: rows.map((r) => ({
      ...r.quote,
      version: r.record?.version ?? 1,
      acceptedAt: r.record?.acceptedAt ?? null,
      name: r.name,
    })),
  });
}
export async function quoteDetail(request: Request, actor: Actor, id: string) {
  if (request.method === "PATCH") {
    const access = await quoteAccess(actor, id, "quote.write");
    const body = await readBody(request, z.object({ input: pricingInputSchema, version: z.number().int().positive(), expiresAt: z.string().datetime().optional() }).strict());
    const result = computeQuote(body.input), recommended = result.packages.find(p => p.recommended)!;
    const tax = paymentPolicySchema.safeParse(await getSetting("payment-policy"));
    const rule = commissionRuleSchema.safeParse(await getSetting("commission-rule"));
    await getDb().transaction(async tx => {
      const [current] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, id)).for("update");
      if (!current || current.version !== body.version) throw new PlatformError(409, "STALE_QUOTE", "La proposta è cambiata. Aggiorna la pagina.");
      if (current.acceptedAt) throw new PlatformError(409, "ACCEPTED_QUOTE", "Una proposta accettata richiede un nuovo accordo, non una sovrascrittura.");
      await tx.insert(quoteVersions).values({ quoteId: id, version: current.version, snapshot: { quote: access.quote, record: current }, createdBy: actor.id }).onConflictDoNothing();
      await tx.update(quotes).set({ input: body.input, pacchettiGenerati: result.packages, prezzoTotale: recommended.total, acconto: recommended.deposit, stato: "draft", updatedAt: new Date() }).where(eq(quotes.id, id));
      await tx.update(quoteRecords).set({ version: current.version + 1, pricingVersion, expiresAt: body.expiresAt ? new Date(body.expiresAt) : current.expiresAt, taxPolicy: tax.success ? tax.data : null, commissionPolicy: rule.success ? rule.data : null }).where(eq(quoteRecords.quoteId, id));
    });
    await audit(actor, "quote.revised", "quote", id, { version: body.version + 1 });
    return json({ ok: true });
  }
  if (request.method !== "GET") throw notFound();
  const access = await quoteAccess(actor, id);
  const policy = paymentPolicySchema.safeParse(access.record.taxPolicy);
  return json({
    quote: access.quote,
    record: {
      version: access.record.version,
      pricingVersion: access.record.pricingVersion,
      acceptedAt: access.record.acceptedAt,
      selectedTier: access.record.selectedTier,
      termsVersion: access.record.termsVersion,
    },
    packages: (access.quote.pacchettiGenerati as QuotePackage[]).map((p) => ({
      ...p,
      money: policy.success ? moneyBreakdown(p.total, policy.data) : null,
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
export async function quoteAccept(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.accept");
  const [ownership] = await getDb()
    .select()
    .from(leadOwnership)
    .where(eq(leadOwnership.leadId, access.quote.leadId));
  if (ownership?.authorId !== actor.id) throw forbidden();
  const body = await readBody(
    request,
    z
      .object({
        tier: z.enum(["essenziale", "consigliato", "signature"]),
        version: z.number().int().positive(),
        policyVersion: z.string().min(1),
        termsAccepted: z.literal(true),
      })
      .strict(),
  );
  const policy = paymentPolicySchema.safeParse(access.record.taxPolicy);
  if (!policy.success || policy.data.version !== body.policyVersion)
    throw new PlatformError(
      409,
      "POLICY_REVIEW_REQUIRED",
      "Il team deve confermare le condizioni della proposta.",
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
      })
      .where(eq(quoteRecords.quoteId, id));
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
  });
  await audit(actor, "quote.accepted", "quote", id, { version: body.version, tier: body.tier });
  return json({ ok: true });
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
