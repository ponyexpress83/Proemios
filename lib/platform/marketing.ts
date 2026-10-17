import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { campaigns, campaignSpend, quoteRecords, paymentOrders, ledgerEntries, invoices, contracts, funnelEvents, emailOutbox, leadOwnership, leadActivities, platformSettings, webhookEvents } from "@/db/platform-schema";
import { user } from "@/db/auth-schema";
import { demand, demandRecent, audit, type Actor } from "./access";
import { can } from "./permissions";
import { readBody, json, notFound, PlatformError } from "./http";
import { limitRequest } from "./rate-limit";
import { appOrigin, explicitDemo } from "./config";
import { recoveryRulesSchema, defaultRecoveryRules } from "./recovery";
import { integrationStatus } from "./integrations";
import { pipelineState } from "./pipeline";
import type { LeadAttribution } from "@/lib/attribution";

const DAY = 86400_000;
const channelSchema = z.enum(["google_ads", "meta", "email", "marketplace", "partner", "organic", "referral", "other"]);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{0,60}$/, "Solo lettere minuscole, numeri, punto, trattino e trattino basso.");
const campaignBody = z.object({
  name: z.string().trim().min(2).max(120),
  channel: channelSchema,
  status: z.enum(["draft", "active", "paused", "ended"]).default("draft"),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  destination: z.string().trim().regex(/^\/[a-z0-9\-/]*$/i, "Destinazione: un percorso interno del sito, es. /preventivo.").default("/preventivo"),
  utmSource: slug,
  utmMedium: slug,
  utmCampaign: slug,
  utmContent: slug.optional(),
  utmTerm: slug.optional(),
  partnerId: z.string().max(100).nullable().optional(),
  sellerId: z.string().max(100).nullable().optional(),
  budgetCents: z.number().int().min(0).max(100_000_000).default(0),
  notes: z.string().trim().max(2000).optional(),
}).strict();
/**
 * Link tracciato: destinazione interna + UTM + id campagna («pc»). Mai email o
 * altri dati personali nell'URL. Funzione pura: la stessa che usa l'interfaccia.
 */
