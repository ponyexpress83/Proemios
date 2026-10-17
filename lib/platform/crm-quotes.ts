/**
 * Preventivi personalizzati e acquisti assistiti: voci personalizzate e
 * condizioni di lavorazione con approvazione delle eccezioni, link protetti
 * (revocabili, con scadenza, senza dati personali) per vedere la proposta
 * prima dell'account o comprare un pacchetto standard dalla trattativa,
 * richieste di chiarimento o modifica, nuova accettazione dopo modifiche.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { crmApprovals, crmContacts, crmDeals, crmShareLinks } from "@/db/crm-schema";
import { leadActivities, leadOwnership, paymentOrders, quoteRecords, quoteVersions, memberships } from "@/db/platform-schema";
import { pricingInputSchema } from "@/lib/validation";
import { computeQuote, type QuotePackage } from "@/lib/pricing";
import { normalizeEmail } from "@/lib/crm-core/dedup";
import { can, effectiveGrants } from "./permissions";
import { demand, demandAvailable, audit, type Actor } from "./access";
import { json, notFound, PlatformError, readBody, hashToken, checkMutationOrigin } from "./http";
import { appOrigin, commissionRuleSchema, moneyBreakdown, pricingVersion } from "./config";
import { quoteAccess, rebuildPackages, resolvePaymentPolicy, resolvePurchaseRule, ensureQuotePolicy, getSetting } from "./crm";
import { installmentSchedule } from "./schedule";
import { attachLead, readSetting, type Tx } from "./crm-relations";
import { notify } from "./crm-notify";
import { routeLead } from "./crm-routing";
import { limitRequest, requestIdentity } from "./rate-limit";
import { PAID_STATUSES } from "./pipeline";

/** Catalogo dei pacchetti standard: riferimenti al listino, non copie del prodotto. */
const catalogSchema = z.object({
  version: z.string().min(1).max(60),
  items: z.array(z.object({ key: z.string().regex(/^[a-z0-9_-]{2,40}$/), name: z.string().min(2).max(120), input: pricingInputSchema, active: z.boolean().default(true) }).strict()).max(100),
}).strict();
export type Catalog = z.infer<typeof catalogSchema>;
const standard = (service: "cover" | "epub" | "kdp" | "isbn" | "amazonListing", name: string) => ({ key: service, name, active: true, input: { projectType: "romanzo" as const, textState: "finito-revisionato" as const, wordCount: 60000, requestedServices: [service], singleService: service, urgency: "standard" as const } });
export const defaultCatalog: Catalog = { version: "catalogo-2026-10-v1", items: [standard("cover", "Copertina"), standard("epub", "Ebook ePub"), standard("kdp", "Pubblicazione su Amazon KDP"), standard("isbn", "Codice ISBN"), standard("amazonListing", "Scheda prodotto Amazon")] };
export const catalog = () => readSetting<Catalog>("catalog", catalogSchema, defaultCatalog);

type Line = { label: string; amount: number; quantity: number; approvedBy: string | null };
/** Nuova versione della proposta con lo snapshot della precedente, dentro una transazione. */
async function newVersion(tx: Tx, quoteId: string, actorId: string, change: { customLines?: Line[]; workTerms?: typeof quoteRecords.$inferSelect.workTerms; discountBps?: number; discountNote?: string | null; discountApprovedBy?: string | null; paymentPlan?: typeof quoteRecords.$inferSelect.paymentPlan }) {
  const [record] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, quoteId)).for("update");
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!record || !quote) throw notFound();
  if (record.acceptedAt) throw new PlatformError(409, "ACCEPTED_QUOTE", "La proposta è accettata: per cambiarla serve una modifica con nuova accettazione.");
  await tx.insert(quoteVersions).values({ quoteId, version: record.version, snapshot: { quote, record }, createdBy: actorId }).onConflictDoNothing();
  const lines = change.customLines ?? record.customLines ?? [];
  const discountBps = change.discountBps ?? record.discountBps;
  const packages = rebuildPackages(quote.input as Parameters<typeof computeQuote>[0], lines, discountBps);
  const chosen = packages.find((p) => p.recommended) ?? packages[0]!;
  await tx.update(quotes).set({ pacchettiGenerati: packages, prezzoTotale: chosen.total, acconto: chosen.deposit, updatedAt: new Date() }).where(eq(quotes.id, quoteId));
  await tx
    .update(quoteRecords)
    .set({
      version: record.version + 1,
      customLines: lines,
      salesAssisted: true,
      ...(change.workTerms !== undefined ? { workTerms: change.workTerms } : {}),
      ...(change.discountBps !== undefined ? { discountBps, discountBy: discountBps ? actorId : null, discountNote: change.discountNote ?? null, discountApprovedBy: change.discountApprovedBy ?? null } : {}),
      ...(change.paymentPlan !== undefined ? { paymentPlan: change.paymentPlan } : {}),
    })
    .where(eq(quoteRecords.quoteId, quoteId));
  return { version: record.version + 1, record, quote };
}
async function approvers(tx: Tx) {
  const rows = await tx.select().from(memberships).where(eq(memberships.active, true));
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  return [...byUser].filter(([, list]) => can(effectiveGrants(list), "quote.approve")).map(([id]) => id);
}
const MAX_LINE_WITHOUT_APPROVAL = 150;

