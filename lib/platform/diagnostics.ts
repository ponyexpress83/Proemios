/**
 * Diagnostica delle integrazioni effettivamente presenti. Quattro stati:
 * - configurata: le impostazioni ci sono, ma nessun fatto registrato dimostra che il servizio funzioni;
 * - verificata: c'è una prova recente nei dati (email consegnata, evento Stripe ricevuto, esecuzione riuscita…);
 * - non configurata: manca qualcosa; se il servizio è facoltativo lo si dice;
 * - errore: un fatto registrato indica un problema.
 * Nessun segreto esce da qui; nessun test invasivo verso i servizi esterni.
 */
import { and, desc, eq, gte, like, notLike, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, webhookDeliveries, webhookEndpoints } from "@/db/crm-schema";
import { emailOutbox, invoices, webhookEvents } from "@/db/platform-schema";
import journal from "@/drizzle/meta/_journal.json";
import { stripeConfigurato } from "@/lib/stripe";
import { mailConfigured, appOrigin } from "./config";
import { ficConfigured, ficSendsToSdi } from "./fic";
import { automationSnapshot } from "./automation";
import type { Actor } from "./access";
import { can } from "./permissions";
import { json, notFound, forbidden } from "./http";

export type DiagnosticState = "verified" | "configured" | "not_configured" | "error";
export type Diagnostic = { key: string; label: string; state: DiagnosticState; optional: boolean; detail: string; action?: string };
const DAY = 86400_000;

/** Migrazioni attese (dal registro incluso nella build) contro quelle registrate nel database. */
export async function migrationStatus() {
  const expected = (journal as { entries: Array<{ tag: string; when: number }> }).entries;
  try {
    const rows = (await getDb().execute(sql`select created_at from drizzle.__drizzle_migrations`)) as unknown as { rows?: Array<{ created_at: string | number }> } | Array<{ created_at: string | number }>;
    const list = Array.isArray(rows) ? rows : rows.rows ?? [];
    const applied = new Set(list.map((r) => Number(r.created_at)));
    const missing = expected.filter((e) => !applied.has(e.when)).map((e) => e.tag);
    return { tracked: true, expected: expected.length, applied: expected.length - missing.length, missing, latest: expected.at(-1)?.tag ?? null };
  } catch {
    // Registro di drizzle assente (migrazioni applicate a mano): si controlla l'esistenza delle tabelle più recenti.
    const probe = async (table: string) => {
      const r = (await getDb().execute(sql`select to_regclass(${`public.${table}`}) as t`)) as unknown as { rows?: Array<{ t: string | null }> } | Array<{ t: string | null }>;
      const list = Array.isArray(r) ? r : r.rows ?? [];
      return Boolean(list[0]?.t);
    };
    const missing = [] as string[];
    if (!(await probe("crm_contacts"))) missing.push("0012_crm_relations");
    if (!(await probe("job_runs"))) missing.push("0013_automation_runs");
    // Il registro può mancare anche dopo un aggiornamento solo parziale:
    // CRM e cron presenti non provano che Document Studio sia installato.
    const studioTables = ["doc_documents", "doc_revisions", "doc_versions", "doc_suggestions", "doc_comments", "doc_revision_cycles", "ai_jobs", "ai_job_chunks", "ai_usage", "project_costs", "external_connections"];
    for (const table of studioTables) {
      if (!(await probe(table))) {
        missing.push("0014_document_studio");
        break;
      }
    }
    return { tracked: false, expected: expected.length, applied: null, missing, latest: expected.at(-1)?.tag ?? null };
  }
}

