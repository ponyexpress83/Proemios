/**
 * Cabina di regia: vendite, finanza, produzione, marketing e tecnologia con
 * dati reali. Ogni indicatore dichiara fonte e stato; se non è disponibile lo
 * dice e spiega perché. Ogni sezione richiede il proprio permesso: un admin
 * delegato vede solo ciò che gli è stato concesso.
 */
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auditEvents, commissions, contracts, invoices, ledgerEntries, paymentOrders, platformSettings, projects, quoteRecords, refundRequests, tasks } from "@/db/platform-schema";
import { crmDeals, jobRuns } from "@/db/crm-schema";
import { aiJobs, aiUsage, docSuggestions, documents, projectCosts, revisionCycles } from "@/db/document-schema";
import { audit, demand, type Actor } from "./access";
import { can } from "./permissions";
import { json, notFound, readBody, PlatformError } from "./http";
import { costRulesSchema } from "./crm-config";
import { approvedAiRules, monthSpentMicros } from "./ai-client";

const DAY = 86400_000;
export type Indicator = { key: string; label: string; value: number | string | null; unit: "count" | "cents" | "pct" | "usd_micros" | "text"; source: string; status: "ok" | "unavailable"; reason?: string; href?: string };
const ok = (key: string, label: string, value: number | string, unit: Indicator["unit"], source: string, href?: string): Indicator => ({ key, label, value, unit, source, status: "ok", href });
const na = (key: string, label: string, unit: Indicator["unit"], source: string, reason: string): Indicator => ({ key, label, value: null, unit, source, status: "unavailable", reason });
const n = async (q: Promise<Array<{ n: number | string | null }>>) => Number((await q)[0]?.n ?? 0);

async function sales(since: Date) {
  const db = getDb();
  const newLeads = await n(db.select({ n: sql<number>`count(*)::int` }).from(leads).where(gte(leads.createdAt, since)));
  const openDeals = await n(db.select({ n: sql<number>`count(*)::int` }).from(crmDeals).where(isNull(crmDeals.closedAt)));
  // Valore della pipeline: imponibile dell'ultima proposta di ciascuna trattativa aperta.
  const pipelineValue = await n(db.select({ n: sql<number>`coalesce(sum(t.amount),0)::bigint` }).from(sql`(select distinct on (${quoteRecords.dealId}) ${quotes.prezzoTotale} as amount from ${quoteRecords} join ${quotes} on ${quotes.id} = ${quoteRecords.quoteId} join ${crmDeals} on ${crmDeals.id} = ${quoteRecords.dealId} where ${crmDeals.closedAt} is null order by ${quoteRecords.dealId}, ${quotes.createdAt} desc) t`));
  const sent = await n(db.select({ n: sql<number>`count(*)::int` }).from(quoteRecords).where(gte(quoteRecords.offeredAt, since)));
  const accepted = await n(db.select({ n: sql<number>`count(distinct ${contracts.quoteId})::int` }).from(contracts).where(gte(contracts.acceptedAt, since)));
  const purchases = await n(db.select({ n: sql<number>`count(distinct ${paymentOrders.quoteId})::int` }).from(paymentOrders).where(and(gte(paymentOrders.updatedAt, since), inArray(paymentOrders.status, ["paid", "partially_refunded", "refunded"]))));
  return [
    ok("new_leads", "Nuovi contatti", newLeads, "count", "CRM (richieste)", "/spazio?tab=leads"),
    ok("open_deals", "Trattative aperte", openDeals, "count", "CRM (trattative)", "/spazio?tab=deals"),
    ok("quotes_sent", "Preventivi inviati", sent, "count", "Proposte offerte nel periodo", "/spazio?tab=quotes"),
    ok("contracts", "Contratti accettati", accepted, "count", "Schede d'ordine accettate", "/spazio?tab=quotes"),
    ok("purchases", "Acquisti conclusi", purchases, "count", "Incassi verificati (Stripe)", "/spazio?tab=finance"),
    newLeads ? ok("conversion", "Conversione contatti → acquisti", Math.round((purchases * 100) / newLeads), "pct", "Acquisti / nuovi contatti nello stesso periodo (indicativo: non segue la singola persona)") : na("conversion", "Conversione contatti → acquisti", "pct", "CRM", "Nessun nuovo contatto nel periodo."),
    ok("pipeline_value", "Valore della pipeline", pipelineValue * 100, "cents", "Imponibile dell'ultima proposta di ogni trattativa aperta", "/spazio?tab=deals"),
  ];
}

