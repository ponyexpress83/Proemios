/**
 * Interfacce di integrazione: chiavi API a scopo limitato (solo impronta
 * salvata, segreto mostrato una volta), chiavi pubbliche di modulo con il
 * solo scopo di acquisizione e origini dichiarate, API v1 versionata con
 * idempotenza e limiti per chiave, webhook in uscita firmati, idempotenti per
 * id evento e ritentati con attesa crescente.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { apiKeys, crmDeals, crmEvents, webhookDeliveries, webhookEndpoints } from "@/db/crm-schema";
import { operationKeys } from "@/db/platform-schema";
import { CRM_EVENTS, MAX_WEBHOOK_ATTEMPTS, retryDelaySeconds, signPayload } from "@/lib/crm-core/webhooks";
import { PRIORITIES } from "@/lib/crm-core/rules";
import { demand, demandRecent, audit, type Actor } from "./access";
import { json, notFound, PlatformError, readBody } from "./http";
import { protectMailHtml, revealMailHtml } from "./mail";
import { limitRequest } from "./rate-limit";
import { routeLead } from "./crm-routing";
import { DEFAULT_PIPELINE, dealFacts, dealStage, pipelines, type Tx } from "./crm-relations";

export const API_SCOPES = ["leads:write", "leads:read", "deals:read", "events:read", "capture"] as const;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

export async function apiKeyCollection(request: Request, actor: Actor, id?: string) {
  demand(actor, "integrations.manage");
  if (request.method === "GET" && !id) {
    const rows = await getDb().select({ id: apiKeys.id, name: apiKeys.name, kind: apiKeys.kind, prefix: apiKeys.prefix, scopes: apiKeys.scopes, allowedOrigins: apiKeys.allowedOrigins, ratePerMinute: apiKeys.ratePerMinute, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return json({ keys: rows, scopes: API_SCOPES });
  }
  demandRecent(actor);
  if (request.method === "POST" && !id) {
    const body = await readBody(request, z.object({ name: z.string().trim().min(3).max(80), kind: z.enum(["server", "form"]).default("server"), scopes: z.array(z.enum(API_SCOPES)).min(1).max(5).default(["leads:write"]), allowedOrigins: z.array(z.string().url().max(200)).max(10).default([]), ratePerMinute: z.number().int().min(1).max(600).default(60) }).strict());
    // Una chiave di modulo vive nel browser: solo acquisizione, solo dalle origini dichiarate.
    const scopes = body.kind === "form" ? ["capture"] : body.scopes.filter((s) => s !== "capture");
    if (body.kind === "form" && !body.allowedOrigins.length) throw new PlatformError(422, "ORIGINS_REQUIRED", "Indica i siti da cui il modulo può inviare richieste.");
    if (!scopes.length) throw new PlatformError(422, "SCOPES_REQUIRED", "Scegli almeno uno scopo.");
    const prefix = randomBytes(6).toString("hex"), secret = randomBytes(24).toString("base64url");
    const key = `${body.kind === "form" ? "pf" : "pk"}_${prefix}_${secret}`;
    const [row] = await getDb().insert(apiKeys).values({ name: body.name, kind: body.kind, prefix, keyHash: sha(key), scopes, allowedOrigins: body.allowedOrigins.map((o) => new URL(o).origin), ratePerMinute: body.ratePerMinute, createdBy: actor.id }).returning({ id: apiKeys.id });
    await audit(actor, "api_key.created", "api_key", row!.id, { kind: body.kind, scopes });
    return json({ id: row!.id, key, note: "Copia la chiave adesso: non verrà più mostrata." }, 201);
  }
  if (request.method === "DELETE" && id) {
    await getDb().update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
    await audit(actor, "api_key.revoked", "api_key", id);
    return json({ ok: true });
  }
  throw notFound();
}
/** Indirizzi pubblici HTTPS soltanto: niente reti interne né localhost (salvo l'ambiente di test isolato). */
function safeWebhookUrl(raw: string) {
  const url = new URL(raw);
  if (process.env.PROEMIOS_TEST_RUN === "1" && url.hostname.endsWith(".test")) return url.toString();
  if (url.protocol !== "https:") throw new PlatformError(422, "INVALID_URL", "Serve un indirizzo HTTPS.");
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd])/i.test(url.hostname) || url.hostname.endsWith(".internal") || url.hostname.endsWith(".local")) throw new PlatformError(422, "INVALID_URL", "L'indirizzo deve essere pubblico.");
  return url.toString();
}
export async function webhookCollection(request: Request, actor: Actor, id?: string, action?: string) {
  demand(actor, "integrations.manage");
  if (request.method === "GET" && !id) return json({ endpoints: await getDb().select({ id: webhookEndpoints.id, url: webhookEndpoints.url, events: webhookEndpoints.events, active: webhookEndpoints.active, createdAt: webhookEndpoints.createdAt }).from(webhookEndpoints), events: CRM_EVENTS });
  if (request.method === "GET" && id && action === "deliveries") return json({ deliveries: await getDb().select().from(webhookDeliveries).where(eq(webhookDeliveries.endpointId, id)).orderBy(desc(webhookDeliveries.createdAt)).limit(100) });
  demandRecent(actor);
  if (request.method === "POST" && !id) {
    const body = await readBody(request, z.object({ url: z.string().url().max(500), events: z.array(z.enum(CRM_EVENTS)).min(1).max(CRM_EVENTS.length) }).strict());
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const [row] = await getDb().insert(webhookEndpoints).values({ url: safeWebhookUrl(body.url), events: body.events, secretEnc: await protectMailHtml(secret), createdBy: actor.id }).returning({ id: webhookEndpoints.id });
    await audit(actor, "webhook.created", "webhook", row!.id, { events: body.events });
    return json({ id: row!.id, secret, note: "Usa il segreto per verificare la firma Proemios-Signature; non verrà più mostrato." }, 201);
  }
  if (request.method === "DELETE" && id && !action) {
    await getDb().update(webhookEndpoints).set({ active: false }).where(eq(webhookEndpoints.id, id));
    await audit(actor, "webhook.disabled", "webhook", id);
    return json({ ok: true });
  }
  throw notFound();
}
/** Dal registro degli eventi alle consegne: una riga per endpoint ed evento (vincolo unico). */
export async function fanOutEvents(db: Tx | ReturnType<typeof getDb> = getDb()) {
  const endpoints = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.active, true));
  let queued = 0;
  for (const endpoint of endpoints) {
    const events = await db.select({ id: crmEvents.id }).from(crmEvents).where(and(inArray(crmEvents.type, endpoint.events), gt(crmEvents.createdAt, endpoint.createdAt), sql`not exists (select 1 from ${webhookDeliveries} d where d.endpoint_id = ${endpoint.id} and d.event_id = ${crmEvents.id})`)).orderBy(asc(crmEvents.createdAt)).limit(200);
    if (!events.length) continue;
    const rows = await db.insert(webhookDeliveries).values(events.map((e) => ({ endpointId: endpoint.id, eventId: e.id }))).onConflictDoNothing().returning({ id: webhookDeliveries.id });
    queued += rows.length;
  }
  return queued;
}
/** Consegna con firma e ritentativi; lo stesso evento porta sempre lo stesso id. */
export async function deliverWebhooks(limit = 20, fetcher: typeof fetch = fetch) {
  await fanOutEvents();
  let delivered = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    const job = await getDb().transaction(async (tx) => {
      const [row] = await tx.select().from(webhookDeliveries).where(and(inArray(webhookDeliveries.status, ["pending", "retry"]), lte(webhookDeliveries.nextAttemptAt, new Date()), or(isNull(webhookDeliveries.lockedUntil), lte(webhookDeliveries.lockedUntil, new Date())))).orderBy(webhookDeliveries.nextAttemptAt).limit(1).for("update", { skipLocked: true });
      if (!row) return null;
      await tx.update(webhookDeliveries).set({ lockedUntil: new Date(Date.now() + 60_000), attempts: row.attempts + 1 }).where(eq(webhookDeliveries.id, row.id));
      return { ...row, attempts: row.attempts + 1 };
    });
    if (!job) break;
    const [endpoint] = await getDb().select().from(webhookEndpoints).where(eq(webhookEndpoints.id, job.endpointId));
    const [event] = await getDb().select().from(crmEvents).where(eq(crmEvents.id, job.eventId));
    if (!endpoint?.active || !event) {
      await getDb().update(webhookDeliveries).set({ status: "cancelled", lockedUntil: null }).where(eq(webhookDeliveries.id, job.id));
      continue;
    }
    const body = JSON.stringify({ id: event.id, type: event.type, createdAt: event.createdAt.toISOString(), data: event.payload });
    let status: number | null = null, error: string | null = null;
    try {
      const response = await fetcher(endpoint.url, { method: "POST", headers: { "content-type": "application/json", "proemios-event-id": event.id, "proemios-event-type": event.type, "proemios-signature": signPayload(await revealMailHtml(endpoint.secretEnc), body) }, body, signal: AbortSignal.timeout(8000), redirect: "manual" });
      status = response.status;
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 300) : "errore di rete";
    }
    if (status !== null && status >= 200 && status < 300) {
      await getDb().update(webhookDeliveries).set({ status: "delivered", deliveredAt: new Date(), lastStatus: status, lastError: null, lockedUntil: null }).where(eq(webhookDeliveries.id, job.id));
      delivered++;
    } else {
      const final = job.attempts >= MAX_WEBHOOK_ATTEMPTS;
      await getDb().update(webhookDeliveries).set({ status: final ? "failed" : "retry", lastStatus: status, lastError: error ?? `HTTP ${status}`, nextAttemptAt: new Date(Date.now() + retryDelaySeconds(job.attempts) * 1000), lockedUntil: null }).where(eq(webhookDeliveries.id, job.id));
      failed++;
    }
  }
  return { delivered, failed };
}