export function trackedLink(c: { id: string; destination: string; utmSource: string; utmMedium: string; utmCampaign: string; utmContent?: string | null; utmTerm?: string | null }, origin = appOrigin()): string {
  const url = new URL(c.destination, origin);
  url.searchParams.set("utm_source", c.utmSource);
  url.searchParams.set("utm_medium", c.utmMedium);
  url.searchParams.set("utm_campaign", c.utmCampaign);
  if (c.utmContent) url.searchParams.set("utm_content", c.utmContent);
  if (c.utmTerm) url.searchParams.set("utm_term", c.utmTerm);
  url.searchParams.set("pc", c.id);
  return url.toString();
}
type Campaign = typeof campaigns.$inferSelect;
/** Lead attribuiti: per id campagna (link tracciato) o per corrispondenza di source/medium/campaign. */
function attributedTo(c: Campaign, a: LeadAttribution | null | undefined): boolean {
  if (!a) return false;
  if (a.campaignId) return a.campaignId === c.id;
  return (a.utmSource ?? "").toLowerCase() === c.utmSource && (a.utmMedium ?? "").toLowerCase() === c.utmMedium && (a.utmCampaign ?? "").toLowerCase() === c.utmCampaign;
}
async function campaignResults(rows: Campaign[], aggregateRevenue: boolean) {
  if (!rows.length) return [];
  const leadRows = await getDb().select({ id: leads.id, attribution: leads.attribution, createdAt: leads.createdAt }).from(leads).where(isNotNull(leads.attribution));
  const byCampaign = new Map(rows.map((c) => [c.id, leadRows.filter((l) => attributedTo(c, l.attribution as LeadAttribution | null))]));
  const allLeadIds = [...new Set([...byCampaign.values()].flat().map((l) => l.id))];
  const quoteRows = allLeadIds.length ? await getDb().select({ id: quotes.id, leadId: quotes.leadId }).from(quotes).where(inArray(quotes.leadId, allLeadIds)) : [];
  const quoteIds = quoteRows.map((q) => q.id);
  const orders = quoteIds.length ? await getDb().select({ id: paymentOrders.id, quoteId: paymentOrders.quoteId, status: paymentOrders.status }).from(paymentOrders).where(inArray(paymentOrders.quoteId, quoteIds)) : [];
  const paidOrderIds = orders.filter((o) => ["paid", "partially_refunded", "refunded", "disputed", "review_required"].includes(o.status)).map((o) => o.id);
  const ledger = paidOrderIds.length ? await getDb().select({ orderId: ledgerEntries.orderId, amountCents: ledgerEntries.amountCents }).from(ledgerEntries).where(inArray(ledgerEntries.orderId, paidOrderIds)) : [];
  const spend = await getDb().select({ campaignId: campaignSpend.campaignId, spend: sql<number>`coalesce(sum(${campaignSpend.spendCents}),0)::integer`, clicks: sql<number>`coalesce(sum(${campaignSpend.clicks}),0)::integer`, impressions: sql<number>`coalesce(sum(${campaignSpend.impressions}),0)::integer`, days: sql<number>`count(*)::integer` }).from(campaignSpend).where(inArray(campaignSpend.campaignId, rows.map((c) => c.id))).groupBy(campaignSpend.campaignId);
  return rows.map((c) => {
    const own = byCampaign.get(c.id) ?? [];
    const ownQuotes = quoteRows.filter((q) => own.some((l) => l.id === q.leadId));
    const ownOrders = orders.filter((o) => ownQuotes.some((q) => q.id === o.quoteId));
    const purchases = new Set(ownOrders.filter((o) => paidOrderIds.includes(o.id)).map((o) => o.quoteId)).size;
    const collected = ledger.filter((e) => ownOrders.some((o) => o.id === e.orderId)).reduce((n, e) => n + e.amountCents, 0);
    const sp = spend.find((s) => s.campaignId === c.id);
    const spent = sp?.spend ?? 0;
    return {
      ...c,
      link: trackedLink(c),
      results: {
        leads: own.length,
        quotes: ownQuotes.length,
        purchases,
        collectedCents: aggregateRevenue ? collected : null,
        spendCents: spent,
        spendDays: sp?.days ?? 0,
        clicks: sp?.clicks ?? 0,
        impressions: sp?.impressions ?? 0,
        budgetUsedPct: c.budgetCents ? Math.round((spent * 100) / c.budgetCents) : null,
        costPerLeadCents: own.length && spent ? Math.round(spent / own.length) : null,
        costPerPurchaseCents: purchases && spent ? Math.round(spent / purchases) : null,
        roas: aggregateRevenue && spent ? Math.round((collected * 100) / spent) / 100 : null,
      },
    };
  });
}
export async function campaignCollection(request: Request, actor: Actor) {
  demand(actor, request.method === "GET" ? "marketing.read" : "marketing.campaigns");
  if (request.method === "GET") {
    const rows = await getDb().select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(200);
    return json({ campaigns: await campaignResults(rows, can(actor.grants, "revenue.aggregate")), demo: explicitDemo() });
  }
  if (request.method !== "POST") throw notFound();
  await limitRequest("campaign-create", actor.id, 50, 3600);
  const body = await readBody(request, campaignBody);
  const [saved] = await getDb().insert(campaigns).values({ ...body, startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null, utmContent: body.utmContent ?? null, utmTerm: body.utmTerm ?? null, partnerId: body.partnerId ?? null, sellerId: body.sellerId ?? null, notes: body.notes ?? null, createdBy: actor.id }).onConflictDoNothing().returning();
  if (!saved) throw new PlatformError(409, "DUPLICATE_CAMPAIGN", "Esiste già una campagna con questi utm_source, utm_medium e utm_campaign.");
  await audit(actor, "campaign.created", "campaign", saved.id, { channel: body.channel });
  return json({ campaign: { ...saved, link: trackedLink(saved) } }, 201);
}
export async function campaignDetail(request: Request, actor: Actor, id: string) {
  if (request.method === "GET") {
    demand(actor, "marketing.read");
    const [row] = await getDb().select().from(campaigns).where(eq(campaigns.id, id));
    if (!row) throw notFound();
    const [result] = await campaignResults([row], can(actor.grants, "revenue.aggregate"));
    const spend = await getDb().select().from(campaignSpend).where(eq(campaignSpend.campaignId, id)).orderBy(desc(campaignSpend.day)).limit(400);
    return json({ campaign: result, spend });
  }
  if (request.method !== "PATCH") throw notFound();
  demand(actor, "marketing.campaigns");
  const body = await readBody(request, campaignBody.partial());
  const [updated] = await getDb().update(campaigns).set({ ...body, startsAt: body.startsAt === undefined ? undefined : body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null, updatedAt: new Date() }).where(eq(campaigns.id, id)).returning();
  if (!updated) throw notFound();
  await audit(actor, "campaign.updated", "campaign", id, { status: body.status });
  return json({ campaign: { ...updated, link: trackedLink(updated) } });
}
/**
 * Spesa pubblicitaria: righe per giorno (CSV o JSON) con controllo dei
 * doppioni su campagna + giorno + origine. Nessun collegamento automatico a
 * Google Ads o Meta: i dati li esporta chi gestisce le campagne.
 */
