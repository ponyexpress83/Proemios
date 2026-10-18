/**
 * Document Studio, motore editoriale AI e revisioni del cliente su un database
 * PGlite isolato con le migrazioni reali e autenticazione reale. I servizi
 * esterni sono simulati: Anthropic (trasporto sostituito), Google (fetch
 * sostituito), scanner dei file (fetch sostituito), Stripe (eventi firmati a
 * mano). Nessuno di questi test verifica i servizi reali.
 */
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URI } from "otpauth";
import JSZip from "jszip";
import * as schema from "@/db/schema";
import * as identity from "@/db/auth-schema";
import * as platform from "@/db/platform-schema";
import * as docs from "@/db/document-schema";
import { ROLE_GRANTS, type Role } from "@/lib/platform/permissions";
import { readDocx, writeFresh } from "@/lib/platform/documents/ooxml";
import type { AiRequest } from "@/lib/platform/ai-client";
import type Stripe from "stripe";

const shared = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => shared.db, dbConfigurato: () => true }));
const origin = "http://localhost:3198";
let database: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let auth: ReturnType<typeof import("@/lib/auth")["getAuth"]>;
let handler: typeof import("@/app/api/platform/[...path]/route")["GET"];
const actors: Record<string, { id: string; cookie: string; email: string }> = {};
const password = `Test-only-${randomBytes(16).toString("hex")}`;
function cookies(response: Response, previous = "") {
  const values = new Map(previous.split("; ").filter(Boolean).map((v) => { const i = v.indexOf("="); return [v.slice(0, i), v.slice(i + 1)] as [string, string]; }));
  for (const item of response.headers.getSetCookie()) { const pair = item.split(";")[0]!, i = pair.indexOf("="); values.set(pair.slice(0, i), pair.slice(i + 1)); }
  return [...values].map(([k, v]) => `${k}=${v}`).join("; ");
}
let requestNumber = 0;
async function authRequest(path: string, body: unknown, cookie = "") {
  return auth.handler(new Request(`${origin}/api/auth/${path}`, { method: "POST", headers: { origin, cookie, "x-forwarded-for": `203.0.113.${++requestNumber % 250}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
}
async function call(actor: string | null, path: string, method = "GET", body?: unknown) {
  return handler(new Request(`${origin}/api/platform/${path}`, { method, headers: { origin, cookie: actor ? actors[actor]!.cookie : "", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}
async function data(response: Response, expected = 200) { expect(response.status, await response.clone().text()).toBe(expected); return response.json(); }
async function createActor(name: string, role: Role) {
  const email = `${name.toLowerCase()}@example.test`;
  const result = await data(await authRequest("sign-up/email", { name, email, password, privacyAccepted: true }));
  const id = result.user.id;
  await db.update(identity.user).set({ emailVerified: true }).where(eq(identity.user.id, id));
  if (role !== "author") await db.insert(platform.memberships).values({ userId: id, role, grants: role === "admin" ? ROLE_GRANTS.admin : null });
  const login = await authRequest("sign-in/email", { email, password });
  actors[name] = { id, email, cookie: cookies(login) };
  if (role !== "author" || name === "owner") {
    const enable = await data(await authRequest("two-factor/enable", { password, method: "totp" }, actors[name]!.cookie));
    const verify = await authRequest("two-factor/verify-totp", { code: URI.parse(enable.totpURI).generate(), trustDevice: false }, actors[name]!.cookie);
    await data(verify); actors[name]!.cookie = cookies(verify, actors[name]!.cookie);
  }
  return actors[name]!;
}

// Simulazioni dei servizi esterni.
type Reply = { kind: "ok"; fn?: (paragraphs: Array<{ paragraphId: string; testo: string }>, req: AiRequest) => unknown } | { kind: "throw" } | { kind: "refuse" };
const ai = { calls: [] as AiRequest[], replies: [] as Reply[], usage: { inputTokens: 1000, outputTokens: 500 } };
const proofread = (paragraphs: Array<{ paragraphId: string; testo: string }>) => ({
  suggestions: paragraphs.flatMap((p) => [
    ...(p.testo.includes("perchè") ? [{ paragraphId: p.paragraphId, kind: "replace", original: "perchè", suggested: "perché", reason: "Accento acuto.", category: "ortografia" }] : []),
    ...(p.testo.includes("un pò") ? [{ paragraphId: p.paragraphId, kind: "replace", original: "un pò", suggested: "un po'", reason: "Apocope.", category: "ortografia" }] : []),
    // Proposta inventata: il testo non esiste e va scartata.
    ...(p.testo.includes("Marta") ? [{ paragraphId: p.paragraphId, kind: "replace", original: "testo che non c'è", suggested: "x", reason: "?", category: "altro" }] : []),
  ]),
  notes: paragraphs.filter((p) => p.testo.includes("Marta")).map((p) => ({ paragraphId: p.paragraphId, text: "Nota interna: verificare il nome del personaggio." })),
  names: ["Marta"],
});
async function transport(req: AiRequest) {
  ai.calls.push(req);
  const reply = ai.replies.shift() ?? { kind: "ok" };
  const usages = [{ model: req.model, inputTokens: ai.usage.inputTokens, outputTokens: ai.usage.outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 }];
  if (reply.kind === "throw") throw new Error("connessione interrotta (simulata)");
  if (reply.kind === "refuse") return { output: null, refused: true, truncated: false, usages };
  const paragraphs = JSON.parse(req.user).paragrafi_da_lavorare as Array<{ paragraphId: string; testo: string }>;
  return { output: (reply.fn ?? proofread)(paragraphs, req) as never, refused: false, truncated: false, usages };
}
const google = { docs: new Map<string, { revision: number; paragraphs: string[] }>(), tokenError: null as string | null, shares: [] as unknown[], batchStatus: 200 };
const gDoc = (id: string) => { const d = google.docs.get(id)!; let index = 1; return { documentId: id, revisionId: `r${d.revision}`, body: { content: [{ endIndex: 1 }, ...d.paragraphs.map((t) => { const start = index; index += t.length + 1; return { startIndex: start, endIndex: index, paragraph: { elements: [{ textRun: { content: `${t}\n` } }] } }; })] } }; };
async function googleFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url === "https://oauth2.googleapis.com/token") {
    const params = new URLSearchParams(String(init?.body));
    if (params.get("grant_type") === "authorization_code") return reply({ refresh_token: "synthetic-refresh-token", id_token: `x.${Buffer.from(JSON.stringify({ email: "studio@example.test" })).toString("base64url")}.y`, scope: "openid email https://www.googleapis.com/auth/drive.file" });
    if (google.tokenError) return reply({ error: google.tokenError }, 400);
    expect(params.get("refresh_token")).toBe("synthetic-refresh-token");
    return reply({ access_token: "synthetic-access", expires_in: 3600 });
  }
  if (url === "https://docs.googleapis.com/v1/documents" && init?.method === "POST") { const id = `gdoc_${google.docs.size + 1}`; google.docs.set(id, { revision: 1, paragraphs: [] }); return reply({ documentId: id }); }
  const batch = url.match(/documents\/([^/:]+):batchUpdate$/);
  if (batch) {
    const d = google.docs.get(batch[1]!)!;
    const body = JSON.parse(String(init?.body)) as { requests: Array<{ insertText?: { location: { index: number }; text: string }; deleteContentRange?: { range: { startIndex: number; endIndex: number } } }>; writeControl?: { requiredRevisionId: string } };
    if (body.writeControl && body.writeControl.requiredRevisionId !== `r${d.revision}`) return reply({ error: { message: "revision mismatch" } }, 400);
    let text = d.paragraphs.join("\n");
    for (const r of body.requests) {
      if (r.deleteContentRange) text = text.slice(0, r.deleteContentRange.range.startIndex - 1) + text.slice(r.deleteContentRange.range.endIndex - 1);
      if (r.insertText) text = text.slice(0, r.insertText.location.index - 1) + r.insertText.text + text.slice(r.insertText.location.index - 1);
    }
    d.paragraphs = text.split("\n"); d.revision++;
    return reply({ writeControl: { requiredRevisionId: `r${d.revision}` } });
  }
  const read = url.match(/docs\.googleapis\.com\/v1\/documents\/([^/:?]+)$/);
  if (read) return reply(gDoc(read[1]!));
  if (url.includes("/permissions")) { google.shares.push({ url, body: JSON.parse(String(init?.body)) }); return reply({ id: "perm" }); }
  return reply({ error: "unexpected" }, 404);
}

async function docxOf(paragraphs: Array<{ text: string; style?: string }>) {
  const base = paragraphs.map((p, i) => ({ id: `s${i}`, text: p.text, style: p.style ?? null, source: null }));
  return writeFresh(base, base, { tracked: false, author: "Autore", date: new Date() });
}
async function upload(actor: string, projectId: string, name: string, bytes: Uint8Array) {
  const form = new FormData(); form.set("kind", "manuscript"); form.set("file", new File([new Uint8Array(bytes)], name));
  return handler(new Request(`${origin}/api/platform/projects/${projectId}/files`, { method: "POST", headers: { origin, cookie: actors[actor]!.cookie }, body: form }));
}
const process_ = async (deadlineMs = 10_000, now?: () => number) => (await import("@/lib/platform/documents/ai-engine")).processAiJobs({ deadlineMs, now });
const aiRules = { version: "ai-test-v1", model: "claude-opus-5-5", effort: "medium", maxJobUsd: 5, monthlyCapUsd: 50, autoStartServices: ["client_revision"], salesAssistant: false };
const notificationsOf = async (name: string) => db.select().from(platform.notifications).where(eq(platform.notifications.userId, actors[name]!.id));

let projectId: string, documentId: string, quoteId: string;
const manuscript = [
  { text: "Capitolo primo", style: "Heading1" },
  { text: "Marta non sapeva perchè il treno fosse in ritardo." },
  { text: "Aspettò un pò, poi tornò a casa." },
  { text: "Capitolo secondo", style: "Heading1" },
  { text: "Il giorno dopo il treno arrivò puntuale." },
];

beforeAll(async () => {
  const directory = await mkdtemp(join(tmpdir(), "proemios-studio-"));
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test-only@localhost/test-only", APP_URL: origin, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), PROEMIOS_TEST_RUN: "1",
    PROEMIOS_TEST_MAIL_DIR: join(directory, "mail"), PROEMIOS_TEST_FILE_DIR: join(directory, "files"), PROEMIOS_OWNER_EMAIL: "owner@example.test", DEMO_MODE: "off",
    STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only", FILE_SCANNER_URL: "https://scanner.example.test/scan", FILE_SCANNER_TOKEN: "synthetic-scanner-token",
  });
  delete process.env.VERCEL; delete process.env.VERCEL_ENV; delete process.env.EDITORIAL_AI_ENABLED; delete process.env.ANTHROPIC_API_KEY;
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => String(input) === process.env.FILE_SCANNER_URL ? new Response(JSON.stringify({ clean: true })) : realFetch(input, init));
  database = await PGlite.create({ dataDir: join(directory, "db") });
  for (const name of (await readdir("drizzle")).filter((n) => n.endsWith(".sql")).sort()) await database.exec(await readFile(join("drizzle", name), "utf8"));
  db = drizzle(database, { schema }); shared.db = db;
  auth = (await import("@/lib/auth")).getAuth();
  handler = (await import("@/app/api/platform/[...path]/route")).GET;
  (await import("@/lib/platform/ai-client")).setAiTransport(transport as never);
  (await import("@/lib/platform/documents/google")).setGoogleFetch(googleFetch as typeof fetch);
  await createActor("owner", "author");
  for (const [name, role] of [["seller", "seller"], ["coord", "coordinator"], ["editor", "editor"], ["finance", "finance"], ["marketing", "marketing"], ["writer", "author"], ["stranger", "author"]] as Array<[string, Role]>) await createActor(name, role);
  await data(await call("owner", "settings", "PUT", { key: "commission-rule", value: { version: "TEST-COMMISSION-v1", sellerBps: 1000, affiliateBps: 500, base: "collected-excluding-tax", attributionDays: 30, attribution: "code-on-quote", assistedSalesOnly: false } }));
  // Vendita reale fino all'incasso dell'acconto (Stripe simulato).
  const leadId = (await data(await call("seller", "leads", "POST", { nome: "Writer", email: actors.writer!.email }), 201)).lead.id;
  quoteId = (await data(await call("seller", `leads/${leadId}/quotes`, "POST", { input: { projectType: "romanzo", textState: "finito-revisionato", wordCount: 50000, requestedServices: ["proofreading"], singleService: "proofreading", urgency: "standard" } }), 201)).quote.id;
  const { hashToken } = await import("@/lib/platform/http");
  const token = randomBytes(32).toString("base64url");
  await db.insert(platform.quoteClaims).values({ quoteId, email: actors.writer!.email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60000) });
  await data(await call("writer", "quote-claim", "POST", { token }));
  const detail = await data(await call("writer", `quotes/${quoteId}`));
  const pkg = detail.packages.find((p: { recommended?: boolean }) => p.recommended) ?? detail.packages[0];
  await data(await call("writer", `quotes/${quoteId}/accept`, "POST", { tier: pkg.tier, version: detail.record.version, policyVersion: detail.paymentPolicy.version, termsAccepted: true, orderSheetAccepted: true }));
  const fresh = (await data(await call("writer", `quotes/${quoteId}`))).packages.find((p: { tier: string }) => p.tier === pkg.tier);
  const session = `cs_test_${randomUUID()}`;
  const [order] = await db.insert(platform.paymentOrders).values({ quoteId, authorId: actors.writer!.id, tier: pkg.tier, kind: "deposit", amountCents: fresh.depositMoney.grossCents, stripeSessionId: session }).returning();
  const { processStripeEvent } = await import("@/lib/platform/payments");
  await processStripeEvent({ id: `evt_test_${randomUUID()}`, type: "checkout.session.completed", livemode: false, data: { object: { id: session, metadata: { orderId: order!.id, quoteId }, client_reference_id: order!.id, currency: "eur", amount_total: fresh.depositMoney.grossCents, payment_status: "paid", payment_intent: `pi_test_${randomUUID()}`, payment_method_types: ["card"] } } } as unknown as Stripe.Event);
  const [project] = await db.select().from(platform.projects).where(eq(platform.projects.quoteId, quoteId));
  projectId = project!.id;
  expect(project!.startedAt).not.toBeNull();
  await data(await call("owner", `crm/projects/${projectId}/ops`, "PATCH", { opsLeadId: actors.coord!.id }));
  await data(await call("owner", `crm/team/${actors.editor!.id}/profile`, "PUT", { skills: ["proofreading"], capacity: 5 }));
  const phases = await data(await call("coord", `crm/projects/${projectId}/phases`, "POST", { phases: [{ phase: "proofreading", skill: "proofreading", title: "Correzione bozze" }] }), 201);
  await data(await call("coord", `crm/tasks/${phases.taskIds[0]}/assign`, "POST", { userId: actors.editor!.id, confirm: true }));
}, 120_000);
afterAll(async () => { vi.restoreAllMocks(); await database?.close(); });

describe("document studio: import, permissions and persistent working document", () => {
  it("imports the client's DOCX, keeps the original untouched and refuses other people", async () => {
    const bytes = await docxOf(manuscript);
    const uploaded = await data(await upload("writer", projectId, "Il treno.docx", bytes), 201);
    expect(uploaded.file.status).toBe("ready");
    expect((await call("stranger", `studio/projects/${projectId}`, "POST", { fileId: uploaded.file.id })).status).toBe(404);
    expect((await call("writer", `studio/projects/${projectId}`, "POST", { fileId: uploaded.file.id })).status).toBe(404);
    expect((await call("seller", `studio/projects/${projectId}`, "POST", { fileId: uploaded.file.id })).status).toBe(404);
    const created = await data(await call("editor", `studio/projects/${projectId}`, "POST", { fileId: uploaded.file.id }), 201);
    documentId = created.document.id;
    const again = await data(await call("editor", `studio/projects/${projectId}`, "POST", { fileId: uploaded.file.id }));
    expect(again.document.id).toBe(documentId);
    const view = await data(await call("editor", `studio/documents/${documentId}`));
    expect(view.revision.paragraphs.map((p: { text: string }) => p.text)).toEqual(manuscript.map((p) => p.text));
    expect(view.revision.paragraphs[0].style).toBe("Heading1");
    expect(view.versions).toHaveLength(1); expect(view.versions[0]).toMatchObject({ label: "Originale", kind: "original", number: 0 });
    // L'originale resta il file caricato, non una copia rigenerata.
    expect(view.versions[0].docxFileId).toBe(uploaded.file.id);
    const [file] = await db.select().from(platform.projectFiles).where(eq(platform.projectFiles.id, uploaded.file.id));
    expect(file!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await call("writer", `studio/documents/${documentId}`)).status).toBe(404);
    expect((await call("stranger", `studio/client/${projectId}`)).status).toBe(404);
  });
  it("records direct edits as new revisions and refuses a stale save", async () => {
    const view = await data(await call("editor", `studio/documents/${documentId}`));
    const last = view.revision.paragraphs[4];
    const saved = await data(await call("editor", `studio/documents/${documentId}/edit`, "POST", { expectedRevision: 1, changes: [{ paragraphId: last.id, text: "Il giorno dopo, il treno arrivò puntuale." }] }));
    expect(saved.revision).toBe(2);
    const stale = await call("editor", `studio/documents/${documentId}/edit`, "POST", { expectedRevision: 1, changes: [{ paragraphId: last.id, text: "Sovrascrittura" }] });
    expect(stale.status).toBe(409); expect((await stale.json()).code).toBe("REVISION_CONFLICT");
  });
});

describe("editorial AI: preconditions, queue, costs, resilience and human review", () => {
  it("does not start without environment enablement and approved rules", async () => {
    const blocked = await call("editor", `studio/documents/${documentId}/ai`, "POST", { service: "proofreading" });
    expect(blocked.status).toBe(409); expect((await blocked.json()).errore).toContain("EDITORIAL_AI_ENABLED");
    process.env.EDITORIAL_AI_ENABLED = "1"; process.env.ANTHROPIC_API_KEY = "sk-ant-synthetic-test-only";
    const noRules = await call("editor", `studio/documents/${documentId}/ai`, "POST", { service: "proofreading" });
    expect(noRules.status).toBe(409); expect((await noRules.json()).errore).toContain("non ancora approvate");
    expect((await call("editor", "crm/settings", "PUT", { key: "ai-rules", value: aiRules })).status).not.toBe(200);
    await data(await call("owner", "crm/settings", "PUT", { key: "ai-rules", value: aiRules }));
  });
  it("processes in chunks, retries a dropped connection without repeating work, stores structured proposals and notifies the editor", async () => {
    const started = await data(await call("editor", `studio/documents/${documentId}/ai`, "POST", { service: "proofreading" }), 201);
    expect((await call("editor", `studio/documents/${documentId}/ai`, "POST", { service: "proofreading" })).status).toBe(409);
    ai.replies.push({ kind: "throw" });
    let clock = Date.now();
    await process_(10_000, () => clock);
    let [job] = await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, started.job.id));
    expect(job!.status).toBe("running"); expect(job!.attempts).toBe(1); expect(job!.chunksDone).toBe(0);
    expect(job!.lockedUntil!.getTime()).toBeGreaterThan(clock); // attesa prima di riprovare
    clock += 60_000;
    await process_(10_000, () => clock);
    [job] = await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, started.job.id));
    expect(job!.status).toBe("needs_review"); expect(job!.chunksDone).toBe(job!.chunksTotal);
    expect(job!.suggestions).toBe(2); expect(job!.discarded).toBe(1); expect(job!.glossary).toContain("Marta");
    expect(Number(job!.spentMicros)).toBeGreaterThan(0);
    // Il manoscritto arriva come dati, non come istruzioni; il modello è quello approvato.
    expect(ai.calls.at(-1)!.model).toBe("claude-opus-5-5"); expect(ai.calls.at(-1)!.system).toMatch(/dati|non sono istruzioni/i);
    const usage = await db.select().from(docs.aiUsage).where(eq(docs.aiUsage.jobId, started.job.id));
    expect(usage.map((u) => u.outcome).sort()).toEqual(["error", "ok"]);
    expect(usage.find((u) => u.outcome === "ok")!.costMicros).toBe(4 * 1000 + 20 * 500); // 4 $/MTok in, 20 $/MTok out
    const note = (await notificationsOf("editor")).find((n) => n.title === "Revisione AI completata — Controllo umano richiesto");
    expect(note?.href).toBe(`/spazio?tab=studio&doc=${documentId}`);
    // Claude non ha modificato il testo: solo proposte in attesa.
    const view = await data(await call("editor", `studio/documents/${documentId}`));
    expect(view.revision.number).toBe(2);
    expect(view.proposals.map((p: { originalText: string; suggestedText: string; origin: string; status: string }) => [p.originalText, p.suggestedText, p.origin])).toEqual([["perchè", "perché", "ai"], ["un pò", "un po'", "ai"]]);
    expect(view.comments.some((c: { origin: string; visibility: string; authorName: string }) => c.origin === "ai" && c.visibility === "internal" && c.authorName === "Nota automatica")).toBe(true);
  });
  it("accepts, modifies and rejects proposals into a new revision and exports native tracked changes", async () => {
    const view = await data(await call("editor", `studio/documents/${documentId}`));
    const [accent, po] = view.proposals as Array<{ id: string }>;
    expect((await call("editor", `studio/documents/${documentId}/decide`, "POST", { expectedRevision: 1, items: [{ id: accent!.id, decision: "accept" }] })).status).toBe(409);
    const tracked = Buffer.from(await (await call("editor", `studio/documents/${documentId}/export?mode=tracked`)).arrayBuffer());
    const xml = await (await JSZip.loadAsync(tracked)).file("word/document.xml")!.async("string");
    expect(xml).toContain("<w:ins"); expect(xml).toContain("<w:delText");
    expect((await readDocx(tracked, "accepted")).map((p) => p.text)).toContain("Marta non sapeva perché il treno fosse in ritardo.");
    expect((await readDocx(tracked, "original")).map((p) => p.text)).toContain("Marta non sapeva perchè il treno fosse in ritardo.");
    const decided = await data(await call("editor", `studio/documents/${documentId}/decide`, "POST", { expectedRevision: 2, items: [{ id: accent!.id, decision: "accept" }, { id: po!.id, decision: "modify", text: "un poco" }] }));
    expect(decided.revision).toBe(3);
    const after = await data(await call("editor", `studio/documents/${documentId}`));
    expect(after.revision.paragraphs[1].text).toBe("Marta non sapeva perché il treno fosse in ritardo.");
    expect(after.revision.paragraphs[2].text).toBe("Aspettò un poco, poi tornò a casa.");
    const rows = await db.select().from(docs.docSuggestions).where(eq(docs.docSuggestions.documentId, documentId));
    expect(rows.map((r) => r.status).sort()).toEqual(["accepted", "modified"]);
    expect(rows.every((r) => r.decidedBy === actors.editor!.id)).toBe(true);
  });
  it("marks proposals superseded when the text moved on during processing", async () => {
    const started = await data(await call("editor", `studio/documents/${documentId}/ai`, "POST", { service: "light_edit" }), 201);
    const view = await data(await call("editor", `studio/documents/${documentId}`));
    const p = view.revision.paragraphs[4];
    // Mentre l'AI lavora l'editor cambia il paragrafo su cui arriverà la proposta.
    await data(await call("editor", `studio/documents/${documentId}/edit`, "POST", { expectedRevision: 3, changes: [{ paragraphId: p.id, text: "La mattina seguente il treno fu puntuale." }] }));
    ai.replies.push({ kind: "ok", fn: (ps) => ({ suggestions: ps.filter((x) => x.testo.includes("arrivò")).map((x) => ({ paragraphId: x.paragraphId, kind: "replace", original: "arrivò puntuale", suggested: "giunse in orario", reason: "Ritmo.", category: "stile" })), notes: [], names: [] }) });
    await process_();
    const [job] = await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, started.job.id));
    expect(job!.status).toBe("needs_review"); expect(job!.statusReason).toContain("documento è cambiato");
    const fresh = await data(await call("editor", `studio/documents/${documentId}`));
    expect(fresh.proposals).toHaveLength(1); expect(fresh.proposals[0].applicable).toBe(false);
    const decided = await data(await call("editor", `studio/documents/${documentId}/decide`, "POST", { expectedRevision: 4, items: [{ id: fresh.proposals[0].id, decision: "accept" }] }));
    expect(decided.outcome[fresh.proposals[0].id]).toBe("stale"); expect(decided.revision).toBe(4);
    const [row] = await db.select().from(docs.docSuggestions).where(eq(docs.docSuggestions.id, fresh.proposals[0].id));
    expect(row!.status).toBe("stale");
  });
  it("pauses at the job budget, resumes only on an explicit, logged decision, and respects the global pause", async () => {
    await data(await call("owner", "crm/settings", "PUT", { key: "ai-rules", value: { ...aiRules, version: "ai-test-v2", maxJobUsd: 0.01 } }));
    ai.usage = { inputTokens: 2000, outputTokens: 2000 };
    const started = await data(await call("editor", `studio/documents/${documentId}/ai`, "POST", { service: "proofreading" }), 201);
    await process_();
    let [job] = await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, started.job.id));
    expect(job!.status).toBe("paused"); expect(job!.statusReason).toContain("Budget");
    expect((await notificationsOf("editor")).some((n) => n.title === "Lavorazione AI ferma per budget")).toBe(true);
    expect((await call("editor", `studio/jobs/${job!.id}/resume`, "POST", { reason: "Riprendo io" })).status).toBe(404);
    expect((await call("coord", `studio/jobs/${job!.id}/resume`, "POST", {})).status).toBe(422);
    await data(await call("owner", "crm/settings", "PUT", { key: "ai-rules", value: { ...aiRules, version: "ai-test-v3" } }));
    await data(await call("coord", `studio/jobs/${job!.id}/resume`, "POST", { reason: "Budget aggiuntivo approvato" }));
    [job] = await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, started.job.id));
    expect(job!.status).toBe("queued"); expect(job!.budgetMicros).toBeGreaterThan(10_000);
    await data(await call("owner", "crm/automation/ai/pause", "POST", { reason: "Verifica dei costi" }));
    expect(await process_()).toMatchObject({ paused: true });
    expect((await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, started.job.id)))[0]!.status).toBe("queued");
    await data(await call("owner", "crm/automation/ai/resume", "POST", { reason: "Costi verificati" }));
    ai.replies.push({ kind: "refuse" }, { kind: "refuse" }, { kind: "refuse" });
    await process_();
    [job] = await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, started.job.id));
    expect(job!.status).toBe("failed");
    expect((await notificationsOf("editor")).some((n) => n.title === "Lavorazione AI non riuscita")).toBe(true);
    const logged = await db.select().from(platform.auditEvents).where(eq(platform.auditEvents.resourceId, job!.id));
    expect(logged.map((l) => l.action)).toContain("ai.job_resume");
    ai.usage = { inputTokens: 1000, outputTokens: 500 };
  });
});

describe("delivery, client revisions and contractual rounds", () => {
  it("delivers an immutable version with DOCX and PDF; the client sees only approved text", async () => {
    // Una lavorazione aperta blocca la consegna.
    const job = await data(await call("editor", `studio/documents/${documentId}/ai`, "POST", { service: "proofreading" }), 201);
    expect((await call("editor", `studio/documents/${documentId}/versions`, "POST", {})).status).toBe(409);
    await data(await call("coord", `studio/jobs/${job.job.id}/cancel`, "POST", { reason: "Non serve prima della consegna" }));
    await data(await call("editor", `studio/documents/${documentId}/comments`, "POST", { body: "Nota riservata del team sul finale", visibility: "internal" }), 201);
    const before = await data(await call("writer", `studio/client/${projectId}`));
    expect(before.documents[0].version).toBeNull(); expect(before.documents[0].paragraphs).toEqual([]);
    const version = await data(await call("editor", `studio/documents/${documentId}/versions`, "POST", {}), 201);
    expect(version.version).toMatchObject({ label: "V1", kind: "delivery" });
    expect(version.version.docxFileId).toBeTruthy(); expect(version.version.pdfFileId).toBeTruthy();
    expect((await call("editor", `studio/documents/${documentId}/versions`, "POST", {})).status).toBe(409);
    const client = await data(await call("writer", `studio/client/${projectId}`));
    const text = JSON.stringify(client);
    expect(client.documents[0].paragraphs[1].text).toBe("Marta non sapeva perché il treno fosse in ritardo.");
    for (const hidden of ["Nota riservata", "Nota interna", "verificare il nome", "proofreading", "spentMicros", "aiJobs", "giunse in orario"]) expect(text).not.toContain(hidden);
    expect(client.rounds).toEqual({ included: null, used: 0 });
    const docx = await call("writer", `files/${version.version.docxFileId}/download`);
    expect(docx.status).toBe(200);
    expect((await readDocx(new Uint8Array(await docx.arrayBuffer()))).map((p) => p.text)).toContain("Aspettò un poco, poi tornò a casa.");
    expect((await call("stranger", `files/${version.version.docxFileId}/download`)).status).toBe(404);
    expect((await notificationsOf("writer")).some((n) => n.title === "Nuova versione del tuo testo")).toBe(true);
  });
  it("without contractual rounds a request waits for a person and starts no paid processing", async () => {
    const client = await data(await call("writer", `studio/client/${projectId}`));
    const paragraph = client.documents[0].paragraphs[2];
    await data(await call("writer", `studio/client-docs/${documentId}/comments`, "POST", { paragraphId: paragraph.id, body: "Questa frase è troppo brusca." }), 201);
    expect((await call("writer", `studio/client-docs/${documentId}/suggestions`, "POST", { paragraphId: paragraph.id, originalText: "poi", suggestedText: "e poi" })).status).toBe(403);
    await data(await call("coord", `studio/documents/${documentId}`, "PATCH", { clientAccess: "suggest" }));
    expect((await call("writer", `studio/client-docs/${documentId}/suggestions`, "POST", { paragraphId: paragraph.id, originalText: "non esiste", suggestedText: "x" })).status).toBe(422);
    await data(await call("writer", `studio/client-docs/${documentId}/suggestions`, "POST", { paragraphId: paragraph.id, originalText: "poi tornò", suggestedText: "e infine tornò" }), 201);
    const jobsBefore = (await db.select().from(docs.aiJobs)).length;
    const sent = await data(await call("writer", `studio/client-docs/${documentId}/revision-request`, "POST", { notes: "Rivedete il finale del primo capitolo." }));
    expect(sent.cycle).toMatchObject({ number: 1, status: "In valutazione", kind: "Da valutare" });
    expect((await db.select().from(docs.aiJobs)).length).toBe(jobsBefore);
    expect((await notificationsOf("coord")).some((n) => n.title.startsWith("Richiesta di revisione da valutare"))).toBe(true);
    // Il ciclo raccoglie commento e proposta insieme; il testo approvato non cambia.
    const [cycle] = await db.select().from(docs.revisionCycles).where(eq(docs.revisionCycles.documentId, documentId));
    expect(cycle).toMatchObject({ status: "needs_decision", kind: "pending_decision" });
    expect((await db.select().from(docs.docComments).where(eq(docs.docComments.cycleId, cycle!.id)))).toHaveLength(1);
    expect((await db.select().from(docs.docSuggestions).where(eq(docs.docSuggestions.cycleId, cycle!.id)))).toHaveLength(1);
    expect((await call("editor", `studio/cycles/${cycle!.id}/decide`, "POST", { kind: "included", reason: "Incluso" })).status).toBe(404);
    expect((await call("coord", `studio/cycles/${cycle!.id}/decide`, "POST", { kind: "extra_paid", reason: "Pagato?" })).status).toBe(422);
    const decided = await data(await call("coord", `studio/cycles/${cycle!.id}/decide`, "POST", { kind: "included", reason: "Il contratto prevede un giro di revisione", startAi: true }));
    expect(decided.jobId).toBeTruthy();
    const [job] = await db.select().from(docs.aiJobs).where(eq(docs.aiJobs.id, decided.jobId));
    expect(job).toMatchObject({ service: "client_revision", cycleId: cycle!.id });
    expect(job!.scope.paragraphIds).toEqual([paragraph.id]);
    expect(job!.instructions.map((i) => i.text)).toEqual(expect.arrayContaining(["Questa frase è troppo brusca.", "Rivedete il finale del primo capitolo."]));
    ai.replies.push({ kind: "ok", fn: (ps) => ({ suggestions: ps.map((x) => ({ paragraphId: x.paragraphId, kind: "replace", original: "poi tornò", suggested: "e infine tornò", reason: "Richiesta del cliente.", category: "contenuto" })), notes: [], names: [] }) });
    await process_();
    expect((await db.select().from(docs.revisionCycles).where(eq(docs.revisionCycles.id, cycle!.id)))[0]!.status).toBe("human_review");
    expect((await data(await call("writer", `studio/client/${projectId}`))).documents[0].cycles[0].status).toBe("In lavorazione");
  });
  it("keeps quality control separate and delivers the new version only after the check", async () => {
    const view = await data(await call("editor", `studio/documents/${documentId}`));
    const ai = view.proposals.find((p: { origin: string }) => p.origin === "ai");
    const client = view.proposals.find((p: { origin: string }) => p.origin === "client");
    await data(await call("editor", `studio/documents/${documentId}/decide`, "POST", { expectedRevision: view.revision.number, items: [{ id: ai.id, decision: "accept" }, { id: client.id, decision: "reject" }] }));
    expect((await call("editor", `studio/documents/${documentId}/qa`, "POST", {})).status).toBe(409);
    await data(await call("owner", `crm/projects/${projectId}/ops`, "PATCH", { qaOwnerId: actors.coord!.id }));
    await data(await call("editor", `studio/documents/${documentId}/qa`, "POST", {}));
    expect((await notificationsOf("coord")).some((n) => n.title === "Documento da controllare in qualità")).toBe(true);
    const cycle = (await db.select().from(docs.revisionCycles).where(eq(docs.revisionCycles.documentId, documentId)))[0]!;
    const blocked = await call("editor", `studio/documents/${documentId}/versions`, "POST", { cycleId: cycle.id });
    expect(blocked.status).toBe(409); expect((await blocked.json()).code).toBe("QA_PENDING");
    const v2 = await data(await call("coord", `studio/documents/${documentId}/versions`, "POST", { cycleId: cycle.id }), 201);
    expect(v2.version.label).toBe("V2");
    expect((await db.select().from(docs.revisionCycles).where(eq(docs.revisionCycles.id, cycle.id)))[0]).toMatchObject({ status: "delivered", deliveredVersionId: v2.version.id });
    const versions = await db.select().from(docs.docVersions).where(eq(docs.docVersions.documentId, documentId));
    expect(versions.map((v) => v.label).sort()).toEqual(["Originale", "V1", "V2"]);
    expect(new Set(versions.map((v) => v.contentHash)).size).toBe(3);
    const client2 = await data(await call("writer", `studio/client/${projectId}`));
    expect(client2.documents[0].paragraphs[2].text).toBe("Aspettò un poco, e infine tornò a casa.");
    expect(client2.documents[0].versions.map((v: { label: string }) => v.label)).toEqual(["V2", "V1"]);
  });
  it("counts rounds from the project, auto-starts an included round only when the rules allow it and never starts an extra", async () => {
    expect((await call("editor", `studio/projects/${projectId}/rounds`, "PUT", { rounds: 2, reason: "Da contratto" })).status).toBe(404);
    await data(await call("coord", `studio/projects/${projectId}/rounds`, "PUT", { rounds: 2, reason: "Due giri di revisione da contratto" }));
    await data(await call("owner", "crm/settings", "PUT", { key: "revision-rules", value: { version: "rev-test-v1", roundsIncludedByService: {}, autoStartIncluded: true } }));
    const client = await data(await call("writer", `studio/client/${projectId}`));
    expect(client.rounds).toEqual({ included: 2, used: 1 });
    const first = client.documents[0].paragraphs[1];
    await data(await call("writer", `studio/client-docs/${documentId}/comments`, "POST", { paragraphId: first.id, body: "Il nome Marta va cambiato in Anna." }), 201);
    const sent = await data(await call("writer", `studio/client-docs/${documentId}/revision-request`, "POST", { level: "chapter" }));
    expect(sent.cycle).toMatchObject({ number: 2, kind: "Inclusa nel contratto" });
    const [job] = await db.select().from(docs.aiJobs).where(and(eq(docs.aiJobs.documentId, documentId), eq(docs.aiJobs.status, "queued")));
    expect(job?.service).toBe("client_revision"); expect(job!.createdBy).toBeNull();
    // Ambito «capitolo»: dal titolo al capitolo successivo.
    expect(job!.scope.paragraphIds).toHaveLength(3);
    await data(await call("coord", `studio/jobs/${job!.id}/cancel`, "POST", { reason: "Lavorata a mano" }));
    await db.update(docs.revisionCycles).set({ status: "delivered" }).where(eq(docs.revisionCycles.documentId, documentId));
    await data(await call("writer", `studio/client-docs/${documentId}/comments`, "POST", { paragraphId: first.id, body: "Ancora una modifica, per favore." }), 201);
    const extra = await data(await call("writer", `studio/client-docs/${documentId}/revision-request`, "POST", {}));
    expect(extra.cycle).toMatchObject({ number: 3, kind: "Fuori contratto", status: "Richiede un preventivo" });
    expect((await db.select().from(docs.aiJobs).where(and(eq(docs.aiJobs.documentId, documentId), eq(docs.aiJobs.status, "queued"))))).toHaveLength(0);
    expect((await notificationsOf("coord")).some((n) => n.title.startsWith("Richiesta di revisione fuori contratto"))).toBe(true);
  });
});

describe("Google Docs adapter (simulated Google APIs)", () => {
  it("connects with server-side encrypted tokens, links, pulls changes as a revision, refuses conflicts and handles revoked tokens", async () => {
    expect((await call("editor", "studio/google/connect", "POST", {})).status).toBe(404);
    expect((await call("owner", "studio/google/connect", "POST", {})).status).toBe(503);
    Object.assign(process.env, { GOOGLE_CLIENT_ID: "synthetic-client.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "synthetic-secret" });
    const { url } = await data(await call("owner", "studio/google/connect", "POST", {}));
    const state = new URL(url).searchParams.get("state")!;
    expect(new URL(url).searchParams.get("scope")).toContain("drive.file");
    const { googleCallback, resetGoogleTokenCache } = await import("@/lib/platform/documents/google");
    await expect(googleCallback("code", "wrong-state")).rejects.toMatchObject({ code: "INVALID_STATE" });
    await googleCallback("code", state);
    const [conn] = await db.select().from(docs.externalConnections).where(eq(docs.externalConnections.provider, "google"));
    expect(conn).toMatchObject({ status: "connected", accountEmail: "studio@example.test" });
    expect(conn!.encryptedToken).not.toContain("synthetic-refresh-token");
    const status = await data(await call("editor", "studio/google"));
    expect(JSON.stringify(status)).not.toContain("synthetic"); expect(status.suggestMode).toBe("proemios");
    const linked = await data(await call("coord", `studio/documents/${documentId}/google-link`, "POST", {}));
    const remote = google.docs.get(linked.externalId)!;
    const view = await data(await call("editor", `studio/documents/${documentId}`));
    expect(remote.paragraphs).toEqual(view.revision.paragraphs.map((p: { text: string }) => p.text));
    // Modifica fatta in Google: rientra come revisione con gli stessi id di paragrafo.
    remote.paragraphs[4] = "La mattina seguente il treno fu in perfetto orario."; remote.revision++;
    expect((await call("editor", `studio/documents/${documentId}/google-pull`, "POST", { expectedRevision: view.revision.number - 1 })).status).toBe(409);
    const pulled = await data(await call("editor", `studio/documents/${documentId}/google-pull`, "POST", { expectedRevision: view.revision.number }));
    expect(pulled).toMatchObject({ changed: true, revision: view.revision.number + 1 });
    const synced = await data(await call("editor", `studio/documents/${documentId}`));
    expect(synced.revision.paragraphs.map((p: { id: string }) => p.id)).toEqual(view.revision.paragraphs.map((p: { id: string }) => p.id));
    // Proposta accettata in Proemios → applicata a Google; se Google è cambiato nel frattempo, nessuna sovrascrittura.
    await data(await call("editor", `studio/documents/${documentId}/edit`, "POST", { expectedRevision: synced.revision.number, changes: [{ paragraphId: synced.revision.paragraphs[0].id, text: "Capitolo 1" }] }));
    remote.revision++;
    const conflict = await call("editor", `studio/documents/${documentId}/google-push`, "POST", {});
    expect(conflict.status).toBe(409); expect((await conflict.json()).code).toBe("GOOGLE_CONFLICT");
    await db.update(docs.documents).set({ externalRevisionId: `r${remote.revision}` }).where(eq(docs.documents.id, documentId));
    expect(await data(await call("editor", `studio/documents/${documentId}/google-push`, "POST", {}))).toEqual({ changed: 1 });
    expect(remote.paragraphs[0]).toBe("Capitolo 1");
    expect((await call("coord", `studio/documents/${documentId}/google-share`, "POST", { mode: "writer" })).status).toBe(422);
    await data(await call("coord", `studio/documents/${documentId}/google-share`, "POST", { mode: "commenter" }));
    expect(google.shares.at(-1)).toMatchObject({ body: { role: "commenter", emailAddress: actors.writer!.email } });
    expect(String((google.shares.at(-1) as { url: string }).url)).toContain("sendNotificationEmail=false");
    google.tokenError = "invalid_grant"; resetGoogleTokenCache();
    const expired = await call("editor", `studio/documents/${documentId}/google-pull`, "POST", { expectedRevision: synced.revision.number + 1 });
    expect(expired.status).toBe(409); expect((await expired.json()).code).toBe("GOOGLE_TOKEN_EXPIRED");
    expect((await db.select().from(docs.externalConnections))[0]!.status).toBe("revoked");
  });
});

describe("seller home and sales assistant (drafts only)", () => {
  it("shows clickable buckets from the derived pipeline and commissions from the register", async () => {
    const deal = await data(await call("seller", "crm/deals", "POST", { contact: { name: "Paola Prospect", email: "paola.prospect@example.test" }, title: "Romanzo di Paola", priority: "urgent", nextAction: "Prima telefonata", nextActionAt: new Date(Date.now() - 86400_000).toISOString() }), 201);
    const home = await data(await call("seller", "crm/seller"));
    const ids = (key: string) => home.buckets.find((b: { key: string }) => b.key === key).deals.map((d: { id: string }) => d.id);
    expect(ids("new")).toContain(deal.deal.id); expect(ids("urgent")).toContain(deal.deal.id); expect(ids("overdue")).toContain(deal.deal.id);
    expect(home.commissions.accrued.cents).toBeGreaterThan(0);
    expect(JSON.stringify(home)).not.toContain("paola.prospect@example.test");
    expect((await call("writer", "crm/seller")).status).toBe(404);
    // Soglie configurabili: versione approvata, effetto solo sul raggruppamento.
    expect((await call("seller", "crm/settings", "PUT", { key: "seller-rules", value: { version: "venditore-v2", newLeadHours: 1, unansweredDays: 5, abandonedCheckoutHours: 12, expiringDays: 10 } })).status).not.toBe(200);
    await data(await call("owner", "crm/settings", "PUT", { key: "seller-rules", value: { version: "venditore-v2", newLeadHours: 1, unansweredDays: 5, abandonedCheckoutHours: 12, expiringDays: 10 } }));
    const tuned = await data(await call("seller", "crm/seller"));
    expect(tuned.buckets.find((b: { key: string }) => b.key === "unanswered").hint).toContain("5 giorni");
    expect(tuned.buckets.find((b: { key: string }) => b.key === "new").deals.map((d: { id: string }) => d.id)).toContain(deal.deal.id);
  });
  it("drafts only when enabled, never sends, keeps contact details out of the prompt and flags discounts", async () => {
    const [deal] = await db.select().from(schema.crmDeals).where(eq(schema.crmDeals.title, "Romanzo di Paola"));
    expect((await call("seller", `crm/deals/${deal!.id}/assistant`, "POST", { purpose: "follow_up" })).status).toBe(409);
    await data(await call("owner", "crm/settings", "PUT", { key: "ai-rules", value: { ...aiRules, version: "ai-test-v9", salesAssistant: true } }));
    expect((await call("stranger", `crm/deals/${deal!.id}/assistant`, "POST", { purpose: "follow_up" })).status).not.toBe(200);
    const outbox = (await db.select().from(platform.emailOutbox)).length;
    ai.replies.push({ kind: "ok", fn: () => ({ channel: "email", subject: "Il tuo romanzo", draft: "Gentile Paola, posso offrirti uno sconto del 10% se confermi oggi.", points: ["Ricontatto"], cautions: [] }) });
    const r = await data(await call("seller", `crm/deals/${deal!.id}/assistant`, "POST", { purpose: "follow_up", notes: "Ha chiesto i tempi" }));
    expect(r.sent).toBe(false); expect(r.draft.cautions[0]).toMatch(/sconti/);
    const prompt = ai.calls.at(-1)!;
    expect(prompt.user).not.toContain("paola.prospect@example.test"); expect(prompt.user).toContain("Paola"); expect(prompt.user).not.toContain("Prospect");
    expect(prompt.system).toMatch(/Non proporre sconti/);
    expect((await db.select().from(platform.emailOutbox)).length).toBe(outbox);
    const usage = await db.select().from(docs.aiUsage).where(eq(docs.aiUsage.dealId, deal!.id));
    expect(usage[0]).toMatchObject({ purpose: "sales_assistant", outcome: "ok" });
  });
});

describe("control room: real indicators, AI costs and margins, production dashboard", () => {
  it("shows sections by permission and explains unavailable indicators instead of inventing them", async () => {
    const owner = await data(await call("owner", "crm/admin"));
    for (const key of ["sales", "finance", "production", "marketing", "technology"]) expect(Array.isArray(owner.sections[key])).toBe(true);
    const finance = await data(await call("finance", "crm/admin"));
    expect(Array.isArray(finance.sections.finance)).toBe(true); expect(finance.sections.marketing).toBeNull(); expect(finance.sections.technology).toBeNull();
    const marketing = await data(await call("marketing", "crm/admin"));
    expect(marketing.sections.finance).toBeNull(); expect(Array.isArray(marketing.sections.marketing)).toBe(true);
    expect([403, 404]).toContain((await call("writer", "crm/admin")).status);
    expect([403, 404]).toContain((await call("seller", "crm/admin/margins")).status);
    for (const section of Object.values(owner.sections) as Array<Array<{ status: string; reason?: string; value: unknown }>>)
      for (const i of section) if (i.status === "unavailable") { expect(i.reason).toBeTruthy(); expect(i.value).toBeNull(); }
  });
  it("computes the contribution margin from contract, commissions, AI cost and recorded costs only once the exchange rate is approved", async () => {
    expect((await call("editor", `crm/projects/${projectId}/costs`, "POST", { kind: "editor_fee", amountCents: 25000, description: "Compenso correzione" })).status).not.toBe(201);
    await data(await call("finance", `crm/projects/${projectId}/costs`, "POST", { kind: "editor_fee", amountCents: 25000, description: "Compenso correzione" }), 201);
    let margins = await data(await call("owner", "crm/admin/margins"));
    let row = margins.rows.find((p: { projectId: string }) => p.projectId === projectId);
    expect(row.aiUsdMicros).toBeGreaterThan(0); expect(row.marginCents).toBeNull(); expect(row.editorCents).toBe(25000);
    expect(row.missing.join(" ")).toMatch(/cambio/i);
    await data(await call("owner", "crm/settings", "PUT", { key: "cost-rules", value: { version: "cost-test-v1", usdToEurRate: 0.9 } }));
    margins = await data(await call("owner", "crm/admin/margins"));
    row = margins.rows.find((p: { projectId: string }) => p.projectId === projectId);
    const [contract] = await db.select().from(platform.contracts).where(eq(platform.contracts.quoteId, quoteId));
    const commissions = (await db.select().from(platform.commissions)).filter((c) => c.status !== "held").reduce((n, c) => n + c.amountCents, 0);
    const aiEur = Math.round((row.aiUsdMicros / 1_000_000) * 0.9 * 100);
    expect(row.aiCents).toBe(aiEur);
    expect(row.marginCents).toBe(contract!.orderSheet.amounts.netCents - commissions - aiEur - 25000);
  });
  it("lists production work per section with direct links and limits operators to their projects", async () => {
    const coord = await data(await call("coord", "studio/production"));
    const row = coord.projects.find((p: { id: string }) => p.id === projectId);
    expect(row.documents[0].id).toBe(documentId);
    expect(coord.sections.clientRevisions).toContain(projectId);
    expect(coord.problems.some((p: { kind: string }) => p.kind === "revision")).toBe(true);
    expect((await call("writer", "studio/production")).status).toBe(404);
    expect((await call("seller", "studio/production")).status).toBe(404);
    const queue = await data(await call("owner", "studio/queue"));
    expect(queue.jobs.length).toBeGreaterThan(0);
    expect((await call("editor", "studio/queue")).status).toBe(404);
  });
  it("reports AI and Google in diagnostics without exposing secrets", async () => {
    const diag = await data(await call("owner", "crm/diagnostics"));
    const text = JSON.stringify(diag);
    expect(text).not.toContain("sk-ant-synthetic"); expect(text).not.toContain("synthetic-secret");
    const items = diag.items as Array<{ key: string; state: string }>;
    expect(items.find((i) => i.key === "anthropic")).toBeTruthy();
    expect(items.find((i) => i.key === "google")?.state).toBe("error");
  });
});

describe("direct upload of large files (Blob simulated by the local file store)", () => {
  it("accepts only this project's and this person's paths, re-checks the file and never registers it twice", async () => {
    const { directPathAllowed, directKeyAllowed } = await import("@/lib/platform/direct-upload");
    const me = actors.writer!.id, other = actors.stranger!.id, file = randomUUID();
    expect(directPathAllowed(`projects/${projectId}/direct/${me}/${file}.docx`, projectId, me)).toBe(true);
    expect(directPathAllowed(`projects/${projectId}/direct/${other}/${file}.docx`, projectId, me)).toBe(false);
    expect(directPathAllowed(`projects/${randomUUID()}/direct/${me}/${file}.docx`, projectId, me)).toBe(false);
    expect(directPathAllowed(`projects/${projectId}/direct/${me}/${file}.exe`, projectId, me)).toBe(false);
    expect(directKeyAllowed(`https://abc.private.blob.vercel-storage.com/projects/${projectId}/direct/${me}/${file}.pdf`, projectId, me)).toBe(true);
    expect(directKeyAllowed(`https://evil.example.com/projects/${projectId}/direct/${me}/${file}.pdf`, projectId, me)).toBe(false);
    expect(directKeyAllowed(`https://abc.private.blob.vercel-storage.com/projects/${projectId}/direct/${other}/${file}.pdf`, projectId, me)).toBe(false);
    // Senza archivio Blob configurato il token non viene emesso.
    expect((await call("writer", `projects/${projectId}/files/direct`, "POST", { type: "blob.generate-client-token", payload: { pathname: `projects/${projectId}/direct/${me}/${file}.txt`, clientPayload: null, multipart: false } })).status).toBe(503);
    const { writeFile, mkdir, access: exists } = await import("node:fs/promises");
    const dir = process.env.PROEMIOS_TEST_FILE_DIR!; await mkdir(dir, { recursive: true });
    const big = randomUUID(); await writeFile(join(dir, big), Buffer.from("Testo lungo di prova. ".repeat(250_000)));
    expect((await call("stranger", `projects/${projectId}/files/register`, "POST", { key: `test:${big}`, name: "lungo.txt" })).status).toBe(404);
    const saved = await data(await call("writer", `projects/${projectId}/files/register`, "POST", { key: `test:${big}`, name: "lungo.txt" }), 201);
    expect(saved.file.status).toBe("ready"); expect(saved.file.size).toBeGreaterThan(4 * 1024 * 1024);
    expect((await call("writer", `projects/${projectId}/files/register`, "POST", { key: `test:${big}`, name: "lungo.txt" })).status).toBe(409);
    const bad = randomUUID(); await writeFile(join(dir, bad), Buffer.from("non è un pdf"));
    expect((await call("writer", `projects/${projectId}/files/register`, "POST", { key: `test:${bad}`, name: "falso.pdf" })).status).toBe(422);
    await expect(exists(join(dir, bad))).rejects.toThrow();
  });
});