// ── API v1 ─────────────────────────────────────────────────────────────────
type ApiKey = typeof apiKeys.$inferSelect;
async function authenticate(request: Request, scope: (typeof API_SCOPES)[number]): Promise<ApiKey> {
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-proemios-form-key") ?? "";
  const match = /^(pk|pf)_([0-9a-f]{12})_[A-Za-z0-9_-]{20,64}$/.exec(header);
  if (!match) throw new PlatformError(401, "UNAUTHORIZED", "Chiave API mancante o non valida.");
  const [key] = await getDb().select().from(apiKeys).where(eq(apiKeys.prefix, match[2]!));
  const given = Buffer.from(sha(header), "hex");
  if (!key || key.revokedAt || !timingSafeEqual(Buffer.from(key.keyHash, "hex"), given)) throw new PlatformError(401, "UNAUTHORIZED", "Chiave API mancante o non valida.");
  if ((match[1] === "pf") !== (key.kind === "form")) throw new PlatformError(401, "UNAUTHORIZED", "Chiave API mancante o non valida.");
  if (!key.scopes.includes(scope) && !(scope === "leads:write" && key.scopes.includes("capture"))) throw new PlatformError(403, "SCOPE_REQUIRED", `La chiave non ha lo scopo ${scope}.`);
  if (key.kind === "form") {
    const origin = request.headers.get("origin");
    if (!origin || !key.allowedOrigins.includes(origin)) throw new PlatformError(403, "INVALID_ORIGIN", "Origine non autorizzata per questo modulo.");
  }
  await limitRequest(`api:${key.id}`, key.id, key.ratePerMinute, 60);
  await getDb().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  return key;
}
const leadInput = z
  .object({
    name: z.string().trim().min(2).max(200),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40).optional(),
    message: z.string().trim().max(4000).optional(),
    consentPrivacy: z.literal(true),
    consentMarketing: z.boolean().default(false),
    language: z.string().min(2).max(8).default("it"),
    priority: z.enum(PRIORITIES).default("normal"),
    service: z.string().regex(/^[a-zA-Z]{2,40}$/).optional(),
    source: z.object({ kind: z.enum(["form", "campaign", "social", "partner", "marketplace", "api"]).default("api"), detail: z.string().trim().max(200).optional(), externalRef: z.string().trim().max(200).optional(), utmSource: z.string().max(200).optional(), utmMedium: z.string().max(200).optional(), utmCampaign: z.string().max(200).optional() }).strict().default({ kind: "api" }),
  })
  .strict();