/** Voce personalizzata: entro la soglia la decide chi scrive la proposta; oltre, o se negativa, serve un'approvazione. */
export async function quoteLines(request: Request, actor: Actor, id: string) {
  const access = await quoteAccess(actor, id, "quote.write");
  if (request.method === "DELETE") {
    const body = await readBody(request, z.object({ index: z.number().int().min(0).max(49) }).strict());
    const lines = [...(access.record.customLines ?? [])];
    if (!lines[body.index]) throw notFound();
    lines.splice(body.index, 1);
    const result = await getDb().transaction((tx) => newVersion(tx, id, actor.id, { customLines: lines }));
    return json({ ok: true, version: result.version });
  }
  if (request.method !== "POST") throw notFound();
  const body = await readBody(request, z.object({ label: z.string().trim().min(3).max(200), amount: z.number().int().min(-5000).max(20000), quantity: z.number().int().min(1).max(100).default(1), note: z.string().trim().max(500).optional() }).strict());
  const approver = can(actor.grants, "quote.approve");
  const needsApproval = !approver && (body.amount < 0 || body.amount * body.quantity > MAX_LINE_WITHOUT_APPROVAL);
  if (needsApproval) {
    const approval = await getDb().transaction(async (tx) => {
      const [row] = await tx.insert(crmApprovals).values({ kind: "custom_line", quoteId: id, dealId: access.record.dealId, requestedBy: actor.id, payload: { label: body.label, amount: body.amount, quantity: body.quantity, note: body.note ?? null } }).returning();
      for (const userId of await approvers(tx)) await notify(tx, userId, "approval_requested", { key: row!.id, title: "Voce personalizzata da approvare", body: `${actor.name}: «${body.label}» € ${body.amount * body.quantity}.`, href: "/spazio?tab=approvals" });
      return row!;
    });
    return json({ ok: false, status: "pending", approvalId: approval.id }, 202);
  }
  const lines = [...(access.record.customLines ?? []), { label: body.label, amount: body.amount, quantity: body.quantity, approvedBy: approver ? actor.id : null }];
  const result = await getDb().transaction((tx) => newVersion(tx, id, actor.id, { customLines: lines }));
  await audit(actor, "quote.line_added", "quote", id, { amount: body.amount, quantity: body.quantity, version: result.version });
  return json({ ok: true, version: result.version }, 201);
}
/** Consegne, revisioni, tempi ed esclusioni: entrano nella scheda d'ordine della versione accettata. */
export async function quoteTerms(request: Request, actor: Actor, id: string) {
  if (request.method !== "PUT") throw notFound();
  await quoteAccess(actor, id, "quote.write");
  const body = await readBody(request, z.object({ deliveries: z.string().trim().min(5).max(2000).optional(), revisions: z.string().trim().min(5).max(2000).optional(), timing: z.string().trim().min(5).max(2000).optional(), exclusions: z.array(z.string().trim().min(2).max(300)).max(30).optional() }).strict());
  const result = await getDb().transaction((tx) => newVersion(tx, id, actor.id, { workTerms: body }));
  await audit(actor, "quote.terms_set", "quote", id, { version: result.version });
  return json({ ok: true, version: result.version });
}
/**
 * Modifica di una proposta accettata e non ancora pagata: nuova versione,
 * accettazione azzerata, il contratto precedente resta in archivio. Dopo un
 * incasso, le richieste in più si gestiscono come extra nel progetto.
 */
