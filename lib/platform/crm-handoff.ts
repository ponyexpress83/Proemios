/**
 * Passaggio dalla vendita alla produzione. Il progetto nasce una volta sola
 * con l'acconto verificato (vincolo unico sulla proposta); il pacchetto di
 * passaggio separa fatti contrattuali, richieste extra e promesse non
 * approvate e segnala incongruenze e informazioni mancanti. «Trattativa
 * vinta» non vale come prova di pagamento: conta l'incasso registrato.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmContacts, crmDeals, crmHandoffItems, crmHandoffs, teamProfiles } from "@/db/crm-schema";
import { billingProfiles, contracts, leadActivities, memberships, paymentOrders, projectFiles, projectMembers, projects, quoteRecords, tasks } from "@/db/platform-schema";
import { rankCandidates, type AssignmentCandidate } from "@/lib/crm-core/assignment";
import { opsRulesSchema, defaultOpsRules, PRIORITIES, type OpsRules } from "@/lib/crm-core/rules";
import { can, effectiveGrants, type Membership } from "./permissions";
import { demand, projectAccess, audit, type Actor } from "./access";
import { json, notFound, forbidden, PlatformError, readBody } from "./http";
import { emitEvent, readSetting, type Reader, type Tx } from "./crm-relations";
import { notify } from "./crm-notify";
import { recordAssignment, assignmentRules } from "./crm-routing";
import { PAID_STATUSES } from "./pipeline";

export const opsRules = (db: Reader = getDb()) => readSetting<OpsRules>("ops-rules", opsRulesSchema, defaultOpsRules, db);
export const OPS_STATUSES = ["waiting_materials", "ready_for_assignment", "assigned", "in_progress", "quality_check", "client_review", "concluded"] as const;
export type OpsStatus = (typeof OPS_STATUSES)[number];
const TRANSITIONS: Record<OpsStatus, OpsStatus[]> = {
  waiting_materials: ["ready_for_assignment"],
  ready_for_assignment: ["assigned", "waiting_materials"],
  assigned: ["in_progress", "ready_for_assignment"],
  in_progress: ["quality_check", "assigned"],
  quality_check: ["client_review", "in_progress"],
  client_review: ["concluded", "in_progress"],
  concluded: [],
};
export const OPS_LABELS: Record<OpsStatus, string> = { waiting_materials: "In attesa dei materiali", ready_for_assignment: "Pronto per l'assegnazione", assigned: "Assegnato", in_progress: "In lavorazione", quality_check: "Controllo qualità", client_review: "Revisione del cliente", concluded: "Concluso" };

/** Calcola il pacchetto di passaggio dai fatti registrati (mai dal solo stato della trattativa). */
export async function buildHandoff(db: Reader, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project?.quoteId) return null;
  const [record] = await db.select().from(quoteRecords).where(eq(quoteRecords.quoteId, project.quoteId));
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, project.quoteId));
  const [contract] = await db.select().from(contracts).where(eq(contracts.quoteId, project.quoteId)).orderBy(desc(contracts.version)).limit(1);
  const orders = await db.select().from(paymentOrders).where(eq(paymentOrders.quoteId, project.quoteId));
  const [lead] = quote ? await db.select().from(leads).where(eq(leads.id, quote.leadId)) : [];
  const dealId = record?.dealId ?? lead?.dealId ?? null;
  const [deal] = dealId ? await db.select().from(crmDeals).where(eq(crmDeals.id, dealId)) : [];
  const [contact] = deal ? await db.select().from(crmContacts).where(eq(crmContacts.id, deal.contactId)) : [];
  const [billing] = await db.select({ userId: billingProfiles.userId }).from(billingProfiles).where(eq(billingProfiles.userId, project.authorId));
  const manuscripts = await db.select({ id: projectFiles.id, status: projectFiles.status }).from(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.kind, "manuscript")));
  const items = await db.select({ i: crmHandoffItems, name: user.name }).from(crmHandoffItems).leftJoin(user, eq(user.id, crmHandoffItems.authorId)).where(eq(crmHandoffItems.projectId, projectId)).orderBy(crmHandoffItems.createdAt);
  const leadIds = deal ? (await db.select({ id: leads.id }).from(leads).where(eq(leads.dealId, deal.id))).map((l) => l.id) : lead ? [lead.id] : [];
  const calls = leadIds.length ? await db.select().from(leadActivities).where(and(inArray(leadActivities.leadId, leadIds), sql`${leadActivities.structured} is not null`)).orderBy(leadActivities.createdAt) : [];
  const changes = leadIds.length ? await db.select().from(leadActivities).where(and(inArray(leadActivities.leadId, leadIds), eq(leadActivities.kind, "change_request"))) : [];
  const rules = await opsRules(db);
  const sheet = contract?.orderSheet;
  const depositPaid = orders.some((o) => o.kind === "deposit" && PAID_STATUSES.includes(o.status));
  const conditions = { contractAccepted: Boolean(contract), orderConfirmed: Boolean(record?.acceptedAt), depositVerified: depositPaid, billingProfile: !rules.requireBillingProfile || Boolean(billing) };
  const missing: string[] = [];
  if (!manuscripts.some((m) => m.status === "ready")) missing.push("materials");
  if (!conditions.billingProfile) missing.push("billing_profile");
  if (!contact?.phone) missing.push("client_phone");
  if (!project.contractualDueAt) missing.push("contractual_due_date");
  const inconsistencies: Array<{ code: string; detail: string }> = [];
  if (!conditions.contractAccepted) inconsistencies.push({ code: "no_contract", detail: "Progetto senza contratto accettato." });
  if (!conditions.depositVerified) inconsistencies.push({ code: "no_verified_payment", detail: "Nessun incasso verificato: la trattativa vinta non basta." });
  const promises = items.filter((x) => x.i.kind === "promise");
  for (const p of promises.filter((x) => x.i.status === "pending")) inconsistencies.push({ code: "unapproved_promise", detail: `Promessa non approvata: «${p.i.body}»` });
  for (const e of items.filter((x) => x.i.kind === "extra_request" && x.i.status !== "rejected")) inconsistencies.push({ code: "extra_outside_contract", detail: `Richiesta fuori dalla scheda d'ordine: «${e.i.body}»` });
  for (const c of changes) inconsistencies.push({ code: "client_change_request", detail: `Il cliente ha chiesto una modifica: «${(c.body ?? "").slice(0, 200)}»` });
  if (sheet && record && sheet.quoteVersion !== record.version) inconsistencies.push({ code: "version_mismatch", detail: `Contratto sulla versione ${sheet.quoteVersion}, proposta alla versione ${record.version}.` });
  const ready = conditions.contractAccepted && conditions.orderConfirmed && conditions.depositVerified && conditions.billingProfile;
  return {
    project,
    dealId,
    sellerId: deal?.ownerId ?? record?.acceptedSellerId ?? null,
    contractId: contract?.id ?? null,
    ready,
    conditions,
    missing,
    inconsistencies,
    package: {
      service: sheet?.service ?? null,
      quote: record ? { id: project.quoteId, version: record.version, tier: record.selectedTier } : null,
      contract: contract ? { id: contract.id, version: contract.version, termsVersion: contract.termsVersion, acceptedAt: contract.acceptedAt, earlyStart: contract.acceptances.earlyStart } : null,
      contractual: sheet ? { includes: sheet.includes, excludes: sheet.excludes, revisions: sheet.revisions, deliveries: sheet.deliveries, deadlines: sheet.deadlines, attachment: sheet.attachment ?? null } : null,
      amounts: sheet ? { ...sheet.amounts, installments: sheet.installments, paid: orders.filter((o) => PAID_STATUSES.includes(o.status)).map((o) => ({ kind: o.kind, sequence: o.sequence, amountCents: o.amountCents })) } : null,
      dates: { contractualDueAt: project.contractualDueAt, startedAt: project.startedAt, startCondition: project.startCondition },
      materials: { files: manuscripts.length, ready: manuscripts.filter((m) => m.status === "ready").length },
      client: contact ? { name: contact.name, email: contact.email, phone: contact.phone, language: contact.language } : null,
      approvedNotes: items.filter((x) => ["note", "decision"].includes(x.i.kind) && x.i.status === "approved").map((x) => ({ id: x.i.id, kind: x.i.kind, body: x.i.body, by: x.name })),
      callDecisions: calls.map((c) => ({ at: c.createdAt, summary: c.structured?.summary ?? null, decisions: c.structured?.decisions ?? [], nextSteps: c.structured?.nextSteps ?? [] })),
      extraRequests: items.filter((x) => x.i.kind === "extra_request").map((x) => ({ id: x.i.id, body: x.i.body, status: x.i.status })),
      unapprovedPromises: promises.filter((x) => x.i.status === "pending").map((x) => ({ id: x.i.id, body: x.i.body, by: x.name })),
      risks: items.filter((x) => x.i.kind === "risk").map((x) => ({ id: x.i.id, body: x.i.body, by: x.name })),
      questions: items.filter((x) => x.i.kind === "question").map((x) => ({ id: x.i.id, body: x.i.body, status: x.i.status, by: x.name, answers: items.filter((a) => a.i.parentId === x.i.id).map((a) => ({ body: a.i.body, by: a.name, at: a.i.createdAt })) })),
    },
  };
}
/** Dentro la transazione del pagamento: crea il passaggio una volta sola e avvisa produzione e venditore. */
export async function createHandoff(tx: Tx, projectId: string) {
  const handoff = await buildHandoff(tx, projectId);
  if (!handoff) return null;
  const opsStatus: OpsStatus = handoff.missing.includes("materials") ? "waiting_materials" : "ready_for_assignment";
  await tx.update(projects).set({ opsStatus, dealId: handoff.dealId, updatedAt: new Date() }).where(eq(projects.id, projectId));
  const [saved] = await tx.insert(crmHandoffs).values({ projectId, quoteId: handoff.project.quoteId!, dealId: handoff.dealId, contractId: handoff.contractId, sellerId: handoff.sellerId, package: handoff.package as Record<string, unknown>, inconsistencies: handoff.inconsistencies, missing: handoff.missing, status: handoff.ready ? "open" : "blocked" }).onConflictDoNothing().returning();
  if (!saved) return null;
  await emitEvent(tx, "project.handoff_ready", projectId, projectId, { projectId, quoteId: handoff.project.quoteId, dealId: handoff.dealId, ready: handoff.ready, missing: handoff.missing, opsStatus });
  for (const lead of await opsLeads(tx)) await notify(tx, lead, "handoff_ready", { key: projectId, title: "Nuovo progetto per la produzione", body: `${handoff.package.service ?? "Progetto"}: ${opsStatus === "waiting_materials" ? "in attesa dei materiali" : "pronto per l'assegnazione"}${handoff.inconsistencies.length ? ` · ${handoff.inconsistencies.length} punti da verificare` : ""}.`, href: `/spazio?progetto=${projectId}` });
  return saved;
}
async function opsLeads(db: Reader) {
  const rows = await db.select().from(memberships).where(and(eq(memberships.active, true), inArray(memberships.role, ["coordinator", "owner", "admin"])));
  const byUser = new Map<string, Membership[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  return [...byUser].filter(([, m]) => can(effectiveGrants(m), "project.assign")).map(([id]) => id);
}
/** Il venditore vede l'esito del passaggio della sua trattativa; la produzione vede i progetti che gestisce. */
async function handoffAccess(actor: Actor, projectId: string, write = false) {
  const [handoff] = await getDb().select().from(crmHandoffs).where(eq(crmHandoffs.projectId, projectId));
  if (!handoff) throw notFound();
  const seller = handoff.sellerId === actor.id;
  if (!seller) await projectAccess(actor, projectId, write ? "project.write" : "project.read");
  return { handoff, seller };
}
export async function handoffDetail(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "GET") throw notFound();
  const { handoff, seller } = await handoffAccess(actor, projectId);
  const live = await buildHandoff(getDb(), projectId);
  const phases = seller ? [] : await getDb().select({ id: tasks.id, phase: tasks.phase, skill: tasks.skill, title: tasks.title, status: tasks.status, claimable: tasks.claimable, dueAt: tasks.dueAt, assignee: user.name }).from(tasks).leftJoin(user, eq(user.id, tasks.assignedTo)).where(and(eq(tasks.projectId, projectId), sql`${tasks.phase} is not null`)).orderBy(tasks.createdAt);
  // Il venditore non riceve i file né le note interne di produzione: solo esito, mancanze e domande.
  return json({ status: handoff.status, acceptedAt: handoff.acceptedAt, opsStatus: live?.project.opsStatus, opsLabel: live ? OPS_LABELS[live.project.opsStatus as OpsStatus] : null, ready: live?.ready, conditions: live?.conditions, missing: live?.missing, inconsistencies: live?.inconsistencies, package: seller ? { ...live?.package, client: undefined } : live?.package, original: { createdAt: handoff.createdAt, inconsistencies: handoff.inconsistencies, missing: handoff.missing }, phases });
}
export async function handoffItemCreate(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "POST") throw notFound();
  const { handoff, seller } = await handoffAccess(actor, projectId);
  const body = await readBody(request, z.object({ kind: z.enum(["note", "decision", "promise", "extra_request", "risk", "question", "answer"]), body: z.string().trim().min(3).max(3000), parentId: z.string().uuid().optional() }).strict());
  const ops = !seller || can(actor.grants, "project.assign");
  if (body.kind === "question" && !ops) throw forbidden();
  if (body.kind === "answer" && !body.parentId) throw new PlatformError(422, "MISSING_PARENT", "Indica la domanda a cui rispondi.");
  // Note e decisioni della produzione sono già approvate; quelle del venditore passano dall'approvazione.
  const status = body.kind === "question" ? "open" : body.kind === "answer" ? "answer" : ["note", "decision", "risk"].includes(body.kind) && ops && !seller ? "approved" : "pending";
  const [item] = await getDb().transaction(async (tx) => {
    const created = await tx.insert(crmHandoffItems).values({ projectId, kind: body.kind, body: body.body, authorId: actor.id, status, parentId: body.parentId ?? null }).returning();
    if (body.kind === "question" && handoff.sellerId) await notify(tx, handoff.sellerId, "handoff_question", { key: created[0]!.id, title: "Domanda della produzione", body: body.body.slice(0, 300), href: `/spazio?progetto=${projectId}` });
    if (body.kind === "answer") {
      const [question] = await tx.select().from(crmHandoffItems).where(and(eq(crmHandoffItems.id, body.parentId!), eq(crmHandoffItems.projectId, projectId)));
      if (!question) throw notFound();
      await tx.update(crmHandoffItems).set({ status: "answered" }).where(eq(crmHandoffItems.id, question.id));
      await notify(tx, question.authorId, "handoff_question", { key: created[0]!.id, title: "Risposta del venditore", body: body.body.slice(0, 300), href: `/spazio?progetto=${projectId}` });
    }
    return created;
  });
  await audit(actor, "handoff.item", "project", projectId, { kind: body.kind });
  return json({ item }, 201);
}
export async function handoffItemDecide(request: Request, actor: Actor, itemId: string) {
  if (request.method !== "POST") throw notFound();
  const [item] = await getDb().select().from(crmHandoffItems).where(eq(crmHandoffItems.id, itemId));
  if (!item) throw notFound();
  await projectAccess(actor, item.projectId, "project.assign");
  const body = await readBody(request, z.object({ decision: z.enum(["approved", "rejected"]) }).strict());
  if (!["promise", "extra_request", "note", "decision", "risk"].includes(item.kind) || item.status !== "pending") throw new PlatformError(409, "ALREADY_DECIDED", "Questa voce non è in attesa di decisione.");
  await getDb().update(crmHandoffItems).set({ status: body.decision, decidedBy: actor.id }).where(eq(crmHandoffItems.id, itemId));
  await audit(actor, `handoff.item_${body.decision}`, "project", item.projectId, { itemId, kind: item.kind });
  return json({ ok: true });
}
export async function handoffAccept(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "POST") throw notFound();
  await projectAccess(actor, projectId, "project.assign");
  const live = await buildHandoff(getDb(), projectId);
  if (!live?.ready) throw new PlatformError(409, "HANDOFF_NOT_READY", "Mancano contratto, ordine confermato, incasso verificato o dati di fatturazione.");
  const pending = live.package.unapprovedPromises.length;
  if (pending) throw new PlatformError(409, "PENDING_PROMISES", "Decidi prima le promesse non approvate del venditore.");
  await getDb().update(crmHandoffs).set({ status: "accepted", acceptedBy: actor.id, acceptedAt: new Date(), package: live.package as Record<string, unknown>, inconsistencies: live.inconsistencies, missing: live.missing, updatedAt: new Date() }).where(eq(crmHandoffs.projectId, projectId));
  await getDb().update(projects).set({ opsLeadId: sql`coalesce(${projects.opsLeadId}, ${actor.id})`, updatedAt: new Date() }).where(eq(projects.id, projectId));
  await audit(actor, "handoff.accepted", "project", projectId);
  return json({ ok: true });
}
/** Stato operativo: solo le transizioni previste; il controllo qualità ha un responsabile diverso da chi lavora. */
export async function projectOps(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "PATCH") throw notFound();
  const access = await projectAccess(actor, projectId, "project.write");
  const body = await readBody(request, z.object({ opsStatus: z.enum(OPS_STATUSES).optional(), opsLeadId: z.string().min(1).max(100).nullable().optional(), qaOwnerId: z.string().min(1).max(100).nullable().optional(), contractualDueAt: z.string().datetime().nullable().optional() }).strict());
  if (body.opsLeadId !== undefined || body.qaOwnerId !== undefined || body.contractualDueAt !== undefined) demand(actor, "project.assign", access.resource);
  const project = access.project;
  const phaseTasks = await getDb().select().from(tasks).where(and(eq(tasks.projectId, projectId), sql`${tasks.phase} is not null`));
  const workers = new Set(phaseTasks.filter((t) => t.phase !== "qa" && t.assignedTo).map((t) => t.assignedTo!));
  const qaOwner = body.qaOwnerId !== undefined ? body.qaOwnerId : project.qaOwnerId;
  if (body.qaOwnerId && workers.has(body.qaOwnerId)) throw new PlatformError(409, "QA_SEPARATION", "Il controllo qualità va a una persona diversa da chi ha lavorato sulle fasi.");
  if (body.opsStatus && body.opsStatus !== project.opsStatus) {
    const from = project.opsStatus as OpsStatus;
    if (!TRANSITIONS[from]?.includes(body.opsStatus)) throw new PlatformError(409, "INVALID_STATE", `Da «${OPS_LABELS[from]}» non si passa a «${OPS_LABELS[body.opsStatus]}».`);
    if (body.opsStatus === "quality_check" && !qaOwner) throw new PlatformError(422, "QA_OWNER_REQUIRED", "Indica chi fa il controllo qualità.");
    if (body.opsStatus === "in_progress" && !project.startedAt) throw new PlatformError(409, "PAYMENT_REQUIRED", "La lavorazione parte dopo l'incasso previsto dalla regola del servizio.");
    if (body.opsStatus === "ready_for_assignment") {
      const ready = await getDb().select({ id: projectFiles.id }).from(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.kind, "manuscript"), eq(projectFiles.status, "ready")));
      if (!ready.length) throw new PlatformError(409, "MATERIALS_MISSING", "Mancano i materiali del cliente.");
    }
  }
  if (body.opsLeadId) {
    const [m] = await getDb().select().from(memberships).where(and(eq(memberships.userId, body.opsLeadId), eq(memberships.active, true), inArray(memberships.role, ["coordinator", "owner", "admin"])));
    if (!m) throw new PlatformError(422, "INVALID_ASSIGNEE", "Il responsabile operativo deve avere un ruolo di coordinamento attivo.");
  }
  await getDb().transaction(async (tx) => {
    await tx.update(projects).set({ ...(body.opsStatus ? { opsStatus: body.opsStatus } : {}), ...(body.opsLeadId !== undefined ? { opsLeadId: body.opsLeadId } : {}), ...(body.qaOwnerId !== undefined ? { qaOwnerId: body.qaOwnerId } : {}), ...(body.contractualDueAt !== undefined ? { contractualDueAt: body.contractualDueAt ? new Date(body.contractualDueAt) : null } : {}), updatedAt: new Date() }).where(eq(projects.id, projectId));
    for (const who of [body.opsLeadId, body.qaOwnerId].filter(Boolean) as string[]) {
      await tx.insert(projectMembers).values({ projectId, userId: who }).onConflictDoNothing();
      await recordAssignment(tx, { entityType: "project", entityId: projectId, fromUser: null, toUser: who, method: "manual", reason: who === body.qaOwnerId ? "qa_owner" : "ops_lead", actorId: actor.id });
    }
  });
  await audit(actor, "project.ops_updated", "project", projectId, body);
  return json({ ok: true });
}

