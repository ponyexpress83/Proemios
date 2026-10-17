/**
 * «Il mio lavoro»: una sola fonte per elenco, Kanban e calendario. Ogni voce
 * ha responsabile, scadenza, priorità, stato e il collegamento al record
 * d'origine; spostare una scheda chiama l'aggiornamento del record vero
 * (trattativa, compito, progetto), non una copia. Riepilogo del mattino,
 * attività personali, richieste di assistenza e report.
 */
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmApprovals, crmContacts, crmDeals, crmHandoffItems, crmHandoffs, supportRequests, teamProfiles } from "@/db/crm-schema";
import { leadOwnership, paymentOrders, platformSettings, projects, tasks, memberships } from "@/db/platform-schema";
import { PRIORITIES } from "@/lib/crm-core/rules";
import { localParts } from "@/lib/crm-core/hours";
import { can, effectiveGrants, type Membership } from "./permissions";
import { demand, demandAvailable, projectAccess, audit, type Actor } from "./access";
import { json, notFound, forbidden, PlatformError, readBody } from "./http";
import { DEFAULT_PIPELINE, dealFacts, dealStage, pipelines } from "./crm-relations";
import { dealDetail } from "./crm-deals";
import { projectOps, taskStatus, OPS_LABELS, OPS_STATUSES } from "./crm-handoff";
import { notify } from "./crm-notify";
import { assignmentRules } from "./crm-routing";
import { lossReasons } from "./crm-deals";
import { PAID_STATUSES } from "./pipeline";

type WorkItem = { type: "lead" | "deal" | "task" | "project" | "approval" | "question" | "support"; id: string; title: string; ownerId: string | null; dueAt: Date | null; priority: string; status: string; column: string; href: string; source: { type: string; id: string }; movable: boolean };
const TASK_COLUMNS = ["todo", "in_progress", "blocked", "done"];