export async function campaignSpendImport(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "marketing.campaigns");
  const [row] = await getDb().select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, id));
  if (!row) throw notFound();
  const rowSchema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), spendCents: z.coerce.number().int().min(0).max(100_000_000).optional(), spend: z.coerce.number().min(0).optional(), impressions: z.coerce.number().int().min(0).optional(), clicks: z.coerce.number().int().min(0).optional() });
  let rows: unknown[], source = "manual";
  if ((request.headers.get("content-type") ?? "").includes("text/csv")) {
    source = (new URL(request.url).searchParams.get("origine") ?? "csv").slice(0, 40);
    const lines = (await request.text()).slice(0, 1_000_000).split(/\r?\n/).filter((l) => l.trim());
    // Separatore dall'intestazione: «;» (export italiani, decimali con virgola) oppure «,».
    const separator = (lines[0] ?? "").includes(";") ? ";" : ",";
    const header = (lines.shift() ?? "").split(separator).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const map: Record<string, string> = { day: "day", date: "day", giorno: "day", data: "day", spend: "spend", cost: "spend", costo: "spend", spesa: "spend", impressions: "impressions", impressioni: "impressions", clicks: "clicks", clic: "clicks" };
    rows = lines.map((line) => Object.fromEntries(line.split(separator).map((cell, i) => [map[header[i] ?? ""] ?? header[i] ?? `c${i}`, cell.trim().replace(/^"|"$/g, "").replace(",", ".")])));
  } else {
    const body = await readBody(request, z.object({ source: z.string().trim().max(40).optional(), rows: z.array(z.unknown()).min(1).max(400) }).strict());
    rows = body.rows; source = body.source ?? "manual";
  }
  const result = { imported: 0, duplicates: 0, invalid: 0 };
  for (const raw of rows.slice(0, 400)) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) { result.invalid++; continue; }
    const cents = parsed.data.spendCents ?? Math.round((parsed.data.spend ?? 0) * 100);
    const inserted = await getDb().insert(campaignSpend).values({ campaignId: id, day: parsed.data.day, spendCents: cents, impressions: parsed.data.impressions ?? null, clicks: parsed.data.clicks ?? null, source, createdBy: actor.id }).onConflictDoNothing().returning({ id: campaignSpend.id });
    if (inserted.length) result.imported++; else result.duplicates++;
  }
  await audit(actor, "campaign.spend-imported", "campaign", id, { ...result, source });
  return json(result, 201);
}
/**
 * Contatti autorizzati alle comunicazioni facoltative: campi minimi, nessuna
 * nota, nessun telefono, nessun documento. L'assegnazione richiede «crm.assign».
 */
