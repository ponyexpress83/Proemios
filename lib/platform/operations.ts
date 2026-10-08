import { eq, and, desc, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  notifications,
  affiliateProfiles,
  affiliateConversions,
  emailOutbox,
  auditEvents,
  dataRequests,
  projectFiles,
  operationKeys,
  requestLimits,
  analysisJobs,
  staffInvitations,
  quoteClaims,
} from "@/db/platform-schema";
import { demand, demandAvailable, demandRecent, audit, type Actor } from "./access";
import { can } from "./permissions";
import { json, readBody, notFound, PlatformError } from "./http";
import { authConfigured, mailConfigured, appOrigin } from "./config";
import { storageConfigured, deletePrivate, readPrivate, scanUpload } from "./storage";
import { flushMail } from "./mail";
import { analysisConfigured, runAnalysisJob } from "./analysis";

export async function notificationCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  return json({
    notifications: await getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.userId, actor.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100),
  });
}
export async function notificationRead(request: Request, actor: Actor, id: string) {
  if (request.method !== "PATCH") throw notFound();
  await getDb()
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, actor.id)));
  return json({ ok: true });
}
export async function affiliateCollection(request: Request, actor: Actor) {
  demandAvailable(actor, "affiliate.read");
  if (request.method !== "GET") throw notFound();
  const profiles = await getDb()
    .select()
    .from(affiliateProfiles)
    .where(
      can(actor.grants, "affiliate.read") ? sql`true` : eq(affiliateProfiles.userId, actor.id),
    );
  const conversions = await getDb()
    .select({
      id: affiliateConversions.id,
      createdAt: affiliateConversions.createdAt,
      ruleVersion: affiliateConversions.ruleVersion,
      affiliateId: affiliateConversions.affiliateId,
    })
    .from(affiliateConversions)
    .where(
      can(actor.grants, "affiliate.read")
        ? sql`true`
        : eq(affiliateConversions.affiliateId, actor.id),
    )
    .limit(200);
  return json({
    profiles: profiles.map((p) => ({
      ...p,
      link: `${appOrigin()}/preventivo?ref=${encodeURIComponent(p.code)}`,
    })),
    conversions,
  });
}
export async function affiliateManage(request: Request, actor: Actor) {
  if (request.method !== "PATCH") throw notFound();
  demand(actor, "affiliate.manage");
  demandRecent(actor);
  const body = await readBody(
    request,
    z.object({ userId: z.string().min(1).max(100), active: z.boolean() }).strict(),
  );
  await getDb()
    .update(affiliateProfiles)
    .set({ active: body.active })
    .where(eq(affiliateProfiles.userId, body.userId));
  await audit(actor, "affiliate.updated", "affiliate", body.userId);
  return json({ ok: true });
}
export async function operationsCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demand(actor, "operations.read");
  const [mail, events, requests, quarantine] = await Promise.all([
    getDb()
      .select({
        id: emailOutbox.id,
        status: emailOutbox.status,
        attempts: emailOutbox.attempts,
        lastError: emailOutbox.lastError,
        createdAt: emailOutbox.createdAt,
      })
      .from(emailOutbox)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(100),
    getDb().select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100),
    getDb().select().from(dataRequests).orderBy(desc(dataRequests.createdAt)).limit(100),
    getDb()
      .select({
        id: projectFiles.id,
        name: projectFiles.name,
        projectId: projectFiles.projectId,
        status: projectFiles.status,
      })
      .from(projectFiles)
      .where(eq(projectFiles.status, "quarantine"))
      .limit(100),
  ]);
  return json({
    readiness: {
      auth: authConfigured(),
      email: mailConfigured(),
      privateFiles: storageConfigured(),
      scanner: Boolean(process.env.FILE_SCANNER_URL && process.env.FILE_SCANNER_TOKEN),
      payments: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      cron: Boolean(process.env.CRON_SECRET),
      analysis: analysisConfigured(),
    },
    mail,
    events,
    requests,
    quarantine,
    jobs: await getDb().select({ id: analysisJobs.id, status: analysisJobs.status, attempts: analysisJobs.attempts, errorCode: analysisJobs.errorCode, createdAt: analysisJobs.createdAt }).from(analysisJobs).orderBy(desc(analysisJobs.createdAt)).limit(100),
  });
}
export async function maintenance() {
  const mail = await flushMail(20);
  const quarantined = await getDb()
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.status, "quarantine"))
    .limit(5);
  let scanned = 0,
    deleted = 0;
  for (const file of quarantined) {
    try {
      const bytes = new Uint8Array(
        await new Response(await readPrivate(file.storageKey)).arrayBuffer(),
      );
      if (await scanUpload(bytes)) {
        await getDb()
          .update(projectFiles)
          .set({ status: "ready" })
          .where(eq(projectFiles.id, file.id));
        scanned++;
      }
    } catch (e) {
      if (e instanceof PlatformError && e.code === "UNSAFE_FILE") {
        await deletePrivate(file.storageKey);
        await getDb()
          .update(projectFiles)
          .set({ status: "rejected" })
          .where(eq(projectFiles.id, file.id));
      }
    }
  }
  const expired = await getDb()
    .select()
    .from(projectFiles)
    .where(and(lt(projectFiles.expiresAt, new Date()), eq(projectFiles.status, "quarantine")))
    .limit(20);
  for (const file of expired) {
    await deletePrivate(file.storageKey);
    await getDb()
      .update(projectFiles)
      .set({ status: "deleted" })
      .where(eq(projectFiles.id, file.id));
    deleted++;
  }
  await getDb().delete(operationKeys).where(lt(operationKeys.expiresAt, new Date()));
  await getDb()
    .delete(requestLimits)
    .where(lt(requestLimits.windowStart, Date.now() - 7 * 86400_000));
  const expiredJobs = await getDb().select().from(analysisJobs).where(lt(analysisJobs.expiresAt, new Date())).limit(20);
  for (const job of expiredJobs) {
    if (job.sourceKey) await deletePrivate(job.sourceKey);
    await getDb().update(analysisJobs).set({ status: "deleted", sourceKey: null, report: null, metrics: {}, filename: "contenuto rimosso", updatedAt: new Date() }).where(eq(analysisJobs.id, job.id));
    deleted++;
  }
  await getDb().update(analysisJobs).set({ status: "failed", errorCode: "INTERRUPTED_REVIEW_REQUIRED", lockedUntil: null }).where(and(eq(analysisJobs.status, "running"), lt(analysisJobs.lockedUntil, new Date())));
  const pending = await getDb().select({ id: analysisJobs.id }).from(analysisJobs).where(eq(analysisJobs.status, "queued")).limit(1);
  if (pending[0]) await runAnalysisJob(pending[0].id);
  await getDb().update(staffInvitations).set({ status: "expired" }).where(and(eq(staffInvitations.status, "pending"), lt(staffInvitations.expiresAt, new Date())));
  await getDb().delete(quoteClaims).where(lt(quoteClaims.expiresAt, new Date()));
  return { ...mail, scanned, deleted };
}
export async function mailRetry(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "operations.write"); demandRecent(actor);
  const rows = await getDb().update(emailOutbox).set({ status: "retry", attempts: 0, availableAt: new Date(), lockedUntil: null }).where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, "failed"))).returning({ id: emailOutbox.id });
  if (!rows.length) throw new PlatformError(409, "NOT_RETRYABLE", "L'invio non è nello stato di errore.");
  await audit(actor, "mail.retry-requested", "mail", id);
  return json({ ok: true });
}
export async function operationRun(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "operations.write");
  demandRecent(actor);
  const result = await maintenance();
  await audit(actor, "maintenance.executed", "operation", undefined, result);
  return json(result);
}

export async function analysisRetry(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "operations.write"); demandRecent(actor);
  await readBody(request, z.object({ confirmProviderCost: z.literal(true) }).strict());
  if (!analysisConfigured()) throw new PlatformError(503, "ANALYSIS_UNAVAILABLE", "L'analisi non è attiva.");
  await getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(617821321)`);
    const [job] = await tx.select().from(analysisJobs).where(eq(analysisJobs.id, id)).for("update");
    if (!job || job.status !== "failed" || !job.sourceKey || job.expiresAt.getTime() <= Date.now() || job.attempts >= 3) throw new PlatformError(409, "NOT_RETRYABLE", "La richiesta non può essere riprovata. Verifica errore, scadenza e tentativi.");
    await tx.update(analysisJobs).set({ status: "queued", errorCode: null, lockedUntil: null, updatedAt: new Date() }).where(eq(analysisJobs.id, id));
  });
  await audit(actor, "analysis.retry-requested", "analysis", id);
  return json({ ok: true, status: "queued" }, 202);
}