export async function quoteAmend(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.write");
  const body = await readBody(request, z.object({ reason: z.string().trim().min(10).max(1000) }).strict());
  if (!access.record.acceptedAt) throw new PlatformError(409, "NOT_ACCEPTED", "La proposta non è accettata: modificala direttamente.");
  const paid = await getDb().select({ id: paymentOrders.id }).from(paymentOrders).where(and(eq(paymentOrders.quoteId, id), inArray(paymentOrders.status, [...PAID_STATUSES, "pending"])));
  if (paid.length) throw new PlatformError(409, "PAYMENT_EXISTS", "C'è già un pagamento: le richieste in più diventano extra del progetto, con un nuovo accordo.");
  const version = await getDb().transaction(async (tx) => {
    const [record] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, id)).for("update");
    await tx.insert(quoteVersions).values({ quoteId: id, version: record!.version, snapshot: { quote: access.quote, record }, createdBy: actor.id }).onConflictDoNothing();
    await tx.update(quoteRecords).set({ version: record!.version + 1, acceptedAt: null, acceptedBy: null, selectedTier: null, commercialState: "offer", offeredAt: new Date(), offeredBy: actor.id }).where(eq(quoteRecords.quoteId, id));
    await tx.update(quotes).set({ pacchettoScelto: null, updatedAt: new Date() }).where(eq(quotes.id, id));
    await tx.insert(leadActivities).values({ leadId: access.quote.leadId, dealId: record!.dealId, actorId: actor.id, kind: "negotiation", body: `Proposta riaperta per modifica (v${record!.version + 1}): ${body.reason}. Serve una nuova accettazione.`, outcome: "amended" });
    const [owner] = await tx.select().from(leadOwnership).where(eq(leadOwnership.leadId, access.quote.leadId));
    if (owner?.authorId) await notify(tx, owner.authorId, "client_message", { key: `amend:${id}:${record!.version + 1}`, title: "La proposta è stata aggiornata", body: "Le condizioni sono cambiate: rileggi e conferma la nuova versione.", href: `/area-autore/conferma/${id}` });
    return record!.version + 1;
  });
  await audit(actor, "quote.amended", "quote", id, { version, reason: body.reason });
  return json({ ok: true, version, commercialState: "offer" });
}

export async function approvalCollection(request: Request, actor: Actor, id?: string) {
  if (request.method === "GET" && !id) {
    demandAvailable(actor, "quote.write");
    const mine = can(actor.grants, "quote.approve");
    const rows = await getDb().select().from(crmApprovals).where(mine ? sql`true` : eq(crmApprovals.requestedBy, actor.id)).orderBy(desc(crmApprovals.createdAt)).limit(100);
    return json({ approvals: rows, canDecide: mine });
  }
  if (request.method !== "POST" || !id) throw notFound();
  demand(actor, "quote.approve");
  const body = await readBody(request, z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(500).optional() }).strict());
  const result = await getDb().transaction(async (tx) => {
    const [approval] = await tx.select().from(crmApprovals).where(eq(crmApprovals.id, id)).for("update");
    if (!approval || approval.status !== "pending") throw new PlatformError(409, "ALREADY_DECIDED", "Questa richiesta è già stata decisa.");
    if (approval.requestedBy === actor.id) throw new PlatformError(409, "SELF_APPROVAL", "Un'eccezione la approva una persona diversa da chi la chiede.");
    let version: number | null = null;
    if (body.decision === "approved" && approval.quoteId) {
      const p = approval.payload as Record<string, unknown>;
      if (approval.kind === "custom_line") {
        const [record] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, approval.quoteId));
        version = (await newVersion(tx, approval.quoteId, actor.id, { customLines: [...(record?.customLines ?? []), { label: String(p.label), amount: Number(p.amount), quantity: Number(p.quantity ?? 1), approvedBy: actor.id }] })).version;
      } else if (approval.kind === "discount") {
        const rule = await resolvePurchaseRule(tx);
        if (Number(p.discountBps) > rule.maxDiscountBps) throw new PlatformError(422, "DISCOUNT_TOO_HIGH", `Lo sconto massimo ammesso è ${rule.maxDiscountBps / 100}%.`);
        version = (await newVersion(tx, approval.quoteId, actor.id, { discountBps: Number(p.discountBps), discountNote: (p.note as string) ?? null, discountApprovedBy: actor.id })).version;
      }
      const [quote] = await tx.select({ leadId: quotes.leadId }).from(quotes).where(eq(quotes.id, approval.quoteId));
      if (quote) await tx.insert(leadActivities).values({ leadId: quote.leadId, dealId: approval.dealId, actorId: actor.id, kind: "negotiation", body: `Eccezione approvata (${approval.kind})${body.note ? `: ${body.note}` : ""}. Nuova versione ${version}.`, outcome: "approved" });
    }
    await tx.update(crmApprovals).set({ status: body.decision, decidedBy: actor.id, decidedAt: new Date(), note: body.note ?? null }).where(eq(crmApprovals.id, id));
    await notify(tx, approval.requestedBy, "approval_decided", { key: id, title: body.decision === "approved" ? "Eccezione approvata" : "Eccezione respinta", body: body.note ?? "Apri la proposta per i dettagli.", href: approval.quoteId ? `/spazio?preventivo=${approval.quoteId}` : undefined });
    return { version };
  });
  await audit(actor, `approval.${body.decision}`, "approval", id);
  return json({ ok: true, ...result });
}

