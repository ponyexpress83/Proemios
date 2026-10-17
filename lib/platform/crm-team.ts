/**
 * Persone del team: inviti con modello di ruolo («Aggiungi venditore»),
 * profilo operativo (team, competenze, lingue, orari, assenze, capacità,
 * partecipazione all'assegnazione, limiti di sconto e rate) e disattivazione
 * senza perdita di storia, con riassegnazione e revoca degli accessi.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { user, session } from "@/db/auth-schema";
import { apiKeys, crmDeals, teamProfiles } from "@/db/crm-schema";
import { auditEvents, emailOutbox, leadOwnership, memberships, projectMembers, projects, staffInvitations, tasks } from "@/db/platform-schema";
import { chooseAssignee } from "@/lib/crm-core/assignment";
import { EXCLUSION_LABELS, profileGaps } from "./crm-setup";
import { businessHoursSchema, isAbsent, isWithinHours, defaultBusinessHours } from "@/lib/crm-core/hours";
import { ROLE_GRANTS, MARKETING_PERMISSIONS, canDelegate, can, effectiveGrants, type Grant, type Permission, type Role } from "./permissions";
import { demand, demandRecent, demandAvailable, audit, type Actor } from "./access";
import { json, notFound, forbidden, PlatformError, readBody } from "./http";
import { createInvitation } from "./team";
import { recordAssignment, assignmentRules, salesCandidates } from "./crm-routing";
import { resolvePurchaseRule } from "./crm";
import { notify } from "./crm-notify";
import { mailConfigured } from "./config";
import { limitRequest } from "./rate-limit";

const org = (permissions: Permission[]): Grant[] => permissions.map((permission) => ({ permission, scope: "organization" as const }));
const adminBase: Permission[] = ["crm.read", "crm.write", "crm.assign", "quote.read", "quote.write", "quote.send", "task.read", "task.write", "support.read", "support.write", "report.read"];
/**
 * Modelli di ruolo: chi invita sceglie il modello e indica solo i dati
 * necessari. I permessi vengono dal modello e passano sempre dal controllo di
 * delega: nessuno concede più di ciò che ha.
 */
export const ROLE_TEMPLATES: Record<string, { label: string; role: Role; grants: Grant[] | null; team: string; participates: boolean; external?: boolean; asks: Array<"skills" | "languages" | "capacity" | "team" | "maxDiscountBps"> }> = {
  seller: { label: "Venditore", role: "seller", grants: null, team: "vendite", participates: true, asks: ["languages", "skills", "capacity", "maxDiscountBps"] },
  marketing: { label: "Marketing", role: "marketing", grants: null, team: "marketing", participates: false, asks: [] },
  operator: { label: "Operatore di produzione", role: "editor", grants: null, team: "produzione", participates: false, asks: ["skills", "languages", "capacity"] },
  collaborator: { label: "Collaboratore esterno", role: "editor", grants: null, team: "produzione", participates: false, external: true, asks: ["skills", "languages", "capacity"] },
  ops_lead: { label: "Responsabile di produzione", role: "coordinator", grants: null, team: "produzione", participates: false, asks: ["skills", "capacity"] },
  finance: { label: "Finance", role: "finance", grants: null, team: "amministrazione", participates: false, asks: [] },
  /** «Admin 2»: CRM più l'area marketing, senza finanza, chiavi o ruoli. */
  admin_marketing: { label: "Admin con Marketing", role: "admin", grants: org([...adminBase, ...MARKETING_PERMISSIONS.filter((p) => p !== "integrations.manage" && p !== "export")]), team: "marketing", participates: false, asks: [] },
  /** «Admin 2»: gestione del team (inviti, profili, assegnazioni), senza diventare proprietario. */
  admin_team: { label: "Admin gestione team", role: "admin", grants: org([...adminBase, "invite.manage", "role.manage"]), team: "direzione", participates: false, asks: [] },
};
const profileInput = z
  .object({
    team: z.string().trim().min(2).max(60).nullable().optional(),
    skills: z.array(z.string().trim().min(2).max(40)).max(30).optional(),
    languages: z.array(z.string().trim().min(2).max(8)).min(1).max(10).optional(),
    hours: businessHoursSchema.nullable().optional(),
    absences: z.array(z.object({ from: z.string().datetime(), to: z.string().datetime(), reason: z.string().trim().max(200).nullable().optional() }).strict()).max(100).optional(),
    capacity: z.number().int().min(0).max(1000).nullable().optional(),
    participates: z.boolean().optional(),
    maxDiscountBps: z.number().int().min(0).max(10000).nullable().optional(),
    maxInstallments: z.number().int().min(1).max(24).nullable().optional(),
    external: z.boolean().optional(),
  })
  .strict();