async function collect(actor: Actor): Promise<WorkItem[]> {
  const db = getDb();
  const items: WorkItem[] = [];
  if (can(actor.grants, "crm.read", { assigned: true })) {
    const myLeads = await db.select({ lead: leads }).from(leads).innerJoin(leadOwnership, eq(leadOwnership.leadId, leads.id)).where(and(eq(leadOwnership.assignedTo, actor.id), isNull(leads.firstResponseAt), sql`${leads.stage} not in ('won','lost','unreachable')`)).limit(100);
    for (const { lead } of myLeads) items.push({ type: "lead", id: lead.id, title: `Primo contatto: ${lead.nome}`, ownerId: actor.id, dueAt: lead.slaDueAt, priority: lead.priority, status: lead.assignmentStatus === "reserved" ? "reserved" : "new", column: "todo", href: `/spazio?lead=${lead.id}`, source: { type: "lead", id: lead.id }, movable: false });
    const myDeals = await db.select({ deal: crmDeals, contact: crmContacts.name }).from(crmDeals).innerJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId)).where(and(eq(crmDeals.ownerId, actor.id), isNull(crmDeals.closedAt))).limit(200);
    const facts = await dealFacts(db, myDeals.map((d) => d.deal.id));
    const all = await pipelines(db);
    for (const { deal, contact } of myDeals) {
      const state = dealStage(deal, all.find((p) => p.key === deal.pipelineKey) ?? DEFAULT_PIPELINE, facts);
      if (state.status !== "open") continue;
      items.push({ type: "deal", id: deal.id, title: `${deal.nextAction ?? "Prossima azione da definire"} · ${contact}`, ownerId: actor.id, dueAt: deal.nextActionAt, priority: deal.priority, status: state.stage, column: state.stage, href: `/spazio?tab=deals&deal=${deal.id}`, source: { type: "deal", id: deal.id }, movable: true });
    }
    const questions = await db.select({ i: crmHandoffItems }).from(crmHandoffItems).innerJoin(crmHandoffs, eq(crmHandoffs.projectId, crmHandoffItems.projectId)).where(and(eq(crmHandoffs.sellerId, actor.id), eq(crmHandoffItems.kind, "question"), eq(crmHandoffItems.status, "open")));
    for (const { i } of questions) items.push({ type: "question", id: i.id, title: `Domanda della produzione: ${i.body.slice(0, 80)}`, ownerId: actor.id, dueAt: null, priority: "high", status: "open", column: "todo", href: `/spazio?progetto=${i.projectId}`, source: { type: "project", id: i.projectId }, movable: false });
  }
  const myTasks = await db.select().from(tasks).where(and(eq(tasks.assignedTo, actor.id), eq(tasks.done, false))).limit(200);
  for (const t of myTasks) items.push({ type: "task", id: t.id, title: t.title, ownerId: actor.id, dueAt: t.dueAt, priority: t.priority, status: t.status, column: t.status, href: t.projectId ? `/spazio?progetto=${t.projectId}` : t.dealId ? `/spazio?tab=deals&deal=${t.dealId}` : t.leadId ? `/spazio?lead=${t.leadId}` : "/spazio?tab=work", source: { type: t.projectId ? "project" : t.dealId ? "deal" : t.leadId ? "lead" : "task", id: t.projectId ?? t.dealId ?? t.leadId ?? t.id }, movable: true });
  if (can(actor.grants, "project.assign") || actor.roles.includes("coordinator")) {
    const led = await db.select().from(projects).where(and(or(eq(projects.opsLeadId, actor.id), can(actor.grants, "project.assign") ? eq(projects.opsStatus, "ready_for_assignment") : sql`false`), sql`${projects.opsStatus} <> 'concluded'`)).limit(100);
    for (const p of led) items.push({ type: "project", id: p.id, title: `${p.title} · ${OPS_LABELS[p.opsStatus as keyof typeof OPS_LABELS] ?? p.opsStatus}`, ownerId: p.opsLeadId, dueAt: p.contractualDueAt, priority: "normal", status: p.opsStatus, column: p.opsStatus, href: `/spazio?progetto=${p.id}`, source: { type: "project", id: p.id }, movable: true });
  }
  if (can(actor.grants, "quote.approve")) {
    const pending = await db.select().from(crmApprovals).where(and(eq(crmApprovals.status, "pending"), sql`${crmApprovals.requestedBy} <> ${actor.id}`)).limit(50);
    for (const a of pending) items.push({ type: "approval", id: a.id, title: `Eccezione da decidere: ${a.kind}`, ownerId: actor.id, dueAt: null, priority: "high", status: "pending", column: "todo", href: "/spazio?tab=approvals", source: { type: "quote", id: a.quoteId ?? a.id }, movable: false });
  }
  if (can(actor.grants, "support.read", { assigned: true })) {
    const support = await db.select().from(supportRequests).where(and(eq(supportRequests.assignedTo, actor.id), sql`${supportRequests.status} <> 'resolved'`)).limit(50);
    for (const s of support) items.push({ type: "support", id: s.id, title: `Assistenza: ${s.subject}`, ownerId: actor.id, dueAt: null, priority: s.priority, status: s.status, column: s.status === "open" ? "todo" : "in_progress", href: `/spazio?tab=support&id=${s.id}`, source: { type: s.projectId ? "project" : "support", id: s.projectId ?? s.id }, movable: false });
  }
  return items;
}
const rank = { urgent: 0, high: 1, normal: 2, low: 3 } as Record<string, number>;
export async function workBoard(request: Request, actor: Actor) {
  if (request.method === "POST") return personalTask(request, actor);
  if (request.method !== "GET") throw notFound();
  const p = new URL(request.url).searchParams;
  const view = p.get("view") ?? "list";
  const items = (await collect(actor)).sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2));
  const now = new Date();
  if (view === "calendar") {
    const from = p.get("from") ? new Date(p.get("from")!) : new Date(now.getTime() - 7 * 86400_000), to = p.get("to") ? new Date(p.get("to")!) : new Date(now.getTime() + 28 * 86400_000);
    const days: Record<string, WorkItem[]> = {};
    for (const i of items.filter((i) => i.dueAt && i.dueAt >= from && i.dueAt <= to)) (days[localParts(i.dueAt!, "Europe/Rome").ymd] ??= []).push(i);
    return json({ view, days, undated: items.filter((i) => !i.dueAt).length });
  }
  const columns = { deal: DEFAULT_PIPELINE.stages.filter((s) => s.kind === "open").map((s) => ({ key: s.key, label: s.label, manual: s.manual })), task: TASK_COLUMNS, project: OPS_STATUSES.map((k) => ({ key: k, label: OPS_LABELS[k] })) };
  return json({ view, items: items.map((i) => ({ ...i, overdue: Boolean(i.dueAt && i.dueAt < now) })), columns });
}
/** Spostamento di una scheda: aggiorna il record vero con le sue regole. */
export async function workMove(request: Request, actor: Actor, type: string, id: string) {
  if (request.method !== "PATCH") throw notFound();
  const body = await readBody(request, z.object({ to: z.string().min(2).max(40), lostReasonKey: z.string().max(40).optional(), lostNote: z.string().max(1000).optional() }).strict());
  const forward = (payload: unknown) => new Request(request.url, { method: "PATCH", headers: request.headers, body: JSON.stringify(payload) });
  if (type === "deal") return dealDetail(forward({ stage: body.to, ...(body.lostReasonKey ? { lostReasonKey: body.lostReasonKey } : {}), ...(body.lostNote ? { lostNote: body.lostNote } : {}) }), actor, id);
  if (type === "task") return taskStatus(forward({ status: body.to }), actor, id);
  if (type === "project") return projectOps(forward({ opsStatus: body.to }), actor, id);
  throw notFound();
}
/** Attività personale semplice (anche collegata a una trattativa). */
async function personalTask(request: Request, actor: Actor) {
  demandAvailable(actor, "task.write");
  const body = await readBody(request, z.object({ title: z.string().trim().min(2).max(200), dueAt: z.string().datetime().optional(), priority: z.enum(PRIORITIES).default("normal"), dealId: z.string().uuid().optional() }).strict());
  if (body.dealId) {
    const [deal] = await getDb().select().from(crmDeals).where(eq(crmDeals.id, body.dealId));
    if (!deal || !(can(actor.grants, "crm.write") || deal.ownerId === actor.id)) throw notFound();
  }
  const [task] = await getDb().insert(tasks).values({ title: body.title, dueAt: body.dueAt ? new Date(body.dueAt) : null, priority: body.priority, dealId: body.dealId ?? null, assignedTo: actor.id, createdBy: actor.id, internal: true }).returning();
  return json({ task }, 201);
}
/** Riepilogo del mattino: scadenze, ritardi, nuovi contatti e ordini, eccezioni e domande in attesa. */
export async function morningSummary(actor: Pick<Actor, "id" | "grants" | "roles">, now = new Date()) {
  const db = getDb();
  const items = await collect(actor as Actor);
  const dayStart = new Date(now.getTime() - 24 * 3600_000);
  const endOfDay = new Date(now.getTime() + 24 * 3600_000);
  const myDeals = await db.select({ id: crmDeals.id }).from(crmDeals).where(eq(crmDeals.ownerId, actor.id));
  const dealQuotes = myDeals.length ? await db.select({ id: quotes.id }).from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(inArray(leads.dealId, myDeals.map((d) => d.id))) : [];
  const orders = dealQuotes.length ? await db.select().from(paymentOrders).where(and(inArray(paymentOrders.quoteId, dealQuotes.map((q) => q.id)), inArray(paymentOrders.status, PAID_STATUSES), gte(paymentOrders.updatedAt, dayStart))) : [];
  const newLeads = await db.select({ id: leads.id }).from(leads).innerJoin(leadOwnership, eq(leadOwnership.leadId, leads.id)).where(and(eq(leadOwnership.assignedTo, actor.id), gte(leads.createdAt, dayStart)));
  return {
    overdue: items.filter((i) => i.dueAt && i.dueAt < now).length,
    dueToday: items.filter((i) => i.dueAt && i.dueAt >= now && i.dueAt < endOfDay).length,
    newLeads: newLeads.length,
    newOrders: orders.length,
    waiting: items.filter((i) => i.type === "approval" || i.type === "question").length,
    firstContacts: items.filter((i) => i.type === "lead").length,
    total: items.length,
  };
}
export async function workSummary(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  return json({ summary: await morningSummary(actor) });
}
/** Dal cron: un riepilogo al giorno per persona del team, dopo le 8 nel fuso dell'ufficio. */
export async function runMorningSummaries(now = new Date()) {
  const rules = await assignmentRules();
  const local = localParts(now, rules.hours.timezone);
  if (local.minutes < 8 * 60 || !rules.hours.days.includes(local.weekday)) return { sent: 0 };
  const key = `morning-summary:${local.ymd}`;
  const claimed = await getDb().insert(platformSettings).values({ key, value: { at: now.toISOString() } }).onConflictDoNothing().returning();
  if (!claimed.length) return { sent: 0 };
  const rows = await getDb().select().from(memberships).where(eq(memberships.active, true));
  const byUser = new Map<string, Membership[]>();
  for (const r of rows) if (r.role !== "author" && r.role !== "affiliate") byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  let sent = 0;
  for (const [userId, list] of byUser) {
    const summary = await morningSummary({ id: userId, grants: effectiveGrants(list), roles: list.map((m) => m.role) }, now);
    if (!summary.total && !summary.newOrders) continue;
    await getDb().transaction((tx) => notify(tx, userId, "morning_summary", { key: `${local.ymd}`, title: "Il tuo lavoro di oggi", body: `${summary.overdue} in ritardo · ${summary.dueToday} in scadenza oggi · ${summary.firstContacts} primi contatti · ${summary.newLeads} nuovi contatti e ${summary.newOrders} nuovi incassi da ieri · ${summary.waiting} in attesa di te.`, href: "/spazio?tab=work" }));
    sent++;
  }
  return { sent };
}