export async function marketingContacts(request: Request, actor: Actor, id?: string) {
  if (request.method === "GET" && !id) {
    demand(actor, "marketing.contacts");
    const rows = await getDb().select({ lead: leads, assignedTo: leadOwnership.assignedTo, assignedName: user.name }).from(leads).leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id)).leftJoin(user, eq(user.id, leadOwnership.assignedTo)).where(and(eq(leads.consensoMarketing, true), sql`${leads.marketingRevokedAt} is null`)).orderBy(desc(leads.createdAt)).limit(500);
    return json({ contacts: rows.map((r) => ({ id: r.lead.id, nome: r.lead.nome, email: r.lead.email, fonte: r.lead.fonte, sourceDetail: r.lead.sourceDetail, consentAt: r.lead.marketingConsentAt ?? r.lead.createdAt, createdAt: r.lead.createdAt, stage: r.lead.stage, assignedTo: r.assignedTo, assignedName: r.assignedName, campaign: (r.lead.attribution as LeadAttribution | null)?.utmCampaign ?? null })), unsubscribeNote: "Ogni email facoltativa porta il link di revoca; le revoche arrivano qui e dal webhook del provider." });
  }
  if (request.method === "PATCH" && id) {
    demand(actor, "crm.assign");
    const body = await readBody(request, z.object({ assignedTo: z.string().min(1).max(100) }).strict());
    const [target] = await getDb().select({ id: user.id }).from(user).where(and(eq(user.id, body.assignedTo), eq(user.emailVerified, true)));
    if (!target) throw new PlatformError(422, "INVALID_ASSIGNEE", "Seleziona un utente verificato.");
    const [lead] = await getDb().select({ id: leads.id }).from(leads).where(eq(leads.id, id));
    if (!lead) throw notFound();
    await getDb().insert(leadOwnership).values({ leadId: id, assignedTo: body.assignedTo }).onConflictDoUpdate({ target: leadOwnership.leadId, set: { assignedTo: body.assignedTo, updatedAt: new Date() } });
    await getDb().insert(leadActivities).values({ leadId: id, actorId: actor.id, kind: "assignment", body: "Assegnato dal marketing.", outcome: body.assignedTo });
    await audit(actor, "lead.assigned", "lead", id, { assignedTo: body.assignedTo, via: "marketing" });
    return json({ ok: true });
  }
  throw notFound();
}
/**
 * Bozze delle automazioni (regole di recupero) separate dall'attivazione:
 * chi ha «automation.draft» scrive la bozza, chi ha «automation.activate» (o
 * gestisce le regole) la rende operativa. La bozza non manda nulla.
 */