/** Campi che ognuno può aggiornare da sé (disponibilità); il resto spetta a chi gestisce il team. */
const SELF_FIELDS = new Set(["hours", "absences", "languages"]);

export async function templateInvite(request: Request, actor: Actor) {
  if (request.method === "GET") {
    demand(actor, "invite.manage");
    return json({ templates: Object.entries(ROLE_TEMPLATES).map(([key, t]) => ({ key, label: t.label, role: t.role, asks: t.asks, allowed: canDelegate(actor.grants, t.grants ?? ROLE_GRANTS[t.role]) && (t.role !== "owner") })) });
  }
  if (request.method !== "POST") throw notFound();
  demand(actor, "invite.manage");
  demandRecent(actor);
  if (!mailConfigured()) throw new PlatformError(503, "MAIL_UNAVAILABLE", "Configura l'invio email prima di invitare il team.");
  await limitRequest("staff-invite", actor.id, 20, 3600);
  const body = await readBody(request, z.object({ template: z.enum(Object.keys(ROLE_TEMPLATES) as [string, ...string[]]), email: z.string().trim().email().max(320), profile: profileInput.default({}) }).strict());
  const template = ROLE_TEMPLATES[body.template]!;
  const purchase = await resolvePurchaseRule();
  if (body.profile.maxDiscountBps && body.profile.maxDiscountBps > purchase.maxDiscountBps) throw new PlatformError(422, "DISCOUNT_ABOVE_RULE", `Il limite personale non può superare il massimo della regola (${purchase.maxDiscountBps / 100}%).`);
  const profile = { team: template.team, participates: template.participates, external: template.external ?? false, ...body.profile };
  const created = await createInvitation(actor, { email: body.email, role: template.role, grants: template.grants, projectIds: [], template: body.template, profile, label: template.label });
  return json({ ...created, template: body.template }, 201);
}

