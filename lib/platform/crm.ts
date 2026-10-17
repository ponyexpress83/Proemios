import { linkLeadsToAuthor } from "./lead-linking";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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
  quoteVersions,
  notifications,
  emailOutbox,
  tasks,
} from "@/db/platform-schema";
import { leadAccess, leadPredicate, demandAvailable, demand, audit, type Actor } from "./access";
import { readBody, json, notFound, forbidden, PlatformError, hashToken, csvCell, afterResponse } from "./http";
import { syncBrevoContact } from "./brevo";
import { limitRequest } from "./rate-limit";
import { computeQuote, type QuotePackage } from "@/lib/pricing";
import { DEPOSIT_RATE } from "@/config/pricing";
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
import { paymentOrders, affiliateConversions, contracts, leadActivities } from "@/db/platform-schema";
import { pipelineState, normalizeStage, manualTransitionAllowed, PIPELINE_STATES, MANUAL_STATES, PAID_STATUSES, type PipelineState } from "./pipeline";
import { can } from "./permissions";
import { acceptanceEvidence, buildOrderSheet, createContract, customerForSheet, termsSnapshot } from "./contracts";
import { attachLead, emitEvent } from "./crm-relations";
import { snapshotAttribution } from "./crm-attribution";
import { markFirstResponse, routeLead, setOwner } from "./crm-routing";
import { crmDeals } from "@/db/crm-schema";

type Db = Pick<ReturnType<typeof getDb>, "select">;
export async function getSetting(key: string, db: Db = getDb()) {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return row?.value;
}
/**
 * Applica uno sconto commerciale ai pacchetti calcolati dal listino: voce
 * esplicita e negativa, totale e acconto ricalcolati con la stessa regola
 * (DEPOSIT_RATE). Non tocca mai il listino.
 */