// ── Fasi, competenze e capacità ─────────────────────────────────────────────
async function operatorCandidates(db: Reader): Promise<AssignmentCandidate[]> {
  const rows = await db.select({ m: memberships, verified: user.emailVerified }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(inArray(memberships.role, ["editor", "coordinator"]));
  const ids = [...new Set(rows.map((r) => r.m.userId))];
  const profiles = ids.length ? await db.select().from(teamProfiles).where(inArray(teamProfiles.userId, ids)) : [];
  const loads = ids.length ? await db.select({ owner: tasks.assignedTo, n: sql<number>`count(*)::int` }).from(tasks).where(and(inArray(tasks.assignedTo, ids), eq(tasks.done, false), sql`${tasks.phase} is not null`)).groupBy(tasks.assignedTo) : [];
  const rules = await opsRules(db);
  return ids.map((id) => {
    const p = profiles.find((x) => x.userId === id);
    return { userId: id, active: rows.some((r) => r.m.userId === id && r.m.active) && !p?.deactivatedAt, verified: rows.find((r) => r.m.userId === id)!.verified, participates: true, skills: p?.skills ?? [], languages: p?.languages ?? ["it"], hours: p?.hours ?? null, absences: p?.absences ?? [], capacity: p?.capacity ?? rules.defaultCapacity, openLoad: Number(loads.find((l) => l.owner === id)?.n ?? 0), lastAssignedAt: p?.lastAssignedAt ?? null };
  });
}
const phaseSchema = z.object({ phase: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/), skill: z.string().min(2).max(40), title: z.string().trim().min(3).max(200), dueAt: z.string().datetime().optional(), dependsOn: z.number().int().min(0).max(19).optional(), priority: z.enum(PRIORITIES).default("normal") }).strict();
/** Piano delle fasi: le categorie standard possono andare in coda reclamabile; le altre si assegnano con conferma. */
export async function projectPhases(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "POST") throw notFound();
  const access = await projectAccess(actor, projectId, "project.assign");
  demand(actor, "project.assign", access.resource);
  const body = await readBody(request, z.object({ phases: z.array(phaseSchema).min(1).max(20), queue: z.boolean().default(false) }).strict());
  const rules = await opsRules();
  const created = await getDb().transaction(async (tx) => {
    const ids: string[] = [];
    for (const [i, p] of body.phases.entries()) {
      if (p.dependsOn !== undefined && p.dependsOn >= i) throw new PlatformError(422, "INVALID_DEPENDENCY", "Una fase può dipendere solo da una fase precedente.");
      const claimable = body.queue && rules.claimableCategories.includes(p.skill);
      const [task] = await tx.insert(tasks).values({ projectId, assignedTo: null, createdBy: actor.id, title: p.title, phase: p.phase, skill: p.skill, priority: p.priority, dueAt: p.dueAt ? new Date(p.dueAt) : null, dependsOn: p.dependsOn !== undefined ? ids[p.dependsOn]! : null, claimable, internal: true }).returning();
      ids.push(task!.id);
    }
    return ids;
  });
  await audit(actor, "project.phases_planned", "project", projectId, { phases: created.length });
  return json({ taskIds: created }, 201);
}
export async function projectSuggestions(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "GET") throw notFound();
  await projectAccess(actor, projectId, "project.assign");
  const skill = new URL(request.url).searchParams.get("skill")?.slice(0, 40) ?? null;
  const rules = await assignmentRules();
  const candidates = await operatorCandidates(getDb());
  const result = rankCandidates(candidates, { requiredSkill: skill, language: "it", now: new Date(), orgHours: rules.hours, defaultCapacity: (await opsRules()).defaultCapacity });
  // Con una competenza richiesta, chi non l'ha dichiarata non entra nel suggerimento.
  const ranked = skill ? result.ranked.filter((r) => candidates.find((c) => c.userId === r.userId)!.skills.includes(skill)) : result.ranked;
  const people = await getDb().select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...candidates.map((c) => c.userId), "-"]));
  return json({ skill, suggestions: ranked.map((r) => ({ ...r, name: people.find((p) => p.id === r.userId)?.name })), excluded: result.excluded.map((e) => ({ userId: e.userId, reason: e.excluded, name: people.find((p) => p.id === e.userId)?.name })), note: "Suggerimento: l'assegnazione richiede conferma." });
}
/** Assegnazione confermata di una fase: accesso ai materiali solo da qui in poi. */
export async function taskAssign(request: Request, actor: Actor, taskId: string) {
  if (request.method !== "POST") throw notFound();
  const [task] = await getDb().select().from(tasks).where(eq(tasks.id, taskId));
  if (!task?.projectId) throw notFound();
  const access = await projectAccess(actor, task.projectId, "project.assign");
  demand(actor, "project.assign", access.resource);
  const body = await readBody(request, z.object({ userId: z.string().min(1).max(100), confirm: z.literal(true) }).strict());
  const candidate = (await operatorCandidates(getDb())).find((c) => c.userId === body.userId);
  if (!candidate?.active || !candidate.verified) throw new PlatformError(422, "INVALID_ASSIGNEE", "Scegli un operatore attivo.");
  if (task.skill && candidate.skills.length && !candidate.skills.includes(task.skill)) throw new PlatformError(409, "SKILL_MISMATCH", "La persona non ha la competenza richiesta per questa fase.");
  if (task.phase === "qa") {
    const others = await getDb().select().from(tasks).where(and(eq(tasks.projectId, task.projectId), sql`${tasks.phase} is not null and ${tasks.phase} <> 'qa'`));
    if (others.some((t) => t.assignedTo === body.userId)) throw new PlatformError(409, "QA_SEPARATION", "Il controllo qualità va a una persona diversa da chi ha lavorato sulle fasi.");
  }
  await getDb().transaction(async (tx) => {
    await tx.update(tasks).set({ assignedTo: body.userId, claimable: false }).where(eq(tasks.id, taskId));
    await tx.insert(projectMembers).values({ projectId: task.projectId!, userId: body.userId }).onConflictDoNothing();
    await recordAssignment(tx, { entityType: "task", entityId: taskId, fromUser: task.assignedTo, toUser: body.userId, method: "manual", reason: "confirmed_suggestion", actorId: actor.id });
    if (task.phase === "qa") await tx.update(projects).set({ qaOwnerId: body.userId }).where(eq(projects.id, task.projectId!));
    await tx.update(projects).set({ opsStatus: "assigned", updatedAt: new Date() }).where(and(eq(projects.id, task.projectId!), eq(projects.opsStatus, "ready_for_assignment")));
    await notify(tx, body.userId, "task_assigned", { key: taskId, title: "Nuova fase assegnata", body: task.title, href: `/spazio?progetto=${task.projectId}` });
  });
  await audit(actor, "task.assigned", "task", taskId, { userId: body.userId });
  return json({ ok: true });
}
/** Coda delle fasi standard: dati minimi prima della presa in carico (niente nome del cliente né file). */
export async function taskQueue(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  if (!actor.roles.some((r) => r === "editor" || r === "coordinator")) throw forbidden();
  const me = (await operatorCandidates(getDb())).find((c) => c.userId === actor.id);
  const rows = await getDb().select({ t: tasks, type: projects.type, due: projects.contractualDueAt }).from(tasks).innerJoin(projects, eq(projects.id, tasks.projectId)).where(and(eq(tasks.claimable, true), isNull(tasks.assignedTo), eq(tasks.done, false))).orderBy(tasks.dueAt).limit(100);
  return json({ items: rows.filter((r) => !me?.skills.length || !r.t.skill || me.skills.includes(r.t.skill)).map((r) => ({ id: r.t.id, phase: r.t.phase, skill: r.t.skill, title: r.t.title, projectType: r.type, dueAt: r.t.dueAt, priority: r.t.priority })), capacity: me ? { load: me.openLoad, capacity: me.capacity } : null });
}
/** Presa in carico atomica di una fase standard, entro competenze e capacità. */
export async function taskClaim(request: Request, actor: Actor, taskId: string) {
  if (request.method !== "POST") throw notFound();
  const me = (await operatorCandidates(getDb())).find((c) => c.userId === actor.id);
  if (!me?.active) throw forbidden();
  const result = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`task-claim:${actor.id}`}))`);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task?.projectId) throw notFound();
    if (task.skill && me.skills.length && !me.skills.includes(task.skill)) throw new PlatformError(409, "SKILL_MISMATCH", "Questa fase richiede una competenza che non hai dichiarato.");
    const [load] = await tx.select({ n: sql<number>`count(*)::int` }).from(tasks).where(and(eq(tasks.assignedTo, actor.id), eq(tasks.done, false), sql`${tasks.phase} is not null`));
    if (Number(load?.n ?? 0) >= (me.capacity ?? 8)) throw new PlatformError(409, "CAPACITY_FULL", "Hai già raggiunto la tua capacità: chiudi una fase prima di prenderne un'altra.");
    const [claimed] = await tx.update(tasks).set({ assignedTo: actor.id, claimable: false }).where(and(eq(tasks.id, taskId), eq(tasks.claimable, true), isNull(tasks.assignedTo))).returning();
    if (!claimed) throw new PlatformError(409, "ALREADY_CLAIMED", "Un collega ha già preso questa fase.");
    await tx.insert(projectMembers).values({ projectId: task.projectId, userId: actor.id }).onConflictDoNothing();
    await recordAssignment(tx, { entityType: "task", entityId: taskId, fromUser: null, toUser: actor.id, method: "claim", reason: "standard_queue", actorId: actor.id });
    await tx.update(projects).set({ opsStatus: "assigned", updatedAt: new Date() }).where(and(eq(projects.id, task.projectId), eq(projects.opsStatus, "ready_for_assignment")));
    return claimed;
  });
  await audit(actor, "task.claimed", "task", taskId);
  return json({ ok: true, projectId: result.projectId });
}
/** Stato di un compito (spostamento della scheda): rispetta le dipendenze tra fasi. */
export async function taskStatus(request: Request, actor: Actor, taskId: string) {
  if (request.method !== "PATCH") throw notFound();
  const [task] = await getDb().select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw notFound();
  const mine = task.assignedTo === actor.id;
  if (task.projectId) {
    const access = await projectAccess(actor, task.projectId, "task.write");
    if (!mine) demand(actor, "project.assign", access.resource);
  } else if (!mine && !(task.createdBy === actor.id)) throw notFound();
  const body = await readBody(request, z.object({ status: z.enum(["todo", "in_progress", "blocked", "done"]), priority: z.enum(PRIORITIES).optional(), dueAt: z.string().datetime().nullable().optional() }).strict());
  if (task.dependsOn && ["in_progress", "done"].includes(body.status)) {
    const [before] = await getDb().select({ done: tasks.done, title: tasks.title }).from(tasks).where(eq(tasks.id, task.dependsOn));
    if (before && !before.done) throw new PlatformError(409, "DEPENDENCY_OPEN", `Prima va chiusa la fase «${before.title}».`);
  }
  await getDb().transaction(async (tx) => {
    await tx.update(tasks).set({ status: body.status, done: body.status === "done", completedAt: body.status === "done" ? new Date() : null, ...(body.priority ? { priority: body.priority } : {}), ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}) }).where(eq(tasks.id, taskId));
    if (task.projectId && body.status === "in_progress") await tx.update(projects).set({ opsStatus: "in_progress", updatedAt: new Date() }).where(and(eq(projects.id, task.projectId), eq(projects.opsStatus, "assigned"), sql`${projects.startedAt} is not null`));
  });
  return json({ ok: true });
}