/** Elenco del team con profilo, carico e disponibilità di adesso (orari e assenze, non la presenza online). */
export async function teamDirectory(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  if (!can(actor.grants, "role.manage") && !can(actor.grants, "crm.assign") && !can(actor.grants, "project.assign")) throw forbidden();
  const rows = await getDb().select({ m: memberships, name: user.name, email: user.email, verified: user.emailVerified }).from(memberships).innerJoin(user, eq(user.id, memberships.userId));
  const ids = [...new Set(rows.map((r) => r.m.userId))];
  const profiles = ids.length ? await getDb().select().from(teamProfiles).where(inArray(teamProfiles.userId, ids)) : [];
  const deals = ids.length ? await getDb().select({ owner: crmDeals.ownerId, count: sql<number>`count(*)::int` }).from(crmDeals).where(and(inArray(crmDeals.ownerId, ids), isNull(crmDeals.closedAt))).groupBy(crmDeals.ownerId) : [];
  const open = ids.length ? await getDb().select({ owner: tasks.assignedTo, count: sql<number>`count(*)::int` }).from(tasks).where(and(inArray(tasks.assignedTo, ids), eq(tasks.done, false))).groupBy(tasks.assignedTo) : [];
  const rules = await assignmentRules();
  const now = new Date();
  const people = ids
    .map((id) => {
      const own = rows.filter((r) => r.m.userId === id);
      const p = profiles.find((x) => x.userId === id);
      const roles = own.map((r) => ({ id: r.m.id, role: r.m.role, active: r.m.active }));
      if (roles.every((r) => r.role === "author")) return null;
      return {
        id,
        name: own[0]!.name,
        email: can(actor.grants, "role.manage") ? own[0]!.email : undefined,
        roles: roles.filter((r) => r.role !== "author"),
        active: roles.some((r) => r.active && r.role !== "author") && !p?.deactivatedAt,
        profile: p ?? null,
        load: { openDeals: Number(deals.find((d) => d.owner === id)?.count ?? 0), openTasks: Number(open.find((d) => d.owner === id)?.count ?? 0) },
        now: { inHours: isWithinHours(now, p?.hours ?? rules.hours ?? defaultBusinessHours), absent: isAbsent(now, p?.absences ?? []) },
      };
    })
    .filter(Boolean);
  // Perché una persona (non) riceverebbe una richiesta adesso: stesso motore dell'assegnazione reale.
  const candidates = await salesCandidates(getDb());
  const probe = chooseAssignee(candidates, { requiredSkill: null, language: rules.defaultLanguage, openDealOwner: null, now, orgHours: rules.hours, defaultCapacity: rules.defaultCapacity });
  const enriched = (people as NonNullable<(typeof people)[number]>[]).map((p) => {
    const c = probe.considered.find((x) => x.userId === p.id);
    const mainRole = p.roles.find((r) => r.active)?.role ?? p.roles[0]?.role ?? "";
    return { ...p, gaps: profileGaps(profiles.find((x) => x.userId === p.id), mainRole), assignment: c ? { eligible: !c.excluded, why: c.excluded ? EXCLUSION_LABELS[c.excluded] : c.inHours ? "idoneo adesso" : "idoneo, fuori orario", load: c.load, capacity: c.capacity } : { eligible: false, why: candidates.some((x) => x.userId === p.id) ? "non partecipa" : "ruolo che non riceve richieste" } };
  });
  // Inviti con stato reale e, se l'email non è partita, l'errore del servizio.
  const invitations = can(actor.grants, "invite.manage") ? await getDb().select({ id: staffInvitations.id, email: staffInvitations.email, role: staffInvitations.role, template: staffInvitations.template, status: staffInvitations.status, expiresAt: staffInvitations.expiresAt, createdAt: staffInvitations.createdAt }).from(staffInvitations).where(actor.roles.includes("owner") ? sql`true` : eq(staffInvitations.invitedBy, actor.id)).orderBy(desc(staffInvitations.createdAt)).limit(100) : [];
  const mails = invitations.length ? await getDb().select({ eventKey: emailOutbox.eventKey, status: emailOutbox.status, lastError: emailOutbox.lastError }).from(emailOutbox).where(sql`${emailOutbox.eventKey} like 'invitation:%'`) : [];
  return json({
    people: enriched,
    invitations: invitations.map((i) => {
      const mail = mails.find((m) => m.eventKey.startsWith(`invitation:${i.id}:`));
      const status = i.status === "pending" && i.expiresAt.getTime() < now.getTime() ? "expired" : i.status;
      return { ...i, status, template: i.template ? ROLE_TEMPLATES[i.template]?.label ?? i.template : null, mail: mail ? { status: mail.status, error: mail.status === "failed" || mail.status === "retry" ? mail.lastError?.slice(0, 200) ?? "invio non riuscito" : null } : null };
    }),
    templates: Object.entries(ROLE_TEMPLATES).map(([key, t]) => ({ key, label: t.label })),
  });
}
export async function teamProfile(request: Request, actor: Actor, userId: string) {
  const self = userId === actor.id;
  if (request.method === "GET") {
    if (!self && !can(actor.grants, "role.manage") && !can(actor.grants, "crm.assign")) throw notFound();
    const [profile] = await getDb().select().from(teamProfiles).where(eq(teamProfiles.userId, userId));
    return json({ profile: profile ?? null });
  }
  if (request.method !== "PUT") throw notFound();
  const body = await readBody(request, profileInput);
  const managed = Object.keys(body).filter((k) => !SELF_FIELDS.has(k));
  if (!self || managed.length) {
    demand(actor, "role.manage");
    demandRecent(actor);
  }
  if (!self) {
    const target = await getDb().select().from(memberships).where(eq(memberships.userId, userId));
    if (!target.length) throw notFound();
    // Chi gestisce il team non modifica chi ha più permessi di lui.
    if (!canDelegate(actor.grants, effectiveGrants(target.filter((m) => m.active)))) throw forbidden();
  }
  const purchase = await resolvePurchaseRule();
  if (body.maxDiscountBps && body.maxDiscountBps > purchase.maxDiscountBps) throw new PlatformError(422, "DISCOUNT_ABOVE_RULE", `Il limite personale non può superare il massimo della regola (${purchase.maxDiscountBps / 100}%).`);
  await getDb().insert(teamProfiles).values({ userId, ...body, updatedBy: actor.id }).onConflictDoUpdate({ target: teamProfiles.userId, set: { ...body, updatedBy: actor.id, updatedAt: new Date() } });
  await audit(actor, "team.profile_updated", "user", userId, { fields: Object.keys(body) });
  return json({ ok: true });
}
/**
 * Disattivazione: accessi revocati subito (ruoli, sessioni, chiavi create),
 * richieste, trattative e compiti aperti riassegnati (o rimessi in coda),
 * progetti tolti. Vendite passate, attribuzioni e provvigioni restano come sono.
 */