// ── Assistenza ──────────────────────────────────────────────────────────────
export async function supportCollection(request: Request, actor: Actor, id?: string) {
  if (request.method === "POST" && !id) {
    const body = await readBody(request, z.object({ subject: z.string().trim().min(3).max(200), body: z.string().trim().min(5).max(5000), projectId: z.string().uuid().optional(), quoteId: z.string().uuid().optional(), priority: z.enum(PRIORITIES).default("normal") }).strict());
    let assignee: string | null = null, contactId: string | null = null, orderId: string | null = null;
    if (body.projectId) {
      const access = await projectAccess(actor, body.projectId, "project.read");
      if (!actor.staff && !access.resource.own) throw notFound();
      assignee = access.project.opsLeadId ?? access.project.referentId;
    }
    if (body.quoteId) {
      const [q] = await getDb().select({ leadId: quotes.leadId }).from(quotes).where(eq(quotes.id, body.quoteId));
      const [owner] = q ? await getDb().select().from(leadOwnership).where(eq(leadOwnership.leadId, q.leadId)) : [];
      if (!owner || (owner.authorId !== actor.id && !actor.staff)) throw notFound();
      assignee ??= owner.assignedTo;
      const [order] = await getDb().select({ id: paymentOrders.id }).from(paymentOrders).where(eq(paymentOrders.quoteId, body.quoteId)).orderBy(desc(paymentOrders.createdAt)).limit(1);
      orderId = order?.id ?? null;
    }
    const [contact] = await getDb().select({ id: crmContacts.id }).from(crmContacts).where(and(eq(crmContacts.userId, actor.id), isNull(crmContacts.mergedIntoId)));
    contactId = contact?.id ?? null;
    const [saved] = await getDb().transaction(async (tx) => {
      const rows = await tx.insert(supportRequests).values({ ...body, authorId: actor.id, contactId, orderId, assignedTo: assignee }).returning();
      if (assignee) await notify(tx, assignee, "support_request", { key: rows[0]!.id, title: "Nuova richiesta di assistenza", body: body.subject, href: `/spazio?tab=support&id=${rows[0]!.id}` });
      return rows;
    });
    return json({ request: { id: saved!.id, status: saved!.status } }, 201);
  }
  if (request.method === "GET" && !id) {
    if (!actor.staff) return json({ requests: await getDb().select({ id: supportRequests.id, subject: supportRequests.subject, status: supportRequests.status, createdAt: supportRequests.createdAt, projectId: supportRequests.projectId }).from(supportRequests).where(eq(supportRequests.authorId, actor.id)).orderBy(desc(supportRequests.createdAt)) });
    demandAvailable(actor, "support.read");
    return json({ requests: await getDb().select().from(supportRequests).where(can(actor.grants, "support.read") ? sql`true` : eq(supportRequests.assignedTo, actor.id)).orderBy(desc(supportRequests.createdAt)).limit(200) });
  }
  if (request.method === "PATCH" && id) {
    demandAvailable(actor, "support.write");
    const [row] = await getDb().select().from(supportRequests).where(eq(supportRequests.id, id));
    if (!row || !(can(actor.grants, "support.write") || row.assignedTo === actor.id)) throw notFound();
    const body = await readBody(request, z.object({ status: z.enum(["open", "in_progress", "resolved"]).optional(), assignedTo: z.string().min(1).max(100).nullable().optional() }).strict());
    if (body.assignedTo !== undefined && !can(actor.grants, "support.write")) throw forbidden();
    await getDb().update(supportRequests).set({ ...body, resolvedAt: body.status === "resolved" ? new Date() : row.resolvedAt, updatedAt: new Date() }).where(eq(supportRequests.id, id));
    await audit(actor, "support.updated", "support", id, body);
    return json({ ok: true });
  }
  throw notFound();
}

