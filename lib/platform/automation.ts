/**
 * Attività automatiche in due lavori distinti.
 *
 * - **frequente** (ogni 10–15 minuti): scadenze ed escalation, code e
 *   prenotazioni, consegna e ritentativi dei webhook, invio della posta già
 *   in coda. Ogni passo è idempotente e ha un limite di lavoro per giro.
 * - **giornaliero** (una volta al giorno): la manutenzione completa già
 *   esistente (fatture, promemoria, recuperi, pulizie, analisi in coda,
 *   riepilogo del mattino). Se chiamato più volte nello stesso giorno dal
 *   cron, i giri successivi sono registrati come saltati.
 *
 * Entrambi registrano ogni tentativo e usano un blocco a tempo, così due
 * chiamate sovrapposte non lavorano insieme.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { jobLocks, jobRuns, webhookDeliveries } from "@/db/crm-schema";
import { emailOutbox, invoices, staffInvitations } from "@/db/platform-schema";
import { runAssignmentJobs } from "./crm-routing";
import { deliverWebhooks } from "./crm-api";
import { flushMail } from "./mail";
import { maintenance } from "./operations";
import type { Actor } from "./access";
import { can } from "./permissions";
import { json, notFound, forbidden } from "./http";

export const JOBS = {
  frequent: { label: "Manutenzione frequente", expectedMinutes: 15, leaseSeconds: 240 },
  daily: { label: "Attività giornaliere", expectedMinutes: 24 * 60, leaseSeconds: 900 },
} as const;
export type JobName = keyof typeof JOBS;

async function acquire(job: JobName, owner: string) {
  const until = new Date(Date.now() + JOBS[job].leaseSeconds * 1000);
  const rows = await getDb()
    .insert(jobLocks)
    .values({ job, owner, lockedUntil: until })
    .onConflictDoUpdate({ target: jobLocks.job, set: { owner, lockedUntil: until }, where: lt(jobLocks.lockedUntil, new Date()) })
    .returning();
  return rows.length > 0;
}
async function release(job: JobName, owner: string) {
  await getDb().delete(jobLocks).where(and(eq(jobLocks.job, job), eq(jobLocks.owner, owner)));
}
/** Esegue un lavoro con registrazione, blocco anti-sovrapposizione ed errori conservati. */
export async function runJob(job: JobName, trigger: "cron" | "manual", work: () => Promise<Record<string, unknown>>) {
  const owner = randomUUID();
  const [run] = await getDb().insert(jobRuns).values({ job, trigger }).returning({ id: jobRuns.id });
  if (!(await acquire(job, owner))) {
    await getDb().update(jobRuns).set({ status: "skipped", finishedAt: new Date(), summary: { reason: "già in esecuzione" } }).where(eq(jobRuns.id, run!.id));
    return { status: "skipped" as const, reason: "già in esecuzione" };
  }
  try {
    const summary = await work();
    const skipped = summary.skipped === true;
    await getDb().update(jobRuns).set({ status: skipped ? "skipped" : "ok", finishedAt: new Date(), summary }).where(eq(jobRuns.id, run!.id));
    return { status: skipped ? ("skipped" as const) : ("ok" as const), summary };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "errore";
    await getDb().update(jobRuns).set({ status: "error", finishedAt: new Date(), error: message }).where(eq(jobRuns.id, run!.id));
    return { status: "error" as const, error: message };
  } finally {
    await release(job, owner);
  }
}
/** Un passo che fallisce non ferma gli altri: l'errore resta nel riepilogo. */
async function step<T>(name: string, errors: string[], work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    errors.push(`${name}: ${error instanceof Error ? error.message.slice(0, 200) : "errore"}`);
    return null;
  }
}
export async function frequentWork() {
  const errors: string[] = [];
  const assignment = await step("assegnazioni", errors, () => runAssignmentJobs());
  const webhooks = await step("webhook", errors, () => deliverWebhooks(20));
  const mail = await step("posta", errors, () => flushMail(20));
  await step("inviti", errors, () => getDb().update(staffInvitations).set({ status: "expired" }).where(and(eq(staffInvitations.status, "pending"), lt(staffInvitations.expiresAt, new Date()))));
  if (errors.length) throw new Error(errors.join(" · "));
  return { assignment, webhooks, mail };
}
export async function dailyWork(trigger: "cron" | "manual") {
  if (trigger === "cron") {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [done] = await getDb().select({ id: jobRuns.id }).from(jobRuns).where(and(eq(jobRuns.job, "daily"), eq(jobRuns.status, "ok"), gte(jobRuns.startedAt, today))).limit(1);
    if (done) return { skipped: true, reason: "già eseguite oggi" };
  }
  return (await maintenance()) as unknown as Record<string, unknown>;
}

