import { randomBytes } from "node:crypto";
import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { user, session } from "@/db/auth-schema";
import {
  memberships,
  staffInvitations,
  projectMembers,
  platformSettings,
  affiliateProfiles,
  dataRequests,
  auditEvents,
  accountPreferences,
} from "@/db/platform-schema";
import {
  PERMISSIONS,
  ROLES,
  ROLE_GRANTS,
  canDelegate,
  effectiveGrants,
  type Role,
  type Grant,
} from "./permissions";
import { demand, demandRecent, projectAccess, audit, type Actor } from "./access";
import { readBody, json, hashToken, PlatformError, forbidden, notFound } from "./http";
import { mailConfigured, appOrigin, paymentPolicySchema, commissionRuleSchema } from "./config";
import { impaginaEmail, esc } from "@/lib/email";
import { enqueueMail } from "./mail";
import { limitRequest } from "./rate-limit";

const grantSchema = z
  .object({ permission: z.enum(PERMISSIONS), scope: z.enum(["own", "assigned", "organization"]) })
  .strict();
const membershipInput = z.object({
  role: z.enum(ROLES),
  grants: z.array(grantSchema).max(100).nullable().default(null),
});
function validateDelegation(actor: Actor, role: Role, grants: Grant[] | null) {
  if (role === "admin" && grants === null) throw new PlatformError(422, "EXPLICIT_GRANTS_REQUIRED", "Scegli esplicitamente moduli e ambiti per questo admin.");
  if (role === "owner" && !actor.roles.includes("owner")) throw forbidden();
  if (role === "owner" && grants !== null)
    throw new PlatformError(422, "OWNER_GRANTS", "Il proprietario mantiene tutti i permessi.");
  const requested = grants ?? ROLE_GRANTS[role];
  // Self-service roles cannot carry staff powers or bypass staff MFA.
  if (
    (role === "author" || role === "affiliate") &&
    !requested.every(
      (g) => g.scope === "own" && ROLE_GRANTS[role].some((d) => d.permission === g.permission),
    )
  )
    throw forbidden();
  if (!canDelegate(actor.grants, requested)) throw forbidden();
}
export async function teamCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demand(actor, "role.manage");
  const people = await getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
    })
    .from(user)
    .limit(200);
  const access = await getDb().select().from(memberships);
  return json({
    users: people.map((p) => ({ ...p, memberships: access.filter((m) => m.userId === p.id) })),
  });
}
export async function invitationCollection(request: Request, actor: Actor) {
  demand(actor, "invite.manage");
  if (request.method === "GET") {
    const rows = await getDb()
      .select({
        id: staffInvitations.id,
        email: staffInvitations.email,
        role: staffInvitations.role,
        grants: staffInvitations.grants,
        projectIds: staffInvitations.projectIds,
        status: staffInvitations.status,
        expiresAt: staffInvitations.expiresAt,
      })
      .from(staffInvitations)
      .where(actor.roles.includes("owner") ? sql`true` : eq(staffInvitations.invitedBy, actor.id))
      .orderBy(desc(staffInvitations.createdAt))
      .limit(100);
    return json({ invitations: rows });
  }
  if (request.method !== "POST") throw notFound();
  demandRecent(actor);
  if (!mailConfigured())
    throw new PlatformError(
      503,
      "MAIL_UNAVAILABLE",
      "Configura l'invio email prima di invitare il team.",
    );
  await limitRequest("staff-invite", actor.id, 20, 3600);
  const body = await readBody(
    request,
    membershipInput
      .extend({
        email: z.string().trim().email().max(320),
        projectIds: z.array(z.string().uuid()).max(100).default([]),
      })
      .strict(),
  );
  validateDelegation(actor, body.role, body.grants);
  for (const id of body.projectIds) await projectAccess(actor, id, "project.assign");
  const token = randomBytes(32).toString("base64url");
  const [invitation] = await getDb()
    .insert(staffInvitations)
    .values({
      ...body,
      email: body.email.toLowerCase(),
      tokenHash: hashToken(token),
      invitedBy: actor.id,
      expiresAt: new Date(Date.now() + 48 * 3600_000),
    })
    .returning({ id: staffInvitations.id });
  try {
    await enqueueMail(`invitation:${invitation!.id}`, {
      to: body.email,
      subject: "Invito al team Proemios",
      html: impaginaEmail(
        "Il tuo invito a Proemios",
        `<p>Hai ricevuto un invito personale per il ruolo ${esc(body.role)}.</p><p><a href="${esc(`${appOrigin()}/invito?token=${token}`)}">Accetta l'invito</a></p><p>Crea o usa il tuo account con questo indirizzo verificato. Il collegamento scade tra 48 ore. Per i ruoli del team è richiesta la verifica in due passaggi.</p>`,
      ),
    });
  } catch {
    await getDb()
      .update(staffInvitations)
      .set({ status: "delivery_failed" })
      .where(eq(staffInvitations.id, invitation!.id));
    throw new PlatformError(503, "MAIL_FAILED", "L'invito non è stato inviato. Riprova.");
  }
  await audit(actor, "invitation.created", "invitation", invitation!.id, { role: body.role });
  return json({ id: invitation!.id, emailStatus: "queued" }, 201);
}
export async function invitationRevoke(request: Request, actor: Actor, id: string) {
  if (request.method !== "DELETE") throw notFound();
  demand(actor, "invite.manage");
  demandRecent(actor);
  const [target] = await getDb().select().from(staffInvitations).where(eq(staffInvitations.id, id));
  if (!target || (!actor.roles.includes("owner") && target.invitedBy !== actor.id)) throw notFound();
  await getDb()
    .update(staffInvitations)
    .set({ status: "revoked" })
    .where(and(eq(staffInvitations.id, id), eq(staffInvitations.status, "pending")));
  await audit(actor, "invitation.revoked", "invitation", id);
  return json({ ok: true });
}
export async function invitationAccept(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  const body = await readBody(request, z.object({ token: z.string().min(30).max(200) }).strict());
  await limitRequest("invite-accept", actor.id, 10, 3600);
  await getDb().transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.tokenHash, hashToken(body.token)))
      .for("update");
    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.expiresAt.getTime() < Date.now() ||
      invitation.email !== actor.email.toLowerCase()
    )
      throw new PlatformError(
        403,
        "INVALID_INVITE",
        "L'invito è scaduto o non corrisponde al tuo indirizzo verificato.",
      );
    const senderMemberships = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, invitation.invitedBy), eq(memberships.active, true)));
    const sender = {
      ...actor,
      id: invitation.invitedBy,
      roles: senderMemberships.map((m) => m.role),
      grants: effectiveGrants(senderMemberships),
    };
    demand(sender, "invite.manage");
    validateDelegation(sender, invitation.role, invitation.grants);
    for (const id of invitation.projectIds) await projectAccess(sender, id, "project.assign", tx);
    await tx
      .insert(memberships)
      .values({ userId: actor.id, role: invitation.role, grants: invitation.grants })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.role],
        set: { active: true, grants: invitation.grants, updatedAt: new Date() },
      });
    for (const projectId of invitation.projectIds)
      await tx.insert(projectMembers).values({ projectId, userId: actor.id }).onConflictDoNothing();
    if (invitation.role === "affiliate")
      await tx
        .insert(affiliateProfiles)
        .values({ userId: actor.id, code: randomBytes(8).toString("hex"), active: true })
        .onConflictDoNothing();
    await tx
      .update(staffInvitations)
      .set({ status: "accepted", acceptedBy: actor.id })
      .where(eq(staffInvitations.id, invitation.id));
    await tx.delete(session).where(eq(session.userId, actor.id));
    await tx
      .insert(auditEvents)
      .values({
        actorId: actor.id,
        action: "invitation.accepted",
        resourceType: "invitation",
        resourceId: invitation.id,
      });
  });
  return json({ ok: true, href: "/sicurezza" });
}
export async function membershipUpdate(request: Request, actor: Actor, id: string) {
  if (request.method !== "PATCH") throw notFound();
  demand(actor, "role.manage");
  demandRecent(actor);
  const body = await readBody(
    request,
    z.object({ active: z.boolean(), grants: z.array(grantSchema).max(100).nullable() }).strict(),
  );
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(617821320)`);
    const [target] = await tx
      .select()
      .from(memberships)
      .where(eq(memberships.id, id))
      .for("update");
    if (!target) throw notFound();
    validateDelegation(actor, target.role, body.grants);
    if (target.userId === actor.id)
      throw new PlatformError(
        409,
        "SELF_ROLE_CHANGE",
        "Le modifiche al tuo accesso richiedono un altro proprietario.",
      );
    if (target.role === "owner" && !body.active) {
      const owners = await tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.role, "owner"), eq(memberships.active, true)));
      if (owners.length <= 1)
        throw new PlatformError(409, "LAST_OWNER", "Non puoi disattivare l'ultimo proprietario.");
    }
    await tx
      .update(memberships)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(memberships.id, id));
    await tx.delete(session).where(eq(session.userId, target.userId));
    await tx
      .insert(auditEvents)
      .values({
        actorId: actor.id,
        action: "membership.updated",
        resourceType: "membership",
        resourceId: id,
        detail: { active: body.active, role: target.role },
      });
  });
  return json({ ok: true });
}
export async function settingsCollection(request: Request, actor: Actor) {
  demand(actor, "settings.manage");
  if (request.method === "GET")
    return json({
      settings: (await getDb().select().from(platformSettings)).filter((s) =>
        ["payment-policy", "commission-rule"].includes(s.key),
      ),
    });
  if (request.method !== "PUT") throw notFound();
  demandRecent(actor);
  const body = await readBody(
    request,
    z
      .object({ key: z.enum(["payment-policy", "commission-rule"]), value: z.record(z.unknown()) })
      .strict(),
  );
  const schema = body.key === "payment-policy" ? paymentPolicySchema : commissionRuleSchema;
  const result = schema.safeParse({
    ...body.value,
    approvedAt: new Date().toISOString(),
    approvedBy: actor.id,
  });
  if (!result.success)
    throw new PlatformError(
      422,
      "INVALID_POLICY",
      "Controlla tutti i valori della configurazione economica.",
    );
  await getDb()
    .insert(platformSettings)
    .values({ key: body.key, value: result.data })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: result.data, updatedAt: new Date() },
    });
  await audit(actor, "settings.approved", "setting", body.key, { version: result.data.version });
  return json({ ok: true });
}
export async function accountRequest(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  const body = await readBody(
    request,
    z
      .object({ kind: z.enum(["export", "delete"]), note: z.string().max(2000).optional() })
      .strict(),
  );
  await limitRequest("data-request", actor.id, 3, 86400);
  await getDb()
    .insert(dataRequests)
    .values({ userId: actor.id, ...body });
  await audit(actor, "account.requested", "account", actor.id, { kind: body.kind });
  return json({ ok: true }, 202);
}
export async function preferences(request: Request, actor: Actor) {
  if (request.method === "GET") {
    const [row] = await getDb().select().from(accountPreferences).where(eq(accountPreferences.userId, actor.id));
    return json({ preferences: row ?? { optionalEmail: false, savedFilters: {} } });
  }
  if (request.method !== "PATCH") throw notFound();
  const body = await readBody(request, z.object({ optionalEmail: z.boolean(), savedFilters: z.record(z.string().max(100)).refine(r => Object.keys(r).length <= 10).default({}) }).strict());
  await getDb().insert(accountPreferences).values({ userId: actor.id, ...body }).onConflictDoUpdate({ target: accountPreferences.userId, set: { ...body, updatedAt: new Date() } });
  return json({ ok: true });
}