export async function teamDeactivate(request: Request, actor: Actor, userId: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "role.manage");
  demandRecent(actor);
  if (userId === actor.id) throw new PlatformError(409, "SELF_DEACTIVATION", "Non puoi disattivare il tuo accesso: serve un'altra persona con i permessi.");
  const body = await readBody(request, z.object({ reason: z.string().trim().min(3).max(300), reassignTo: z.string().min(1).max(100).nullable().default(null) }).strict());
  const result = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(617821320)`);
    const target = await tx.select().from(memberships).where(eq(memberships.userId, userId)).for("update");
    if (!target.length || target.every((m) => m.role === "author")) throw notFound();
    if (!canDelegate(actor.grants, effectiveGrants(target.filter((m) => m.active)))) throw forbidden();
    if (target.some((m) => m.role === "owner" && m.active)) {
      const owners = await tx.select().from(memberships).where(and(eq(memberships.role, "owner"), eq(memberships.active, true)));
      if (owners.length <= 1) throw new PlatformError(409, "LAST_OWNER", "Non puoi disattivare l'ultimo proprietario.");
    }
    if (body.reassignTo) {
      const next = await tx.select().from(memberships).where(and(eq(memberships.userId, body.reassignTo), eq(memberships.active, true)));
      if (!next.length || body.reassignTo === userId) throw new PlatformError(422, "INVALID_ASSIGNEE", "Scegli una persona attiva a cui passare il lavoro.");
    }
    await tx.update(memberships).set({ active: false, updatedAt: new Date() }).where(and(eq(memberships.userId, userId), sql`${memberships.role} <> 'author'`));
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.insert(teamProfiles).values({ userId, participates: false, deactivatedAt: new Date(), deactivationReason: body.reason, updatedBy: actor.id }).onConflictDoUpdate({ target: teamProfiles.userId, set: { participates: false, deactivatedAt: new Date(), deactivationReason: body.reason, updatedBy: actor.id, updatedAt: new Date() } });
    const keys = await tx.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.createdBy, userId), isNull(apiKeys.revokedAt))).returning({ id: apiKeys.id });
    const to = body.reassignTo;
    const owned = await tx.select().from(leadOwnership).innerJoin(leads, eq(leads.id, leadOwnership.leadId)).where(and(eq(leadOwnership.assignedTo, userId), sql`${leads.stage} not in ('won','lost','unreachable')`));
    for (const row of owned) {
      await tx.update(leadOwnership).set({ assignedTo: to, updatedAt: new Date() }).where(eq(leadOwnership.leadId, row.platform_lead_ownership.leadId));
      await tx.update(leads).set({ assignmentStatus: to ? "assigned" : "queued", reservedBy: null, reservedUntil: null }).where(eq(leads.id, row.leads.id));
      await recordAssignment(tx, { entityType: "lead", entityId: row.leads.id, fromUser: userId, toUser: to, method: "deactivation", reason: body.reason, actorId: actor.id });
    }
    const deals = await tx.update(crmDeals).set({ ownerId: to, updatedAt: new Date() }).where(and(eq(crmDeals.ownerId, userId), isNull(crmDeals.closedAt))).returning({ id: crmDeals.id });
    for (const d of deals) await recordAssignment(tx, { entityType: "deal", entityId: d.id, fromUser: userId, toUser: to, method: "deactivation", reason: body.reason, actorId: actor.id });
    const openTasks = await tx.update(tasks).set({ assignedTo: to }).where(and(eq(tasks.assignedTo, userId), eq(tasks.done, false))).returning({ id: tasks.id });
    for (const t of openTasks) await recordAssignment(tx, { entityType: "task", entityId: t.id, fromUser: userId, toUser: to, method: "deactivation", reason: body.reason, actorId: actor.id });
    const removed = await tx.delete(projectMembers).where(eq(projectMembers.userId, userId)).returning({ projectId: projectMembers.projectId });
    await tx.update(projects).set({ opsLeadId: null }).where(eq(projects.opsLeadId, userId));
    await tx.update(projects).set({ qaOwnerId: null }).where(eq(projects.qaOwnerId, userId));
    if (to) await notify(tx, to, "task_assigned", { key: `deactivation:${userId}`, title: "Lavoro ricevuto da un collega", body: `Ti sono passati ${owned.length} contatti, ${deals.length} trattative e ${openTasks.length} compiti aperti.`, href: "/spazio?tab=work" });
    await tx.insert(auditEvents).values({ actorId: actor.id, action: "team.deactivated", resourceType: "user", resourceId: userId, detail: { reason: body.reason, reassignTo: to, leads: owned.length, deals: deals.length, tasks: openTasks.length, projects: removed.length, keys: keys.length } });
    return { leads: owned.length, deals: deals.length, tasks: openTasks.length, projects: removed.length, keysRevoked: keys.length };
  });
  return json({ ok: true, ...result });
}
export async function teamReactivate(request: Request, actor: Actor, userId: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "role.manage");
  demandRecent(actor);
  const target = await getDb().select().from(memberships).where(eq(memberships.userId, userId));
  if (!target.length) throw notFound();
  if (!canDelegate(actor.grants, effectiveGrants(target.map((m) => ({ ...m, active: true }))))) throw forbidden();
  await getDb().update(memberships).set({ active: true, updatedAt: new Date() }).where(eq(memberships.userId, userId));
  await getDb().update(teamProfiles).set({ deactivatedAt: null, deactivationReason: null, updatedAt: new Date() }).where(eq(teamProfiles.userId, userId));
  await audit(actor, "team.reactivated", "user", userId);
  return json({ ok: true });
}
export { demandAvailable };