// ── Link protetti ───────────────────────────────────────────────────────────
function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
/** Link alla proposta da vedere prima di creare l'account: revocabile, con scadenza, senza dati personali. */
export async function quoteShareLink(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.send");
  if (access.record.commercialState !== "offer") throw new PlatformError(409, "NOT_PURCHASABLE", "Rendi la proposta definitiva prima di condividerla.");
  const body = await readBody(request, z.object({ validityDays: z.number().int().min(1).max(90).optional() }).strict());
  const rule = await resolvePurchaseRule();
  const { token, hash } = newToken();
  const days = body.validityDays ?? Math.min(rule.validityDays, 30);
  const [link] = await getDb().insert(crmShareLinks).values({ tokenHash: hash, kind: "quote", quoteId: id, dealId: access.record.dealId, createdBy: actor.id, expiresAt: new Date(Date.now() + days * 86400_000) }).returning();
  await getDb().update(quoteRecords).set({ salesAssisted: true }).where(eq(quoteRecords.quoteId, id));
  await audit(actor, "link.created", "quote", id, { linkId: link!.id, days });
  return json({ id: link!.id, url: `${appOrigin()}/proposta/${token}`, expiresAt: link!.expiresAt }, 201);
}
/** Link a un pacchetto standard dalla trattativa: il prodotto resta quello del catalogo. */
export async function dealPackageLink(request: Request, actor: Actor, dealId: string) {
  if (request.method !== "POST") throw notFound();
  demandAvailable(actor, "quote.send");
  const [deal] = await getDb().select().from(crmDeals).where(eq(crmDeals.id, dealId));
  if (!deal || !(can(actor.grants, "quote.send") || (can(actor.grants, "quote.send", { assigned: true }) && deal.ownerId === actor.id))) throw notFound();
  const body = await readBody(request, z.object({ catalogKey: z.string().regex(/^[a-z0-9_-]{2,40}$/), validityDays: z.number().int().min(1).max(90).default(14) }).strict());
  const item = (await catalog()).items.find((i) => i.key === body.catalogKey && i.active);
  if (!item) throw new PlatformError(422, "UNKNOWN_PACKAGE", "Pacchetto non presente nel catalogo.");
  const { token, hash } = newToken();
  const [link] = await getDb().insert(crmShareLinks).values({ tokenHash: hash, kind: "package", dealId, catalogKey: item.key, createdBy: actor.id, expiresAt: new Date(Date.now() + body.validityDays * 86400_000) }).returning();
  if (deal.originLeadId) await getDb().insert(leadActivities).values({ leadId: deal.originLeadId, dealId, actorId: actor.id, kind: "link", body: `Link al pacchetto «${item.name}» creato (valido ${body.validityDays} giorni).`, outcome: "package_link" });
  await audit(actor, "link.created", "deal", dealId, { linkId: link!.id, catalogKey: item.key });
  return json({ id: link!.id, url: `${appOrigin()}/proposta/${token}`, expiresAt: link!.expiresAt }, 201);
}
export async function linkCollection(request: Request, actor: Actor, id?: string) {
  demandAvailable(actor, "quote.send");
  if (request.method === "GET" && !id) {
    const p = new URL(request.url).searchParams;
    const dealId = p.get("dealId"), quoteId = p.get("quoteId");
    const where = dealId && z.string().uuid().safeParse(dealId).success ? eq(crmShareLinks.dealId, dealId) : quoteId && z.string().uuid().safeParse(quoteId).success ? eq(crmShareLinks.quoteId, quoteId) : can(actor.grants, "quote.send") ? sql`true` : eq(crmShareLinks.createdBy, actor.id);
    const rows = await getDb().select({ id: crmShareLinks.id, kind: crmShareLinks.kind, dealId: crmShareLinks.dealId, quoteId: crmShareLinks.quoteId, catalogKey: crmShareLinks.catalogKey, createdBy: crmShareLinks.createdBy, expiresAt: crmShareLinks.expiresAt, revokedAt: crmShareLinks.revokedAt, views: crmShareLinks.views, lastViewedAt: crmShareLinks.lastViewedAt }).from(crmShareLinks).where(where).orderBy(desc(crmShareLinks.createdAt)).limit(100);
    return json({ links: can(actor.grants, "quote.send") ? rows : rows.filter((r) => r.createdBy === actor.id) });
  }
  if (request.method === "DELETE" && id) {
    const [link] = await getDb().select().from(crmShareLinks).where(eq(crmShareLinks.id, id));
    if (!link || (link.createdBy !== actor.id && !can(actor.grants, "quote.send"))) throw notFound();
    await getDb().update(crmShareLinks).set({ revokedAt: new Date(), revokedBy: actor.id }).where(and(eq(crmShareLinks.id, id), isNull(crmShareLinks.revokedAt)));
    await audit(actor, "link.revoked", "link", id);
    return json({ ok: true });
  }
  throw notFound();
}
async function validLink(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw notFound();
  const [link] = await getDb().select().from(crmShareLinks).where(and(eq(crmShareLinks.tokenHash, hashToken(token)), isNull(crmShareLinks.revokedAt), gt(crmShareLinks.expiresAt, new Date())));
  // Stessa risposta per link inesistente, revocato o scaduto: niente indizi.
  if (!link) throw new PlatformError(410, "LINK_UNAVAILABLE", "Il collegamento non è più valido. Chiedi un nuovo link a chi ti segue.");
  return link;
}
function presentPackages(packages: QuotePackage[], policy: Awaited<ReturnType<typeof resolvePaymentPolicy>>, plan: typeof quoteRecords.$inferSelect.paymentPlan) {
  return packages.map((p) => {
    const money = moneyBreakdown(p.total, policy), deposit = moneyBreakdown(p.deposit, policy);
    return { tier: p.tier, name: p.name, recommended: p.recommended ?? false, lineItems: p.lineItems, includes: p.includes, excludes: p.excludes, money, depositMoney: deposit, installments: installmentSchedule(money.grossCents, deposit.grossCents, plan ?? null) };
  });
}
/** Vista pubblica del link: totale, imposte, acconto e rate sempre visibili; nessun dato personale. */
export async function publicLinkView(request: Request, token: string) {
  if (request.method !== "GET") throw notFound();
  await limitRequest("link-view", `${requestIdentity(request)}:${token.slice(0, 12)}`, 60, 3600);
  const link = await validLink(token);
  await getDb().update(crmShareLinks).set({ views: sql`${crmShareLinks.views} + 1`, lastViewedAt: new Date() }).where(eq(crmShareLinks.id, link.id));
  if (link.kind === "quote" && link.quoteId) {
    const [record] = await getDb().select().from(quoteRecords).where(eq(quoteRecords.quoteId, link.quoteId));
    const [quote] = await getDb().select().from(quotes).where(eq(quotes.id, link.quoteId));
    if (!record || !quote) throw notFound();
    const policy = await ensureQuotePolicy(record);
    return json({ kind: "quote", version: record.version, commercialState: record.commercialState, accepted: Boolean(record.acceptedAt), expiresAt: record.expiresAt, linkExpiresAt: link.expiresAt, workTerms: record.workTerms, vat: { mode: policy.vatMode, rateBps: policy.vatRateBps }, packages: presentPackages(quote.pacchettiGenerati as QuotePackage[], policy, record.paymentPlan), next: { account: "/accedi", claim: "/api/platform/crm/links/claim" } });
  }
  const item = (await catalog()).items.find((i) => i.key === link.catalogKey && i.active);
  if (!item) throw new PlatformError(410, "LINK_UNAVAILABLE", "Il pacchetto non è più disponibile.");
  const policy = await resolvePaymentPolicy();
  const packages = computeQuote(item.input).packages;
  return json({ kind: "package", name: item.name, linkExpiresAt: link.expiresAt, vat: { mode: policy.vatMode, rateBps: policy.vatRateBps }, packages: presentPackages(packages, policy, null), next: { account: "/accedi", purchase: "/api/platform/crm/links/purchase" } });
}
/** Chiarimento o richiesta di modifica dal link: arriva al responsabile come attività ricevuta, senza account. */
export async function publicLinkMessage(request: Request, token: string) {
  if (request.method !== "POST") throw notFound();
  checkMutationOrigin(request);
  await limitRequest("link-message", `${requestIdentity(request)}:${token.slice(0, 12)}`, 5, 3600);
  const link = await validLink(token);
  const body = await readBody(request, z.object({ kind: z.enum(["clarification", "change_request"]), body: z.string().trim().min(5).max(3000) }).strict());
  const [deal] = link.dealId ? await getDb().select().from(crmDeals).where(eq(crmDeals.id, link.dealId)) : [];
  const leadId = deal?.originLeadId ?? (link.quoteId ? (await getDb().select({ leadId: quotes.leadId }).from(quotes).where(eq(quotes.id, link.quoteId)))[0]?.leadId : null);
  if (!leadId) throw notFound();
  await getDb().transaction(async (tx) => {
    await tx.insert(leadActivities).values({ leadId, dealId: link.dealId, kind: body.kind === "clarification" ? "clarification" : "change_request", channel: "link", direction: "inbound", body: body.body, outcome: "received" });
    const owner = deal?.ownerId ?? link.createdBy;
    await notify(tx, owner, "client_message", { key: `${link.id}:${Date.now()}`, title: body.kind === "clarification" ? "Il cliente chiede un chiarimento" : "Il cliente chiede una modifica", body: body.body.slice(0, 300), href: link.dealId ? `/spazio?tab=deals&deal=${link.dealId}` : `/spazio?preventivo=${link.quoteId}` });
    if (deal) await tx.update(crmDeals).set({ lastActivityAt: new Date(), stage: body.kind === "change_request" ? "negotiation" : deal.stage, updatedAt: new Date() }).where(eq(crmDeals.id, deal.id));
  });
  return json({ ok: true }, 202);
}
/** Collega la proposta all'account solo se l'email verificata della sessione è quella del contatto. */
export async function linkClaim(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  await limitRequest("link-claim", actor.id, 10, 3600);
  const body = await readBody(request, z.object({ token: z.string().min(40).max(60) }).strict());
  const link = await validLink(body.token);
  if (link.kind !== "quote" || !link.quoteId) throw new PlatformError(409, "WRONG_LINK", "Questo link è per un pacchetto: usa «Acquista».");
  const quoteId = await getDb().transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, link.quoteId!));
    const [lead] = quote ? await tx.select().from(leads).where(eq(leads.id, quote.leadId)) : [];
    if (!quote || !lead) throw notFound();
    if (normalizeEmail(lead.email) !== normalizeEmail(actor.email)) throw new PlatformError(403, "IDENTITY_MISMATCH", "Accedi con l'indirizzo a cui è stata mandata la proposta.");
    const [owner] = await tx.select().from(leadOwnership).where(eq(leadOwnership.leadId, lead.id)).for("update");
    if (owner?.authorId && owner.authorId !== actor.id) throw new PlatformError(403, "IDENTITY_MISMATCH", "La proposta è già collegata a un altro account.");
    await tx.insert(leadOwnership).values({ leadId: lead.id, authorId: actor.id }).onConflictDoUpdate({ target: leadOwnership.leadId, set: { authorId: actor.id, updatedAt: new Date() } });
    if (lead.contactId) await tx.update(crmContacts).set({ userId: actor.id, identityVerifiedAt: new Date() }).where(and(eq(crmContacts.id, lead.contactId), isNull(crmContacts.userId)));
    return quote.id;
  });
  await audit(actor, "link.claimed", "quote", quoteId);
  return json({ quoteId, href: `/area-autore/conferma/${quoteId}` });
}
/**
 * Acquisto di un pacchetto standard da link: serve un account con email
 * verificata. Se l'email è quella del contatto della trattativa, la proposta
 * nasce lì; altrimenti nasce per la persona che compra, e vale il link come
 * prova (con il motivo registrato nell'attribuzione).
 */
