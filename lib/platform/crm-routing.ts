/**
 * Instradamento delle richieste: automatico (predefinito), manuale o coda a
 * scelta libera. Le regole sono versionate (`assignment-rules`); ogni
 * decisione resta nella storia delle assegnazioni con il motivo. Una
 * trattativa in corso non viene mai riassegnata in automatico perché il
 * venditore è offline: le scadenze mancate producono un avviso, non uno spostamento.
 */
import { and, eq, inArray, isNull, lt, sql, notInArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmAssignments, crmDeals, teamProfiles } from "@/db/crm-schema";
import { leadActivities, leadOwnership, memberships } from "@/db/platform-schema";
import { chooseAssignee, type AssignmentCandidate } from "@/lib/crm-core/assignment";
import { addBusinessMinutes, isWithinHours } from "@/lib/crm-core/hours";
import { assignmentRulesSchema, defaultAssignmentRules, type AssignmentRules, type AssignmentMode, type Priority } from "@/lib/crm-core/rules";
import { can, effectiveGrants, type Membership } from "./permissions";
import { attachLead, emitEvent, readSetting, type Reader, type Tx } from "./crm-relations";
import { notify } from "./crm-notify";
import { demandAvailable, demand, audit, type Actor } from "./access";
import { json, notFound, PlatformError, readBody } from "./http";

export const assignmentRules = (db: Reader = getDb()) => readSetting<AssignmentRules>("assignment-rules", assignmentRulesSchema, defaultAssignmentRules, db);
const CLOSED = ["won", "lost", "unreachable"];

