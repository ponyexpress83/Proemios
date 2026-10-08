import { and, eq, or, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import {
  memberships,
  platformSettings,
  auditEvents,
  projects,
  projectMembers,
  leadOwnership,
} from "@/db/platform-schema";
import {
  can,
  effectiveGrants,
  hasPermission,
  isStaff,
  type Grant,
  type Role,
  type Permission,
  type Membership,
} from "./permissions";
import { PlatformError, forbidden, notFound } from "./http";

export type Actor = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  grants: Grant[];
  staff: boolean;
  mfaEnabled: boolean;
  sessionCreatedAt: Date;
};
export async function actorFromHeaders(
  headers: Headers,
  options: { allowUnenrolled?: boolean } = {},
): Promise<Actor> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) throw new PlatformError(401, "UNAUTHORIZED", "Accedi per continuare.");
  if (!session.user.emailVerified)
    throw new PlatformError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Verifica il tuo indirizzo email per continuare.",
    );
  const database = getDb();
  const ownerEmail = process.env.PROEMIOS_OWNER_EMAIL?.trim().toLowerCase();
  // A verified configured identity may bootstrap exactly once; the key is atomic.
  if (ownerEmail && session.user.email.toLowerCase() === ownerEmail) {
    await database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(617821320)`);
      const existingOwner = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.role, "owner"))
        .limit(1);
      if (existingOwner.length) return;
      const claim = await tx
        .insert(platformSettings)
        .values({ key: "owner-bootstrap", value: { completed: true } })
        .onConflictDoNothing()
        .returning();
      if (!claim.length) return;
      await tx
        .insert(memberships)
        .values({ userId: session.user.id, role: "owner" })
        .onConflictDoNothing();
      await tx
        .insert(auditEvents)
        .values({
          actorId: session.user.id,
          action: "owner.bootstrapped",
          resourceType: "membership",
        });
    });
  }
  const access = await database
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, session.user.id), eq(memberships.active, true)));
  if (!access.length) throw forbidden();
  const staff = isStaff(access as Membership[]);
  if (staff && Date.now() - session.session.createdAt.getTime() > 12 * 60 * 60 * 1000)
    throw new PlatformError(401, "SESSION_EXPIRED", "Accedi nuovamente per continuare.");
  if (staff && !session.user.twoFactorEnabled && !options.allowUnenrolled)
    throw new PlatformError(
      428,
      "MFA_REQUIRED",
      "Attiva la verifica in due passaggi per accedere allo spazio del team.",
    );
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: access.map((m) => m.role),
    grants: effectiveGrants(access),
    staff,
    mfaEnabled: Boolean(session.user.twoFactorEnabled),
    sessionCreatedAt: session.session.createdAt,
  };
}
export const getActor = (request: Request, options?: { allowUnenrolled?: boolean }) =>
  actorFromHeaders(request.headers, options);
export function demand(
  actor: Actor,
  permission: Permission,
  resource?: { own?: boolean; assigned?: boolean },
) {
  if (!can(actor.grants, permission, resource)) throw forbidden();
}
export function demandRecent(actor: Actor) {
  if (!actor.mfaEnabled || Date.now() - actor.sessionCreatedAt.getTime() > 15 * 60 * 1000)
    throw new PlatformError(
      428,
      "REAUTH_REQUIRED",
      "Per questa operazione accedi nuovamente con la verifica in due passaggi.",
    );
}
export async function audit(
  actor: Actor,
  action: string,
  resourceType: string,
  resourceId?: string,
  detail?: Record<string, unknown>,
) {
  await getDb()
    .insert(auditEvents)
    .values({ actorId: actor.id, action, resourceType, resourceId, detail });
}
export async function projectAccess(
  actor: Actor,
  id: string,
  permission: Permission = "project.read",
  database: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
) {
  const [project] = await database.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) throw notFound();
  const member = await database
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, actor.id)))
    .limit(1);
  const resource = { own: project.authorId === actor.id, assigned: member.length > 0 };
  if (!can(actor.grants, permission, resource)) throw notFound();
  return { project, resource };
}
export async function projectPredicate(
  actor: Actor,
  permission: Permission = "project.read",
): Promise<SQL> {
  if (can(actor.grants, permission)) return sql`true`;
  const predicates: SQL[] = [];
  if (can(actor.grants, permission, { own: true }))
    predicates.push(eq(projects.authorId, actor.id));
  if (can(actor.grants, permission, { assigned: true })) {
    const assigned = await getDb()
      .select({ id: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, actor.id));
    if (assigned.length)
      predicates.push(
        inArray(
          projects.id,
          assigned.map((x) => x.id),
        ),
      );
  }
  return predicates.length ? or(...predicates)! : sql`false`;
}
export async function leadAccess(
  actor: Actor,
  leadId: string,
  permission: Permission = "crm.read",
) {
  const [owner] = await getDb()
    .select()
    .from(leadOwnership)
    .where(eq(leadOwnership.leadId, leadId))
    .limit(1);
  const resource = { own: owner?.authorId === actor.id, assigned: owner?.assignedTo === actor.id };
  if (!can(actor.grants, permission, resource)) throw notFound();
  return resource;
}
export function leadPredicate(actor: Actor, permission: Permission): SQL {
  if (can(actor.grants, permission)) return sql`true`;
  const predicates: SQL[] = [];
  if (can(actor.grants, permission, { own: true }))
    predicates.push(eq(leadOwnership.authorId, actor.id));
  if (can(actor.grants, permission, { assigned: true }))
    predicates.push(eq(leadOwnership.assignedTo, actor.id));
  return predicates.length ? or(...predicates)! : sql`false`;
}
export function demandAvailable(actor: Actor, permission: Permission) {
  if (!hasPermission(actor.grants, permission)) throw forbidden();
}