async function finance(since: Date) {
  const db = getDb();
  const collected = await n(db.select({ n: sql<number>`coalesce(sum(${ledgerEntries.amountCents}),0)::bigint` }).from(ledgerEntries).where(and(gte(ledgerEntries.createdAt, since), eq(ledgerEntries.kind, "payment"))));
  const refunded = await n(db.select({ n: sql<number>`coalesce(sum(${ledgerEntries.amountCents}),0)::bigint` }).from(ledgerEntries).where(and(gte(ledgerEntries.createdAt, since), eq(ledgerEntries.kind, "refund"))));
  const pendingRows = await db.select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${paymentOrders.amountCents}),0)::bigint` }).from(paymentOrders).where(and(eq(paymentOrders.status, "pending"), isNotNull(paymentOrders.dueAt)));
  const inv = await db.select({ status: invoices.status, n: sql<number>`count(*)::int`, gross: sql<number>`coalesce(sum(${invoices.grossCents}),0)::bigint`, tax: sql<number>`coalesce(sum(${invoices.taxCents}),0)::bigint` }).from(invoices).where(gte(invoices.createdAt, since)).groupBy(invoices.status);
  const refunds = await db.select({ status: refundRequests.status, n: sql<number>`count(*)::int` }).from(refundRequests).groupBy(refundRequests.status);
  const comm = await db.select({ status: commissions.status, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${commissions.amountCents}),0)::bigint` }).from(commissions).groupBy(commissions.status);
  const costs = await n(db.select({ n: sql<number>`coalesce(sum(${projectCosts.amountCents}),0)::bigint` }).from(projectCosts).where(gte(projectCosts.createdAt, since)));
  // IVA: verificata = fatture emesse; stimata = imposta delle schede d'ordine accettate nel periodo.
  const vatEstimate = await n(db.select({ n: sql<number>`coalesce(sum((${contracts.orderSheet}->'amounts'->>'taxCents')::bigint),0)::bigint` }).from(contracts).where(gte(contracts.acceptedAt, since)));
  const issued = inv.filter((i) => ["created", "sent"].includes(i.status));
  const byStatus = (rows: Array<{ status: string; n: number }>) => rows.map((r) => `${r.status}: ${r.n}`).join(" · ") || "nessuna";
  return [
    ok("collected", "Incassato", Number(collected), "cents", "Registro dei pagamenti verificati", "/spazio?tab=finance"),
    ok("refunded", "Rimborsato", -Number(refunded), "cents", "Registro (rimborsi eseguiti)", "/spazio?tab=finance"),
    ok("installments_due", "Rate in sospeso", `${pendingRows[0]?.n ?? 0} rate · ${((Number(pendingRows[0]?.total ?? 0)) / 100).toFixed(2)} €`, "text", "Ordini di pagamento in attesa con scadenza", "/spazio?tab=finance"),
    ok("invoices", "Fatture nel periodo", byStatus(inv), "text", "Fatture in Cloud (coda)", "/spazio?tab=finance"),
    issued.length ? ok("vat_verified", "IVA delle fatture emesse (verificata)", issued.reduce((s, i) => s + Number(i.tax), 0), "cents", "Fatture emesse") : na("vat_verified", "IVA delle fatture emesse (verificata)", "cents", "Fatture in Cloud", "Nessuna fattura emessa nel periodo."),
    ok("vat_estimate", "IVA stimata sui contratti", vatEstimate, "cents", "Schede d'ordine accettate (stima, non fatturato)"),
    ok("refund_requests", "Richieste di rimborso", byStatus(refunds), "text", "Rimborsi", "/spazio?tab=finance"),
    ok("commissions", "Provvigioni per stato", comm.map((c) => `${c.status}: ${c.n} (${(Number(c.total) / 100).toFixed(2)} €)`).join(" · ") || "nessuna", "text", "Registro provvigioni", "/spazio?tab=commissions"),
    ok("direct_costs", "Costi diretti registrati", costs, "cents", "Costi di progetto inseriti (compensi editor, altri)", "/spazio?tab=admin&section=margini"),
  ];
}