/** Persone che possono ricevere richieste: venditori attivi e chi ha scelto di partecipare con i permessi CRM. */
export async function salesCandidates(db: Reader) {
  const rows = await db
    .select({ userId: memberships.userId, role: memberships.role, grants: memberships.grants, active: memberships.active, verified: user.emailVerified })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId));
  const byUser = new Map<string, { memberships: Membership[]; verified: boolean; seller: boolean }>();
  for (const r of rows) {
    const entry = byUser.get(r.userId) ?? { memberships: [], verified: r.verified, seller: false };
    entry.memberships.push({ role: r.role, grants: r.grants, active: r.active });
    if (r.role === "seller" && r.active) entry.seller = true;
    byUser.set(r.userId, entry);
  }
  const ids = [...byUser.keys()];
  const profiles = ids.length ? await db.select().from(teamProfiles).where(inArray(teamProfiles.userId, ids)) : [];
  const loads = ids.length
    ? await db.select({ owner: crmDeals.ownerId, count: sql<number>`count(*)::int` }).from(crmDeals).where(and(inArray(crmDeals.ownerId, ids), isNull(crmDeals.closedAt))).groupBy(crmDeals.ownerId)
    : [];
  const out: Array<AssignmentCandidate & { name?: string }> = [];
  for (const [userId, entry] of byUser) {
    const grants = effectiveGrants(entry.memberships);
    const canSell = can(grants, "crm.write", { assigned: true });
    if (!canSell) continue;
    const profile = profiles.find((p) => p.userId === userId);
    // I venditori partecipano salvo diversa scelta; gli altri ruoli solo se lo dichiarano nel profilo.
    const participates = profile ? profile.participates : entry.seller;
    if (!entry.seller && !profile?.participates) continue;
    out.push({
      userId,
      active: entry.memberships.some((m) => m.active) && !profile?.deactivatedAt,
      verified: entry.verified,
      participates,
      skills: profile?.skills ?? [],
      languages: profile?.languages ?? ["it"],
      hours: profile?.hours ?? null,
      absences: profile?.absences ?? [],
      capacity: profile?.capacity ?? null,
      openLoad: Number(loads.find((l) => l.owner === userId)?.count ?? 0),
      lastAssignedAt: profile?.lastAssignedAt ?? null,
    });
  }
  return out.sort((a, b) => a.userId.localeCompare(b.userId));
}
async function managers(db: Reader): Promise<string[]> {
  const rows = await db.select({ userId: memberships.userId, role: memberships.role, grants: memberships.grants, active: memberships.active }).from(memberships).where(eq(memberships.active, true));
  const byUser = new Map<string, Membership[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), { role: r.role, grants: r.grants, active: r.active }]);
  return [...byUser].filter(([, m]) => can(effectiveGrants(m), "crm.assign")).map(([id]) => id);
}
export function slaMinutes(rules: AssignmentRules, priority: string) {
  return rules.sla.responseMinutes[(["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal") as Priority];
}
export async function recordAssignment(tx: Tx, input: { entityType: string; entityId: string; fromUser: string | null; toUser: string | null; method: string; reason: string; ruleVersion?: string | null; detail?: Record<string, unknown>; actorId?: string | null }) {
  await tx.insert(crmAssignments).values({ ...input, ruleVersion: input.ruleVersion ?? null, detail: input.detail ?? null, actorId: input.actorId ?? null });
}
/** Imposta il responsabile su richiesta e trattativa, con la storia. */
export async function setOwner(tx: Tx, input: { leadId: string; dealId: string | null; to: string | null; method: string; reason: string; ruleVersion?: string | null; actorId?: string | null; detail?: Record<string, unknown> }) {
  const [current] = await tx.select().from(leadOwnership).where(eq(leadOwnership.leadId, input.leadId)).for("update");
  await tx.insert(leadOwnership).values({ leadId: input.leadId, assignedTo: input.to }).onConflictDoUpdate({ target: leadOwnership.leadId, set: { assignedTo: input.to, updatedAt: new Date() } });
  await recordAssignment(tx, { entityType: "lead", entityId: input.leadId, fromUser: current?.assignedTo ?? null, toUser: input.to, method: input.method, reason: input.reason, ruleVersion: input.ruleVersion, actorId: input.actorId, detail: input.detail });
  if (input.dealId) {
    const [deal] = await tx.select().from(crmDeals).where(eq(crmDeals.id, input.dealId)).for("update");
    if (deal && deal.ownerId !== input.to) {
      await tx.update(crmDeals).set({ ownerId: input.to, updatedAt: new Date() }).where(eq(crmDeals.id, input.dealId));
      await recordAssignment(tx, { entityType: "deal", entityId: input.dealId, fromUser: deal.ownerId, toUser: input.to, method: input.method, reason: input.reason, ruleVersion: input.ruleVersion, actorId: input.actorId });
    }
  }
  if (input.to) await tx.insert(teamProfiles).values({ userId: input.to, lastAssignedAt: new Date() }).onConflictDoUpdate({ target: teamProfiles.userId, set: { lastAssignedAt: new Date() } });
}
export type RouteResult = { assignee: string | null; status: "assigned" | "queued" | "pool" | "manual"; reason: string; dealId: string; contactId: string; slaDueAt: Date };

/** Collega la richiesta a contatto e trattativa e la instrada secondo le regole. */
/**
 * preferredAssignee: chi ha portato il contatto (es. il venditore del link). Vale
 * solo per un cliente senza trattativa aperta e solo se la persona è attiva.
 */
export async function routeLead(tx: Tx, leadId: string, options: { now?: Date; notifyAssignee?: boolean; actorId?: string | null; preferredAssignee?: string | null } = {}): Promise<RouteResult> {
  await tx.execute(sql`select pg_advisory_xact_lock(617821321)`);
  const now = options.now ?? new Date();
  const rules = await assignmentRules(tx);
  const { lead, contact, deal, reused } = await attachLead(tx, leadId, { createdBy: options.actorId ?? null });
  const mode: AssignmentMode = (lead.sourceKind && rules.sourceModes[lead.sourceKind as keyof typeof rules.sourceModes]) || rules.mode;
  const candidates = await salesCandidates(tx);
  const owner = reused && deal.ownerId ? candidates.find((c) => c.userId === deal.ownerId) : undefined;
  const respond = slaMinutes(rules, lead.priority);
  let result: RouteResult;
  if (reused && deal.ownerId && owner?.active) {
    result = { assignee: deal.ownerId, status: "assigned", reason: "open_deal_owner", dealId: deal.id, contactId: contact.id, slaDueAt: addBusinessMinutes(now, respond, owner.hours ?? rules.hours) };
  } else if (!(reused && deal.ownerId) && options.preferredAssignee && candidates.some((c) => c.userId === options.preferredAssignee && c.active)) {
    const brought = candidates.find((c) => c.userId === options.preferredAssignee)!;
    result = { assignee: brought.userId, status: "assigned", reason: "brought_by_seller", dealId: deal.id, contactId: contact.id, slaDueAt: addBusinessMinutes(now, respond, brought.hours ?? rules.hours) };
  } else if (mode === "pool" || mode === "manual") {
    result = { assignee: null, status: mode, reason: mode === "pool" ? "free_pick_queue" : "manual_mode", dealId: deal.id, contactId: contact.id, slaDueAt: addBusinessMinutes(now, respond, rules.hours) };
  } else {
    const decision = chooseAssignee(candidates, { requiredSkill: lead.requiredSkill, language: lead.language, openDealOwner: null, now, orgHours: rules.hours, defaultCapacity: rules.defaultCapacity });
    result = { assignee: decision.assignee, status: decision.assignee ? "assigned" : "queued", reason: decision.reason, dealId: deal.id, contactId: contact.id, slaDueAt: addBusinessMinutes(decision.availableAt, respond, rules.hours) };
    if (!decision.assignee) await tx.insert(leadActivities).values({ leadId, kind: "assignment", direction: "inbound", body: `Nessun venditore idoneo (${decision.considered.map((c) => c.excluded ?? "idoneo").join(", ") || "nessun candidato"}): resta nella coda monitorata.`, outcome: "queued" });
  }
  await tx.update(leads).set({ assignmentStatus: result.status, slaDueAt: result.slaDueAt, updatedAt: new Date() }).where(eq(leads.id, leadId));
  // Ogni trattativa aperta ha una prossima azione: per una richiesta nuova è il primo contatto entro la scadenza.
  if (!deal.nextAction || !deal.nextActionAt) await tx.update(crmDeals).set({ nextAction: deal.nextAction ?? "Primo contatto", nextActionAt: deal.nextActionAt ?? result.slaDueAt, updatedAt: new Date() }).where(eq(crmDeals.id, deal.id));
  await setOwner(tx, { leadId, dealId: deal.id, to: result.assignee, method: result.status === "assigned" ? (result.reason === "open_deal_owner" ? "rule_keep" : "auto") : result.status, reason: result.reason, ruleVersion: rules.version, actorId: options.actorId ?? null });
  await emitEvent(tx, "lead.created", leadId, leadId, { leadId, contactId: contact.id, dealId: deal.id, source: lead.sourceKind ?? lead.fonte, priority: lead.priority });
  if (result.assignee) {
    await emitEvent(tx, "lead.assigned", `${leadId}:${result.assignee}`, leadId, { leadId, dealId: deal.id, ownerId: result.assignee, reason: result.reason, ruleVersion: rules.version });
    if (options.notifyAssignee !== false) await notify(tx, result.assignee, "lead_assigned", { key: leadId, title: "Nuovo contatto da seguire", body: `${lead.nome}: richiesta da ${lead.sourceKind ?? lead.fonte}. Prima risposta entro ${result.slaDueAt.toLocaleString("it-IT", { timeZone: rules.hours.timezone })}.`, href: `/spazio?lead=${leadId}` });
  } else if (result.status === "pool") {
    for (const c of candidates.filter((c) => c.active && c.participates)) await notify(tx, c.userId, "pool_new", { key: leadId, title: "Nuova richiesta nella coda libera", body: "Una nuova richiesta può essere presa in carico dalla coda.", href: "/spazio?tab=pool" });
  } else {
    for (const m of await managers(tx)) await notify(tx, m, "lead_queued", { key: leadId, title: result.status === "manual" ? "Richiesta da assegnare" : "Richiesta senza venditore idoneo", body: `${lead.nome}: ${result.status === "manual" ? "assegnazione manuale prevista dalle regole" : "nessuno è disponibile per competenze, lingua, assenze o capacità"}. Va presa in carico entro ${result.slaDueAt.toLocaleString("it-IT", { timeZone: rules.hours.timezone })}.`, href: `/spazio?lead=${leadId}` });
  }
  return result;
}
/** Prima risposta del responsabile: ferma il conteggio della scadenza e conferma una prenotazione dalla coda. */
export async function markFirstResponse(tx: Tx | ReturnType<typeof getDb>, leadId: string, actorId: string) {
  await tx.update(leads).set({ firstResponseAt: new Date() }).where(and(eq(leads.id, leadId), isNull(leads.firstResponseAt)));
  await tx.update(leads).set({ assignmentStatus: "assigned", reservedUntil: null }).where(and(eq(leads.id, leadId), eq(leads.assignmentStatus, "reserved"), eq(leads.reservedBy, actorId)));
}

/** Coda a scelta libera: dati minimi prima della presa in carico (niente email, telefono o note). */
export async function poolCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "crm.write");
  const rows = await getDb().select({ lead: leads }).from(leads).where(eq(leads.assignmentStatus, "pool")).orderBy(leads.slaDueAt).limit(100);
  const ids = rows.map((r) => r.lead.id);
  const quoteRows = ids.length ? await getDb().select({ leadId: quotes.leadId, input: quotes.input }).from(quotes).where(inArray(quotes.leadId, ids)) : [];
  const rules = await assignmentRules();
  const mine = await getDb().select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.assignmentStatus, "reserved"), eq(leads.reservedBy, actor.id)));
  return json({
    rules: { maxReservations: rules.pool.maxReservations, reservationMinutes: rules.pool.reservationMinutes },
    reserved: Number(mine[0]?.count ?? 0),
    items: rows.map(({ lead }) => {
      const input = quoteRows.find((q) => q.leadId === lead.id)?.input as { projectType?: string; singleService?: string; wordCount?: number } | undefined;
      return { id: lead.id, firstName: lead.nome.split(/\s+/)[0], source: lead.sourceKind ?? lead.fonte, service: input?.singleService ?? input?.projectType ?? null, words: input?.wordCount ? (input.wordCount < 30000 ? "<30k" : input.wordCount < 80000 ? "30-80k" : ">80k") : null, priority: lead.priority, language: lead.language, createdAt: lead.createdAt, slaDueAt: lead.slaDueAt };
    }),
  });
}
/** Presa in carico atomica: vince una sola persona, entro il limite di prenotazioni. */
export async function poolClaim(request: Request, actor: Actor, leadId: string) {
  if (request.method !== "POST") throw notFound();
  demandAvailable(actor, "crm.write");
  const rules = await assignmentRules();
  const candidates = await salesCandidates(getDb());
  const me = candidates.find((c) => c.userId === actor.id);
  if (!me?.active || !me.participates) throw new PlatformError(403, "NOT_PARTICIPATING", "Non partecipi alla coda delle richieste.");
  const result = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`pool:${actor.id}`}))`);
    const [held] = await tx.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.assignmentStatus, "reserved"), eq(leads.reservedBy, actor.id)));
    if (Number(held?.count ?? 0) >= rules.pool.maxReservations) throw new PlatformError(409, "RESERVATION_LIMIT", `Hai già ${rules.pool.maxReservations} richieste prenotate: rispondi a quelle prima di prenderne altre.`);
    const until = new Date(Date.now() + rules.pool.reservationMinutes * 60_000);
    const [claimed] = await tx.update(leads).set({ assignmentStatus: "reserved", reservedBy: actor.id, reservedUntil: until, updatedAt: new Date() }).where(and(eq(leads.id, leadId), eq(leads.assignmentStatus, "pool"))).returning({ id: leads.id, dealId: leads.dealId });
    if (!claimed) throw new PlatformError(409, "ALREADY_CLAIMED", "Un'altra persona ha già preso questa richiesta.");
    await setOwner(tx, { leadId, dealId: claimed.dealId, to: actor.id, method: "claim", reason: "free_pick_queue", ruleVersion: rules.version, actorId: actor.id, detail: { reservedUntil: until.toISOString() } });
    await emitEvent(tx, "lead.assigned", `${leadId}:${actor.id}`, leadId, { leadId, dealId: claimed.dealId, ownerId: actor.id, reason: "claim", ruleVersion: rules.version });
    return { leadId, reservedUntil: until };
  });
  await audit(actor, "lead.claimed", "lead", leadId);
  return json(result);
}
/**
 * Scadenze e code (dal cron): avvisa chi gestisce l'assegnazione quando la
 * prima risposta è in ritardo, riprova l'assegnazione delle richieste in coda
 * nel primo periodo utile e restituisce alla coda le prenotazioni scadute.
 */
export async function runAssignmentJobs(now = new Date()) {
  const db = getDb();
  const rules = await assignmentRules();
  let escalated = 0, routed = 0, released = 0;
  const late = await db.select().from(leads).where(and(isNull(leads.firstResponseAt), isNull(leads.escalatedAt), lt(leads.slaDueAt, now), notInArray(leads.stage, CLOSED))).limit(50);
  for (const lead of late) {
    const threshold = addBusinessMinutes(lead.slaDueAt!, rules.sla.escalateAfterMinutes, rules.hours);
    const overdue = threshold.getTime() <= now.getTime();
    await db.transaction(async (tx) => {
      const [owner] = await tx.select().from(leadOwnership).where(eq(leadOwnership.leadId, lead.id));
      if (owner?.assignedTo) await notify(tx, owner.assignedTo, "sla_breach", { key: `${lead.id}:owner`, title: "Prima risposta in ritardo", body: `${lead.nome} aspetta una risposta dal ${lead.slaDueAt!.toLocaleString("it-IT", { timeZone: rules.hours.timezone })}.`, href: `/spazio?lead=${lead.id}` });
      if (overdue) {
        for (const m of await managers(tx)) await notify(tx, m, "sla_breach", { key: `${lead.id}:escalation`, title: "Escalation: richiesta senza risposta", body: `${lead.nome}: nessuna risposta oltre la scadenza${owner?.assignedTo ? "" : " e nessun responsabile"}. La trattativa non viene spostata in automatico.`, href: `/spazio?lead=${lead.id}` });
        await tx.update(leads).set({ escalatedAt: now }).where(eq(leads.id, lead.id));
        await tx.insert(leadActivities).values({ leadId: lead.id, kind: "sla", direction: "inbound", body: "Scadenza della prima risposta superata: avvisati responsabile e gestione.", outcome: "escalated", eventKey: `sla:${lead.id}` }).onConflictDoNothing();
        escalated++;
      }
    });
  }
  if (isWithinHours(now, rules.hours)) {
    const queued = await db.select({ id: leads.id }).from(leads).where(eq(leads.assignmentStatus, "queued")).limit(20);
    for (const q of queued) {
      const outcome = await db.transaction(async (tx) => {
        const candidates = await salesCandidates(tx);
        const [lead] = await tx.select().from(leads).where(eq(leads.id, q.id));
        const decision = chooseAssignee(candidates, { requiredSkill: lead!.requiredSkill, language: lead!.language, openDealOwner: null, now, orgHours: rules.hours, defaultCapacity: rules.defaultCapacity });
        if (!decision.assignee) return false;
        await tx.update(leads).set({ assignmentStatus: "assigned", updatedAt: new Date() }).where(eq(leads.id, q.id));
        await setOwner(tx, { leadId: q.id, dealId: lead!.dealId, to: decision.assignee, method: "auto", reason: `queue_retry:${decision.reason}`, ruleVersion: rules.version });
        await notify(tx, decision.assignee, "lead_assigned", { key: q.id, title: "Nuovo contatto da seguire", body: `${lead!.nome}: era in coda, ora è tuo.`, href: `/spazio?lead=${q.id}` });
        return true;
      });
      if (outcome) routed++;
    }
  }
  const expired = await db.select().from(leads).where(and(eq(leads.assignmentStatus, "reserved"), lt(leads.reservedUntil, now), isNull(leads.firstResponseAt))).limit(50);
  for (const lead of expired)
    await db.transaction(async (tx) => {
      const [row] = await tx.update(leads).set({ assignmentStatus: "pool", reservedBy: null, reservedUntil: null }).where(and(eq(leads.id, lead.id), eq(leads.assignmentStatus, "reserved"))).returning({ id: leads.id });
      if (!row) return;
      await setOwner(tx, { leadId: lead.id, dealId: lead.dealId, to: null, method: "release", reason: "reservation_expired", ruleVersion: rules.version });
      released++;
    });
  return { escalated, routed, released };
}
/** Assegnazione manuale (o riassegnazione) da chi gestisce l'assegnazione, con motivo. */
export async function leadAssign(request: Request, actor: Actor, leadId: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "crm.assign");
  const body = await readBody(request, z.object({ to: z.string().min(1).max(100).nullable(), reason: z.string().trim().min(3).max(300), includeDeal: z.boolean().default(true) }).strict());
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw notFound();
  if (body.to) {
    const candidates = await salesCandidates(getDb());
    if (!candidates.some((c) => c.userId === body.to && c.active && c.verified)) throw new PlatformError(422, "INVALID_ASSIGNEE", "Scegli una persona attiva che può seguire contatti.");
  }
  const rules = await assignmentRules();
  await getDb().transaction(async (tx) => {
    await tx.update(leads).set({ assignmentStatus: body.to ? "assigned" : "queued", reservedBy: null, reservedUntil: null, updatedAt: new Date() }).where(eq(leads.id, leadId));
    await setOwner(tx, { leadId, dealId: body.includeDeal ? lead.dealId : null, to: body.to, method: "manual", reason: body.reason, ruleVersion: rules.version, actorId: actor.id });
    if (body.to) {
      await emitEvent(tx, "lead.assigned", `${leadId}:${body.to}:${Date.now()}`, leadId, { leadId, dealId: lead.dealId, ownerId: body.to, reason: "manual" });
      if (body.to !== actor.id) await notify(tx, body.to, "lead_assigned", { key: `${leadId}:${Date.now()}`, title: "Contatto assegnato a te", body: `${lead.nome}: ${body.reason}`, href: `/spazio?lead=${leadId}` });
    }
  });
  await audit(actor, "lead.assigned", "lead", leadId, { to: body.to, reason: body.reason });
  return json({ ok: true });
}