export function applyDiscount(packages: QuotePackage[], discountBps: number): QuotePackage[] {
  if (!discountBps) return packages;
  return packages.map((p) => {
    const base = p.lineItems.filter((li) => li.key !== "negotiatedDiscount").reduce((n, li) => n + li.amount, 0);
    const discount = Math.round((Math.max(p.total, base) * discountBps) / 10000);
    const total = Math.max(0, p.total - discount);
    return { ...p, lineItems: [...p.lineItems.filter((li) => li.key !== "negotiatedDiscount"), { key: "negotiatedDiscount", label: `Sconto commerciale ${discountBps / 100}%`, amount: -discount }], total, deposit: Math.round(total * DEPOSIT_RATE) };
  });
}
/** La policy approvata dall'owner, oppure quella predefinita. */
export async function resolvePaymentPolicy(): Promise<PaymentPolicy> {
  const saved = paymentPolicySchema.safeParse(await getSetting("payment-policy"));
  return saved.success ? saved.data : defaultPaymentPolicy;
}
/** La regola di acquistabilità approvata dall'owner, oppure quella predefinita (prudente). */
export async function resolvePurchaseRule(db: Db = getDb()): Promise<PurchaseRule> {
  const saved = purchaseRuleSchema.safeParse(await getSetting("purchase-rule", db));
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
const leadSourceSchema = z.enum(["contatto", "marketplace", "import"]);
const contactPreferencesSchema = z.object({ email: z.boolean(), phone: z.boolean(), whatsapp: z.boolean(), sms: z.boolean(), note: z.string().trim().max(300).nullable().optional() }).strict();
/** Fatti di ogni contatto (ultima proposta, ordini) per derivare lo stato della pipeline. */
async function leadFacts(ids: string[]) {
  if (!ids.length) return { quotes: [] as Array<{ quote: typeof quotes.$inferSelect; record: typeof quoteRecords.$inferSelect | null }>, orders: [] as Array<typeof paymentOrders.$inferSelect> };
  const quoteRows = await getDb().select({ quote: quotes, record: quoteRecords }).from(quotes).leftJoin(quoteRecords, eq(quoteRecords.quoteId, quotes.id)).where(inArray(quotes.leadId, ids)).orderBy(desc(quotes.createdAt));
  const quoteIds = quoteRows.map((r) => r.quote.id);
  const orders = quoteIds.length ? await getDb().select().from(paymentOrders).where(inArray(paymentOrders.quoteId, quoteIds)) : [];
  return { quotes: quoteRows, orders };
}
export function leadPipeline(lead: typeof leads.$inferSelect, facts: Awaited<ReturnType<typeof leadFacts>>): { pipeline: PipelineState; quoteId: string | null } {
  const own = facts.quotes.filter((r) => r.quote.leadId === lead.id);
  // Un acquisto concluso su qualsiasi proposta vale per il contatto; altrimenti conta l'ultima proposta.
  const won = own.find((r) => facts.orders.some((o) => o.quoteId === r.quote.id && PAID_STATUSES.includes(o.status)));
  const latest = won ?? own[0];
  const orders = latest ? facts.orders.filter((o) => o.quoteId === latest.quote.id) : [];
  return { pipeline: pipelineState({ stage: lead.stage, quote: latest?.quote ?? null, record: latest?.record ?? null, orders }), quoteId: latest?.quote.id ?? null };
}
export async function leadCollection(request: Request, actor: Actor) {
  demandAvailable(actor, request.method === "POST" ? "crm.write" : "crm.read");
  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const search = params.get("q")?.slice(0, 100), source = params.get("fonte")?.slice(0, 40), wanted = params.get("stato")?.slice(0, 40);
    const rows = await getDb()
      .select({ lead: leads, owner: leadOwnership, ownerName: user.name })
      .from(leads)
      .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
      .leftJoin(user, eq(user.id, leadOwnership.assignedTo))
      .where(
        and(
          leadPredicate(actor, "crm.read"),
          search
            ? or(ilike(leads.nome, `%${search}%`), ilike(leads.email, `%${search}%`))
            : undefined,
          source ? eq(leads.fonte, source as typeof leads.$inferSelect.fonte) : undefined,
        ),
      )
      .orderBy(desc(leads.createdAt))
      .limit(150);
    const facts = await leadFacts(rows.map((r) => r.lead.id));
    const list = rows.map((r) => ({ ...r.lead, assignedTo: r.owner?.assignedTo ?? null, assignedName: r.ownerName ?? null, authorId: r.owner?.authorId ?? null, ...leadPipeline(r.lead, facts) }));
    return json({ leads: wanted ? list.filter((l) => l.pipeline === wanted) : list, states: PIPELINE_STATES });
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
        /** Il contatto ha accettato di essere contattato per questa richiesta (es. risposta a un'offerta sul marketplace). */
        fonte: leadSourceSchema.default("contatto"),
        sourceDetail: z.string().trim().max(200).optional(),
        externalRef: z.string().trim().max(200).optional(),
        contactPreferences: contactPreferencesSchema.optional(),
      })
      .strict(),
  );
  if (body.fonte !== "contatto") demand(actor, "crm.import");
  const email = body.email.toLowerCase();
  const lead = await getDb().transaction(async (tx) => {
    // Mai due contatti per la stessa email o lo stesso riferimento esterno: si apre quello esistente.
    const [duplicate] = await tx.select({ id: leads.id }).from(leads).where(or(eq(leads.email, email), body.externalRef ? eq(leads.externalRef, body.externalRef) : sql`false`)).limit(1);
    if (duplicate) throw new PlatformError(409, "DUPLICATE_LEAD", "Esiste già un contatto con questa email o questo riferimento.", { leadId: duplicate.id });
    const [saved] = await tx
      .insert(leads)
      .values({
        nome: body.nome,
        telefono: body.telefono,
        note: body.note,
        consensoPrivacy: body.consensoPrivacy,
        email,
        fonte: body.fonte,
        sourceDetail: body.sourceDetail ?? null,
        externalRef: body.externalRef ?? null,
        contactPreferences: body.contactPreferences ?? null,
        consensoMarketing: false,
      })
      .returning();
    await tx.update(leads).set({ sourceKind: body.fonte === "marketplace" ? "marketplace" : actor.roles.includes("seller") ? "seller" : "manual", sourcedBy: actor.id, firstResponseAt: new Date() }).where(eq(leads.id, saved!.id));
    const linked = await attachLead(tx, saved!.id, { createdBy: actor.id });
    await setOwner(tx, { leadId: saved!.id, dealId: linked.deal.id, to: actor.id, method: "manual", reason: "seller_sourced", actorId: actor.id });
    await tx.insert(leadActivities).values({ leadId: saved!.id, actorId: actor.id, kind: "created", channel: body.fonte, body: body.sourceDetail ? `Inserito da ${body.sourceDetail}` : "Inserito dal team", direction: "inbound" });
    return saved!;
  });
  await audit(actor, "lead.created", "lead", lead.id, { fonte: body.fonte });
  return json({ lead }, 201);
}
/**
 * Importazione autorizzata (CSV o righe JSON) di contatti da marketplace o
 * altre liste: nessuno scraping, nessun messaggio inviato dall'import. Ogni
 * riga dichiara l'origine; email e riferimento esterno evitano i doppioni.
 */