export async function linkPurchase(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  if (actor.staff) throw new PlatformError(409, "STAFF_ACCOUNT", "Gli account del team non acquistano dai link dei clienti.");
  await limitRequest("link-purchase", actor.id, 10, 3600);
  const body = await readBody(request, z.object({ token: z.string().min(40).max(60) }).strict());
  const link = await validLink(body.token);
  if (link.kind !== "package") throw new PlatformError(409, "WRONG_LINK", "Questo link è una proposta personalizzata: collegala al tuo account.");
  const item = (await catalog()).items.find((i) => i.key === link.catalogKey && i.active);
  if (!item) throw new PlatformError(410, "LINK_UNAVAILABLE", "Il pacchetto non è più disponibile.");
  const tax = await resolvePaymentPolicy();
  const commissions = commissionRuleSchema.safeParse(await getSetting("commission-rule"));
  const rule = await resolvePurchaseRule();
  const result = await getDb().transaction(async (tx) => {
    // Lo stesso link usato due volte dalla stessa persona riapre la stessa proposta.
    const [previous] = await tx.select({ quoteId: quoteRecords.quoteId }).from(quoteRecords).innerJoin(quotes, eq(quotes.id, quoteRecords.quoteId)).innerJoin(leadOwnership, eq(leadOwnership.leadId, quotes.leadId)).where(and(eq(quoteRecords.originLinkId, link.id), eq(leadOwnership.authorId, actor.id)));
    if (previous) return { quoteId: previous.quoteId, reused: true };
    const [deal] = link.dealId ? await tx.select().from(crmDeals).where(eq(crmDeals.id, link.dealId)) : [];
    const [dealContact] = deal ? await tx.select().from(crmContacts).where(eq(crmContacts.id, deal.contactId)) : [];
    const sameContact = Boolean(dealContact && dealContact.emailNormalized === normalizeEmail(actor.email));
    const [lead] = await tx.insert(leads).values({ nome: actor.name, email: actor.email.toLowerCase(), fonte: "preventivo", sourceKind: "seller", sourcedBy: link.createdBy, sourceDetail: `link pacchetto ${item.key}`, consensoPrivacy: true, consensoMarketing: false, requiredSkill: item.input.singleService ?? null, firstResponseAt: new Date(), ...(sameContact ? { contactId: dealContact!.id, dealId: deal!.id } : {}) }).returning();
    let dealId: string;
    if (sameContact) {
      dealId = deal!.id;
      await tx.insert(leadOwnership).values({ leadId: lead!.id, authorId: actor.id, assignedTo: deal!.ownerId }).onConflictDoNothing();
    } else {
      // Persona diversa: la richiesta segue le regole (il cliente già seguito resta al suo responsabile).
      const routed = await routeLead(tx, lead!.id, { notifyAssignee: true });
      dealId = routed.dealId;
      await tx.update(leadOwnership).set({ authorId: actor.id }).where(eq(leadOwnership.leadId, lead!.id));
    }
    const packages = computeQuote(item.input).packages;
    const chosen = packages.find((p) => p.recommended) ?? packages[0]!;
    const [quote] = await tx.insert(quotes).values({ leadId: lead!.id, input: item.input, pacchettiGenerati: packages, prezzoTotale: chosen.total, acconto: chosen.deposit, stato: "sent" }).returning();
    await tx.insert(quoteRecords).values({ quoteId: quote!.id, dealId, originLinkId: link.id, pricingVersion, taxPolicy: tax, commissionPolicy: commissions.success ? commissions.data : null, commercialState: "offer", offeredAt: new Date(), offeredBy: link.createdBy, salesAssisted: true, expiresAt: new Date(Date.now() + rule.validityDays * 86400_000) });
    await tx.insert(leadActivities).values({ leadId: lead!.id, dealId, actorId: actor.id, kind: "purchase_intent", channel: "link", direction: "inbound", body: `Acquisto avviato dal link del pacchetto «${item.name}»${sameContact ? "" : " (email diversa da quella del contatto: vale il link)"}.`, outcome: sameContact ? "same_contact" : "email_differs" });
    return { quoteId: quote!.id, reused: false };
  });
  await audit(actor, "link.purchase_started", "quote", result.quoteId, { linkId: link.id });
  return json({ ...result, href: `/area-autore/conferma/${result.quoteId}` }, result.reused ? 200 : 201);
}
export { attachLead };