async function production(now: Date) {
  const db = getDb();
  const ops = await db.select({ s: projects.opsStatus, n: sql<number>`count(*)::int` }).from(projects).groupBy(projects.opsStatus);
  const c = (s: string) => ops.find((o) => o.s === s)?.n ?? 0;
  const late = await n(db.select({ n: sql<number>`count(*)::int` }).from(projects).where(and(lt(projects.contractualDueAt, now), ne(projects.opsStatus, "concluded"))));
  const jobs = await db.select({ s: aiJobs.status, n: sql<number>`count(*)::int` }).from(aiJobs).groupBy(aiJobs.status);
  const j = (...s: string[]) => jobs.filter((x) => s.includes(x.s)).reduce((t, x) => t + x.n, 0);
  const review = await n(db.select({ n: sql<number>`count(distinct ${docSuggestions.documentId})::int` }).from(docSuggestions).where(eq(docSuggestions.status, "pending")));
  const cycles = await db.select({ s: revisionCycles.status, n: sql<number>`count(*)::int` }).from(revisionCycles).groupBy(revisionCycles.status);
  const load = await db.select({ name: user.name, n: sql<number>`count(*)::int` }).from(tasks).innerJoin(user, eq(user.id, tasks.assignedTo)).where(and(isNotNull(tasks.projectId), ne(tasks.status, "done"))).groupBy(user.name).orderBy(desc(sql`count(*)`)).limit(10);
  return [
    ok("open_projects", "Progetti aperti", ops.filter((o) => o.s !== "concluded").reduce((t, o) => t + o.n, 0), "count", "Progetti", "/spazio?tab=production"),
    ok("to_assign", "Lavori da assegnare", c("ready_for_assignment"), "count", "Stato operativo", "/spazio?tab=production"),
    ok("missing_materials", "In attesa di materiali", c("waiting_materials"), "count", "Stato operativo", "/spazio?tab=production"),
    ok("ai_running", "Lavorazioni AI in corso o in coda", j("queued", "running"), "count", "Coda AI", "/spazio?tab=production"),
    ok("ai_attention", "Lavorazioni AI ferme o fallite", j("paused", "failed", "blocked"), "count", "Coda AI", "/spazio?tab=production"),
    ok("human_review", "Documenti con proposte da controllare", review, "count", "Document Studio", "/spazio?tab=production"),
    ok("client_revisions", "Revisioni richieste dai clienti", cycles.filter((x) => !["delivered", "rejected"].includes(x.s)).reduce((t, x) => t + x.n, 0), "count", "Cicli di revisione", "/spazio?tab=production"),
    ok("quality_check", "In controllo qualità", c("quality_check"), "count", "Stato operativo", "/spazio?tab=production"),
    ok("late", "Progetti oltre la data contrattuale", late, "count", "Data contrattuale nella scheda d'ordine", "/spazio?tab=production"),
    ok("operator_load", "Carico degli operatori (compiti aperti)", load.map((l) => `${l.name}: ${l.n}`).join(" · ") || "nessun compito aperto", "text", "Compiti di progetto"),
  ];
}

async function technology(now: Date) {
  const db = getDb();
  const { diagnostics } = await import("./diagnostics");
  const items = await diagnostics(now);
  const runsWithError = await n(db.select({ n: sql<number>`count(*)::int` }).from(jobRuns).where(and(eq(jobRuns.status, "error"), gte(jobRuns.startedAt, new Date(now.getTime() - DAY)))));
  const failures = await n(db.select({ n: sql<number>`count(*)::int` }).from(auditEvents).where(and(gte(auditEvents.createdAt, new Date(now.getTime() - DAY)), sql`${auditEvents.action} like '%failed%'`)));
  const rules = await approvedAiRules();
  const spent = await monthSpentMicros(now);
  return [
    ...items.map((i) => ({ key: `svc_${i.key}`, label: i.label, value: i.state, unit: "text" as const, source: i.detail, status: "ok" as const, href: "/spazio?tab=crm-settings&section=diagnostics" })),
    ok("job_errors", "Attività automatiche con errore (24 h)", runsWithError, "count", "Registro delle esecuzioni", "/spazio?tab=crm-settings&section=automation"),
    ok("failures", "Operazioni fallite registrate (24 h)", failures, "count", "Registro di audit"),
    ok("ai_month", "Spesa AI del mese", spent, "usd_micros", rules ? `Tetto mensile approvato: ${rules.monthlyCapUsd} $` : "Regole AI non ancora approvate"),
  ];
}