export async function diagnostics(now = new Date()): Promise<Diagnostic[]> {
  const db = getDb();
  const out: Diagnostic[] = [];
  // Database e migrazioni
  try {
    await db.execute(sql`select 1`);
    const m = await migrationStatus();
    out.push({ key: "database", label: "Database e migrazioni", optional: false, state: m.missing.length ? "error" : "verified", detail: m.missing.length ? `Migrazioni mancanti: ${m.missing.join(", ")}.` : `Connesso; ${m.tracked ? `${m.applied}/${m.expected} migrazioni registrate` : "tabelle più recenti presenti (registro di drizzle assente)"}; ultima attesa ${m.latest}.`, action: m.missing.length ? "Applicare le migrazioni mancanti con `npm run db:migrate` puntando al database di questo ambiente." : undefined });
  } catch {
    out.push({ key: "database", label: "Database e migrazioni", optional: false, state: "error", detail: "Il database non risponde.", action: "Controllare DATABASE_URL dell'ambiente." });
  }
  // Email
  const realMail = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const sent = await db.select({ at: emailOutbox.createdAt }).from(emailOutbox).where(and(eq(emailOutbox.status, "accepted"), gte(emailOutbox.createdAt, new Date(now.getTime() - 30 * DAY)))).orderBy(desc(emailOutbox.createdAt)).limit(1);
  const failed = await db.select({ n: sql<number>`count(*)::int` }).from(emailOutbox).where(and(eq(emailOutbox.status, "failed"), gte(emailOutbox.createdAt, new Date(now.getTime() - 7 * DAY))));
  const sender = process.env.EMAIL_FROM?.replace(/.*@/, "@").replace(/[>"\s]/g, "") ?? null;
  if (!mailConfigured()) out.push({ key: "email", label: "Email operative", optional: false, state: "not_configured", detail: "Servizio email non configurato: inviti, proposte e notifiche email non partono.", action: "Impostare RESEND_API_KEY ed EMAIL_FROM con un dominio verificato su Resend." });
  else if (!realMail) out.push({ key: "email", label: "Email operative", optional: false, state: "configured", detail: "Trasporto di prova: i messaggi restano in una cartella locale e non raggiungono nessuno." });
  else if (Number(failed[0]?.n ?? 0) > 0 && !sent.length) out.push({ key: "email", label: "Email operative", optional: false, state: "error", detail: `${failed[0]!.n} invii falliti negli ultimi 7 giorni e nessuna consegna recente; mittente ${sender}.`, action: "Aprire Operazioni → posta per l'errore del provider." });
  else out.push({ key: "email", label: "Email operative", optional: false, state: sent.length ? "verified" : "configured", detail: sent.length ? `Ultima consegna accettata dal provider il ${sent[0]!.at.toLocaleDateString("it-IT")}; mittente ${sender}.` : `Configurato con mittente ${sender}; nessuna consegna registrata negli ultimi 30 giorni.` });
  // Pagamenti
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : null;
  const stripeEvent = await db.select({ at: webhookEvents.createdAt, type: webhookEvents.type }).from(webhookEvents).where(and(notLike(webhookEvents.type, "brevo.%"), gte(webhookEvents.createdAt, new Date(now.getTime() - 30 * DAY)))).orderBy(desc(webhookEvents.createdAt)).limit(1);
  if (!stripeConfigurato()) out.push({ key: "payments", label: "Pagamenti (Stripe)", optional: false, state: "not_configured", detail: "Chiave Stripe assente: il checkout rifiuta gli addebiti.", action: "Impostare STRIPE_SECRET_KEY (test per le prove) e STRIPE_WEBHOOK_SECRET." });
  else if (!process.env.STRIPE_WEBHOOK_SECRET) out.push({ key: "payments", label: "Pagamenti (Stripe)", optional: false, state: "error", detail: `Chiave in modalità ${mode ?? "sconosciuta"} ma segreto del webhook assente: gli incassi non verrebbero confermati.`, action: "Registrare l'endpoint /api/webhooks/stripe nella Dashboard Stripe e impostare STRIPE_WEBHOOK_SECRET." });
  else out.push({ key: "payments", label: "Pagamenti (Stripe)", optional: false, state: stripeEvent.length ? "verified" : "configured", detail: `Modalità ${mode ?? "sconosciuta"}; ${stripeEvent.length ? `ultimo evento firmato ricevuto il ${stripeEvent[0]!.at.toLocaleDateString("it-IT")} (${stripeEvent[0]!.type})` : "nessun evento firmato ricevuto negli ultimi 30 giorni"}.` });
  // Attività automatiche
  const auto = await automationSnapshot(now);
  for (const job of auto.jobs) {
    const optional = false;
    if (job.state === "never") out.push({ key: `cron_${job.job}`, label: job.label, optional, state: "not_configured", detail: "Nessuna esecuzione registrata.", action: job.job === "frequent" ? "Pianificare GET /api/cron/frequent ogni 10–15 minuti con l'intestazione Authorization: Bearer CRON_SECRET (vedi docs/CRM_OPERATIVO.md)." : "Verificare il cron di Vercel su /api/cron e CRON_SECRET." });
    else out.push({ key: `cron_${job.job}`, label: job.label, optional, state: job.state === "ok" ? "verified" : "error", detail: job.state === "ok" ? `Ultima riuscita: ${job.lastSuccess ? new Date(job.lastSuccess).toLocaleString("it-IT") : "—"}.` : job.state === "late" ? `In ritardo di ${job.lateMinutes} minuti rispetto alla frequenza attesa.` : `Ultimo errore: ${job.lastError?.error ?? "sconosciuto"}.` });
  }
  // Webhook in uscita e API
  const endpoints = await db.select({ n: sql<number>`count(*)::int` }).from(webhookEndpoints).where(eq(webhookEndpoints.active, true));
  const badDeliveries = await db.select({ n: sql<number>`count(*)::int` }).from(webhookDeliveries).where(eq(webhookDeliveries.status, "failed"));
  const okDelivery = await db.select({ at: webhookDeliveries.deliveredAt }).from(webhookDeliveries).where(eq(webhookDeliveries.status, "delivered")).orderBy(desc(webhookDeliveries.deliveredAt)).limit(1);
  out.push(Number(endpoints[0]?.n ?? 0) === 0 ? { key: "webhooks", label: "Webhook in uscita", optional: true, state: "not_configured", detail: "Nessun indirizzo registrato. Servono solo se un altro sistema deve ricevere gli eventi del CRM." } : { key: "webhooks", label: "Webhook in uscita", optional: true, state: Number(badDeliveries[0]?.n ?? 0) > 0 ? "error" : okDelivery.length ? "verified" : "configured", detail: `${endpoints[0]!.n} indirizzi attivi; ${badDeliveries[0]!.n} consegne fallite in modo definitivo.` });
  const keys = await db.select({ n: sql<number>`count(*)::int` }).from(apiKeys).where(sql`${apiKeys.revokedAt} is null`);
  out.push({ key: "api", label: "API v1", optional: true, state: Number(keys[0]?.n ?? 0) ? "configured" : "not_configured", detail: Number(keys[0]?.n ?? 0) ? `${keys[0]!.n} chiavi attive.` : "Nessuna chiave. Serve solo per moduli esterni o integrazioni server." });
  // Servizi amministrativi e marketing
  const ficIssued = await db.select({ at: invoices.updatedAt }).from(invoices).where(eq(invoices.status, "created")).orderBy(desc(invoices.updatedAt)).limit(1);
  const ficFailed = await db.select({ n: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.status, "failed"));
  out.push(!ficConfigured() ? { key: "fic", label: "Fatture in Cloud", optional: true, state: "not_configured", detail: "Non collegato: le fatture restano in coda finché non lo si configura." } : { key: "fic", label: "Fatture in Cloud", optional: true, state: Number(ficFailed[0]?.n ?? 0) > 0 ? "error" : ficIssued.length ? "verified" : "configured", detail: `${ficSendsToSdi() ? "Emissione e invio SdI" : "Emissione senza invio SdI"}; ${ficIssued.length ? `ultima fattura emessa il ${ficIssued[0]!.at.toLocaleDateString("it-IT")}` : "nessuna fattura emessa"}${Number(ficFailed[0]?.n ?? 0) ? `; ${ficFailed[0]!.n} non riuscite` : ""}.` });
  const brevoEvent = await db.select({ at: webhookEvents.createdAt }).from(webhookEvents).where(like(webhookEvents.type, "brevo.%")).orderBy(desc(webhookEvents.createdAt)).limit(1);
  out.push(process.env.BREVO_API_KEY ? { key: "brevo", label: "Brevo", optional: true, state: brevoEvent.length ? "verified" : "configured", detail: brevoEvent.length ? `Ultimo evento ricevuto il ${brevoEvent[0]!.at.toLocaleDateString("it-IT")}.` : "Configurato; nessun evento ricevuto." } : { key: "brevo", label: "Brevo", optional: true, state: "not_configured", detail: "Facoltativo: serve per campagne e liste esterne." });
  out.push({ key: "storage", label: "Archivio file privato", optional: false, state: process.env.PROEMIOS_TEST_RUN === "1" && !process.env.VERCEL ? "configured" : process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? "configured" : "not_configured", detail: process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? "Vercel Blob privato impostato; la prova è un caricamento riuscito." : process.env.PROEMIOS_TEST_RUN === "1" ? "Cartella locale di prova." : "Archivio non configurato: i materiali non si caricano." });
  // Motore editoriale (Anthropic): «verificata» solo con una chiamata riuscita negli ultimi 30 giorni.
  const { aiUsage } = await import("@/db/document-schema");
  const { approvedAiRules } = await import("./ai-client");
  const aiOk = await db.select({ at: aiUsage.createdAt }).from(aiUsage).where(and(eq(aiUsage.outcome, "ok"), gte(aiUsage.createdAt, new Date(now.getTime() - 30 * 86400_000)))).orderBy(desc(aiUsage.createdAt)).limit(1);
  const aiRules = await approvedAiRules();
  const aiEnv = process.env.EDITORIAL_AI_ENABLED === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
  out.push(!aiEnv ? { key: "anthropic", label: "Motore editoriale (Anthropic)", optional: true, state: "not_configured", detail: process.env.ANTHROPIC_API_KEY ? "Chiave presente ma lavorazioni non abilitate (EDITORIAL_AI_ENABLED)." : "Nessuna chiave Anthropic: le lavorazioni AI non partono.", action: "Impostare ANTHROPIC_API_KEY ed EDITORIAL_AI_ENABLED=1 dopo aver approvato fornitore, conservazione dei dati e costi." } : !aiRules ? { key: "anthropic", label: "Motore editoriale (Anthropic)", optional: true, state: "configured", detail: "Chiave presente, ma regole dell'AI (modello e tetti di spesa) non approvate.", action: "Approvare le regole in Impostazioni CRM → AI." } : { key: "anthropic", label: "Motore editoriale (Anthropic)", optional: true, state: aiOk.length ? "verified" : "configured", detail: aiOk.length ? `Ultima chiamata riuscita il ${aiOk[0]!.at.toLocaleDateString("it-IT")} · modello ${aiRules.model}.` : `Modello ${aiRules.model}; nessuna chiamata riuscita negli ultimi 30 giorni.` });
  const { googleStatus } = await import("./documents/google");
  const g = await googleStatus();
  out.push(!g.configured ? { key: "google", label: "Google Docs", optional: true, state: "not_configured", detail: "Client OAuth non impostato: i documenti si lavorano nell'editor di Proemios." } : g.status === "connected" ? { key: "google", label: "Google Docs", optional: true, state: "configured", detail: `Collegato${g.accountEmail ? ` all'account ${g.accountEmail}` : ""}. Le proposte restano in Proemios (modalità suggerimenti di Google non verificata).` } : { key: "google", label: "Google Docs", optional: true, state: g.status === "not_connected" || g.status === "pending" ? "not_configured" : "error", detail: g.lastError ? `Collegamento da rifare: ${g.lastError}` : "Client OAuth impostato, account non ancora collegato.", action: "Collegare l'account da Impostazioni CRM → Diagnostica." });
  out.push({ key: "app", label: "Indirizzo dell'applicazione", optional: false, state: process.env.APP_URL || process.env.BETTER_AUTH_URL ? "configured" : "not_configured", detail: `Link nelle email verso ${appOrigin()}.` });
  return out;
}
export async function diagnosticsCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  if (!["operations.read", "settings.manage", "integrations.manage"].some((p) => can(actor.grants, p as "operations.read"))) throw forbidden();
  return json({ checkedAt: new Date(), items: await diagnostics(), automation: await automationSnapshot() });
}