export async function automationDrafts(request: Request, actor: Actor, action?: string) {
  const [draft] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, "recovery-rules-draft"));
  const [active] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, "recovery-rules"));
  if (request.method === "GET" && !action) {
    if (!can(actor.grants, "automation.draft") && !can(actor.grants, "automation.activate") && !can(actor.grants, "settings.manage")) throw new PlatformError(403, "FORBIDDEN", "Permesso mancante.");
    return json({ draft: draft?.value ?? null, active: active?.value ?? null, defaults: defaultRecoveryRules, canActivate: can(actor.grants, "automation.activate") || can(actor.grants, "settings.manage") });
  }
  if (request.method === "PUT" && !action) {
    demand(actor, "automation.draft");
    const body = await readBody(request, z.object({ value: z.record(z.unknown()) }).strict());
    const parsed = recoveryRulesSchema.safeParse({ ...body.value, approvedAt: new Date().toISOString(), approvedBy: `bozza:${actor.id}` });
    if (!parsed.success) throw new PlatformError(422, "INVALID_AUTOMATION", "Controlla i passi dell'automazione: ritardo in ore, canale (email o task) e scopo.");
    await getDb().insert(platformSettings).values({ key: "recovery-rules-draft", value: parsed.data }).onConflictDoUpdate({ target: platformSettings.key, set: { value: parsed.data, updatedAt: new Date() } });
    await audit(actor, "automation.drafted", "setting", "recovery-rules-draft", { version: parsed.data.version });
    return json({ ok: true, draft: parsed.data });
  }
  if (request.method === "POST" && action === "activate") {
    if (!can(actor.grants, "automation.activate") && !can(actor.grants, "settings.manage")) throw new PlatformError(403, "FORBIDDEN", "L'attivazione richiede la delega «automation.activate».");
    demandRecent(actor);
    if (!draft) throw new PlatformError(409, "NO_DRAFT", "Nessuna bozza da attivare.");
    const parsed = recoveryRulesSchema.safeParse({ ...(draft.value as Record<string, unknown>), approvedAt: new Date().toISOString(), approvedBy: actor.id });
    if (!parsed.success) throw new PlatformError(422, "INVALID_AUTOMATION", "La bozza non è valida.");
    await getDb().insert(platformSettings).values({ key: "recovery-rules", value: parsed.data }).onConflictDoUpdate({ target: platformSettings.key, set: { value: parsed.data, updatedAt: new Date() } });
    await audit(actor, "automation.activated", "setting", "recovery-rules", { version: parsed.data.version });
    return json({ ok: true, active: parsed.data });
  }
  throw notFound();
}
type Metric = { key: string; label: string; value: number | string | null; unit?: "count" | "cents" | "pct" | "text"; definition: string; source: string; updatedAt: string | null; status: "ok" | "to_connect" | "unavailable" | "unauthorized"; demo: boolean };
/**
 * Dashboard marketing: ogni numero dichiara definizione, fonte e aggiornamento.
 * «Da collegare» quando manca l'integrazione, «Non disponibile» quando non ci
 * sono dati. I ricavi compaiono solo con «revenue.aggregate», e solo aggregati.
 */