export async function leadImport(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "crm.import");
  await limitRequest("lead-import", actor.id, 10, 3600);
  const rowSchema = z.object({ nome: z.string().trim().min(2).max(200), email: z.string().trim().email().max(320), telefono: z.string().trim().max(40).optional(), note: z.string().trim().max(5000).optional(), externalRef: z.string().trim().max(200).optional(), consensoPrivacy: z.coerce.boolean().default(false) });
  let payload: { fonte: "marketplace" | "import"; sourceDetail: string; rows: unknown[]; assign?: "none" | "rules" };
  if ((request.headers.get("content-type") ?? "").includes("text/csv")) {
    const url = new URL(request.url);
    const text = (await request.text()).slice(0, 2_000_000);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = (lines.shift() ?? "").split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const rows = lines.map((line) => {
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
      return Object.fromEntries(header.map((h, i) => [{ name: "nome", nome: "nome", email: "email", telefono: "telefono", phone: "telefono", note: "note", ref: "externalRef", externalref: "externalRef", external_ref: "externalRef", consenso: "consensoPrivacy", consensoprivacy: "consensoPrivacy", consenso_privacy: "consensoPrivacy" }[h] ?? h, cells[i] ?? ""]));
    });
    payload = { fonte: url.searchParams.get("fonte") === "marketplace" ? "marketplace" : "import", sourceDetail: (url.searchParams.get("origine") ?? "file CSV").slice(0, 200), rows, assign: url.searchParams.get("assegna") === "regole" ? "rules" : "none" };
  } else {
    payload = await readBody(request, z.object({ fonte: z.enum(["marketplace", "import"]), sourceDetail: z.string().trim().min(2).max(200), rows: z.array(z.unknown()).min(1).max(500), assign: z.enum(["none", "rules"]).default("none") }).strict());
  }
  const result = { imported: 0, duplicates: 0, invalid: 0, leadIds: [] as string[] };
  for (const raw of payload.rows.slice(0, 500)) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) { result.invalid++; continue; }
    const row = parsed.data, email = row.email.toLowerCase();
    const outcome = await getDb().transaction(async (tx) => {
      const [duplicate] = await tx.select({ id: leads.id }).from(leads).where(or(eq(leads.email, email), row.externalRef ? eq(leads.externalRef, row.externalRef) : sql`false`)).limit(1);
      if (duplicate) {
        await tx.insert(leadActivities).values({ leadId: duplicate.id, actorId: actor.id, kind: "import", channel: payload.fonte, body: `Riga importata da ${payload.sourceDetail} ignorata: contatto già presente.`, outcome: "duplicate" });
        return "duplicate" as const;
      }
      const [saved] = await tx.insert(leads).values({ nome: row.nome, email, telefono: row.telefono ?? null, note: row.note ?? null, fonte: payload.fonte, sourceDetail: payload.sourceDetail, externalRef: row.externalRef ?? null, consensoPrivacy: row.consensoPrivacy, consensoMarketing: false }).returning({ id: leads.id });
      await tx.insert(leadActivities).values({ leadId: saved!.id, actorId: actor.id, kind: "import", channel: payload.fonte, direction: "inbound", body: `Importato da ${payload.sourceDetail}${row.externalRef ? ` (rif. ${row.externalRef})` : ""}.`, outcome: row.consensoPrivacy ? "contactable" : "no-consent" });
      await tx.update(leads).set({ sourceKind: payload.fonte === "marketplace" ? "marketplace" : "manual" }).where(eq(leads.id, saved!.id));
      // Contatto e trattativa sempre collegati; l'assegnazione segue le regole solo se richiesto, senza email per riga.
      if (payload.assign === "rules") await routeLead(tx, saved!.id, { actorId: actor.id, notifyAssignee: false });
      else {
        await attachLead(tx, saved!.id, { createdBy: actor.id });
        await tx.update(leads).set({ assignmentStatus: "manual" }).where(eq(leads.id, saved!.id));
      }
      result.leadIds.push(saved!.id);
      return "imported" as const;
    });
    if (outcome === "duplicate") result.duplicates++; else result.imported++;
  }
  await audit(actor, "lead.imported", "lead", undefined, { ...result, leadIds: undefined, fonte: payload.fonte, sourceDetail: payload.sourceDetail });
  return json(result, 201);
}
/** Attività manuale del venditore (telefonata, WhatsApp, SMS, incontro, email) o risposta ricevuta: niente viene inviato da qui. */
export async function leadActivity(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  await leadAccess(actor, id, "crm.write");
  const body = await readBody(request, z.object({
    kind: z.enum(["call", "whatsapp", "sms", "email", "meeting", "other"]),
    direction: z.enum(["outbound", "inbound"]).default("outbound"),
    body: z.string().trim().min(1).max(5000),
    outcome: z.enum(["reached", "no-answer", "callback", "replied", "declined", "other"]).default("other"),
    nextAction: z.string().trim().max(300).optional(),
    nextActionAt: z.string().datetime().optional(),
    /** Telefonata strutturata: sintesi, decisioni e prossimi passi (base per il passaggio alla produzione). */
    structured: z.object({ summary: z.string().trim().max(2000).optional(), decisions: z.array(z.string().trim().min(1).max(500)).max(20).optional(), nextSteps: z.array(z.string().trim().min(1).max(500)).max(20).optional() }).strict().optional(),
  }).strict());
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, id));
  if (!lead) throw notFound();
  const prefs = lead.contactPreferences;
  if (body.direction === "outbound" && prefs && ((body.kind === "whatsapp" && !prefs.whatsapp) || (body.kind === "sms" && !prefs.sms) || (body.kind === "call" && !prefs.phone)))
    throw new PlatformError(409, "CHANNEL_NOT_ALLOWED", "La persona non ha autorizzato questo canale: usa un canale ammesso o aggiorna le preferenze con il suo consenso.");
  const [activity] = await getDb().insert(leadActivities).values({ leadId: id, dealId: lead.dealId, actorId: actor.id, kind: body.kind, channel: body.kind, direction: body.direction, body: body.body, outcome: body.outcome, structured: body.structured ?? null }).returning();
  if (body.direction === "outbound") await markFirstResponse(getDb(), id, actor.id);
  if (lead.dealId) await getDb().update(crmDeals).set({ lastActivityAt: new Date(), ...(body.nextAction ? { nextAction: body.nextAction } : {}), ...(body.nextActionAt ? { nextActionAt: new Date(body.nextActionAt) } : {}) }).where(eq(crmDeals.id, lead.dealId));
  await getDb().update(leads).set({ lastContactAt: new Date(), ...(body.nextAction !== undefined ? { nextAction: body.nextAction || null } : {}), ...(body.nextActionAt !== undefined ? { nextActionAt: new Date(body.nextActionAt) } : {}), updatedAt: new Date() }).where(eq(leads.id, id));
  await audit(actor, "lead.activity", "lead", id, { kind: body.kind, direction: body.direction });
  return json({ activity }, 201);
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
        visibility: leadNotes.visibility,
        name: user.name,
        createdAt: leadNotes.createdAt,
      })
      .from(leadNotes)
      .innerJoin(user, eq(user.id, leadNotes.authorId))
      // Le note private restano di chi le ha scritte, anche per chi ha accesso a tutta l'organizzazione.
      .where(and(eq(leadNotes.leadId, id), or(eq(leadNotes.visibility, "team"), eq(leadNotes.authorId, actor.id))))
      .orderBy(desc(leadNotes.createdAt));
    const facts = await leadFacts([id]);
    const savedQuotes = facts.quotes.map((r) => ({ id: r.quote.id, createdAt: r.quote.createdAt, stato: r.quote.stato, prezzoTotale: r.quote.prezzoTotale, commercialState: r.record?.commercialState ?? null, acceptedAt: r.record?.acceptedAt ?? null, journey: r.record ? journeyStage(r.record, facts.orders.filter((o) => o.quoteId === r.quote.id)) : null }));
    const activities = await getDb().select({ id: leadActivities.id, kind: leadActivities.kind, channel: leadActivities.channel, direction: leadActivities.direction, purpose: leadActivities.purpose, body: leadActivities.body, outcome: leadActivities.outcome, createdAt: leadActivities.createdAt, name: user.name }).from(leadActivities).leftJoin(user, eq(user.id, leadActivities.actorId)).where(eq(leadActivities.leadId, id)).orderBy(desc(leadActivities.createdAt)).limit(200);
    const [ownership] = await getDb().select({ assignedTo: leadOwnership.assignedTo, authorId: leadOwnership.authorId, name: user.name }).from(leadOwnership).leftJoin(user, eq(user.id, leadOwnership.assignedTo)).where(eq(leadOwnership.leadId, id));
    const openTasks = await getDb().select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, done: tasks.done, assignedTo: tasks.assignedTo }).from(tasks).where(and(eq(tasks.leadId, id), eq(tasks.done, false))).orderBy(tasks.dueAt).limit(50);
    const contractRows = facts.quotes.length ? await getDb().select({ id: contracts.id, quoteId: contracts.quoteId, acceptedAt: contracts.acceptedAt, withdrawalRequestedAt: contracts.withdrawalRequestedAt }).from(contracts).where(inArray(contracts.quoteId, facts.quotes.map((r) => r.quote.id))) : [];
    return json({
      lead: { ...lead, ...leadPipeline(lead, facts), stage: normalizeStage(lead.stage) },
      ownership: ownership ? { assignedTo: ownership.assignedTo, assignedName: ownership.name, authorId: ownership.authorId } : null,
      notes, activities, quotes: savedQuotes, tasks: openTasks, contracts: contractRows,
      orders: facts.orders.map((o) => ({ id: o.id, quoteId: o.quoteId, kind: o.kind, sequence: o.sequence, status: o.status, amountCents: o.amountCents, createdAt: o.createdAt })),
      states: PIPELINE_STATES, manualStates: MANUAL_STATES,
    });
  }
  if (request.method !== "PATCH") throw notFound();
  const body = await readBody(
    request,
    z
      .object({
        stage: z.string().min(1).max(40).optional(),
        nome: z.string().trim().min(2).max(200).optional(),
        telefono: z.string().max(40).optional(),
        assignedTo: z.string().min(1).max(100).optional(),
        lostReason: z.string().trim().max(1000).optional(),
        nextAction: z.string().trim().max(300).nullable().optional(),
        nextActionAt: z.string().datetime().nullable().optional(),
        contactPreferences: contactPreferencesSchema.nullable().optional(),
        /** Consenso alle comunicazioni facoltative registrato dal team solo con prova (es. richiesta scritta); false = revoca. */
        marketingConsent: z.boolean().optional(),
        consentEvidence: z.string().trim().max(500).optional(),
      })
      .strict(),
  );
  const facts = await leadFacts([id]);
  const current = leadPipeline(lead, facts).pipeline;
  const next = body.stage !== undefined ? normalizeStage(body.stage) : undefined;
  if (next !== undefined) {
    if (!manualTransitionAllowed(current, next)) throw new PlatformError(409, "INVALID_STATE", next === "won" ? "«Acquisto concluso» lo decide l'incasso verificato, non una modifica manuale." : "Questo stato è derivato dai fatti (proposta, pagamento): non si imposta a mano.");
    if (["lost", "unreachable"].includes(next) && !body.lostReason) throw new PlatformError(422, "MISSING_REASON", "Indica il motivo della chiusura.");
  }
  if (body.assignedTo) {
    demand(actor, "crm.assign");
    const [target] = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, body.assignedTo), eq(user.emailVerified, true)));
    if (!target)
      throw new PlatformError(422, "INVALID_ASSIGNEE", "Seleziona un utente verificato.");
    await getDb().transaction(async (tx) => {
      await tx.update(leads).set({ assignmentStatus: "assigned", reservedBy: null, reservedUntil: null }).where(eq(leads.id, id));
      await setOwner(tx, { leadId: id, dealId: lead.dealId, to: body.assignedTo!, method: "manual", reason: "manual_assignment", actorId: actor.id });
    });
    await getDb().insert(leadActivities).values({ leadId: id, actorId: actor.id, kind: "assignment", body: `Assegnato a ${target.id === actor.id ? "sé stesso" : "un altro responsabile"}.`, outcome: body.assignedTo });
  }
  if (body.marketingConsent !== undefined) {
    if (body.marketingConsent && !body.consentEvidence) throw new PlatformError(422, "CONSENT_EVIDENCE_REQUIRED", "Per registrare un consenso serve la prova (es. data e testo della richiesta scritta).");
    await getDb().update(leads).set(body.marketingConsent ? { consensoMarketing: true, marketingConsentAt: new Date(), marketingRevokedAt: null } : { consensoMarketing: false, marketingRevokedAt: new Date() }).where(eq(leads.id, id));
    await getDb().insert(leadActivities).values({ leadId: id, actorId: actor.id, kind: "consent", purpose: "marketing", body: body.marketingConsent ? `Consenso registrato: ${body.consentEvidence}` : "Consenso alle comunicazioni facoltative revocato.", outcome: body.marketingConsent ? "granted" : "revoked" });
    afterResponse(() => syncBrevoContact(id).catch(() => undefined));
  }
  const closing = next !== undefined && ["lost", "unreachable"].includes(next);
  await getDb()
    .update(leads)
    .set({
      ...(next !== undefined ? { stage: next, closedAt: closing ? new Date() : null, lostReason: closing ? body.lostReason ?? null : lead.lostReason } : {}),
      ...(body.nome ? { nome: body.nome } : {}),
      ...(body.telefono !== undefined ? { telefono: body.telefono } : {}),
      ...(body.nextAction !== undefined ? { nextAction: body.nextAction } : {}),
      ...(body.nextActionAt !== undefined ? { nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null } : {}),
      ...(body.contactPreferences !== undefined ? { contactPreferences: body.contactPreferences } : {}),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));
  if (next !== undefined && lead.dealId)
    await getDb().update(crmDeals).set({ stage: next, closedAt: closing ? new Date() : null, lostNote: closing ? body.lostReason ?? null : null, lastActivityAt: new Date(), updatedAt: new Date() }).where(and(eq(crmDeals.id, lead.dealId), eq(crmDeals.originLeadId, id)));
  if ((body.nextAction !== undefined || body.nextActionAt !== undefined) && lead.dealId)
    await getDb().update(crmDeals).set({ ...(body.nextAction !== undefined ? { nextAction: body.nextAction } : {}), ...(body.nextActionAt !== undefined ? { nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null } : {}) }).where(eq(crmDeals.id, lead.dealId));
  if (next !== undefined && next !== current)
    await getDb().insert(leadActivities).values({ leadId: id, actorId: actor.id, kind: "state", body: `Stato: ${current} → ${next}${closing ? ` · ${body.lostReason}` : ""}`, outcome: next });
  if (body.lostReason && closing)
    await getDb()
      .insert(leadNotes)
      .values({ leadId: id, authorId: actor.id, body: `Motivo chiusura: ${body.lostReason}` });
  await audit(actor, "lead.updated", "lead", id, {
    stage: next,
    assignedTo: body.assignedTo,
    marketingConsent: body.marketingConsent,
  });
  return json({ ok: true, pipeline: next ?? current });
}
export async function leadNote(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  await leadAccess(actor, id, "crm.write");
  const body = await readBody(
    request,
    z.object({ body: z.string().trim().min(1).max(5000), visibility: z.enum(["team", "private"]).default("team") }).strict(),
  );
  const [note] = await getDb()
    .insert(leadNotes)
    .values({ leadId: id, authorId: actor.id, body: body.body, visibility: body.visibility })
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
    const { deal } = await attachLead(tx, id, { createdBy: actor.id });
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
        dealId: deal.id,
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
        balancePaid: r.quote.stato === "won",
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
    const body = await readBody(request, z.object({ input: pricingInputSchema, version: z.number().int().positive(), expiresAt: z.string().datetime().optional(), discountBps: z.number().int().min(0).max(5000).optional(), discountNote: z.string().trim().max(500).optional() }).strict());
    const result = computeQuote(body.input), recommended = result.packages.find(p => p.recommended)!;
    const tax = await resolvePaymentPolicy();
    const rule = commissionRuleSchema.safeParse(await getSetting("commission-rule"));
    // Sconto commerciale: mai dal browser, solo entro le soglie della regola;
    // oltre la soglia del venditore serve chi gestisce le regole economiche.
    const purchase = await resolvePurchaseRule();
    const discountBps = body.discountBps ?? access.record.discountBps ?? 0;
    const exception = discountBps > purchase.maxSellerDiscountBps;
    if (discountBps > purchase.maxDiscountBps) throw new PlatformError(422, "DISCOUNT_TOO_HIGH", `Lo sconto massimo ammesso è ${purchase.maxDiscountBps / 100}%.`);
    if (body.discountBps !== undefined && exception && !can(actor.grants, "settings.manage")) throw new PlatformError(409, "APPROVAL_REQUIRED", `Fino al ${purchase.maxSellerDiscountBps / 100}% decidi tu; oltre serve l'approvazione di chi gestisce le regole economiche. Prima dello sconto valuta rate, servizio a fasi o un pacchetto più essenziale.`);
    const packages = applyDiscount(result.packages, discountBps);
    const chosen = packages.find(p => p.tier === recommended.tier)!;
    await getDb().transaction(async tx => {
      const [current] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, id)).for("update");
      if (!current || current.version !== body.version) throw new PlatformError(409, "STALE_QUOTE", "La proposta è cambiata. Aggiorna la pagina.");
      if (current.acceptedAt) throw new PlatformError(409, "ACCEPTED_QUOTE", "Una proposta accettata richiede un nuovo accordo, non una sovrascrittura.");
      await tx.insert(quoteVersions).values({ quoteId: id, version: current.version, snapshot: { quote: access.quote, record: current }, createdBy: actor.id }).onConflictDoNothing();
      await tx.update(quotes).set({ input: body.input, pacchettiGenerati: packages, prezzoTotale: chosen.total, acconto: chosen.deposit, stato: "draft", updatedAt: new Date() }).where(eq(quotes.id, id));
      await tx.update(quoteRecords).set({ version: current.version + 1, pricingVersion, expiresAt: body.expiresAt ? new Date(body.expiresAt) : current.expiresAt, taxPolicy: tax, commissionPolicy: rule.success ? rule.data : null, salesAssisted: true, ...(body.discountBps !== undefined ? { discountBps, discountBy: discountBps ? actor.id : null, discountNote: body.discountNote ?? null, discountApprovedBy: discountBps && exception ? actor.id : null } : {}) }).where(eq(quoteRecords.quoteId, id));
      if (body.discountBps !== undefined) await tx.insert(leadActivities).values({ leadId: access.quote.leadId, actorId: actor.id, kind: "negotiation", body: `Nuova versione ${current.version + 1} con sconto ${discountBps / 100}%${exception ? " (eccezione approvata)" : ""}${body.discountNote ? ` · ${body.discountNote}` : ""}.`, outcome: String(discountBps) });
    });
    await audit(actor, "quote.revised", "quote", id, { version: body.version + 1, discountBps, exception });
    return json({ ok: true, discountBps, exception });
  }
  if (request.method !== "GET") throw notFound();
  const access = await quoteAccess(actor, id);
  const current = await ensureQuotePolicy(access.record);
  const policy = { success: true as const, data: current };
  const orders = await getDb().select({ kind: paymentOrders.kind, status: paymentOrders.status }).from(paymentOrders).where(eq(paymentOrders.quoteId, id));
  const [contract] = await getDb().select().from(contracts).where(eq(contracts.quoteId, id)).orderBy(desc(contracts.version)).limit(1);
  return json({
    quote: access.quote,
    contract: contract ? { id: contract.id, version: contract.version, termsVersion: contract.termsVersion, acceptedAt: contract.acceptedAt, acceptances: contract.acceptances, consumer: contract.consumer, withdrawalDeadline: contract.withdrawalDeadline, withdrawalRequestedAt: contract.withdrawalRequestedAt, stableCopy: Boolean(contract.storageKey), pdfUrl: `/api/platform/contracts/${contract.id}/pdf` } : null,
    terms: { version: termsSnapshot().version, updated: termsSnapshot().updated, status: termsSnapshot().status },
    attachment: access.record.attachmentName && access.record.attachmentHash ? { name: access.record.attachmentName, hash: access.record.attachmentHash, uploadedAt: access.record.attachmentUploadedAt } : null,
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
      paymentPlan: access.record.paymentPlan ?? null,
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
/**
 * Accettazioni separate, nessuna preselezionata: condizioni generali, scheda
 * d'ordine, avvio anticipato nel periodo di recesso (facoltativo), consenso
 * alle comunicazioni informative (facoltativo e indipendente dal contratto).
 */
export const acceptBodySchema = z
  .object({
    tier: z.enum(["essenziale", "consigliato", "signature"]),
    version: z.number().int().positive(),
    policyVersion: z.string().min(1),
    termsAccepted: z.literal(true),
    orderSheetAccepted: z.literal(true),
    earlyStart: z.boolean().default(false),
    marketingConsent: z.boolean().default(false),
  })
  .strict();
export type AcceptanceEvidence = { ip: string | null; userAgent: string | null };
export async function quoteAccept(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const body = await readBody(request, acceptBodySchema);
  const contract = await acceptQuote(actor, id, body, acceptanceEvidence(request));
  return json({ ok: true, contractId: contract?.id ?? null });
}
/**
 * Accettazione di una proposta acquistabile. Idempotente: ripetere con lo
 * stesso pacchetto non cambia nulla. Solo una proposta in stato "offer" si
 * può accettare: una stima o una richiesta in valutazione no.
 */
export async function acceptQuote(actor: Actor, id: string, body: z.infer<typeof acceptBodySchema>, evidence: AcceptanceEvidence = { ip: null, userAgent: null }) {
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
  const contract = await getDb().transaction(async (tx) => {
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
    if (record.acceptedAt) {
      const [existing] = await tx.select().from(contracts).where(eq(contracts.quoteId, id)).orderBy(desc(contracts.version)).limit(1);
      return existing ?? null;
    }
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
    // Istantanea dell'attribuzione al momento della vendita: i cambi di responsabile successivi non la toccano.
    const attribution = await snapshotAttribution(tx, id, { id: actor.id, email: actor.email });
    await emitEvent(tx, "quote.accepted", id, id, { quoteId: id, dealId: record.dealId, tier: body.tier, version: record.version, attribution: attribution ? { path: attribution.path, status: attribution.status, closing: attribution.closing, ruleVersion: attribution.ruleVersion } : null });
    await tx
      .update(quotes)
      .set({
        pacchettoScelto: body.tier,
        prezzoTotale: selected.total,
        acconto: selected.deposit,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id));
    // Il contratto nasce qui, prima del pagamento: scheda d'ordine + condizioni
    // generali nella versione accettata, con prova proporzionata. Il progetto
    // invece nasce solo con l'acconto verificato (vedi payments.recordPayment).
    const customer = await customerForSheet(tx, actor.id);
    const consumer = customer ? customer.kind !== "business" : true;
    const sheet = buildOrderSheet({ quoteId: id, version: record.version, pricingVersion: record.pricingVersion, policy: policy.data, pkg: selected, quoteInput: access.quote.input as Parameters<typeof buildOrderSheet>[0]["quoteInput"], plan: record.paymentPlan ?? null, customer, email: actor.email, attachment: record.attachmentKey && record.attachmentName && record.attachmentHash && record.attachmentUploadedAt ? { name: record.attachmentName, hash: record.attachmentHash, uploadedAt: record.attachmentUploadedAt.toISOString() } : null });
    const created = await createContract(tx, { quoteId: id, version: record.version, tier: body.tier, actor, sheet, acceptances: { terms: true, orderSheet: true, earlyStart: body.earlyStart, marketing: body.marketingConsent }, consumer, evidence });
    // Il consenso alle comunicazioni facoltative è separato dal contratto: si registra solo se dato.
    if (body.marketingConsent) {
      await tx.update(leads).set({ consensoMarketing: true, marketingConsentAt: new Date(), marketingRevokedAt: null, updatedAt: new Date() }).where(eq(leads.id, access.quote.leadId));
      afterResponse(() => syncBrevoContact(access.quote.leadId).catch(() => undefined));
    }
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
    return created;
  });
  await audit(actor, "quote.accepted", "quote", id, { version: body.version, tier: body.tier, contractId: contract?.id ?? null, earlyStart: body.earlyStart, ip: evidence.ip });
  return contract;
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
  await markFirstResponse(getDb(), access.quote.leadId, actor.id);
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
