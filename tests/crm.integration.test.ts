/**
 * CRM: scenari richiesti, su un database PGlite isolato con le migrazioni
 * reali, autenticazione reale (Better Auth + TOTP) e destinatari di test.
 * Nessun servizio esterno: Stripe è simulato con eventi firmati a mano,
 * la posta finisce in una cartella temporanea, i webhook in uscita usano
 * un fetch di prova.
 */
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URI } from "otpauth";
import * as schema from "@/db/schema";
import * as identity from "@/db/auth-schema";
import * as platform from "@/db/platform-schema";
import * as crm from "@/db/crm-schema";
import { ROLE_GRANTS, type Role } from "@/lib/platform/permissions";
import { verifySignature } from "@/lib/crm-core/webhooks";
import type Stripe from "stripe";

const shared = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => shared.db, dbConfigurato: () => true }));
const origin = "http://localhost:3199";
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
  return auth.handler(new Request(`${origin}/api/auth/${path}`, { method: "POST", headers: { origin, cookie, "x-forwarded-for": `198.51.100.${++requestNumber % 250}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
}
async function call(actor: string | null, path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return handler(new Request(`${origin}/api/platform/${path}`, { method, headers: { origin, cookie: actor ? actors[actor]!.cookie : "", "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}
async function data(response: Response, expected = 200) { expect(response.status, await response.clone().text()).toBe(expected); return response.json(); }
async function createActor(name: string, role: Role, grants: typeof ROLE_GRANTS[Role] | null = null) {
  const email = `${name.toLowerCase()}@example.test`;
  const result = await data(await authRequest("sign-up/email", { name, email, password, privacyAccepted: true }));
  const id = result.user.id;
  await db.update(identity.user).set({ emailVerified: true }).where(eq(identity.user.id, id));
  if (role !== "author") await db.insert(platform.memberships).values({ userId: id, role, grants: role === "admin" ? grants ?? ROLE_GRANTS.admin : grants });
  const login = await authRequest("sign-in/email", { email, password });
  actors[name] = { id, email, cookie: cookies(login) };
  if (role !== "author") {
    const enable = await data(await authRequest("two-factor/enable", { password, method: "totp" }, actors[name]!.cookie));
    const verify = await authRequest("two-factor/verify-totp", { code: URI.parse(enable.totpURI).generate(), trustDevice: false }, actors[name]!.cookie);
    await data(verify); actors[name]!.cookie = cookies(verify, actors[name]!.cookie);
  }
  return actors[name]!;
}
const allDay = { timezone: "Europe/Rome", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59", holidays: [] };
const rules = (extra: Record<string, unknown> = {}) => ({ version: `assegnazione-test-${randomUUID().slice(0, 8)}`, mode: "automatic", sourceModes: {}, defaultLanguage: "it", defaultCapacity: 40, hours: allDay, sla: { responseMinutes: { low: 1440, normal: 480, high: 120, urgent: 60 }, escalateAfterMinutes: 120 }, pool: { maxReservations: 3, reservationMinutes: 120 }, ...extra });
const commissionRule = { version: "TEST-COMMISSION-v1", sellerBps: 1000, affiliateBps: 500, base: "collected-excluding-tax", attributionDays: 30, attribution: "code-on-quote", assistedSalesOnly: false };
async function publicQuote(body: Record<string, unknown>) {
  const { publicQuote } = await import("@/lib/platform/public-forms");
  return data(await publicQuote(new Request(`${origin}/api/preventivo`, { method: "POST", headers: { origin, "idempotency-key": randomUUID(), "content-type": "application/json" }, body: JSON.stringify(body) })), 201);
}
const proofreading = { projectType: "romanzo", textState: "finito-revisionato", wordCount: 50000, requestedServices: ["proofreading"], singleService: "proofreading", urgency: "standard" };
const fullPath = { projectType: "romanzo", textState: "finito-revisionato", wordCount: 60000, requestedServices: ["editing", "layout"], urgency: "standard" };
const leadOfQuote = async (quoteId: string) => (await db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)))[0]!.leadId;
const leadRow = async (leadId: string) => (await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)))[0]!;
const ownerOf = async (leadId: string) => (await db.select().from(platform.leadOwnership).where(eq(platform.leadOwnership.leadId, leadId)))[0]?.assignedTo ?? null;
async function accept(author: string, quoteId: string, tierPick?: string) {
  const detail = await data(await call(author, `quotes/${quoteId}`));
  const tier = tierPick ?? (detail.packages.find((p: { recommended?: boolean }) => p.recommended) ?? detail.packages[0]).tier;
  const accepted = await data(await call(author, `quotes/${quoteId}/accept`, "POST", { tier, version: detail.record.version, policyVersion: detail.paymentPolicy.version, termsAccepted: true, orderSheetAccepted: true }));
  return { tier, detail, contractId: accepted.contractId as string };
}
const stripeEvent = (type: string, object: unknown) => ({ id: `evt_test_${randomUUID()}`, type, livemode: false, data: { object } }) as Stripe.Event;
async function pay(author: string, quoteId: string, tier: string, kind: "deposit" | "balance" = "deposit", repeat = 1) {
  const detail = await data(await call(author, `quotes/${quoteId}`));
  const pkg = detail.packages.find((p: { tier: string }) => p.tier === tier);
  const amount = kind === "deposit" ? pkg.depositMoney.grossCents : pkg.money.grossCents - pkg.depositMoney.grossCents;
  const session = `cs_test_${randomUUID()}`, intent = `pi_test_${randomUUID()}`;
  const [order] = await db.insert(platform.paymentOrders).values({ quoteId, authorId: actors[author]!.id, tier, kind, amountCents: amount, stripeSessionId: session }).returning();
  const { processStripeEvent } = await import("@/lib/platform/payments");
  const event = stripeEvent("checkout.session.completed", { id: session, metadata: { orderId: order!.id, quoteId }, client_reference_id: order!.id, currency: "eur", amount_total: amount, payment_status: "paid", payment_intent: intent, payment_method_types: ["card"] });
  for (let i = 0; i < repeat; i++) await processStripeEvent(event);
  // Stesso fatto, evento con id diverso (Stripe può reinviare): nessun doppio effetto.
  if (repeat > 1) await processStripeEvent({ ...event, id: `evt_test_${randomUUID()}` });
  return { orderId: order!.id, intent, amount };
}
async function upload(actor: string, projectId: string, name: string) {
  const form = new FormData(); form.set("kind", "manuscript"); form.set("file", new File(["Testo sintetico di prova. ".repeat(50)], name));
  return handler(new Request(`${origin}/api/platform/projects/${projectId}/files`, { method: "POST", headers: { origin, cookie: actors[actor]!.cookie }, body: form }));
}
async function mailLink(eventPrefix: string) {
  const { compactDecrypt } = await import("jose");
  const item = (await db.select().from(platform.emailOutbox)).find((r) => r.eventKey.startsWith(eventPrefix))!;
  const html = new TextDecoder().decode((await compactDecrypt(item.html.slice(4), createHash("sha256").update(process.env.BETTER_AUTH_SECRET!).digest())).plaintext);
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replaceAll("&amp;", "&")).find((v) => v.includes("token="))!;
}

beforeAll(async () => {
  const directory = await mkdtemp(join(tmpdir(), "proemios-crm-"));
  process.env.DATABASE_URL = "postgresql://test-only@localhost/test-only";
  process.env.APP_URL = origin;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.PROEMIOS_TEST_RUN = "1";
  process.env.PROEMIOS_TEST_MAIL_DIR = join(directory, "mail");
  process.env.PROEMIOS_TEST_FILE_DIR = join(directory, "files");
  process.env.PROEMIOS_OWNER_EMAIL = "owner@example.test";
  process.env.DEMO_MODE = "off";
  process.env.STRIPE_SECRET_KEY = "sk_test_synthetic_fixture_only";
  delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  database = await PGlite.create({ dataDir: join(directory, "db") });
  for (const name of (await readdir("drizzle")).filter((n) => n.endsWith(".sql")).sort()) await database.exec(await readFile(join("drizzle", name), "utf8"));
  db = drizzle(database, { schema }); shared.db = db;
  auth = (await import("@/lib/auth")).getAuth();
  handler = (await import("@/app/api/platform/[...path]/route")).GET;
  await createActor("owner", "author");
  expect((await data(await call("owner", "me"))).user.roles).toContain("owner");
  const enable = await data(await authRequest("two-factor/enable", { password, method: "totp" }, actors.owner!.cookie));
  const verify = await authRequest("two-factor/verify-totp", { code: URI.parse(enable.totpURI).generate(), trustDevice: false }, actors.owner!.cookie);
  await data(verify); actors.owner!.cookie = cookies(verify, actors.owner!.cookie);
  for (const [name, role] of [["sellerA", "seller"], ["sellerB", "seller"], ["sellerC", "seller"], ["admin", "admin"], ["coord", "coordinator"], ["editorA", "editor"], ["editorB", "editor"], ["marketing", "marketing"], ["finance", "finance"], ["affiliate", "affiliate"]] as Array<[string, Role]>) await createActor(name, role);
  await data(await call("owner", "settings", "PUT", { key: "commission-rule", value: commissionRule }));
  await data(await call("owner", "crm/settings", "PUT", { key: "assignment-rules", value: rules() }));
  // Profili: competenze e lingue diverse per rendere visibili le regole.
  await data(await call("owner", `crm/team/${actors.sellerA!.id}/profile`, "PUT", { skills: ["editing", "proofreading", "cover"], languages: ["it"], capacity: 20 }));
  await data(await call("owner", `crm/team/${actors.sellerB!.id}/profile`, "PUT", { skills: ["cover", "editing"], languages: ["it", "en"], capacity: 20 }));
  await data(await call("owner", `crm/team/${actors.sellerC!.id}/profile`, "PUT", { skills: [], languages: ["en"], capacity: 20 }));
}, 180000);
afterAll(async () => { if (database) await database.close(); });

let adsLead: string, adsDeal: string, adsContact: string;
describe("relations, acquisition and automatic assignment", () => {
  it("routes an Ads request to the eligible seller and keeps one contact and one open deal per person", async () => {
    const saved = await publicQuote({ input: proofreading, contatto: { nome: "Ada Ads", email: "ada.ads@example.test", consensoPrivacy: true, consensoMarketing: false }, attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: "autunno", gclid: "test-gclid-1", landingPath: "/preventivo" } });
    adsLead = await leadOfQuote(saved.quoteId);
    const lead = await leadRow(adsLead);
    expect(lead.sourceKind).toBe("campaign"); expect(lead.requiredSkill).toBe("proofreading"); expect(lead.assignmentStatus).toBe("assigned");
    // sellerB non ha la competenza, sellerC non parla italiano: resta sellerA.
    expect(await ownerOf(adsLead)).toBe(actors.sellerA!.id);
    expect(lead.slaDueAt!.getTime()).toBeGreaterThan(Date.now());
    const history = await db.select().from(crm.crmAssignments).where(and(eq(crm.crmAssignments.entityType, "lead"), eq(crm.crmAssignments.entityId, adsLead)));
    expect(history[0]).toMatchObject({ toUser: actors.sellerA!.id, method: "auto", reason: "balanced_in_hours" });
    expect(history[0]!.ruleVersion).toMatch(/^assegnazione-test-/);
    adsDeal = lead.dealId!; adsContact = lead.contactId!;
    expect((await db.select().from(crm.crmDeals).where(eq(crm.crmDeals.id, adsDeal)))[0]!.ownerId).toBe(actors.sellerA!.id);
    const events = await db.select().from(crm.crmEvents);
    expect(events.some((e) => e.type === "lead.created" && e.entityId === adsLead)).toBe(true);
    expect(events.some((e) => e.type === "lead.assigned" && e.entityId === adsLead)).toBe(true);
    expect(JSON.stringify(events.map((e) => e.payload))).not.toContain("ada.ads@example.test");
    // Seconda richiesta della stessa persona: stessa scheda, stessa trattativa aperta, stesso responsabile.
    const again = await publicQuote({ input: { ...proofreading, wordCount: 52000 }, contatto: { nome: "Ada Ads", email: "ADA.ads@example.test", consensoPrivacy: true, consensoMarketing: false } });
    const second = await leadRow(await leadOfQuote(again.quoteId));
    expect(second.contactId).toBe(adsContact); expect(second.dealId).toBe(adsDeal);
    expect(await ownerOf(second.id)).toBe(actors.sellerA!.id);
    expect((await db.select().from(crm.crmContacts).where(eq(crm.crmContacts.emailNormalized, "ada.ads@example.test")))).toHaveLength(1);
    expect((await db.select().from(crm.crmAssignments).where(eq(crm.crmAssignments.entityId, second.id)))[0]!.reason).toBe("open_deal_owner");
  });
  it("queues requests when nobody is eligible, alerts managers, retries in the first useful period and escalates late answers without reassigning", async () => {
    const away = [{ from: new Date(Date.now() - 3600_000).toISOString(), to: new Date(Date.now() + 3600_000).toISOString(), reason: "ferie" }];
    for (const s of ["sellerA", "sellerB"]) await data(await call("owner", `crm/team/${actors[s]!.id}/profile`, "PUT", { absences: away }));
    const saved = await publicQuote({ input: fullPath, contatto: { nome: "Nora Nessuno", email: "nora@example.test", consensoPrivacy: true, consensoMarketing: false } });
    const leadId = await leadOfQuote(saved.quoteId);
    expect((await leadRow(leadId)).assignmentStatus).toBe("queued");
    expect(await ownerOf(leadId)).toBeNull();
    const alerts = await db.select().from(platform.notifications).where(eq(platform.notifications.userId, actors.owner!.id));
    expect(alerts.some((n) => n.title === "Richiesta senza venditore idoneo" && n.href === `/spazio?lead=${leadId}`)).toBe(true);
    for (const s of ["sellerA", "sellerB"]) await data(await call("owner", `crm/team/${actors[s]!.id}/profile`, "PUT", { absences: [] }));
    const { runAssignmentJobs } = await import("@/lib/platform/crm-routing");
    const jobs = await runAssignmentJobs();
    expect(jobs.routed).toBeGreaterThanOrEqual(1);
    const owner = await ownerOf(leadId);
    expect([actors.sellerA!.id, actors.sellerB!.id]).toContain(owner);
    expect((await db.select().from(crm.crmAssignments).where(eq(crm.crmAssignments.entityId, leadId))).some((a) => a.reason.startsWith("queue_retry"))).toBe(true);
    // Scadenza superata: avviso al responsabile e alla gestione, nessuno spostamento automatico.
    await db.update(schema.leads).set({ slaDueAt: new Date(Date.now() - 6 * 3600_000) }).where(eq(schema.leads.id, leadId));
    await data(await call("owner", "crm/settings", "PUT", { key: "assignment-rules", value: rules({ sla: { responseMinutes: { low: 1440, normal: 480, high: 120, urgent: 60 }, escalateAfterMinutes: 0 } }) }));
    const late = await runAssignmentJobs();
    expect(late.escalated).toBeGreaterThanOrEqual(1);
    expect((await leadRow(leadId)).escalatedAt).not.toBeNull();
    expect(await ownerOf(leadId)).toBe(owner);
    expect((await db.select().from(platform.notifications).where(eq(platform.notifications.userId, actors.owner!.id))).some((n) => n.title === "Escalation: richiesta senza risposta")).toBe(true);
    await data(await call("owner", "crm/settings", "PUT", { key: "assignment-rules", value: rules() }));
  });
  it("lets only one of two sellers claim a free-pick request, with minimal data before the claim, limits and expiry", async () => {
    await data(await call("owner", "crm/settings", "PUT", { key: "assignment-rules", value: rules({ mode: "pool", pool: { maxReservations: 1, reservationMinutes: 30 } }) }));
    const first = await leadOfQuote((await publicQuote({ input: fullPath, contatto: { nome: "Paola Pool", email: "paola.pool@example.test", consensoPrivacy: true, consensoMarketing: false, telefono: "+39 333 0000001", ricontatto: true } })).quoteId);
    const second = await leadOfQuote((await publicQuote({ input: fullPath, contatto: { nome: "Piero Pool", email: "piero.pool@example.test", consensoPrivacy: true, consensoMarketing: false } })).quoteId);
    expect((await leadRow(first)).assignmentStatus).toBe("pool");
    const pool = await data(await call("sellerB", "crm/pool"));
    const visible = JSON.stringify(pool);
    expect(visible).toContain("Paola"); expect(visible).not.toContain("paola.pool@example.test"); expect(visible).not.toContain("333");
    // Prima della presa in carico la scheda non è leggibile.
    expect((await call("sellerB", `leads/${first}`)).status).toBe(404);
    const results = await Promise.all([call("sellerA", `crm/pool/${first}/claim`, "POST", {}), call("sellerB", `crm/pool/${first}/claim`, "POST", {})]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results[0]!.status === 200 ? "sellerA" : "sellerB";
    expect(await ownerOf(first)).toBe(actors[winner]!.id);
    expect((await call(winner, `crm/pool/${second}/claim`, "POST", {})).status).toBe(409);
    expect((await db.select().from(crm.crmAssignments).where(eq(crm.crmAssignments.entityId, first))).some((a) => a.method === "claim")).toBe(true);
    await db.update(schema.leads).set({ reservedUntil: new Date(Date.now() - 60_000) }).where(eq(schema.leads.id, first));
    const { runAssignmentJobs } = await import("@/lib/platform/crm-routing");
    expect((await runAssignmentJobs()).released).toBe(1);
    expect((await leadRow(first)).assignmentStatus).toBe("pool");
    expect(await ownerOf(first)).toBeNull();
    // La prima risposta conferma la prenotazione.
    await data(await call(winner, `crm/pool/${second}/claim`, "POST", {}));
    await data(await call(winner, `leads/${second}/activities`, "POST", { kind: "email", body: "Risposta di prova a un destinatario di test.", outcome: "other" }), 201);
    expect((await leadRow(second)).assignmentStatus).toBe("assigned");
    await data(await call("owner", "crm/settings", "PUT", { key: "assignment-rules", value: rules() }));
  });
});

let customQuote: string, customProject: string, customDeal: string, customLead: string;
describe("assisted purchases and attribution", () => {
  it("custom quote: authorized lines, approvals, protected link, verified claim, re-acceptance after changes and credit to the seller", async () => {
    const created = await data(await call("sellerB", "crm/deals", "POST", { contact: { name: "Quinto Quote", email: "buyerq@example.test", phone: "+39 333 5550001" }, title: "Romanzo di Quinto", nextAction: "Chiamata di qualifica", nextActionAt: new Date(Date.now() + 86400_000).toISOString() }), 201);
    customDeal = created.deal.id; customLead = created.leadId;
    expect((await leadRow(customLead)).sourcedBy).toBe(actors.sellerB!.id);
    const quote = await data(await call("sellerB", `leads/${customLead}/quotes`, "POST", { input: fullPath }), 201);
    customQuote = quote.quote.id;
    expect((await db.select().from(platform.quoteRecords).where(eq(platform.quoteRecords.quoteId, customQuote)))[0]!.dealId).toBe(customDeal);
    await data(await call("sellerB", `crm/quotes/${customQuote}/terms`, "PUT", { revisions: "Due giri di revisione sul testo completo.", exclusions: ["Traduzione"] }));
    await data(await call("sellerB", `crm/quotes/${customQuote}/lines`, "POST", { label: "Scheda personaggi", amount: 90 }), 201);
    const pending = await data(await call("sellerB", `crm/quotes/${customQuote}/lines`, "POST", { label: "Revisione aggiuntiva dei dialoghi", amount: 400 }), 202);
    expect((await call("sellerB", `crm/approvals/${pending.approvalId}`, "POST", { decision: "approved" })).status).toBe(403);
    await data(await call("owner", `crm/approvals/${pending.approvalId}`, "POST", { decision: "approved", note: "Lavoro specifico concordato" }));
    const detail = await data(await call("sellerB", `quotes/${customQuote}`));
    const recommended = detail.packages.find((p: { recommended?: boolean }) => p.recommended);
    expect(recommended.lineItems.map((l: { label: string }) => l.label)).toEqual(expect.arrayContaining(["Scheda personaggi", "Revisione aggiuntiva dei dialoghi"]));
    expect(detail.record.version).toBe(4);
    const link = await data(await call("sellerB", `crm/quotes/${customQuote}/link`, "POST", { validityDays: 7 }), 201);
    const token = link.url.split("/proposta/")[1];
    const { publicLinkView } = await import("@/lib/platform/crm-quotes");
    const view = await data(await publicLinkView(new Request(`${origin}/api/public/proposta/${token}`), token));
    expect(JSON.stringify(view)).not.toContain("buyerq@example.test");
    expect(view.packages[0].money.grossCents).toBeGreaterThan(0); expect(view.packages[0].depositMoney.grossCents).toBeGreaterThan(0); expect(view.packages[0].installments.length).toBeGreaterThan(0);
    expect(view.workTerms.revisions).toBe("Due giri di revisione sul testo completo.");
    const { publicLinkMessage } = await import("@/lib/platform/crm-quotes");
    await data(await publicLinkMessage(new Request(`${origin}/api/public/proposta/${token}/messaggio`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ kind: "clarification", body: "Le revisioni includono anche i titoli?" }) }), token), 202);
    expect((await db.select().from(platform.notifications).where(eq(platform.notifications.userId, actors.sellerB!.id))).some((n) => n.title === "Il cliente chiede un chiarimento")).toBe(true);
    // Il collegamento all'account vale solo con l'email verificata del contatto.
    await createActor("intruder", "author");
    expect((await call("intruder", "crm/links/claim", "POST", { token })).status).toBe(403);
    await createActor("buyerq", "author");
    expect((await data(await call("buyerq", "crm/links/claim", "POST", { token }))).quoteId).toBe(customQuote);
    const first = await accept("buyerq", customQuote);
    const sheet = (await db.select().from(platform.contracts).where(eq(platform.contracts.id, first.contractId)))[0]!.orderSheet;
    expect(sheet.revisions).toBe("Due giri di revisione sul testo completo."); expect(sheet.excludes).toContain("Traduzione");
    // Modifica contrattuale dopo l'accettazione: nuova versione e nuova accettazione.
    await data(await call("sellerB", `crm/quotes/${customQuote}/amend`, "POST", { reason: "Il cliente chiede consegne in due tranche." }));
    expect((await call("buyerq", `quotes/${customQuote}/accept`, "POST", { tier: first.tier, version: first.detail.record.version, policyVersion: first.detail.paymentPolicy.version, termsAccepted: true, orderSheetAccepted: true })).status).toBe(409);
    const second = await accept("buyerq", customQuote, first.tier);
    expect(second.contractId).not.toBe(first.contractId);
    const [attribution] = await db.select().from(crm.crmAttributions).where(and(eq(crm.crmAttributions.quoteId, customQuote), eq(crm.crmAttributions.current, true)));
    expect(attribution).toMatchObject({ path: "custom_quote", creditedSellerId: actors.sellerB!.id, closing: "assisted", status: "final", sourcerId: actors.sellerB!.id });
    await db.insert(platform.billingProfiles).values({ userId: actors.buyerq!.id, name: "Quinto Quote", taxCode: "QNTQTO80A01H501U", street: "Via Prova 1", postcode: "00100", city: "Roma" });
    // Acconto verificato con eventi duplicati: un solo progetto, un solo passaggio, una sola provvigione.
    const paid = await pay("buyerq", customQuote, first.tier, "deposit", 3);
    const projectRows = await db.select().from(platform.projects).where(eq(platform.projects.quoteId, customQuote));
    expect(projectRows).toHaveLength(1); customProject = projectRows[0]!.id;
    expect(await db.select().from(crm.crmHandoffs).where(eq(crm.crmHandoffs.projectId, customProject))).toHaveLength(1);
    expect((await db.select().from(crm.crmEvents)).filter((e) => e.type === "project.handoff_ready" && e.entityId === customProject)).toHaveLength(1);
    const payouts = await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, paid.orderId));
    expect(payouts).toHaveLength(1); expect(payouts[0]!.beneficiaryId).toBe(actors.sellerB!.id);
    expect((await db.select().from(crm.crmDeals).where(eq(crm.crmDeals.id, customDeal)))[0]!.closedAt).not.toBeNull();
  });
  it("a followed client buys a standard package from the deal link without duplicating the product or exposing personal data", async () => {
    const link = await data(await call("sellerA", `crm/deals/${adsDeal}/package-link`, "POST", { catalogKey: "cover", validityDays: 5 }), 201);
    const token = link.url.split("/proposta/")[1];
    const { publicLinkView } = await import("@/lib/platform/crm-quotes");
    const view = await data(await publicLinkView(new Request(`${origin}/api/public/proposta/${token}`), token));
    expect(view.kind).toBe("package"); expect(link.url).not.toContain("@");
    expect(JSON.stringify(view)).not.toContain("ada.ads");
    expect((await call("sellerB", `crm/deals/${adsDeal}/package-link`, "POST", { catalogKey: "cover" })).status).toBe(404);
    await createActor("ada.ads", "author");
    const bought = await data(await call("ada.ads", "crm/links/purchase", "POST", { token }), 201);
    const again = await data(await call("ada.ads", "crm/links/purchase", "POST", { token }));
    expect(again.quoteId).toBe(bought.quoteId);
    const [record] = await db.select().from(platform.quoteRecords).where(eq(platform.quoteRecords.quoteId, bought.quoteId));
    expect(record!.dealId).toBe(adsDeal); expect(record!.originLinkId).toBe(link.id);
    const accepted = await accept("ada.ads", bought.quoteId);
    const [attribution] = await db.select().from(crm.crmAttributions).where(eq(crm.crmAttributions.quoteId, bought.quoteId));
    expect(attribution).toMatchObject({ path: "package_link", creditedSellerId: actors.sellerA!.id, closing: "assisted" });
    expect((attribution!.marketing as { first: { gclid?: string } }).first.gclid).toBe("test-gclid-1");
    const paid = await pay("ada.ads", bought.quoteId, accepted.tier);
    expect((await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, paid.orderId))).map((c) => c.beneficiaryId)).toEqual([actors.sellerA!.id]);
    // Il link revocato smette di funzionare.
    await data(await call("sellerA", `crm/links/${link.id}`, "DELETE"));
    await expect(publicLinkView(new Request(`${origin}/api/public/proposta/${token}`), token)).rejects.toMatchObject({ status: 410 });
  });
  it("credits a later purchase without a link only with verified identity and inside the relationship window", async () => {
    const saved = await publicQuote({ input: { ...proofreading, requestedServices: ["cover"], singleService: "cover" }, contatto: { nome: "Quinto Quote", email: "buyerq@example.test", consensoPrivacy: true, consensoMarketing: false } });
    expect(saved.commercialState).toBe("offer");
    const list = await data(await call("buyerq", "quotes"));
    expect(list.quotes.map((q: { id: string }) => q.id)).toContain(saved.quoteId);
    await accept("buyerq", saved.quoteId);
    const [attribution] = await db.select().from(crm.crmAttributions).where(eq(crm.crmAttributions.quoteId, saved.quoteId));
    expect(attribution!.path).toBe("later_purchase");
    expect(attribution!.creditedSellerId).toBe(actors.sellerB!.id);
    expect(attribution!.closing).toBe("autonomous");
    expect(attribution!.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(["relationship_window", "later_purchase"]));
  });
  it("flags two open deals with different owners instead of choosing, withholds the seller commission and accepts an authorized correction", async () => {
    const first = await data(await call("sellerA", "crm/deals", "POST", { contact: { name: "Zeno Zeta", email: "buyerz@example.test" }, title: "Saggio di Zeno", nextAction: "Inviare proposta", nextActionAt: new Date(Date.now() + 86400_000).toISOString() }), 201);
    // Un venditore non può rivendicare un cliente già seguito da un collega.
    expect((await call("sellerB", "crm/deals", "POST", { contactId: first.contactId, title: "Altro", nextAction: "Chiamare", nextActionAt: new Date(Date.now() + 86400_000).toISOString() })).status).toBe(409);
    await data(await call("admin", "crm/deals", "POST", { contactId: first.contactId, title: "Seconda trattativa", ownerId: actors.sellerB!.id, nextAction: "Chiamare", nextActionAt: new Date(Date.now() + 86400_000).toISOString() }), 201);
    const quote = await data(await call("sellerA", `leads/${first.leadId}/quotes`, "POST", { input: fullPath }), 201);
    await createActor("buyerz", "author");
    await data(await call("buyerz", "quotes"));
    const accepted = await accept("buyerz", quote.quote.id);
    const [conflict] = await db.select().from(crm.crmAttributions).where(eq(crm.crmAttributions.quoteId, quote.quote.id));
    expect(conflict).toMatchObject({ status: "conflict", creditedSellerId: null });
    expect(conflict!.conflicts[0]!.candidates.sort()).toEqual([actors.sellerA!.id, actors.sellerB!.id].sort());
    expect((await db.select().from(platform.notifications).where(eq(platform.notifications.userId, actors.owner!.id))).some((n) => n.title === "Attribuzione da decidere")).toBe(true);
    const paid = await pay("buyerz", quote.quote.id, accepted.tier);
    expect(await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, paid.orderId))).toHaveLength(0);
    expect((await call("sellerA", `crm/attributions/${quote.quote.id}`, "POST", { creditedSellerId: actors.sellerA!.id, closing: "assisted", reason: "Ha preparato e inviato la proposta." })).status).toBe(403);
    await data(await call("owner", `crm/attributions/${quote.quote.id}`, "POST", { creditedSellerId: actors.sellerA!.id, closing: "assisted", reason: "Ha preparato e inviato la proposta: decisione della direzione." }));
    const versions = await db.select().from(crm.crmAttributions).where(eq(crm.crmAttributions.quoteId, quote.quote.id));
    expect(versions).toHaveLength(2); expect(versions.filter((v) => v.current)).toHaveLength(1);
    const payouts = await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, paid.orderId));
    expect(payouts).toHaveLength(1); expect(payouts[0]).toMatchObject({ beneficiaryId: actors.sellerA!.id, eventKey: `commission:${paid.intent}:seller:v2` });
  });
  it("keeps Ads origin, affiliate and seller separate on the same sale, and reassignment never rewrites a past sale", async () => {
    await db.insert(platform.affiliateProfiles).values({ userId: actors.affiliate!.id, code: "affcode000000001", active: true });
    const saved = await publicQuote({ ref: "affcode000000001", input: { ...proofreading, wordCount: 30000 }, contatto: { nome: "Mira Mix", email: "mira.mix@example.test", consensoPrivacy: true, consensoMarketing: false }, attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: "inverno", gclid: "test-gclid-2" } });
    const leadId = await leadOfQuote(saved.quoteId);
    const seller = (await ownerOf(leadId))!;
    const sellerName = Object.keys(actors).find((k) => actors[k]!.id === seller)!;
    await data(await call(sellerName, `quotes/${saved.quoteId}/offer`, "POST", { validityDays: 10 }));
    await createActor("mira.mix", "author");
    await data(await call("mira.mix", "quotes"));
    const accepted = await accept("mira.mix", saved.quoteId);
    const [attribution] = await db.select().from(crm.crmAttributions).where(eq(crm.crmAttributions.quoteId, saved.quoteId));
    expect(attribution).toMatchObject({ creditedSellerId: seller, affiliateId: actors.affiliate!.id, closing: "assisted", beneficiaries: { seller, affiliate: actors.affiliate!.id } });
    expect((attribution!.marketing as { last: { gclid: string } }).last.gclid).toBe("test-gclid-2");
    const deposit = await pay("mira.mix", saved.quoteId, accepted.tier);
    const first = await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, deposit.orderId));
    expect(first.map((c) => c.beneficiaryId).sort()).toEqual([seller, actors.affiliate!.id].sort());
    // Riassegnazione dopo la vendita: l'istantanea e le provvigioni restano.
    const dealId = (await leadRow(leadId)).dealId!;
    const other = seller === actors.sellerA!.id ? actors.sellerB!.id : actors.sellerA!.id;
    await data(await call("admin", `crm/deals/${dealId}`, "PATCH", { ownerId: other, reason: "Riorganizzazione del portafoglio" }));
    const balance = await pay("mira.mix", saved.quoteId, accepted.tier, "balance");
    const later = await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, balance.orderId));
    expect(later.map((c) => c.beneficiaryId).sort()).toEqual([seller, actors.affiliate!.id].sort());
    expect((await db.select().from(crm.crmAttributions).where(eq(crm.crmAttributions.quoteId, saved.quoteId)))).toHaveLength(1);
    const summary = await data(await call("finance", "crm/commissions/summary"));
    expect(summary.people[seller].accruedCents).toBeGreaterThan(0);
  });
});

describe("handoff to production, operators and boards", () => {
  it("hands off with missing materials, separates promises and extras, and the seller answers questions", async () => {
    const seller = await data(await call("sellerB", `crm/handoffs/${customProject}`));
    expect(seller.missing).toContain("materials"); expect(seller.opsStatus).toBe("waiting_materials"); expect(seller.package.client).toBeUndefined();
    expect(seller.conditions).toEqual({ contractAccepted: true, orderConfirmed: true, depositVerified: true, billingProfile: true });
    await data(await call("sellerB", `crm/handoffs/${customProject}/items`, "POST", { kind: "promise", body: "Consegna entro Natale" }), 201);
    await data(await call("sellerB", `crm/handoffs/${customProject}/items`, "POST", { kind: "extra_request", body: "Vorrebbe anche la quarta di copertina" }), 201);
    expect((await call("sellerA", `crm/handoffs/${customProject}`)).status).toBe(404);
    await data(await call("owner", `crm/projects/${customProject}/ops`, "PATCH", { opsLeadId: actors.coord!.id }));
    const ops = await data(await call("coord", `crm/handoffs/${customProject}`));
    expect(ops.package.client.email).toBe("buyerq@example.test");
    expect(ops.inconsistencies.map((i: { code: string }) => i.code)).toEqual(expect.arrayContaining(["unapproved_promise", "extra_outside_contract"]));
    expect((await call("coord", `crm/handoffs/${customProject}/accept`, "POST", {})).status).toBe(409);
    const question = await data(await call("coord", `crm/handoffs/${customProject}/items`, "POST", { kind: "question", body: "La quarta è inclusa o va preventivata?" }), 201);
    expect((await db.select().from(platform.notifications).where(eq(platform.notifications.userId, actors.sellerB!.id))).some((n) => n.title === "Domanda della produzione")).toBe(true);
    await data(await call("sellerB", `crm/handoffs/${customProject}/items`, "POST", { kind: "answer", parentId: question.item.id, body: "Non inclusa: va preventivata a parte." }), 201);
    const promise = (await db.select().from(crm.crmHandoffItems).where(and(eq(crm.crmHandoffItems.projectId, customProject), eq(crm.crmHandoffItems.kind, "promise"))))[0]!;
    await data(await call("coord", `crm/handoff-items/${promise.id}/decide`, "POST", { decision: "rejected" }));
    expect((await call("coord", `crm/projects/${customProject}/ops`, "PATCH", { opsStatus: "ready_for_assignment" })).status).toBe(409);
    await data(await upload("buyerq", customProject, "manoscritto.txt"), 201);
    const after = await data(await call("coord", `crm/handoffs/${customProject}`));
    expect(after.opsStatus).toBe("ready_for_assignment"); expect(after.missing).not.toContain("materials");
    expect(after.package.questions[0].answers).toHaveLength(1);
    await data(await call("coord", `crm/handoffs/${customProject}/accept`, "POST", {}));
  });
  it("suggests and assigns operators by skills and load, opens materials only on assignment, keeps QA separate and enforces dependencies", async () => {
    await data(await call("owner", `crm/team/${actors.editorA!.id}/profile`, "PUT", { skills: ["editing"], capacity: 3 }));
    await data(await call("owner", `crm/team/${actors.editorB!.id}/profile`, "PUT", { skills: ["editing", "proofreading"], capacity: 4 }));
    const phases = await data(await call("coord", `crm/projects/${customProject}/phases`, "POST", { queue: true, phases: [{ phase: "editing", skill: "editing", title: "Editing del romanzo" }, { phase: "proofreading", skill: "proofreading", title: "Correzione bozze", dependsOn: 0 }, { phase: "qa", skill: "qa", title: "Controllo qualità finale", dependsOn: 1 }] }), 201);
    const [editing, proof, qa] = phases.taskIds as string[];
    const extra = await data(await call("coord", `crm/projects/${customProject}/phases`, "POST", { phases: [{ phase: "notes", skill: "editing", title: "Schede di lavoro" }] }), 201);
    await data(await call("coord", `crm/tasks/${extra.taskIds[0]}/assign`, "POST", { userId: actors.editorB!.id, confirm: true }));
    const suggestions = await data(await call("coord", `crm/projects/${customProject}/suggestions?skill=editing`));
    expect(suggestions.suggestions[0].userId).toBe(actors.editorA!.id);
    const proofSuggestions = await data(await call("coord", `crm/projects/${customProject}/suggestions?skill=proofreading`));
    expect(proofSuggestions.suggestions.map((s: { userId: string }) => s.userId)).toEqual([actors.editorB!.id]);
    const file = (await db.select().from(platform.projectFiles).where(eq(platform.projectFiles.projectId, customProject)))[0]!;
    expect((await call("editorA", `files/${file.id}/download`)).status).toBe(404);
    await data(await call("coord", `crm/tasks/${editing}/assign`, "POST", { userId: actors.editorA!.id, confirm: true }));
    expect((await call("editorA", `files/${file.id}/download`)).status).toBe(200);
    // Coda delle fasi standard: competenza richiesta e presa in carico atomica.
    const queue = await data(await call("editorB", "crm/tasks/queue"));
    expect(JSON.stringify(queue)).not.toContain("buyerq"); expect(queue.items.map((i: { id: string }) => i.id)).toContain(proof);
    expect((await call("editorA", `crm/tasks/${proof}/claim`, "POST", {})).status).toBe(409);
    const claims = await Promise.all([call("editorB", `crm/tasks/${proof}/claim`, "POST", {}), call("editorB", `crm/tasks/${proof}/claim`, "POST", {})]);
    expect(claims.map((c) => c.status).sort()).toEqual([200, 409]);
    expect((await call("coord", `crm/tasks/${qa}/assign`, "POST", { userId: actors.editorA!.id, confirm: true })).status).toBe(409);
    await data(await call("coord", `crm/tasks/${qa}/assign`, "POST", { userId: actors.coord!.id, confirm: true }));
    expect((await call("editorB", `crm/work/task/${proof}`, "PATCH", { to: "in_progress" })).status).toBe(409);
    await data(await call("editorA", `crm/work/task/${editing}`, "PATCH", { to: "in_progress" }));
    expect((await db.select().from(platform.projects).where(eq(platform.projects.id, customProject)))[0]!.opsStatus).toBe("in_progress");
    await data(await call("editorA", `crm/work/task/${editing}`, "PATCH", { to: "done" }));
    await data(await call("editorB", `crm/work/task/${proof}`, "PATCH", { to: "in_progress" }));
    expect((await call("coord", `crm/projects/${customProject}/ops`, "PATCH", { qaOwnerId: actors.editorA!.id })).status).toBe(409);
    await data(await call("coord", `crm/work/project/${customProject}`, "PATCH", { to: "quality_check" }));
    const board = await data(await call("editorB", "crm/work"));
    expect(board.items.some((i: { id: string; status: string }) => i.id === proof && i.status === "in_progress")).toBe(true);
  });
  it("shows each person a single work board with list, Kanban moves that change real records and a morning summary", async () => {
    const board = await data(await call("sellerA", "crm/work"));
    const deal = board.items.find((i: { type: string }) => i.type === "deal");
    expect(deal).toMatchObject({ ownerId: actors.sellerA!.id, movable: true }); expect(deal.href).toContain(deal.id);
    expect(board.items.every((i: { ownerId: string | null; status: string; priority: string; source: object }) => i.status && i.priority && i.source)).toBe(true);
    const target = (await data(await call("sellerA", "crm/deals?status=open"))).deals.find((d: { stage: string; contact: string }) => d.contact === "Zeno Zeta" ? false : d.stage === "received");
    if (target) {
      await data(await call("sellerA", `crm/work/deal/${target.id}`, "PATCH", { to: "negotiation" }));
      expect((await db.select().from(crm.crmDeals).where(eq(crm.crmDeals.id, target.id)))[0]!.stage).toBe("negotiation");
      expect((await call("sellerA", `crm/work/deal/${target.id}`, "PATCH", { to: "won" })).status).toBe(409);
      expect((await call("sellerA", `crm/work/deal/${target.id}`, "PATCH", { to: "lost" })).status).toBe(422);
      expect((await call("sellerA", `crm/deals/${target.id}`, "PATCH", { nextAction: null })).status).toBe(422);
    }
    await data(await call("sellerA", "crm/work", "POST", { title: "Preparare le note per la call", dueAt: new Date(Date.now() + 3600_000).toISOString(), priority: "high" }), 201);
    const calendar = await data(await call("sellerA", "crm/work?view=calendar"));
    expect(Object.values(calendar.days).flat().length).toBeGreaterThan(0);
    const summary = await data(await call("sellerA", "crm/work/summary"));
    expect(summary.summary.total).toBeGreaterThan(0);
    const { runMorningSummaries } = await import("@/lib/platform/crm-work");
    const morning = new Date(); morning.setUTCHours(8, 30, 0, 0);
    expect((await runMorningSummaries(morning)).sent).toBeGreaterThan(0);
    expect((await runMorningSummaries(morning)).sent).toBe(0);
  });
});

describe("configuration, integrations and boundaries", () => {
  it("captures leads through a scoped API key with idempotency, rate limits and a public form key limited to its origins", async () => {
    const { apiV1: raw } = await import("@/lib/platform/crm-api");
    const { route } = await import("@/lib/platform/http");
    const apiV1 = route(raw);
    const server = await data(await call("owner", "crm/api-keys", "POST", { name: "Sito partner", scopes: ["leads:write", "leads:read"], ratePerMinute: 30 }), 201);
    const form = await data(await call("owner", "crm/api-keys", "POST", { name: "Modulo landing", kind: "form", allowedOrigins: ["https://landing.example.test"] }), 201);
    expect((await data(await call("owner", "crm/api-keys"))).keys.some((k: { keyHash?: string }) => "keyHash" in k)).toBe(false);
    const body = { name: "Api Person", email: "api.person@example.test", consentPrivacy: true, source: { kind: "partner", detail: "Partner test" } };
    const post = (key: string, payload: unknown, idem: string, extra: Record<string, string> = {}) => apiV1(new Request(`${origin}/api/v1/leads`, { method: "POST", headers: { authorization: `Bearer ${key}`, "idempotency-key": idem, "content-type": "application/json", ...extra }, body: JSON.stringify(payload) }));
    const first = await data(await post(server.key, body, "idem-key-0001"), 201);
    const repeat = await data(await post(server.key, body, "idem-key-0001"), 200);
    expect(repeat.leadId).toBe(first.leadId);
    expect((await post(server.key, { ...body, name: "Altro nome" }, "idem-key-0001")).status).toBe(409);
    expect((await db.select().from(schema.leads).where(eq(schema.leads.email, "api.person@example.test")))).toHaveLength(1);
    expect((await apiV1(new Request(`${origin}/api/v1/deals`, { headers: { authorization: `Bearer ${server.key}` } }))).status).toBe(403);
    const formPost = (o: string) => apiV1(new Request(`${origin}/api/v1/leads`, { method: "POST", headers: { "x-proemios-form-key": form.key, origin: o, "idempotency-key": randomUUID(), "content-type": "application/json" }, body: JSON.stringify({ ...body, email: "form.person@example.test" }) }));
    expect((await formPost("https://evil.example.test")).status).toBe(403);
    expect((await formPost("https://landing.example.test")).status).toBe(201);
    expect((await apiV1(new Request(`${origin}/api/v1/events`, { headers: { authorization: `Bearer ${form.key}` } }))).status).toBe(403);
    await data(await call("owner", `crm/api-keys/${server.id}`, "DELETE"));
    expect((await post(server.key, body, "idem-key-0002")).status).toBe(401);
    expect((await apiV1(new Request(`${origin}/api/v1/openapi.json`))).status).toBe(200);
  });
  it("delivers signed webhooks with stable event ids, retries failures and never duplicates a delivery", async () => {
    const created = await data(await call("owner", "crm/webhooks", "POST", { url: "https://hooks.example.test/crm", events: ["lead.created", "lead.assigned"] }), 201);
    expect((await call("owner", "crm/webhooks", "POST", { url: "http://127.0.0.1/crm", events: ["lead.created"] })).status).toBe(422);
    await publicQuote({ input: fullPath, contatto: { nome: "Hook Person", email: "hook.person@example.test", consensoPrivacy: true, consensoMarketing: false } });
    const { deliverWebhooks, fanOutEvents } = await import("@/lib/platform/crm-api");
    const seen: Array<{ id: string; signature: string; body: string }> = [];
    let fail = true;
    const fetcher = (async (_url: string, init: RequestInit) => { const h = init.headers as Record<string, string>; seen.push({ id: h["proemios-event-id"]!, signature: h["proemios-signature"]!, body: String(init.body) }); return new Response(null, { status: fail ? 500 : 204 }); }) as unknown as typeof fetch;
    const firstRun = await deliverWebhooks(10, fetcher);
    expect(firstRun.failed).toBe(2);
    await db.update(crm.webhookDeliveries).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(crm.webhookDeliveries.endpointId, created.id));
    fail = false;
    expect((await deliverWebhooks(10, fetcher)).delivered).toBe(2);
    expect(await fanOutEvents()).toBe(0);
    const ids = seen.map((s) => s.id);
    expect(new Set(ids).size).toBe(2); expect(ids).toHaveLength(4);
    for (const s of seen) expect(verifySignature(created.secret, s.body, s.signature)).toBe(true);
    expect(seen.every((s) => !s.body.includes("hook.person@example.test"))).toBe(true);
  });
  it("adds two sellers, two marketing users and one operator from role templates without granting more than the inviter holds", async () => {
    const templates = await data(await call("owner", "crm/team/templates"));
    expect(templates.templates.map((t: { key: string }) => t.key)).toEqual(expect.arrayContaining(["seller", "marketing", "operator", "admin_marketing", "admin_team"]));
    const invited: string[] = [];
    for (const [template, name, profile] of [["seller", "newsellerone", { languages: ["it"], skills: ["editing"], capacity: 15, maxDiscountBps: 500 }], ["seller", "newsellertwo", { languages: ["it", "en"] }], ["marketing", "newmarketone", {}], ["admin_marketing", "newmarkettwo", {}], ["operator", "newoperator", { skills: ["layout"], capacity: 5 }]] as const) {
      await createActor(name, "author");
      const invitation = await data(await call("owner", "crm/team/invite", "POST", { template, email: actors[name]!.email, profile }), 201);
      const token = new URL(await mailLink(`invitation:${invitation.id}`)).searchParams.get("token");
      await data(await call(name, "invite-accept", "POST", { token }));
      invited.push(name);
    }
    const roles = await db.select().from(platform.memberships);
    expect(roles.filter((m) => m.userId === actors.newsellerone!.id && m.role === "seller")).toHaveLength(1);
    expect(roles.find((m) => m.userId === actors.newmarkettwo!.id && m.role === "admin")!.grants!.some((g) => g.permission === "marketing.read")).toBe(true);
    expect(roles.find((m) => m.userId === actors.newmarkettwo!.id && m.role === "admin")!.grants!.some((g) => g.permission === "role.manage" || g.permission === "finance.read")).toBe(false);
    expect((await db.select().from(crm.teamProfiles).where(eq(crm.teamProfiles.userId, actors.newsellerone!.id)))[0]).toMatchObject({ team: "vendite", maxDiscountBps: 500, capacity: 15, participates: true });
    expect((await db.select().from(crm.teamProfiles).where(eq(crm.teamProfiles.userId, actors.newoperator!.id)))[0]).toMatchObject({ team: "produzione", skills: ["layout"] });
    // Un admin di gestione team non concede la gestione delle chiavi o della finanza che non ha.
    await createActor("teamadmin", "admin", [...["invite.manage", "role.manage", "crm.read", "crm.assign"].map((p) => ({ permission: p as "crm.read", scope: "organization" as const }))]);
    expect((await call("teamadmin", "crm/team/invite", "POST", { template: "admin_marketing", email: "x@example.test" })).status).toBe(403);
    expect((await call("sellerA", "crm/team/invite", "POST", { template: "seller", email: "y@example.test" })).status).toBe(403);
  });
  it("deactivates a seller without losing history: access revoked, open work reassigned, past sales untouched", async () => {
    const deal = await data(await call("admin", "crm/deals", "POST", { contact: { name: "Walter W", email: "walter@example.test" }, title: "Memoir di Walter", ownerId: actors.sellerC!.id, nextAction: "Prima call", nextActionAt: new Date(Date.now() + 86400_000).toISOString() }), 201);
    const before = await db.select().from(crm.crmAttributions);
    expect((await call("sellerC", "crm/deals")).status).toBe(200);
    expect((await call("teamadmin", `crm/team/${actors.owner!.id}/deactivate`, "POST", { reason: "prova fuori ambito" })).status).toBe(403);
    const result = await data(await call("owner", `crm/team/${actors.sellerC!.id}/deactivate`, "POST", { reason: "Fine collaborazione", reassignTo: actors.sellerA!.id }));
    expect(result.deals).toBeGreaterThanOrEqual(1);
    expect((await call("sellerC", "crm/deals")).status).toBe(401);
    expect((await db.select().from(crm.crmDeals).where(eq(crm.crmDeals.id, deal.deal.id)))[0]!.ownerId).toBe(actors.sellerA!.id);
    expect((await db.select().from(crm.crmAssignments).where(eq(crm.crmAssignments.entityId, deal.deal.id))).some((a) => a.method === "deactivation" && a.fromUser === actors.sellerC!.id)).toBe(true);
    expect(await db.select().from(crm.crmAttributions)).toEqual(before);
    expect((await db.select().from(identity.user).where(eq(identity.user.id, actors.sellerC!.id)))).toHaveLength(1);
    const { salesCandidates } = await import("@/lib/platform/crm-routing");
    expect((await salesCandidates(db as never)).find((c) => c.userId === actors.sellerC!.id)?.active ?? false).toBe(false);
  });
  it("refuses out-of-scope access: other sellers' records, private notes, merges on name only, settings and modules of other roles", async () => {
    expect((await call("sellerB", `crm/deals/${adsDeal}`)).status).toBe(404);
    expect((await call("sellerB", `crm/contacts/${adsContact}`)).status).toBe(404);
    expect((await data(await call("sellerB", "crm/contacts"))).contacts.some((c: { id: string }) => c.id === adsContact)).toBe(false);
    await data(await call("sellerA", `leads/${adsLead}/notes`, "POST", { body: "Nota riservata del venditore", visibility: "private" }), 201);
    expect(JSON.stringify(await data(await call("admin", `leads/${adsLead}`)))).not.toContain("Nota riservata del venditore");
    expect(JSON.stringify(await data(await call("owner", `crm/contacts/${adsContact}`)))).not.toContain("Nota riservata del venditore");
    expect(JSON.stringify(await data(await call("sellerA", `crm/contacts/${adsContact}`)))).toContain("Nota riservata del venditore");
    for (const [who, path] of [["marketing", "crm/contacts"], ["editorA", "crm/deals"], ["affiliate", "crm/pool"], ["finance", "crm/contacts"]] as const) expect((await call(who, path)).status, `${who} ${path}`).toBe(403);
    expect((await call("sellerA", "crm/settings", "PUT", { key: "assignment-rules", value: rules() })).status).toBe(403);
    expect((await call("sellerA", "crm/api-keys")).status).toBe(403);
    // Duplicati: il telefono in comune rende unibili, il solo nome no.
    const a = await data(await call("sellerA", "crm/deals", "POST", { contact: { name: "Gemma Doppia", email: "gemma.one@example.test", phone: "333 7770001" }, title: "Trattativa uno", nextAction: "Call", nextActionAt: new Date(Date.now() + 86400_000).toISOString() }), 201);
    const b = await data(await call("admin", "crm/deals", "POST", { contact: { name: "G. Doppia", email: "gemma.two@example.test", phone: "+39 333 7770001" }, ownerId: actors.sellerA!.id, title: "Trattativa due", nextAction: "Call", nextActionAt: new Date(Date.now() + 86400_000).toISOString() }), 201);
    const c = await data(await call("admin", "crm/deals", "POST", { contact: { name: "Gemma Doppia", email: "gemma.three@example.test" }, ownerId: actors.sellerA!.id, title: "Trattativa tre", nextAction: "Call", nextActionAt: new Date(Date.now() + 86400_000).toISOString() }), 201);
    const dups = (await data(await call("sellerA", `crm/contacts/${a.contactId}`))).duplicates;
    expect(dups.find((d: { b: string }) => d.b === b.contactId)).toMatchObject({ reasons: ["phone"], mergeable: true });
    expect(dups.find((d: { b: string }) => d.b === c.contactId)).toMatchObject({ reasons: ["name_only"], mergeable: false });
    expect((await call("sellerA", `crm/contacts/${a.contactId}/merge`, "POST", { sourceId: b.contactId, reason: "stesso telefono" })).status).toBe(403);
    expect((await call("owner", `crm/contacts/${a.contactId}/merge`, "POST", { sourceId: c.contactId, reason: "sembra la stessa persona" })).status).toBe(409);
    const merged = await data(await call("owner", `crm/contacts/${a.contactId}/merge`, "POST", { sourceId: b.contactId, reason: "Stesso numero di telefono confermato al telefono" }));
    expect(merged.matchedOn).toEqual(["phone"]); expect(merged.moved.deals).toBe(1);
    expect((await db.select().from(crm.crmContacts).where(eq(crm.crmContacts.id, b.contactId)))[0]!.mergedIntoId).toBe(a.contactId);
    expect(await db.select().from(crm.crmMerges)).toHaveLength(1);
  });
  it("validates custom fields, saves views, renders templates as drafts, links support to projects and reports without opaque scores", async () => {
    await data(await call("owner", "crm/fields", "POST", { entity: "deal", key: "genere", label: "Genere", type: "select", options: ["giallo", "saggio"] }), 201);
    expect((await call("sellerA", `crm/deals/${adsDeal}`, "PATCH", { custom: { genere: "horror" } })).status).toBe(422);
    await data(await call("sellerA", `crm/deals/${adsDeal}`, "PATCH", { custom: { genere: "giallo" } }));
    await data(await call("sellerA", "crm/views", "POST", { entity: "deals", name: "Miei in ritardo", filters: { owner: "me", overdue: "1" }, layout: "kanban" }), 201);
    expect((await data(await call("sellerA", "crm/views"))).views).toHaveLength(1);
    expect((await data(await call("sellerB", "crm/views"))).views).toHaveLength(0);
    const template = await data(await call("owner", "crm/templates", "POST", { kind: "email", key: "primo-contatto", name: "Primo contatto", subject: "Ciao {{nome}}", body: "Sono {{responsabile}} di {{marchio}}." }), 201);
    const draft = await data(await call("sellerA", `crm/templates/${template.template.id}/render`, "POST", { leadId: adsLead }));
    expect(draft).toMatchObject({ sent: false, draft: { subject: "Ciao Ada" } });
    const support = await data(await call("buyerq", "crm/support", "POST", { subject: "Domanda sui tempi", body: "Quando arriva la prima bozza?", projectId: customProject }), 201);
    expect((await call("buyerz", "crm/support", "POST", { subject: "Altro", body: "Progetto non mio", projectId: customProject })).status).toBe(404);
    const timeline = await data(await call("owner", `crm/contacts/${(await leadRow(customLead)).contactId}`));
    expect(timeline.timeline.some((t: { kind: string }) => t.kind === "support")).toBe(true);
    expect(timeline.timeline.map((t: { kind: string }) => t.kind)).toEqual(expect.arrayContaining(["origin", "assignment", "quote", "quote_accepted", "contract", "payment", "project", "handoff"]));
    await data(await call("coord", `crm/support/${support.request.id}`, "PATCH", { status: "resolved" }));
    const report = await data(await call("owner", "crm/reports"));
    expect(report.responseTimes.requests).toBeGreaterThan(0);
    expect(report.conversion.bySource.campaign.leads).toBeGreaterThan(0);
    expect(report.load.sales.length).toBeGreaterThan(0);
    expect((await call("sellerA", "crm/reports")).status).toBe(403);
  });
});