/** Marginalità per progetto: imponibile − provvigioni − costo AI − costi diretti. Se manca un dato, il margine non si calcola e si dice cosa manca. */
export async function projectMargins(limit = 100) {
  const db = getDb();
  const rows = await db.select({ id: projects.id, title: projects.title, quoteId: projects.quoteId, opsStatus: projects.opsStatus, createdAt: projects.createdAt }).from(projects).where(isNotNull(projects.quoteId)).orderBy(desc(projects.createdAt)).limit(limit);
  if (!rows.length) return { rows: [], fx: null, missing: [] as string[] };
  const ids = rows.map((r) => r.id), quoteIds = rows.map((r) => r.quoteId!) as string[];
  const sheets = await db.select({ quoteId: contracts.quoteId, version: contracts.version, net: sql<number>`(${contracts.orderSheet}->'amounts'->>'netCents')::bigint`, service: sql<string>`${contracts.orderSheet}->>'service'` }).from(contracts).where(inArray(contracts.quoteId, quoteIds)).orderBy(desc(contracts.version));
  const comm = await db.select({ quoteId: paymentOrders.quoteId, total: sql<number>`coalesce(sum(${commissions.amountCents}),0)::bigint` }).from(commissions).innerJoin(paymentOrders, eq(paymentOrders.id, commissions.orderId)).where(and(inArray(paymentOrders.quoteId, quoteIds), notInArray(commissions.status, ["held"]))).groupBy(paymentOrders.quoteId);
  const ai = await db.select({ projectId: aiUsage.projectId, micros: sql<number>`coalesce(sum(${aiUsage.costMicros}),0)::bigint` }).from(aiUsage).where(inArray(aiUsage.projectId, ids)).groupBy(aiUsage.projectId);
  const direct = await db.select({ projectId: projectCosts.projectId, kind: projectCosts.kind, total: sql<number>`coalesce(sum(${projectCosts.amountCents}),0)::bigint` }).from(projectCosts).where(inArray(projectCosts.projectId, ids)).groupBy(projectCosts.projectId, projectCosts.kind);
  const cyclesRows = await db.select({ projectId: revisionCycles.projectId, n: sql<number>`count(*)::int` }).from(revisionCycles).where(inArray(revisionCycles.projectId, ids)).groupBy(revisionCycles.projectId);
  const [fxRow] = await db.select().from(platformSettings).where(eq(platformSettings.key, "cost-rules")).limit(1);
  const fx = costRulesSchema.safeParse(fxRow?.value);
  const rate = fx.success ? fx.data.usdToEurRate : null;
  const out = rows.map((p) => {
    const sheet = sheets.find((s) => s.quoteId === p.quoteId);
    const priceCents = sheet ? Number(sheet.net) : null;
    const commissionCents = Number(comm.find((c) => c.quoteId === p.quoteId)?.total ?? 0);
    const aiMicros = Number(ai.find((a) => a.projectId === p.id)?.micros ?? 0);
    const aiCents = aiMicros === 0 ? 0 : rate ? Math.round((aiMicros / 1_000_000) * rate * 100) : null;
    const editorCents = Number(direct.find((d) => d.projectId === p.id && d.kind === "editor_fee")?.total ?? 0);
    const otherCents = Number(direct.find((d) => d.projectId === p.id && d.kind === "other")?.total ?? 0);
    const missing = [...(priceCents === null ? ["prezzo (contratto non trovato)"] : []), ...(aiCents === null ? ["cambio USD→EUR per il costo AI"] : [])];
    const marginCents = missing.length ? null : priceCents! - commissionCents - aiCents! - editorCents - otherCents;
    return { projectId: p.id, title: p.title, service: sheet?.service ?? null, opsStatus: p.opsStatus, priceCents, commissionCents, aiUsdMicros: aiMicros, aiCents, editorCents, otherCents, marginCents, marginPct: marginCents !== null && priceCents ? Math.round((marginCents * 1000) / priceCents) / 10 : null, revisionCycles: Number(cyclesRows.find((c) => c.projectId === p.id)?.n ?? 0), missing };
  });
  const byService = Object.values(out.reduce<Record<string, { service: string; projects: number; price: number; margin: number; complete: number }>>((acc, r) => {
    const k = r.service ?? "non indicato";
    acc[k] ??= { service: k, projects: 0, price: 0, margin: 0, complete: 0 };
    acc[k].projects++;
    if (r.marginCents !== null && r.priceCents) { acc[k].price += r.priceCents; acc[k].margin += r.marginCents; acc[k].complete++; }
    return acc;
  }, {})).map((s) => ({ ...s, marginPct: s.price ? Math.round((s.margin * 1000) / s.price) / 10 : null }));
  return { rows: out, byService, fx: rate, missing: rate ? [] : ["Cambio USD→EUR non approvato in Impostazioni CRM → Costi: il costo AI resta in dollari e il margine dei progetti con lavorazioni AI non si calcola."] };
}