export async function marketingDashboard(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demand(actor, "marketing.read");
  const days = Math.min(365, Math.max(7, Number(new URL(request.url).searchParams.get("giorni") ?? 30) || 30));
  const since = new Date(Date.now() - days * DAY), now = new Date().toISOString(), demo = explicitDemo();
  const integrations = await integrationStatus();
  const metric = (m: Omit<Metric, "demo" | "updatedAt"> & { updatedAt?: string | null }): Metric => ({ updatedAt: m.status === "ok" ? now : null, ...m, demo });
  const funnel = await getDb().select({ name: funnelEvents.name, kind: funnelEvents.kind, count: sql<number>`count(*)::integer`, sessions: sql<number>`count(distinct ${funnelEvents.visitorKey})::integer` }).from(funnelEvents).where(gte(funnelEvents.createdAt, since)).groupBy(funnelEvents.name, funnelEvents.kind);
  const count = (name: string) => funnel.find((f) => f.name === name)?.count ?? 0;
  const sessionsStarted = funnel.find((f) => f.name === "quote_started")?.sessions ?? 0;
  const completedSessions = await getDb().select({ count: sql<number>`count(distinct ${funnelEvents.visitorKey})::integer` }).from(funnelEvents).where(and(gte(funnelEvents.createdAt, since), eq(funnelEvents.name, "quote_started"), sql`${funnelEvents.visitorKey} in (select ${funnelEvents.visitorKey} from ${funnelEvents} where ${funnelEvents.name} = 'proposal_viewed' and ${funnelEvents.visitorKey} is not null)`));
  const orderRows = await getDb().select({ status: paymentOrders.status, count: sql<number>`count(*)::integer`, quotes: sql<number>`count(distinct ${paymentOrders.quoteId})::integer` }).from(paymentOrders).where(gte(paymentOrders.createdAt, since)).groupBy(paymentOrders.status);
  const ordersBy = (status: string[]) => orderRows.filter((o) => status.includes(o.status)).reduce((n, o) => n + o.quotes, 0);
  const paidQuotes = await getDb().select({ quoteId: paymentOrders.quoteId }).from(paymentOrders).where(and(gte(paymentOrders.updatedAt, since), inArray(paymentOrders.status, ["paid", "partially_refunded", "refunded"]))).groupBy(paymentOrders.quoteId);
  const paidIds = paidQuotes.map((q) => q.quoteId);
  const assisted = paidIds.length ? await getDb().select({ count: sql<number>`count(*)::integer` }).from(quoteRecords).where(and(inArray(quoteRecords.quoteId, paidIds), eq(quoteRecords.salesAssisted, true))) : [{ count: 0 }];
  const recovered = paidIds.length ? await getDb().select({ count: sql<number>`count(distinct ${quotes.id})::integer` }).from(quotes).innerJoin(leadActivities, and(eq(leadActivities.leadId, quotes.leadId), eq(leadActivities.kind, "automation"))).where(inArray(quotes.id, paidIds)) : [{ count: 0 }];
  const leadsBySource = await getDb().select({ fonte: leads.fonte, count: sql<number>`count(*)::integer` }).from(leads).where(gte(leads.createdAt, since)).groupBy(leads.fonte);
  const attributed = await getDb().select({ count: sql<number>`count(*)::integer` }).from(leads).where(and(gte(leads.createdAt, since), isNotNull(leads.attribution)));
  const mail = await getDb().select({ status: emailOutbox.status, count: sql<number>`count(*)::integer` }).from(emailOutbox).where(gte(emailOutbox.createdAt, since)).groupBy(emailOutbox.status);
  const spend = await getDb().select({ spend: sql<number>`coalesce(sum(${campaignSpend.spendCents}),0)::integer`, last: sql<string | null>`max(${campaignSpend.day})` }).from(campaignSpend).where(gte(campaignSpend.day, since.toISOString().slice(0, 10)));
  const aggregate = can(actor.grants, "revenue.aggregate");
  const money = aggregate ? await Promise.all([
    getDb().select({ total: sql<number>`coalesce(sum((${contracts.orderSheet}->'amounts'->>'grossCents')::integer),0)::integer` }).from(contracts).where(gte(contracts.acceptedAt, since)),
    getDb().select({ total: sql<number>`coalesce(sum(${ledgerEntries.amountCents}),0)::integer` }).from(ledgerEntries).where(and(gte(ledgerEntries.createdAt, since), eq(ledgerEntries.kind, "payment"))),
    getDb().select({ total: sql<number>`coalesce(sum(${ledgerEntries.amountCents}),0)::integer` }).from(ledgerEntries).where(and(gte(ledgerEntries.createdAt, since), eq(ledgerEntries.kind, "refund"))),
    getDb().select({ total: sql<number>`coalesce(sum(${invoices.grossCents}),0)::integer` }).from(invoices).where(and(gte(invoices.createdAt, since), inArray(invoices.status, ["created", "sent"]))),
  ]) : null;
  const sent = mail.filter((m) => m.status === "accepted").reduce((n, m) => n + m.count, 0), failed = mail.filter((m) => m.status === "failed").reduce((n, m) => n + m.count, 0);
  // Eventi Brevo ricevuti dal webhook (consegne, aperture, clic, disiscrizioni): contano solo quelli arrivati, mai stime.
  const brevoRows = await getDb().select({ type: webhookEvents.type, count: sql<number>`count(*)::integer`, last: sql<string | Date | null>`max(${webhookEvents.createdAt})` }).from(webhookEvents).where(and(gte(webhookEvents.createdAt, since), sql`${webhookEvents.type} like 'brevo.%'`)).groupBy(webhookEvents.type);
  const brevoCount = (...types: string[]) => brevoRows.filter((r) => types.includes(r.type.slice(6))).reduce((n, r) => n + r.count, 0);
  const brevoLast = brevoRows.map((r) => (r.last ? new Date(r.last) : null)).filter((d): d is Date => Boolean(d) && !Number.isNaN(d!.getTime())).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const brevoSummary = brevoRows.length ? `consegnate ${brevoCount("delivered")} · aperte ${brevoCount("opened", "unique_opened", "uniqueOpened")} · clic ${brevoCount("click", "clicked")} · disiscritte ${brevoCount("unsubscribed", "unsubscribe")} · non recapitate ${brevoCount("hard_bounce", "hardBounce", "soft_bounce", "softBounce", "blocked", "invalid_email")}` : null;
  const totalSpend = spend[0]?.spend ?? 0, purchases = paidIds.length;
  const metrics: Metric[] = [
    metric({ key: "visits", label: "Visite e sorgenti", value: null, unit: "count", definition: "Sessioni sul sito per sorgente/mezzo.", source: integrations.analytics.configured ? `Analytics (${integrations.analytics.detail})` : "Analytics", status: integrations.analytics.configured ? "unavailable" : "to_connect" }),
    metric({ key: "quotes_started", label: "Preventivi avviati", value: count("quote_started"), unit: "count", definition: "Sessioni che hanno iniziato il configuratore (evento d'interfaccia, anonimo).", source: "Eventi del sito (platform_funnel_events)", status: "ok" }),
    metric({ key: "quotes_saved", label: "Preventivi completati", value: count("quote_saved"), unit: "count", definition: "Richieste di preventivo salvate con contatto (evento verificato dal server).", source: "Eventi economici", status: "ok" }),
    metric({ key: "configurator_abandon", label: "Abbandoni del configuratore", value: sessionsStarted ? Math.max(0, sessionsStarted - (completedSessions[0]?.count ?? 0)) : null, unit: "count", definition: "Sessioni con configuratore avviato ma senza proposta vista. Richiede la chiave di sessione negli eventi.", source: "Eventi del sito con chiave di sessione", status: sessionsStarted ? "ok" : "unavailable" }),
    metric({ key: "checkouts", label: "Checkout avviati", value: ordersBy(["pending", "paid", "failed", "expired", "partially_refunded", "refunded", "disputed", "review_required"]), unit: "count", definition: "Proposte con almeno una sessione di pagamento aperta.", source: "Ordini (Stripe Checkout)", status: integrations.stripe.configured ? "ok" : "to_connect" }),
    metric({ key: "payments_failed", label: "Pagamenti falliti o scaduti", value: ordersBy(["failed", "expired"]), unit: "count", definition: "Proposte con un ordine fallito o scaduto nel periodo (eventi del webhook).", source: "Webhook Stripe", status: integrations.stripe.configured ? "ok" : "to_connect" }),
    metric({ key: "purchases", label: "Acquisti conclusi", value: purchases, unit: "count", definition: "Proposte con almeno un incasso verificato nel periodo.", source: "Webhook Stripe + registro", status: "ok" }),
    metric({ key: "autonomous_share", label: "Quota di acquisti autonomi", value: purchases ? Math.round(((purchases - (assisted[0]?.count ?? 0)) * 100) / purchases) : null, unit: "pct", definition: "Acquisti senza intervento commerciale tracciato (revisione, invio, offerta, sconto, piano).", source: "Proposte (sales_assisted)", status: purchases ? "ok" : "unavailable" }),
    metric({ key: "recovered", label: "Proposte recuperate", value: recovered[0]?.count ?? 0, unit: "count", definition: "Acquisti conclusi dopo almeno un passo automatico di recupero sul contatto.", source: "Attività del contatto + registro", status: "ok" }),
    metric({ key: "leads_by_source", label: "Contatti per origine", value: leadsBySource.map((l) => `${l.fonte}: ${l.count}`).join(" · ") || null, unit: "text", definition: "Nuovi contatti per canale di ingresso (sito, marketplace, import…).", source: "CRM", status: leadsBySource.length ? "ok" : "unavailable" }),
    metric({ key: "attributed_leads", label: "Contatti con origine di campagna", value: attributed[0]?.count ?? 0, unit: "count", definition: "Contatti arrivati con parametri UTM o link tracciato nella sessione di richiesta (prima origine per landing e referrer, ultima per UTM).", source: "Attribuzione di sessione", status: "ok" }),
    metric({ key: "contract_value", label: "Valore contrattuale", value: money ? money[0][0]?.total ?? 0 : null, unit: "cents", definition: "Somma lorda delle schede d'ordine accettate nel periodo.", source: "Contratti", status: aggregate ? "ok" : "unauthorized" }),
    metric({ key: "collected", label: "Incassato", value: money ? money[1][0]?.total ?? 0 : null, unit: "cents", definition: "Pagamenti verificati dal provider nel periodo (rimborsi esclusi, indicati a parte).", source: "Registro (Stripe)", status: aggregate ? "ok" : "unauthorized" }),
    metric({ key: "refunded", label: "Rimborsato", value: money ? -(money[2][0]?.total ?? 0) : null, unit: "cents", definition: "Rimborsi eseguiti nel periodo.", source: "Registro (Stripe)", status: aggregate ? "ok" : "unauthorized" }),
    metric({ key: "invoiced", label: "Fatturato", value: money ? money[3][0]?.total ?? 0 : null, unit: "cents", definition: "Fatture emesse nel periodo (lordo).", source: integrations.fic.configured ? "Fatture in Cloud" : "Fatture in Cloud (da collegare)", status: aggregate ? (integrations.fic.configured ? "ok" : "to_connect") : "unauthorized" }),
    metric({ key: "ad_spend", label: "Spesa pubblicitaria", value: totalSpend, unit: "cents", definition: "Spesa importata o inserita per giorno sulle campagne del registro.", source: "Registro campagne (import CSV/manuale)", updatedAt: spend[0]?.last ?? null, status: spend[0]?.last ? "ok" : "unavailable" }),
    metric({ key: "cost_per_lead", label: "Costo per contatto attribuito", value: totalSpend && attributed[0]?.count ? Math.round(totalSpend / attributed[0].count) : null, unit: "cents", definition: "Spesa del periodo / contatti con origine di campagna.", source: "Registro campagne + CRM", status: totalSpend && attributed[0]?.count ? "ok" : "unavailable" }),
    metric({ key: "cost_per_purchase", label: "Costo per acquisto", value: totalSpend && purchases ? Math.round(totalSpend / purchases) : null, unit: "cents", definition: "Spesa del periodo / acquisti conclusi (tutte le origini).", source: "Registro campagne + registro incassi", status: totalSpend && purchases ? "ok" : "unavailable" }),
    metric({ key: "email_sent", label: "Email operative inviate", value: sent, unit: "count", definition: "Email accettate dal provider transazionale nel periodo (tutte le tipologie).", source: integrations.resend.configured ? "Resend (outbox)" : "Outbox (provider da collegare)", status: integrations.resend.configured ? "ok" : "to_connect" }),
    metric({ key: "email_failed", label: "Email non recapitate", value: failed, unit: "count", definition: "Email fallite dopo i tentativi previsti.", source: "Outbox", status: "ok" }),
    metric({ key: "email_campaigns", label: "Andamento campagne email", value: brevoSummary, unit: "text", definition: "Consegne, aperture, clic, disiscrizioni e mancati recapiti riportati dal webhook di Brevo nel periodo (eventi ricevuti, non stime).", source: integrations.brevo.configured ? "Brevo (webhook)" : "Brevo (da collegare)", updatedAt: brevoLast?.toISOString() ?? null, status: integrations.brevo.configured ? (brevoSummary ? "ok" : "unavailable") : "to_connect" }),
  ];
  return json({ days, demo, metrics, integrations: Object.fromEntries(Object.entries(integrations).map(([k, v]) => [k, { configured: v.configured, label: v.label }])) });
}
export { pipelineState };