/** Pannello: ultimo tentativo, ultima riuscita, ritardo, errori e lavoro in attesa. */
export async function automationStatus(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  if (!["operations.read", "settings.manage", "integrations.manage"].some((p) => can(actor.grants, p as "operations.read"))) throw forbidden();
  return json(await automationSnapshot());
}
export async function automationSnapshot(now = new Date()) {
  const db = getDb();
  const jobs = [];
  for (const job of Object.keys(JOBS) as JobName[]) {
    const [attempt] = await db.select().from(jobRuns).where(eq(jobRuns.job, job)).orderBy(desc(jobRuns.startedAt)).limit(1);
    const [success] = await db.select().from(jobRuns).where(and(eq(jobRuns.job, job), eq(jobRuns.status, "ok"))).orderBy(desc(jobRuns.startedAt)).limit(1);
    const [failure] = await db.select().from(jobRuns).where(and(eq(jobRuns.job, job), eq(jobRuns.status, "error"))).orderBy(desc(jobRuns.startedAt)).limit(1);
    const expected = JOBS[job].expectedMinutes;
    const lateMinutes = success ? Math.max(0, Math.round((now.getTime() - success.startedAt.getTime()) / 60000) - expected) : null;
    jobs.push({
      job,
      label: JOBS[job].label,
      expectedMinutes: expected,
      lastAttempt: attempt ? { at: attempt.startedAt, status: attempt.status, trigger: attempt.trigger } : null,
      lastSuccess: success ? success.startedAt : null,
      lateMinutes,
      state: !attempt ? "never" : attempt.status === "error" ? "error" : lateMinutes !== null && lateMinutes > expected ? "late" : success ? "ok" : "error",
      lastError: failure && (!success || failure.startedAt > success.startedAt) ? { at: failure.startedAt, error: failure.error } : null,
    });
  }
  const count = async (q: Promise<Array<{ n: number }>>) => Number((await q)[0]?.n ?? 0);
  const pending = {
    mail: await count(db.select({ n: sql<number>`count(*)::int` }).from(emailOutbox).where(inArray(emailOutbox.status, ["pending", "retry"]))),
    mailFailed: await count(db.select({ n: sql<number>`count(*)::int` }).from(emailOutbox).where(eq(emailOutbox.status, "failed"))),
    webhooks: await count(db.select({ n: sql<number>`count(*)::int` }).from(webhookDeliveries).where(inArray(webhookDeliveries.status, ["pending", "retry"]))),
    queuedLeads: await count(db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.assignmentStatus, "queued"))),
    expiredReservations: await count(db.select({ n: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.assignmentStatus, "reserved"), lt(leads.reservedUntil, now)))),
    lateFirstResponses: await count(db.select({ n: sql<number>`count(*)::int` }).from(leads).where(and(isNull(leads.firstResponseAt), isNull(leads.escalatedAt), lt(leads.slaDueAt, now), sql`${leads.stage} not in ('won','lost','unreachable')`))),
    invoices: await count(db.select({ n: sql<number>`count(*)::int` }).from(invoices).where(inArray(invoices.status, ["queued", "retry"]))),
  };
  return { jobs, pending, frequentConfigured: jobs.find((j) => j.job === "frequent")!.lastAttempt !== null };
}