const costInput = z.object({ kind: z.enum(["editor_fee", "other"]), amountCents: z.number().int().min(1).max(10_000_000), description: z.string().trim().min(3).max(300) }).strict();
/** Costi diretti del progetto inseriti a mano: compenso editor, altri costi. Chi li inserisce resta registrato. */
export async function projectCostCollection(request: Request, actor: Actor, projectId: string) {
  if (!can(actor.grants, "finance.record") && !can(actor.grants, "settings.manage")) demand(actor, "finance.record");
  const [project] = await getDb().select({ id: projects.id }).from(projects).where(eq(projects.id, projectId));
  if (!project) throw notFound();
  if (request.method === "GET") return json({ costs: await getDb().select().from(projectCosts).where(eq(projectCosts.projectId, projectId)).orderBy(desc(projectCosts.createdAt)) });
  if (request.method !== "POST") throw notFound();
  const body = await readBody(request, costInput);
  const [cost] = await getDb().insert(projectCosts).values({ projectId, ...body, createdBy: actor.id }).returning();
  await audit(actor, "project.cost_added", "project", projectId, { kind: body.kind, amountCents: body.amountCents });
  return json({ cost }, 201);
}

/** Cabina di regia: solo le sezioni consentite dai permessi di chi la apre. */
export async function adminDashboard(request: Request, actor: Actor, section?: string) {
  if (request.method !== "GET") throw notFound();
  const days = Math.min(365, Math.max(7, Number(new URL(request.url).searchParams.get("giorni") ?? 30) || 30));
  const now = new Date(), since = new Date(now.getTime() - days * DAY);
  if (section === "margins") {
    if (!can(actor.grants, "finance.read")) throw new PlatformError(403, "FORBIDDEN", "La marginalità richiede il permesso sulla finanza.");
    return json(await projectMargins());
  }
  const allowed = {
    sales: can(actor.grants, "report.read") || can(actor.grants, "settings.manage"),
    finance: can(actor.grants, "finance.read"),
    production: can(actor.grants, "operations.read") || can(actor.grants, "project.assign"),
    marketing: can(actor.grants, "marketing.read"),
    technology: can(actor.grants, "operations.read") || can(actor.grants, "integrations.manage"),
  };
  if (!Object.values(allowed).some(Boolean)) throw new PlatformError(403, "FORBIDDEN", "Nessuna sezione della cabina di regia è consentita al tuo profilo.");
  let marketing: Indicator[] | null = null;
  if (allowed.marketing) {
    const { marketingDashboard } = await import("./marketing");
    const res = await marketingDashboard(new Request(`http://local/x?giorni=${days}`), actor);
    const data = (await res.json()) as { metrics: Array<{ key: string; label: string; value: number | string | null; unit?: string; source: string; status: string; definition: string }> };
    marketing = data.metrics.map((m) => (m.status === "ok" ? ok(m.key, m.label, m.value ?? 0, (m.unit === "pct" || m.unit === "cents" || m.unit === "text" ? m.unit : "count") as Indicator["unit"], m.source, "/spazio?tab=marketing") : na(m.key, m.label, "text", m.source, m.status === "to_connect" ? "Integrazione da collegare." : m.status === "unauthorized" ? "Non consentito al tuo profilo." : m.definition)));
  }
  return json({
    days,
    generatedAt: now.toISOString(),
    owner: actor.roles.includes("owner"),
    sections: {
      sales: allowed.sales ? await sales(since) : null,
      finance: allowed.finance ? await finance(since) : null,
      production: allowed.production ? await production(now) : null,
      marketing,
      technology: allowed.technology ? await technology(now) : null,
    },
    open: { documents: Number((await getDb().select({ n: sql<number>`count(*)::int` }).from(documents))[0]?.n ?? 0) },
  });
}