// ── Report ──────────────────────────────────────────────────────────────────
const median = (values: number[]) => (values.length ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)]! : null);
export async function crmReports(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demand(actor, "report.read");
  const p = new URL(request.url).searchParams;
  const from = p.get("from") ? new Date(p.get("from")!) : new Date(Date.now() - 90 * 86400_000), to = p.get("to") ? new Date(p.get("to")!) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new PlatformError(422, "INVALID_RANGE", "Intervallo di date non valido.");
  const db = getDb(), now = new Date();
  const leadRows = await db.select({ lead: leads, owner: leadOwnership.assignedTo }).from(leads).leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id)).where(and(gte(leads.createdAt, from), lte(leads.createdAt, to)));
  const responded = leadRows.filter((r) => r.lead.firstResponseAt);
  const minutes = responded.map((r) => Math.round((r.lead.firstResponseAt!.getTime() - r.lead.createdAt.getTime()) / 60000));
  const withinSla = responded.filter((r) => r.lead.slaDueAt && r.lead.firstResponseAt! <= r.lead.slaDueAt).length;
  const deals = await db.select().from(crmDeals).where(and(gte(crmDeals.createdAt, from), lte(crmDeals.createdAt, to)));
  const facts = await dealFacts(db, deals.map((d) => d.id));
  const all = await pipelines(db);
  const states = deals.map((d) => ({ d, s: dealStage(d, all.find((x) => x.key === d.pipelineKey) ?? DEFAULT_PIPELINE, facts) }));
  const sourceOf = new Map(leadRows.map((r) => [r.lead.id, r.lead.sourceKind ?? r.lead.fonte]));
  const bySource: Record<string, { leads: number; won: number; lost: number; open: number }> = {};
  for (const r of leadRows) (bySource[r.lead.sourceKind ?? r.lead.fonte] ??= { leads: 0, won: 0, lost: 0, open: 0 }).leads++;
  for (const { d, s } of states) {
    const src = (d.originLeadId && sourceOf.get(d.originLeadId)) || "altro";
    (bySource[src] ??= { leads: 0, won: 0, lost: 0, open: 0 })[s.status]++;
  }
  const byOwner: Record<string, { open: number; won: number; lost: number; medianResponseMinutes: number | null }> = {};
  for (const { d, s } of states) if (d.ownerId) (byOwner[d.ownerId] ??= { open: 0, won: 0, lost: 0, medianResponseMinutes: null })[s.status]++;
  for (const owner of Object.keys(byOwner)) byOwner[owner]!.medianResponseMinutes = median(responded.filter((r) => r.owner === owner).map((r) => Math.round((r.lead.firstResponseAt!.getTime() - r.lead.createdAt.getTime()) / 60000)));
  const openDeals = await db.select({ owner: crmDeals.ownerId, n: sql<number>`count(*)::int` }).from(crmDeals).where(isNull(crmDeals.closedAt)).groupBy(crmDeals.ownerId);
  const openTasks = await db.select({ owner: tasks.assignedTo, n: sql<number>`count(*)::int` }).from(tasks).where(eq(tasks.done, false)).groupBy(tasks.assignedTo);
  const profiles = await db.select({ userId: teamProfiles.userId, capacity: teamProfiles.capacity }).from(teamProfiles);
  const names = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...new Set([...openDeals.map((o) => o.owner), ...openTasks.map((o) => o.owner), ...Object.keys(byOwner)].filter(Boolean) as string[]), "-"]));
  const reasons = await lossReasons();
  const lost = states.filter((x) => x.s.status === "lost");
  return json({
    range: { from, to },
    responseTimes: { requests: leadRows.length, responded: responded.length, medianMinutes: median(minutes), withinSlaShare: responded.length ? withinSla / responded.length : null, waiting: leadRows.filter((r) => !r.lead.firstResponseAt).length, escalated: leadRows.filter((r) => r.lead.escalatedAt).length, unassigned: leadRows.filter((r) => !r.owner).length },
    conversion: { bySource, byOwner, deals: deals.length, won: states.filter((x) => x.s.status === "won").length, rate: deals.length ? states.filter((x) => x.s.status === "won").length / deals.length : null },
    load: { sales: openDeals.map((o) => ({ userId: o.owner, name: names.find((n) => n.id === o.owner)?.name ?? null, openDeals: Number(o.n), capacity: profiles.find((p) => p.userId === o.owner)?.capacity ?? null })), operations: openTasks.filter((o) => o.owner).map((o) => ({ userId: o.owner, name: names.find((n) => n.id === o.owner)?.name ?? null, openTasks: Number(o.n), capacity: profiles.find((p) => p.userId === o.owner)?.capacity ?? null })) },
    delays: {
      overdueNextActions: (await db.select({ n: sql<number>`count(*)::int` }).from(crmDeals).where(and(isNull(crmDeals.closedAt), lt(crmDeals.nextActionAt, now))))[0]?.n ?? 0,
      dealsWithoutNextAction: (await db.select({ n: sql<number>`count(*)::int` }).from(crmDeals).where(and(isNull(crmDeals.closedAt), or(isNull(crmDeals.nextAction), isNull(crmDeals.nextActionAt)))))[0]?.n ?? 0,
      overdueTasks: (await db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(and(eq(tasks.done, false), lt(tasks.dueAt, now))))[0]?.n ?? 0,
      projectsPastContractualDate: (await db.select({ n: sql<number>`count(*)::int` }).from(projects).where(and(lt(projects.contractualDueAt, now), sql`${projects.opsStatus} <> 'concluded'`)))[0]?.n ?? 0,
    },
    lossReasons: reasons.reasons.map((r) => ({ key: r.key, label: r.label, count: lost.filter((x) => x.d.lostReasonKey === r.key).length })),
    method: "Conteggi sui dati registrati, senza punteggi automatici: ogni numero si ricostruisce dai record.",
  });
}