export const OPENAPI = {
  openapi: "3.1.0",
  info: { title: "CRM API", version: "1.0.0", description: "API versionata. Le scritture richiedono Idempotency-Key; le risposte non contengono dati oltre lo scopo della chiave." },
  servers: [{ url: "/api/v1" }],
  components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Chiave server pk_… (mai nel frontend)" }, formKey: { type: "apiKey", in: "header", name: "X-Proemios-Form-Key", description: "Chiave pubblica di modulo pf_…: solo acquisizione, solo dalle origini dichiarate" } } },
  paths: {
    "/leads": { post: { summary: "Acquisisce una richiesta", security: [{ bearer: [] }, { formKey: [] }], parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", maxLength: 100 } }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["name", "email", "consentPrivacy"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string" }, message: { type: "string" }, consentPrivacy: { const: true }, consentMarketing: { type: "boolean" }, language: { type: "string" }, priority: { enum: [...PRIORITIES] }, service: { type: "string" }, source: { type: "object" } } } } } }, responses: { "201": { description: "Creata" }, "200": { description: "Già ricevuta con la stessa chiave" }, "409": { description: "Chiave riusata con un corpo diverso" }, "429": { description: "Limite superato" } } } },
    "/leads/{id}": { get: { summary: "Stato di una richiesta", security: [{ bearer: [] }] } },
    "/deals": { get: { summary: "Trattative (id, fase, stato)", security: [{ bearer: [] }] } },
    "/events": { get: { summary: "Eventi stabili in ordine", security: [{ bearer: [] }], parameters: [{ name: "after", in: "query", schema: { type: "string", format: "date-time" } }] } },
  },
  "x-events": CRM_EVENTS,
  "x-webhooks": { signature: "Proemios-Signature: t=<unix>,v1=<hex HMAC-SHA256 di '<t>.<corpo>'>", idempotency: "Proemios-Event-Id identico a ogni ritentativo", retries: "30 s, 1, 2, 4… minuti, al massimo 8 tentativi" },
};
export async function apiV1(request: Request): Promise<Response> {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
  const [resource, id] = parts;
  if (parts.length > 2) throw notFound();
  if (resource === "openapi.json" && request.method === "GET") return json(OPENAPI);
  if (resource === "leads" && !id && request.method === "POST") {
    const key = await authenticate(request, "leads:write");
    const idem = request.headers.get("idempotency-key");
    if (!idem || !/^[A-Za-z0-9_.:-]{8,100}$/.test(idem)) throw new PlatformError(400, "IDEMPOTENCY_REQUIRED", "Serve l'intestazione Idempotency-Key.");
    const raw = await request.text();
    if (raw.length > 50_000) throw new PlatformError(413, "TOO_LARGE", "Richiesta troppo grande.");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new PlatformError(400, "INVALID_BODY", "Richiesta non leggibile."); }
    const result = leadInput.safeParse(parsed);
    if (!result.success) throw new PlatformError(422, "VALIDATION_ERROR", "Controlla i campi indicati.", Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message])));
    const body = result.data, requestHash = sha(JSON.stringify(body)), opKey = `api:${key.id}:${idem}`;
    const outcome = await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${opKey}))`);
      const [previous] = await tx.select().from(operationKeys).where(eq(operationKeys.key, opKey));
      if (previous) {
        if (previous.requestHash !== requestHash) throw new PlatformError(409, "REQUEST_CHANGED", "La stessa Idempotency-Key è stata usata con un corpo diverso.");
        return { status: 200, result: previous.result };
      }
      if (body.source.externalRef) {
        const [dup] = await tx.select({ id: leads.id }).from(leads).where(eq(leads.externalRef, body.source.externalRef));
        if (dup) throw new PlatformError(409, "DUPLICATE_REFERENCE", "Esiste già una richiesta con questo riferimento esterno.");
      }
      const attribution = body.source.utmSource || body.source.utmCampaign ? { utmSource: body.source.utmSource, utmMedium: body.source.utmMedium, utmCampaign: body.source.utmCampaign } : null;
      const [lead] = await tx.insert(leads).values({ nome: body.name, email: body.email.toLowerCase(), telefono: body.phone ?? null, note: body.message ?? null, fonte: body.source.kind === "marketplace" ? "marketplace" : "contatto", sourceKind: key.kind === "form" ? "form" : body.source.kind, sourceDetail: body.source.detail ?? `API: ${key.name}`, externalRef: body.source.externalRef ?? null, attribution, consensoPrivacy: true, consensoMarketing: body.consentMarketing, marketingConsentAt: body.consentMarketing ? new Date() : null, language: body.language, priority: body.priority, requiredSkill: body.service ?? null, contactPreferences: { email: true, phone: Boolean(body.phone), whatsapp: false, sms: false } }).returning();
      const routed = await routeLead(tx, lead!.id);
      const saved = { leadId: lead!.id, contactId: routed.contactId, dealId: routed.dealId, assignment: routed.status, slaDueAt: routed.slaDueAt.toISOString() };
      await tx.insert(operationKeys).values({ key: opKey, requestHash, result: saved, expiresAt: new Date(Date.now() + 7 * 86400_000) });
      return { status: 201, result: saved };
    });
    return json(outcome.result, outcome.status);
  }
  if (resource === "leads" && id && request.method === "GET") {
    await authenticate(request, "leads:read");
    if (!z.string().uuid().safeParse(id).success) throw notFound();
    const [lead] = await getDb().select({ id: leads.id, createdAt: leads.createdAt, stage: leads.stage, assignmentStatus: leads.assignmentStatus, priority: leads.priority, dealId: leads.dealId, firstResponseAt: leads.firstResponseAt, sourceKind: leads.sourceKind }).from(leads).where(eq(leads.id, id));
    if (!lead) throw notFound();
    return json({ lead });
  }
  if (resource === "deals" && !id && request.method === "GET") {
    await authenticate(request, "deals:read");
    const since = new URL(request.url).searchParams.get("updatedSince");
    const rows = await getDb().select().from(crmDeals).where(since && !Number.isNaN(Date.parse(since)) ? gt(crmDeals.updatedAt, new Date(since)) : sql`true`).orderBy(desc(crmDeals.updatedAt)).limit(200);
    const facts = await dealFacts(getDb(), rows.map((d) => d.id));
    const all = await pipelines();
    return json({ deals: rows.map((d) => ({ id: d.id, contactId: d.contactId, pipeline: d.pipelineKey, ...dealStage(d, all.find((p) => p.key === d.pipelineKey) ?? DEFAULT_PIPELINE, facts), updatedAt: d.updatedAt })) });
  }
  if (resource === "events" && !id && request.method === "GET") {
    await authenticate(request, "events:read");
    const after = new URL(request.url).searchParams.get("after");
    const rows = await getDb().select().from(crmEvents).where(after && !Number.isNaN(Date.parse(after)) ? gt(crmEvents.createdAt, new Date(after)) : sql`true`).orderBy(asc(crmEvents.createdAt)).limit(200);
    return json({ events: rows.map((e) => ({ id: e.id, type: e.type, createdAt: e.createdAt, data: e.payload })) });
  }
  throw notFound();
}
