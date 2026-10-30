import { randomUUID, createHash } from "node:crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { analysisJobs, notifications } from "@/db/platform-schema";
import { user } from "@/db/auth-schema";
import { analizza, aiConfigurata, estratto, AiError, type ReportCompleto } from "@/lib/ai";
import { calcolaMetriche, type MetricheTesto } from "@/lib/metrics";
import { costBandForAnalysis } from "@/lib/pricing";
import { estraiTesto, estensioneDi } from "@/lib/extract";
import { gateAnalisiSchema } from "@/lib/validation";
import { json, PlatformError, unavailable, notFound } from "./http";
import { authConfigured, mailConfigured } from "./config";
import { getActor } from "./access";
import { inspectUpload, scanUpload, storePrivate, readPrivate, deletePrivate, storageConfigured } from "./storage";
import { limitRequest } from "./rate-limit";
import { enqueueMail } from "./mail";
import { impaginaEmail } from "@/lib/email";

function positiveSetting(key: string) { const n = Number(process.env[key]); return Number.isSafeInteger(n) && n > 0 ? n : 0; }
export function analysisConfigured() {
  return process.env.ANALYSIS_ENABLED === "1" && process.env.ANALYSIS_POLICY_APPROVED === "1" &&
    aiConfigurata() && authConfigured() && storageConfigured() && mailConfigured() && Boolean(process.env.CRON_SECRET) &&
    positiveSetting("ANALYSIS_MAX_JOBS_PER_DAY") > 0 && positiveSetting("ANALYSIS_PER_USER_DAILY_LIMIT") > 0 &&
    positiveSetting("MANUSCRIPT_RETENTION_DAYS") > 0;
}
export async function submitAnalysis(request: Request) {
  if (!analysisConfigured()) throw unavailable();
  const actor = await getActor(request);
  const operationKey = request.headers.get("idempotency-key");
  if (!operationKey || !z.string().uuid().safeParse(operationKey).success) throw new PlatformError(400, "IDEMPOTENCY_REQUIRED", "Aggiorna la pagina e riprova.");
  const form = await request.formData(), uploaded = form.get("file");
  const gate = gateAnalisiSchema.safeParse({ nome: form.get("nome"), email: form.get("email"), consensoPrivacy: form.get("consensoPrivacy") === "true", consensoMarketing: form.get("consensoMarketing") === "true" });
  if (!gate.success) throw new PlatformError(422, "INVALID_FIELDS", "Controlla nome, email e informativa.");
  if (gate.data.email.toLowerCase() !== actor.email.toLowerCase()) throw new PlatformError(403, "ACCOUNT_EMAIL_REQUIRED", "Usa l'indirizzo verificato del tuo account.");
  if (form.get("website")) throw new PlatformError(422, "INVALID_REQUEST", "Richiesta non valida.");
  if (!(uploaded instanceof File) || uploaded.size === 0 || uploaded.size > 4 * 1024 * 1024) throw new PlatformError(422, "INVALID_FILE", "Carica un file non vuoto di massimo 4 MB.");
  const bytes = new Uint8Array(await uploaded.arrayBuffer()), inspection = inspectUpload(uploaded.name, bytes);
  const requestHash = createHash("sha256").update(actor.id).update(bytes).digest("hex");
  const [previous] = await getDb().select().from(analysisJobs).where(eq(analysisJobs.operationKey, operationKey));
  if (previous) {
    if (previous.userId !== actor.id || previous.requestHash !== requestHash) throw new PlatformError(409, "REQUEST_CHANGED", "La richiesta è cambiata. Aggiorna e riprova.");
    return json({ jobId: previous.id, status: previous.status, report: previous.report }, previous.status === "completed" ? 200 : 202);
  }
  await limitRequest("analysis-upload", actor.id, 10, 3600);
  if (!inspection.text && !(await scanUpload(bytes))) throw new PlatformError(503, "SCANNER_REQUIRED", "Il controllo di DOCX e PDF non è disponibile. Puoi usare un file TXT UTF-8.");
  const extension = estensioneDi(uploaded.name);
  if (!extension) throw new PlatformError(422, "INVALID_FILE", "Formato non ammesso.");
  let text: string;
  try { text = await estraiTesto(Buffer.from(bytes), extension); }
  catch { throw new PlatformError(422, "INVALID_DOCUMENT", "Non riusciamo a leggere il documento. Prova un file TXT UTF-8."); }
  const metrics = calcolaMetriche(text);
  if (metrics.parole < 100) throw new PlatformError(422, "TEXT_TOO_SHORT", "Occorrono almeno 100 parole.");
  const sourceKey = await storePrivate("analysis", new TextEncoder().encode(estratto(text)), "text/plain; charset=utf-8");
  try {
    const job = await getDb().transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(617821321)`);
      const [duplicate] = await tx.select().from(analysisJobs).where(eq(analysisJobs.operationKey, operationKey));
      if (duplicate) {
        if (duplicate.userId !== actor.id || duplicate.requestHash !== requestHash) throw new PlatformError(409, "REQUEST_CHANGED", "La richiesta è cambiata.");
        return { ...duplicate, duplicate: true };
      }
      const day = new Date(); day.setUTCHours(0, 0, 0, 0);
      const today = await tx.select({ userId: analysisJobs.userId }).from(analysisJobs).where(gte(analysisJobs.createdAt, day));
      const active = await tx.select({ id: analysisJobs.id }).from(analysisJobs).where(inArray(analysisJobs.status, ["queued", "running"]));
      if (active.length) throw new PlatformError(429, "ANALYSIS_BUSY", "Un'analisi è già in corso. Riprova tra qualche minuto.");
      if (today.length >= positiveSetting("ANALYSIS_MAX_JOBS_PER_DAY") || today.filter(j => j.userId === actor.id).length >= positiveSetting("ANALYSIS_PER_USER_DAILY_LIMIT")) throw new PlatformError(429, "ANALYSIS_LIMIT", "È stato raggiunto il limite delle analisi disponibili oggi.");
      const [saved] = await tx.insert(analysisJobs).values({ id: randomUUID(), userId: actor.id, operationKey, requestHash, filename: uploaded.name, sourceKey, metrics, expiresAt: new Date(Date.now() + positiveSetting("MANUSCRIPT_RETENTION_DAYS") * 86400_000) }).returning();
      return { ...saved!, duplicate: false };
    });
    if (job.duplicate) await deletePrivate(sourceKey);
    return json({ jobId: job.id, status: job.status }, 202);
  } catch (error) { await deletePrivate(sourceKey).catch(() => {}); throw error; }
}
export async function analysisStatus(request: Request) {
  const actor = await getActor(request), id = new URL(request.url).searchParams.get("jobId");
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  const [job] = await getDb().select({ id: analysisJobs.id, status: analysisJobs.status, report: analysisJobs.report, errorCode: analysisJobs.errorCode }).from(analysisJobs).where(and(eq(analysisJobs.id, id!), eq(analysisJobs.userId, actor.id)));
  if (!job) throw notFound();
  return json({ jobId: job.id, status: job.status, report: job.report, errore: job.status === "failed" ? "L'analisi non è riuscita. Il team può verificare la richiesta senza perdere il riferimento." : undefined });
}
export async function runAnalysisJob(id: string) {
  if (!analysisConfigured()) return;
  const job = await getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(617821321)`);
    const [row] = await tx.select().from(analysisJobs).where(eq(analysisJobs.id, id)).for("update");
    if (!row || row.status !== "queued" || !row.sourceKey || row.expiresAt.getTime() <= Date.now()) return null;
    const running = await tx.select({ id: analysisJobs.id }).from(analysisJobs).where(eq(analysisJobs.status, "running"));
    if (running.length) return null;
    await tx.update(analysisJobs).set({ status: "running", attempts: row.attempts + 1, lockedUntil: new Date(Date.now() + 90_000), updatedAt: new Date() }).where(eq(analysisJobs.id, id));
    return row;
  });
  if (!job?.sourceKey) return;
  try {
    const text = await new Response(await readPrivate(job.sourceKey)).text();
    const result = await analizza(text), metrics = job.metrics as MetricheTesto;
    const report: ReportCompleto = { ...result, metriche: metrics, fasciaCosto: costBandForAnalysis(metrics.parole, result.livelloIntervento), generatoIl: new Date().toISOString() };
    await getDb().transaction(async tx => {
      await tx.update(analysisJobs).set({ report, status: "completed", errorCode: null, lockedUntil: null, updatedAt: new Date() }).where(eq(analysisJobs.id, id));
      await tx.insert(notifications).values({ userId: job.userId, title: "Il report automatico è pronto", body: "Puoi consultarlo nello spazio delle analisi.", href: `/analisi-manoscritto?jobId=${id}` });
    });
    const [person] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, job.userId));
    if (person) await enqueueMail(`analysis:${id}:ready`, { to: person.email, subject: "Il report automatico è pronto · Proemios", html: impaginaEmail("Il report è pronto", "<p>Accedi al tuo spazio per consultare il report. Le metriche riguardano il file completo; il giudizio automatico usa un estratto di massimo 8.000 parole.</p>") });
  } catch (error) {
    const [current] = await getDb().select({ status: analysisJobs.status }).from(analysisJobs).where(eq(analysisJobs.id, id));
    if (current?.status === "completed") return;
    await getDb().update(analysisJobs).set({ status: "failed", errorCode: error instanceof AiError ? error.codice : "SERVICE_ERROR", lockedUntil: null, updatedAt: new Date() }).where(eq(analysisJobs.id, id));
  }
}
