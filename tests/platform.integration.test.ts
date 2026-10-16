import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, access, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URI } from "otpauth";
import * as schema from "@/db/schema";
import * as identity from "@/db/auth-schema";
import * as platform from "@/db/platform-schema";
import { ROLE_GRANTS, type Role } from "@/lib/platform/permissions";
import type Stripe from "stripe";
const shared = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => shared.db, dbConfigurato: () => true }));
const origin = "http://localhost:3199";
let database: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let directory: string;
let auth: ReturnType<typeof import("@/lib/auth")["getAuth"]>;
let handler: typeof import("@/app/api/platform/[...path]/route")["GET"];
const actors: Record<string, { id: string; cookie: string; email: string }> = {};
const secrets = new Map<string, string>();
const password = `Test-only-${randomBytes(16).toString("hex")}`;
function cookies(response: Response, previous = "") {
  const values = new Map(previous.split("; ").filter(Boolean).map(v => { const i = v.indexOf("="); return [v.slice(0, i), v.slice(i+1)] as [string,string]; }));
  for (const item of response.headers.getSetCookie()) { const pair = item.split(";")[0]!, i = pair.indexOf("="); values.set(pair.slice(0,i), pair.slice(i+1)); }
  return [...values].map(([k,v]) => `${k}=${v}`).join("; ");
}
let requestNumber = 0;
async function authRequest(path: string, body: unknown, cookie = "") {
  return auth.handler(new Request(`${origin}/api/auth/${path}`, { method: "POST", headers: { origin, cookie, "x-forwarded-for": `192.0.2.${++requestNumber}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
}
async function call(actor: string | null, path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return handler(new Request(`${origin}/api/platform/${path}`, { method, headers: { origin, cookie: actor ? actors[actor]!.cookie : "", "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}
async function data(response: Response, expected = 200) { expect(response.status, await response.clone().text()).toBe(expected); return response.json(); }
async function createActor(name: string, role: Role, verified = true) {
  const email = `${name}@example.test`;
  const registration = await authRequest("sign-up/email", { name, email, password, privacyAccepted: true, role: "owner" });
  const result = await data(registration);
  const id = result.user.id;
  if (verified) await db.update(identity.user).set({ emailVerified: true }).where(eq(identity.user.id, id));
  if (role !== "author") await db.insert(platform.memberships).values({ userId: id, role, grants: role === "admin" ? ROLE_GRANTS.admin : null });
  const login = await authRequest("sign-in/email", { email, password });
  actors[name] = { id, email, cookie: cookies(login) };
  if (verified) expect(login.status, await login.clone().text()).toBe(200);
  if (role !== "author" && verified) {
    const enable = await authRequest("two-factor/enable", { password, method: "totp" }, actors[name]!.cookie);
    const result = await data(enable); secrets.set(name, result.totpURI);
    const verify = await authRequest("two-factor/verify-totp", { code: URI.parse(result.totpURI).generate(), trustDevice: false }, actors[name]!.cookie);
    await data(verify); actors[name]!.cookie = cookies(verify, actors[name]!.cookie);
  }
  return actors[name]!;
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "proemios-isolated-"));
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
  for (const name of (await readdir("drizzle")).filter(n => n.endsWith(".sql")).sort()) await database.exec(await readFile(join("drizzle", name), "utf8"));
  db = drizzle(database, { schema }); shared.db = db;
  auth = (await import("@/lib/auth")).getAuth();
  handler = (await import("@/app/api/platform/[...path]/route")).GET;
  for (const [name, role] of Object.entries({ authorA: "author", authorB: "author", editorA: "editor", editorB: "editor", sellerA: "seller", sellerB: "seller", affiliateA: "affiliate", affiliateB: "affiliate", finance: "finance", admin: "admin", owner: "author" }) as Array<[string,Role]>) await createActor(name, role);
  // Bootstrap is bound to the verified configured identity, then blocked until TOTP.
  const initial = await call("owner", "me"); expect(initial.status).toBe(200);
  expect((await initial.json()).user.roles).toContain("owner");
  expect((await call("owner", "team")).status).toBe(428);
  const ownerCookie = actors.owner!.cookie;
  const enable = await data(await authRequest("two-factor/enable", { password, method: "totp" }, ownerCookie));
  secrets.set("owner", enable.totpURI);
  const verify = await authRequest("two-factor/verify-totp", { code: URI.parse(enable.totpURI).generate(), trustDevice: false }, ownerCookie);
  await data(verify); actors.owner!.cookie = cookies(verify, ownerCookie);
  await writeFile(join(directory, "owner-fixture-cookie"), actors.owner!.cookie, { mode: 0o600 });
}, 120000);
afterAll(async () => { if (database) await database.close(); });

describe("real auth and isolated Postgres boundaries", () => {
  it("signup cannot select a staff role, unverified identities cannot sign in", async () => {
    const user = await createActor("unverified", "author", false);
    const memberships = await db.select().from(platform.memberships).where(eq(platform.memberships.userId, user.id));
    expect(memberships.map(m => m.role)).toEqual(["author"]);
    expect((await authRequest("sign-in/email", { email: user.email, password })).status).toBe(403);
  });
  it("enforces MFA challenges and forbids staff disabling TOTP", async () => {
    const login = await authRequest("sign-in/email", { email: actors.editorA!.email, password });
    expect(await login.json()).toMatchObject({ twoFactorRedirect: true });
    const challengeCookie = cookies(login);
    expect((await handler(new Request(`${origin}/api/platform/projects`, { headers: { cookie: challengeCookie } }))).status).toBe(401);
    const disable = await authRequest("two-factor/disable", { password }, actors.editorA!.cookie);
    expect(disable.status).toBe(403);
  });
  it("rejects missing sessions, cross-site modifications and mass assignment", async () => {
    expect((await call(null, "projects")).status).toBe(401);
    expect((await handler(new Request(`${origin}/api/platform/projects`, { method: "POST", headers: { origin: "https://attacker.example", cookie: actors.authorA!.cookie }, body: JSON.stringify({ title: "Unwanted" }) }))).status).toBe(403);
    expect((await call("authorA", "projects", "POST", { title: "Book", authorId: actors.authorB!.id })).status).toBe(403);
    expect((await call("authorA", "projects", "POST", { title: "Book", role: "owner" })).status).toBe(422);
  });
});

let projectA: string, projectB: string, delivery: string;
describe("editorial resource isolation, files and approvals", () => {
  it("persists separate projects and limits lists, reads and edits", async () => {
    projectA = (await data(await call("authorA", "projects", "POST", { title: "Synthetic book A" }), 201)).project.id;
    projectB = (await data(await call("authorB", "projects", "POST", { title: "Synthetic book B" }), 201)).project.id;
    await data(await call("owner", `projects/${projectA}/members`, "POST", { userId: actors.editorA!.id }));
    await data(await call("owner", `projects/${projectB}/members`, "POST", { userId: actors.editorB!.id }));
    for (const role of ["authorB", "editorB", "sellerA", "affiliateA", "finance"]) expect((await call(role, `projects/${projectA}`)).status).toBe(404);
    expect((await data(await call("authorA", "projects"))).projects.map((p: {id:string}) => p.id)).toEqual([projectA]);
    await data(await call("editorA", `projects/${projectA}`, "PATCH", { title: "Edited A" }));
    expect((await call("editorB", `projects/${projectA}`, "PATCH", { title: "Unauthorized" })).status).toBe(404);
  });
  it("separates internal messages and persists read markers", async () => {
    const internal = await data(await call("editorA", `projects/${projectA}/messages`, "POST", { body: "Internal QA note", internal: true }), 201);
    const visible = await data(await call("editorA", `projects/${projectA}/messages`, "POST", { body: "Shared message", internal: false }), 201);
    const list = (await data(await call("authorA", `projects/${projectA}/messages`))).messages;
    expect(list.map((m: {id:string})=>m.id)).toEqual([visible.message.id]);
    expect((await call("authorA", `projects/${projectA}/messages`, "PATCH", { messageId: internal.message.id })).status).toBe(404);
    await data(await call("authorA", `projects/${projectA}/messages`, "PATCH", { messageId: visible.message.id }));
    expect((await data(await call("authorA", `projects/${projectA}/messages`))).messages[0].read).toBe(true);
  });
  async function upload(name: string, actor: string, project: string, kind = "delivery", text = "Synthetic plain text") {
    const form = new FormData(); form.set("kind", kind); form.set("file", new File([text], name));
    return handler(new Request(`${origin}/api/platform/projects/${project}/files`, { method: "POST", headers: { origin, cookie: actors[actor]!.cookie }, body: form }));
  }
  it("rejects forbidden formats, author deliveries and unauthorized downloads", async () => {
    expect((await upload("bad.exe", "editorA", projectA)).status).toBe(422);
    expect((await upload("delivery.txt", "authorA", projectA)).status).toBe(403);
    const response = await data(await upload("delivery.txt", "editorA", projectA), 201);
    delivery = response.file.id;
    expect(response.file).not.toHaveProperty("storageKey");
    const download = await call("authorA", `files/${delivery}/download`);
    expect(download.status).toBe(200); expect(download.headers.get("cache-control")).toContain("no-store");
    expect(await download.text()).toBe("Synthetic plain text");
    expect((await call("authorB", `files/${delivery}/download`)).status).toBe(404);
  });
  it("approval binds a version; a new revision requires a fresh approval", async () => {
    await data(await call("authorA", `files/${delivery}/approval`, "POST", { decision: "approved" }));
    const revision = await data(await upload("delivery.txt", "editorA", projectA, "delivery", "Second revision"), 201);
    expect(revision.file.version).toBe(2);
    expect((await call("authorA", `files/${delivery}/approval`, "POST", { decision: "approved" })).status).toBe(409);
    expect((await data(await call("authorA", `projects/${projectA}`))).project.stage).toBe("review");
    await data(await call("authorA", `files/${revision.file.id}/approval`, "POST", { decision: "approved" }));
    expect((await data(await call("authorA", `projects/${projectA}`))).project.stage).toBe("approved");
  });
});

let leadId: string, quoteId: string;
const priceInput = { projectType: "romanzo", textState: "finito-da-revisionare", wordCount: 50000, requestedServices: ["proofreading", "proofreading"], urgency: "standard" };
describe("CRM, immutable pricing, secure claims and PDF", () => {
  it("seller creates a persistent lead and cannot see another seller's data", async () => {
    leadId = (await data(await call("sellerA", "leads", "POST", { nome: "Synthetic author", email: actors.authorA!.email }), 201)).lead.id;
    expect((await call("sellerB", `leads/${leadId}`)).status).toBe(404);
    expect((await data(await call("sellerB", "leads"))).leads).toHaveLength(0);
    expect((await call("sellerA", `leads/${leadId}`, "PATCH", { assignedTo: actors.sellerB!.id })).status).toBe(403);
    await data(await call("sellerA", `leads/${leadId}/notes`, "POST", { body: "Follow up with synthetic author" }), 201);
  });
  it("rejects browser prices, stores price versions, scopes PDF and denies finance manuscripts", async () => {
    expect((await call("sellerA", `leads/${leadId}/quotes`, "POST", { input: priceInput, total: 1 })).status).toBe(422);
    quoteId = (await data(await call("sellerA", `leads/${leadId}/quotes`, "POST", { input: priceInput }), 201)).quote.id;
    const pdf = await call("sellerA", `quotes/${quoteId}/pdf`); expect(pdf.status).toBe(200);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString()).toBe("%PDF");
    expect((await call("sellerB", `quotes/${quoteId}/pdf`)).status).toBe(404);
    expect((await call("finance", `files/${delivery}/download`)).status).toBe(404);
    await data(await call("sellerA", `quotes/${quoteId}`, "PATCH", { version: 1, input: { ...priceInput, wordCount: 60000 } }));
    expect((await call("sellerA", `quotes/${quoteId}`, "PATCH", { version: 1, input: priceInput })).status).toBe(409);
    expect((await db.select().from(platform.quoteVersions).where(eq(platform.quoteVersions.quoteId, quoteId))).map(v => v.version)).toEqual([1]);
  });
  it("claims require verified identity and a single-use token, not an email match", async () => {
    expect((await call("authorA", `quotes/${quoteId}`)).status).toBe(404);
    const { hashToken } = await import("@/lib/platform/http");
    const token = randomBytes(32).toString("base64url");
    await db.insert(platform.quoteClaims).values({ quoteId, email: actors.authorA!.email, tokenHash: hashToken(token), expiresAt: new Date(Date.now()+60000) });
    expect((await call("authorB", "quote-claim", "POST", { token })).status).toBe(403);
    await data(await call("authorA", "quote-claim", "POST", { token }));
    expect((await call("authorA", "quote-claim", "POST", { token })).status).toBe(403);
    expect((await call("authorA", `quotes/${quoteId}`)).status).toBe(200);
  });
});

describe("delegations, revocations and encrypted notification outbox", () => {
  it("requires explicit admin scopes and prevents unauthorized invitations", async () => {
    expect((await call("owner", "invitations", "POST", { email: "new@example.test", role: "admin" })).status).toBe(422);
    expect((await call("editorA", "invitations", "POST", { email: "new@example.test", role: "owner" })).status).toBe(403);
    expect((await call("affiliateA", "leads/export")).status).toBe(403);
    expect((await call("finance", `commissions/${randomUUID()}`, "PATCH", { reference: "synthetic transfer" })).status).toBe(403);
  });
  it("persists encrypted emails and flushes only to the isolated transport", async () => {
    const { enqueueMail, flushMail } = await import("@/lib/platform/mail");
    await enqueueMail("test-dedup", { to: "controlled@example.test", subject: "Synthetic", html: "<p>Private token text</p>" });
    await enqueueMail("test-dedup", { to: "controlled@example.test", subject: "Synthetic", html: "<p>Private token text</p>" });
    const rows = await db.select().from(platform.emailOutbox).where(eq(platform.emailOutbox.eventKey,"test-dedup:controlled@example.test"));
    expect(rows).toHaveLength(1); expect(rows[0]!.html).toMatch(/^jwe:/); expect(rows[0]!.html).not.toContain("Private token text");
    const result = await flushMail(100); expect(result.failed).toBe(0);
    const filenames = await readdir(join(directory,"mail")); expect(filenames.length).toBeGreaterThan(0);
    await access(join(directory,"db"));
  });
  it("revocation invalidates the existing session on the next request", async () => {
    const [membership] = await db.select().from(platform.memberships).where(eq(platform.memberships.userId, actors.authorB!.id));
    await data(await call("owner", `memberships/${membership!.id}`, "PATCH", { active: false, grants: null }));
    expect((await call("authorB", "projects")).status).toBe(401);
  });
});

describe("financial events, affiliate privacy and recovery", () => {
  const policy = { version: "SYNTHETIC-TAX-v1", vatMode: "included", vatRateBps: 2200, termsVersion: "SYNTHETIC-TERMS-v1" };
  const rule = { version: "SYNTHETIC-COMMISSION-v1", sellerBps: 1200, affiliateBps: 800, base: "collected-excluding-tax", attributionDays: 30, attribution: "code-on-quote" };
  let orderId: string, amount: number;
  const intent = `pi_test_${randomUUID()}`, stripeSession = `cs_test_${randomUUID()}`;
  const event = (type: string, object: unknown, id = `evt_test_${randomUUID()}`) => ({ id, type, livemode: false, data: { object } }) as Stripe.Event;
  function checkoutSession(paid = true) { return { id: stripeSession, metadata: { orderId, quoteId }, client_reference_id: orderId, currency: "eur", amount_total: amount, payment_status: paid ? "paid" : "unpaid", payment_intent: intent }; }
  it("requires economic conditions, versions acceptance and protects proposal expiry", async () => {
    expect((await call("authorA", `quotes/${quoteId}/accept`, "POST", { tier: "consigliato", version: 2, policyVersion: "unknown", termsAccepted: true, orderSheetAccepted: true })).status).toBe(409);
    await data(await call("owner", "settings", "PUT", { key: "payment-policy", value: policy }));
    await data(await call("owner", "settings", "PUT", { key: "commission-rule", value: rule }));
    await data(await call("sellerA", `quotes/${quoteId}`, "PATCH", { version: 2, input: priceInput }));
    const body = { tier: "consigliato", version: 3, policyVersion: policy.version, termsAccepted: true, orderSheetAccepted: true };
    expect((await call("authorA", `quotes/${quoteId}/accept`, "POST", { ...body, version: 2 })).status).toBe(409);
    const accepted = await data(await call("authorA", `quotes/${quoteId}/accept`, "POST", body));
    const again = await data(await call("authorA", `quotes/${quoteId}/accept`, "POST", body));
    expect(again.contractId).toBe(accepted.contractId);
    // Acceptance concludes the contract; the project exists only after a verified payment.
    expect((await db.select().from(platform.projects).where(eq(platform.projects.quoteId, quoteId)))).toHaveLength(0);
    const contractRows = await db.select().from(platform.contracts).where(eq(platform.contracts.quoteId, quoteId));
    expect(contractRows).toHaveLength(1);
    expect(contractRows[0]!.acceptances).toEqual({ terms: true, orderSheet: true, earlyStart: false, marketing: false });
    expect(contractRows[0]!.orderSheet.amounts.grossCents).toBeGreaterThan(0);
    expect((await db.select().from(platform.emailOutbox)).some(r => r.eventKey === `contract:${accepted.contractId}:author` && (r.attachments?.length ?? 0) === 1)).toBe(true);
    const pdf = await call("authorA", `contracts/${accepted.contractId}/pdf`);
    expect(pdf.status).toBe(200); expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect((await call("editorA", `contracts/${accepted.contractId}/pdf`)).status).toBe(404);
    expect((await call("affiliateA", `contracts/${accepted.contractId}`)).status).toBe(404);
    expect((await call("sellerA", `quotes/${quoteId}`, "PATCH", { version: 3, input: priceInput })).status).toBe(409);
  });
  it("keeps affiliate data separate and never discloses customer contact details", async () => {
    await db.insert(platform.affiliateProfiles).values([{ userId: actors.affiliateA!.id, code: "aaaaaaaaaaaaaaaa", active: true }, { userId: actors.affiliateB!.id, code: "bbbbbbbbbbbbbbbb", active: true }]);
    await db.insert(platform.affiliateConversions).values({ affiliateId: actors.affiliateA!.id, quoteId, ruleVersion: rule.version });
    const a = await data(await call("affiliateA", "affiliates")), b = await data(await call("affiliateB", "affiliates"));
    expect(a.conversions).toHaveLength(1); expect(b.conversions).toHaveLength(0);
    expect(JSON.stringify(a)).not.toContain(actors.authorA!.email);
    expect(a.conversions[0]).not.toHaveProperty("quoteId");
  });
  it("waits for asynchronous payment and processes duplicate events only once", async () => {
    const quote = await data(await call("authorA", `quotes/${quoteId}`));
    const selected = quote.packages.find((p: { tier: string }) => p.tier === "consigliato");
    amount = Math.round(selected.deposit * 100);
    const [order] = await db.insert(platform.paymentOrders).values({ quoteId, authorId: actors.authorA!.id, tier: "consigliato", amountCents: amount, stripeSessionId: stripeSession }).returning(); orderId = order!.id;
    const { processStripeEvent } = await import("@/lib/platform/payments");
    await processStripeEvent(event("checkout.session.completed", checkoutSession(false)));
    expect(await db.select().from(platform.ledgerEntries).where(eq(platform.ledgerEntries.orderId, orderId))).toHaveLength(0);
    // Reassignment after acceptance must not redirect earned seller attribution.
    await db.update(platform.leadOwnership).set({ assignedTo: actors.sellerB!.id }).where(eq(platform.leadOwnership.leadId, leadId));
    const success = event("checkout.session.async_payment_succeeded", checkoutSession());
    await processStripeEvent(success); await processStripeEvent(success);
    await processStripeEvent(event("checkout.session.completed", checkoutSession()));
    expect(await db.select().from(platform.ledgerEntries).where(eq(platform.ledgerEntries.orderId, orderId))).toHaveLength(1);
    // One verified deposit opens exactly one project, started and linked to the seller who closed the sale.
    const opened = await db.select().from(platform.projects).where(eq(platform.projects.quoteId, quoteId));
    expect(opened).toHaveLength(1); expect(opened[0]!.stage).toBe("materials"); expect(opened[0]!.startedAt).not.toBeNull(); expect(opened[0]!.referentId).toBe(actors.sellerA!.id);
    expect((await db.select().from(platform.tasks).where(eq(platform.tasks.projectId, opened[0]!.id))).some(t => t.assignedTo === actors.authorA!.id && !t.internal)).toBe(true);
    await expect(db.insert(platform.projects).values({ authorId: actors.authorA!.id, title: "Doppione", quoteId })).rejects.toThrow();
    const payouts = await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, orderId));
    expect(payouts).toHaveLength(2);
    expect(payouts.some(p => p.beneficiaryId === actors.sellerA!.id)).toBe(true);
    expect(payouts.some(p => p.beneficiaryId === actors.sellerB!.id)).toBe(false);
    const net = Math.round(amount * 10000 / 12200);
    expect(payouts.reduce((sum, p) => sum + p.amountCents, 0)).toBe(Math.round(net*.12)+Math.round(net*.08));
  });
  it("rejects mismatched mode, order, amount and connected accounts", async () => {
    const { processStripeEvent } = await import("@/lib/platform/payments");
    await expect(processStripeEvent(event("checkout.session.completed", { ...checkoutSession(), amount_total: amount+1 }))).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    await expect(processStripeEvent({ ...event("checkout.session.completed", checkoutSession()), livemode: true })).rejects.toMatchObject({ code: "MODE_MISMATCH" });
    await expect(processStripeEvent({ ...event("checkout.session.completed", checkoutSession()), account: "acct_unauthorized" })).rejects.toMatchObject({ code: "ACCOUNT_MISMATCH" });
  });
  it("retains out-of-order refunds for retry and keeps proportional reversals idempotent", async () => {
    const { processStripeEvent } = await import("@/lib/platform/payments");
    const unknown = event("refund.created", { id: "re_early", status: "succeeded", payment_intent: "pi_before-payment", currency: "eur", amount: 10 });
    await expect(processStripeEvent(unknown)).rejects.toMatchObject({ code: "PAYMENT_NOT_RECONCILED" });
    expect(await db.select().from(platform.webhookEvents).where(eq(platform.webhookEvents.eventId, unknown.id))).toHaveLength(0);
    const partial = event("refund.updated", { id: "re_partial", status: "succeeded", payment_intent: intent, currency: "eur", amount: Math.floor(amount/3) });
    await processStripeEvent(partial); await processStripeEvent(partial);
    const final = event("refund.updated", { id: "re_final", status: "succeeded", payment_intent: intent, currency: "eur", amount: amount-Math.floor(amount/3) });
    await processStripeEvent(final);
    const ledger = await db.select().from(platform.ledgerEntries).where(eq(platform.ledgerEntries.orderId, orderId));
    expect(ledger.reduce((sum, e) => sum + e.amountCents, 0)).toBe(0);
    const payouts = await db.select().from(platform.commissions).where(eq(platform.commissions.orderId, orderId));
    expect(payouts.reduce((sum, p) => sum + p.amountCents, 0)).toBe(0);
    expect((await data(await call("finance", "finance"))).totals.balanceCents).toBe(0);
  });
  it("restores the synthetic database in a separate instance", async () => {
    const snapshot = await database.dumpDataDir();
    const restored = await PGlite.create({ loadDataDir: snapshot });
    const count = await restored.query<{count:number}>("select count(*)::integer as count from platform_projects");
    expect(count.rows[0]!.count).toBeGreaterThanOrEqual(3);
    await restored.close();
  });
});

async function mailLink(eventPrefix: string) {
  const { compactDecrypt } = await import("jose");
  const rows = await db.select().from(platform.emailOutbox);
  const item = rows.find(r => r.eventKey.startsWith(eventPrefix))!;
  const decrypted = await compactDecrypt(item.html.slice(4), createHash("sha256").update(process.env.BETTER_AUTH_SECRET!).digest());
  const html = new TextDecoder().decode(decrypted.plaintext);
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]!.replaceAll("&amp;", "&"));
  return links.find(v => v.includes("token=") || v.includes("/reset-password/"))!;
}

describe("public requests, invitation lifecycle and operating failures", () => {
  it("verifies email through Better Auth and recovers access using the queued one-time link", async () => {
    const registration = await authRequest("sign-up/email", { name: "Verified path", email: "verify-path@example.test", password, privacyAccepted: true });
    const person = (await data(registration)).user;
    const rows = await db.select().from(platform.emailOutbox);
    const verification = rows.find(r => r.recipient === person.email)!;
    const link = await mailLink(verification.eventKey);
    const response = await auth.handler(new Request(link));
    expect([200,302]).toContain(response.status);
    const [verified] = await db.select().from(identity.user).where(eq(identity.user.id, person.id));
    expect(verified!.emailVerified).toBe(true);
    expect((await authRequest("sign-in/email", { email: person.email, password })).status).toBe(200);
    await data(await authRequest("request-password-reset", { email: person.email, redirectTo: `${origin}/nuova-password` }));
    const resetRows = await db.select().from(platform.emailOutbox);
    const reset = resetRows.find(r => r.recipient === person.email && r.eventKey.startsWith("password-reset:"))!;
    const resetLink = await mailLink(reset.eventKey);
    const nextPassword = `Replacement-${randomBytes(12).toString("hex")}`;
    await data(await authRequest("reset-password", { token: new URL((await auth.handler(new Request(resetLink))).headers.get("location")!).searchParams.get("token"), newPassword: nextPassword }));
    expect((await authRequest("sign-in/email", { email: person.email, password: nextPassword })).status).toBe(200);
    expect((await authRequest("sign-in/email", { email: person.email, password })).status).toBe(401);
  });
  it("accepts an invitation once, invalidates sessions and enforces a CRM-only admin profile", async () => {
    await createActor("limited", "author");
    const grants = [{ permission: "crm.read", scope: "organization" }, { permission: "crm.write", scope: "organization" }];
    const invitation = await data(await call("owner", "invitations", "POST", { email: actors.limited!.email, role: "admin", grants }),201);
    const token = new URL(await mailLink(`invitation:${invitation.id}`)).searchParams.get("token");
    expect((await call("authorA", "invite-accept", "POST", { token })).status).toBe(403);
    await data(await call("limited", "invite-accept", "POST", { token }));
    expect((await call("limited", "me")).status).toBe(401);
    const login = await authRequest("sign-in/email", { email: actors.limited!.email, password }); actors.limited!.cookie = cookies(login);
    expect((await call("limited", "leads")).status).toBe(428);
    const enable = await data(await authRequest("two-factor/enable", { password, method:"totp" }, actors.limited!.cookie));
    const verified = await authRequest("two-factor/verify-totp", { code: URI.parse(enable.totpURI).generate() }, actors.limited!.cookie);
    await data(verified); actors.limited!.cookie = cookies(verified, actors.limited!.cookie);
    await data(await call("limited", "leads"));
    await data(await call("limited", "leads", "POST", { nome: "Scoped", email:"scoped@example.test" }),201);
    expect((await call("limited", "finance")).status).toBe(403);
    expect((await call("limited", `projects/${projectA}`)).status).toBe(404);
    expect((await call("limited", "invitations", "POST", { email:"escape@example.test", role:"owner" })).status).toBe(403);
    expect((await call("limited", "invite-accept", "POST", { token })).status).toBe(403);
  });
  it("rejects revoked and expired invitation tokens", async () => {
    for (const status of ["revoked", "expired"] as const) {
      const invite = await data(await call("owner", "invitations", "POST", { email: actors.authorA!.email, role:"editor" }),201);
      const token = new URL(await mailLink(`invitation:${invite.id}`)).searchParams.get("token");
      if (status === "revoked") await data(await call("owner", `invitations/${invite.id}`, "DELETE"));
      else await db.update(platform.staffInvitations).set({ expiresAt: new Date(Date.now()-1000) }).where(eq(platform.staffInvitations.id,invite.id));
      expect((await call("authorA", "invite-accept", "POST", { token })).status).toBe(403);
    }
  });
  it("persists public contact once, escapes content, separates interest from marketing", async () => {
    const { publicContact, publicWaitlist } = await import("@/lib/platform/public-forms");
    const key = randomUUID(), body = { nome:"<script>QA</script>", email:"contact@example.test", messaggio:"A synthetic contact request for testing.", consensoPrivacy:true, consensoMarketing:false };
    const make = () => new Request(`${origin}/api/contatto`, { method:"POST", headers:{ origin,"idempotency-key":key,"content-type":"application/json" }, body:JSON.stringify(body) });
    const first = await data(await publicContact(make()),201), second = await data(await publicContact(make()),201);
    expect(second.requestId).toBe(first.requestId);
    expect((await db.select().from(schema.leads).where(eq(schema.leads.email,body.email)))).toHaveLength(1);
    const waiting = await publicWaitlist(new Request(`${origin}/api/lista-attesa`,{ method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({email:"interest@example.test",piano:"pro",periodo:"monthly",consensoPrivacy:true}) }));
    await data(waiting,201);
    expect((await db.select().from(schema.leads).where(eq(schema.leads.email,"interest@example.test")))[0]!.consensoMarketing).toBe(false);
  });
  it("keeps failed email records, bounds attempts and only lets operations request retry", async () => {
    const { enqueueMail,flushMail } = await import("@/lib/platform/mail");
    await db.update(platform.emailOutbox).set({ availableAt:new Date(Date.now()+86400_000) });
    await enqueueMail("failure-fixture",{ to:"failed@example.test",subject:"Synthetic unavailable provider",html:"<p>Retained request</p>" });
    const [item] = await db.select().from(platform.emailOutbox).where(eq(platform.emailOutbox.eventKey,"failure-fixture:failed@example.test"));
    await db.update(platform.emailOutbox).set({ attempts:4,availableAt:new Date(Date.now()-1000) }).where(eq(platform.emailOutbox.id,item!.id));
    const transport = process.env.PROEMIOS_TEST_MAIL_DIR; delete process.env.PROEMIOS_TEST_MAIL_DIR;
    try { expect((await flushMail(1)).failed).toBe(1); } finally { process.env.PROEMIOS_TEST_MAIL_DIR=transport; }
    expect((await db.select().from(platform.emailOutbox).where(eq(platform.emailOutbox.id,item!.id)))[0]!.status).toBe("failed");
    expect((await call("editorA",`operations/${item!.id}/retry`,"POST")).status).toBe(403);
    await data(await call("owner",`operations/${item!.id}/retry`,"POST"));
  });
  it("persists self preferences for every active role and refuses forbidden modules", async () => {
    for (const name of ["owner","admin","limited","editorA","sellerA","affiliateA","finance","authorA"]) {
      await data(await call(name,"preferences","PATCH",{ optionalEmail:false,savedFilters:{crm:"synthetic"} }));
      expect((await data(await call(name,"preferences"))).preferences.savedFilters.crm).toBe("synthetic");
    }
    for (const name of ["editorA","sellerA","affiliateA","finance","authorA","limited"]) expect((await call(name,"settings","PUT",{key:"commission-rule",value:{}})).status).toBe(403);
    expect((await data(await call("affiliateA","quotes"))).quotes).toHaveLength(0);
    expect((await call("owner",`memberships/${(await db.select().from(platform.memberships).where(eq(platform.memberships.role,"owner")))[0]!.id}`,"PATCH",{active:false,grants:null})).status).toBe(409);
  });
  it("gates costly analysis and deletes expired private sources and derived reports", async () => {
    const { analysisConfigured,analysisStatus } = await import("@/lib/platform/analysis");
    expect(analysisConfigured()).toBe(false);
    const { storePrivate,readPrivate } = await import("@/lib/platform/storage");
    const sourceKey = await storePrivate("analysis",new TextEncoder().encode("Synthetic private excerpt"),"text/plain");
    const [job] = await db.insert(platform.analysisJobs).values({ userId:actors.authorA!.id,operationKey:randomUUID(),requestHash:"synthetic",filename:"fixture.txt",sourceKey,metrics:{parole:100},status:"completed",report:{sintesi:"Synthetic test report"},expiresAt:new Date(Date.now()-1000) }).returning();
    expect((await analysisStatus(new Request(`${origin}/api/analisi?jobId=${job!.id}`,{headers:{cookie:actors.editorA!.cookie}})).catch(e=>({status:e.status}))).status).toBe(404);
    const { maintenance } = await import("@/lib/platform/operations"); await maintenance();
    const [deleted] = await db.select().from(platform.analysisJobs).where(eq(platform.analysisJobs.id,job!.id));
    expect(deleted!.status).toBe("deleted"); expect(deleted!.report).toBeNull(); expect(deleted!.sourceKey).toBeNull();
    await expect(readPrivate(sourceKey)).rejects.toBeDefined();
  });
});

describe("signed callbacks and private maintenance", () => {
  it("requires a valid Stripe signature and durably acknowledges an authenticated test event once", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = `whsec_${randomBytes(16).toString("hex")}`;
    const { stripe } = await import("@/lib/stripe");
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const event = { id:`evt_signed_${randomUUID()}`,type:"customer.created",livemode:false,data:{object:{id:"cus_synthetic"}} };
    const payload = JSON.stringify(event);
    const signature = stripe().webhooks.generateTestHeaderString({ payload,secret:process.env.STRIPE_WEBHOOK_SECRET });
    const request = (sign: string,body=payload) => new Request(`${origin}/api/webhooks/stripe`,{method:"POST",headers:{"stripe-signature":sign},body});
    expect((await POST(request("invalid"))).status).toBe(400);
    await data(await POST(request(signature))); await data(await POST(request(signature)));
    expect(await db.select().from(platform.webhookEvents).where(eq(platform.webhookEvents.eventId,event.id))).toHaveLength(1);
    expect((await POST(request(signature,payload+" "))).status).toBe(400);
  });
  it("rejects maintenance without its independent bearer credential", async () => {
    process.env.CRON_SECRET = randomBytes(24).toString("hex");
    const { GET } = await import("@/app/api/cron/route");
    expect((await GET(new Request(`${origin}/api/cron`))).status).toBe(403);
    expect((await GET(new Request(`${origin}/api/cron`,{headers:{authorization:"Bearer guessed"}}))).status).toBe(403);
  });
});

describe("scoped saved searches and proposal history", () => {
  it("search predicates retain resource isolation after reassignment", async () => {
    expect((await data(await call("sellerA", "leads?q=Synthetic%20author"))).leads).toHaveLength(0);
    const found = (await data(await call("sellerB", "leads?q=Synthetic%20author"))).leads;
    expect(found.map((l: {id:string})=>l.id)).toEqual([leadId]);
    expect((await data(await call("limited", "leads?q=Scoped"))).leads).toHaveLength(1);
  });
  it("exposes only the authorized proposal's version history without internal snapshots", async () => {
    const detail = await data(await call("authorA", `quotes/${quoteId}`));
    expect(detail.history.map((v:{version:number})=>v.version)).toEqual([2,1]);
    expect(detail.history[0]).not.toHaveProperty("snapshot");
    expect((await call("editorB",`quotes/${quoteId}`)).status).toBe(404);
  });
});

describe("durable analysis jobs with an isolated provider boundary", () => {
  it("claims once, persists provider failure, retries by permission and never calls AI during polling", async () => {
    const ai = await import("@/lib/ai");
    const configured = vi.spyOn(ai,"aiConfigurata").mockReturnValue(true);
    const provider = vi.spyOn(ai,"analizza").mockRejectedValueOnce(new Error("Synthetic provider unavailable")).mockResolvedValue({ sintesi:"Synthetic provider result for the isolated job test.",ritmo:{giudizio:"Synthetic rhythm assessment.",periodareLungo:false},ripetizioni:[],cliche:[],coerenza:{tempiVerbali:"Synthetic tense assessment",puntoDiVista:"Synthetic point of view"},genere:"Synthetic fiction",lettoreTipo:"Synthetic target reader",puntiForza:["Synthetic strength"],areeIntervento:["Synthetic area"],livelloIntervento:"editing-leggero" });
    const keys=["ANALYSIS_ENABLED","ANALYSIS_POLICY_APPROVED","ANALYSIS_MAX_JOBS_PER_DAY","ANALYSIS_PER_USER_DAILY_LIMIT","MANUSCRIPT_RETENTION_DAYS"];
    const before=keys.map(k=>process.env[k]);
    Object.assign(process.env,{ANALYSIS_ENABLED:"1",ANALYSIS_POLICY_APPROVED:"1",ANALYSIS_MAX_JOBS_PER_DAY:"20",ANALYSIS_PER_USER_DAILY_LIMIT:"5",MANUSCRIPT_RETENTION_DAYS:"2"});
    try {
      const { submitAnalysis,runAnalysisJob,analysisStatus }=await import("@/lib/platform/analysis");
      const operationKey=randomUUID();
      const upload=()=>{const form=new FormData();form.set("file",new File(["Synthetic words for testing. ".repeat(100)],"job-fixture.txt"));form.set("nome","Synthetic author");form.set("email",actors.authorA!.email);form.set("consensoPrivacy","true");return new Request(`${origin}/api/analisi`,{method:"POST",headers:{origin,cookie:actors.authorA!.cookie,"idempotency-key":operationKey},body:form});};
      const job=await data(await submitAnalysis(upload()),202);
      expect((await data(await submitAnalysis(upload()),202)).jobId).toBe(job.jobId);
      await Promise.all([runAnalysisJob(job.jobId),runAnalysisJob(job.jobId)]);
      expect(provider).toHaveBeenCalledTimes(1);
      const status=()=>analysisStatus(new Request(`${origin}/api/analisi?jobId=${job.jobId}`,{headers:{cookie:actors.authorA!.cookie}}));
      for(let i=0;i<3;i++)expect((await data(await status())).status).toBe("failed");
      expect(provider).toHaveBeenCalledTimes(1);
      expect((await call("editorA",`operations/${job.jobId}/analysis-retry`,"POST",{confirmProviderCost:true})).status).toBe(403);
      await data(await call("owner",`operations/${job.jobId}/analysis-retry`,"POST",{confirmProviderCost:true}),202);
      await runAnalysisJob(job.jobId);await runAnalysisJob(job.jobId);
      const completed=await data(await status());expect(completed.status).toBe("completed");expect(completed.report.sintesi).toContain("Synthetic provider result");
      expect(provider).toHaveBeenCalledTimes(2);
      expect((await db.select().from(platform.analysisJobs).where(eq(platform.analysisJobs.operationKey,operationKey)))).toHaveLength(1);
    } finally {
      configured.mockRestore();provider.mockRestore();keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});
    }
  });
});

describe("first euro without manual configuration", () => {
  it("applies the documented default policy so a public proposal can be accepted and paid", async () => {
    const { defaultPaymentPolicy } = await import("@/lib/platform/config");
    await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "payment-policy"));
    const { publicQuote } = await import("@/lib/platform/public-forms");
    const email = "first-euro@example.test";
    const quoteRequest = await publicQuote(new Request(`${origin}/api/preventivo`, { method: "POST", headers: { origin, "idempotency-key": randomUUID(), "content-type": "application/json" }, body: JSON.stringify({ input: priceInput, contatto: { nome: "First Euro", email, consensoPrivacy: true, consensoMarketing: false } }) }));
    const created = await data(quoteRequest, 201);
    const [quoteRow] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, created.quoteId));
    const leadId = quoteRow!.leadId;
    const outbox = await db.select().from(platform.emailOutbox);
    expect(outbox.some(r => r.recipient === email && r.eventKey.startsWith("quote:"))).toBe(true);
    // The author registers with the same address: verification links the request, no token needed.
    const registration = await data(await authRequest("sign-up/email", { name: "First Euro", email, password, privacyAccepted: true }));
    const [before] = await db.select().from(platform.leadOwnership).where(eq(platform.leadOwnership.leadId, leadId));
    expect(before?.authorId ?? null).toBeNull();
    const verification = (await db.select().from(platform.emailOutbox)).find(r => r.recipient === email && r.eventKey.startsWith("email-verification:"))!;
    await auth.handler(new Request(await mailLink(verification.eventKey)));
    const [linked] = await db.select().from(platform.leadOwnership).where(eq(platform.leadOwnership.leadId, leadId));
    expect(linked?.authorId).toBe(registration.user.id);
    const login = await authRequest("sign-in/email", { email, password });
    actors.firstEuro = { id: registration.user.id, email, cookie: cookies(login) };
    const list = await data(await call("firstEuro", "quotes"));
    expect(list.quotes.map((q: { id: string }) => q.id)).toContain(created.quoteId);
    const detail = await data(await call("firstEuro", `quotes/${created.quoteId}`));
    expect(detail.paymentPolicy.version).toBe(defaultPaymentPolicy.version);
    expect(detail.packages[0].money.grossCents).toBe(Math.round(detail.packages[0].total * 100 * 1.22));
    const tier = detail.packages.find((p: { recommended?: boolean }) => p.recommended)?.tier ?? detail.packages[0].tier;
    // A word-count service is an estimate under the prudent default rule: nobody can buy it as is.
    expect(created.commercialState).toBe("estimate"); expect(detail.journey).toBe("estimate");
    const blocked = await call("firstEuro", `quotes/${created.quoteId}/accept`, "POST", { tier, version: detail.record.version, policyVersion: defaultPaymentPolicy.version, termsAccepted: true, orderSheetAccepted: true });
    expect(blocked.status).toBe(409); expect((await blocked.json()).code).toBe("NOT_PURCHASABLE");
    // The chosen package survives before any account exists, then the author asks for the definitive proposal.
    const { publicQuotePreference } = await import("@/lib/platform/public-forms");
    await data(await publicQuotePreference(new Request(`${origin}/api/preventivo/scelta`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ quoteId: created.quoteId, tier }) })));
    expect((await data(await call("firstEuro", `quotes/${created.quoteId}`))).record.preferredTier).toBe(tier);
    await data(await call("firstEuro", `quotes/${created.quoteId}/review`, "POST", { note: "Il testo è pronto, vorrei partire presto." }));
    expect((await call("firstEuro", `quotes/${created.quoteId}/review`, "POST", {})).status).toBe(409);
    expect((await data(await call("firstEuro", `quotes/${created.quoteId}`))).journey).toBe("review");
    expect((await db.select().from(platform.emailOutbox)).some(r => r.eventKey === `quote:${created.quoteId}:review:team`)).toBe(true);
    // Only the team makes it purchasable; the author cannot.
    expect((await call("firstEuro", `quotes/${created.quoteId}/offer`, "POST", {})).status).toBe(404);
    const offered = await data(await call("owner", `quotes/${created.quoteId}/offer`, "POST", { validityDays: 10, message: "Confermiamo tutto." }));
    expect(offered.commercialState).toBe("offer");
    const offerMail = (await db.select().from(platform.emailOutbox)).find(r => r.eventKey === `quote:${created.quoteId}:offer:${detail.record.version}`);
    expect(offerMail?.recipient).toBe(email);
    expect((await db.select().from(platform.quoteRecords).where(eq(platform.quoteRecords.quoteId, created.quoteId)))[0]!.salesAssisted).toBe(true);
    expect((await call("firstEuro", `quotes/${created.quoteId}/accept`, "POST", { tier, version: detail.record.version, policyVersion: "unknown", termsAccepted: true, orderSheetAccepted: true })).status).toBe(409);
    // One step: billing data, acceptance and (without Stripe here) a clear answer instead of a dead end.
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; delete process.env.STRIPE_WEBHOOK_SECRET;
    const noBilling = await call("firstEuro", `quotes/${created.quoteId}/confirm`, "POST", { tier, version: detail.record.version, policyVersion: defaultPaymentPolicy.version, termsAccepted: true, orderSheetAccepted: true });
    expect(noBilling.status).toBe(409); expect((await noBilling.json()).code).toBe("BILLING_REQUIRED");
    const confirmed = await data(await call("firstEuro", `quotes/${created.quoteId}/confirm`, "POST", { tier, version: detail.record.version, policyVersion: defaultPaymentPolicy.version, termsAccepted: true, orderSheetAccepted: true, billing: { kind: "private", name: "First Euro", taxCode: "RSSMRA80A01H501U", street: "Via Prova 9", postcode: "00100", city: "Roma", province: "RM", country: "IT" } }));
    expect(confirmed.accepted).toBe(true); expect(confirmed.checkoutAvailable).toBe(false);
    // Repeating the confirmation is harmless; changing the package after acceptance is not.
    expect((await call("firstEuro", `quotes/${created.quoteId}/confirm`, "POST", { tier, version: detail.record.version, policyVersion: defaultPaymentPolicy.version, termsAccepted: true, orderSheetAccepted: true })).status).toBe(200);
    const other = detail.packages.find((p: { tier: string }) => p.tier !== tier)?.tier;
    if (other) expect((await call("firstEuro", `quotes/${created.quoteId}/confirm`, "POST", { tier: other, version: detail.record.version, policyVersion: defaultPaymentPolicy.version, termsAccepted: true, orderSheetAccepted: true })).status).toBe(409);
    expect((await data(await call("firstEuro", `quotes/${created.quoteId}`))).journey).toBe("accepted");
    if (webhookSecret) process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const [record] = await db.select().from(platform.quoteRecords).where(eq(platform.quoteRecords.quoteId, created.quoteId));
    expect((record!.taxPolicy as { version: string }).version).toBe(defaultPaymentPolicy.version);
    const payments = await data(await call("firstEuro", `quotes/${created.quoteId}/payments`));
    expect(payments.accepted).toBe(true); expect(payments.deposit.paid).toBe(false);
    expect(payments.deposit.grossCents + payments.balance.grossCents).toBe(detail.packages.find((p: { tier: string }) => p.tier === tier).money.grossCents);
    expect((await call("authorA", `quotes/${created.quoteId}/payments`)).status).toBe(404);
    // Team and seller learn about the acceptance without being able to change the conditions.
    const afterAccept = await db.select().from(platform.emailOutbox);
    expect(afterAccept.some(r => r.eventKey === `quote:${created.quoteId}:accepted:team`)).toBe(true);
    const own = await db.select().from(platform.notifications).where(eq(platform.notifications.userId, registration.user.id));
    expect(own.every(n => (n.href ?? "").startsWith("/area-autore"))).toBe(true);
  });
  it("never links a request to an unverified address nor to someone else's claimed request", async () => {
    const { linkLeadsToAuthor } = await import("@/lib/platform/lead-linking");
    const email = "unverified-link@example.test";
    const [lead] = await db.insert(schema.leads).values({ nome: "Unverified", email, fonte: "preventivo", consensoPrivacy: true }).returning();
    const registration = await data(await authRequest("sign-up/email", { name: "Unverified", email, password, privacyAccepted: true }));
    expect((await db.select().from(platform.leadOwnership).where(eq(platform.leadOwnership.leadId, lead!.id)))).toHaveLength(0);
    await db.insert(platform.leadOwnership).values({ leadId: lead!.id, authorId: actors.authorB!.id });
    expect(await linkLeadsToAuthor(registration.user.id, email)).toBe(0);
    const [owner] = await db.select().from(platform.leadOwnership).where(eq(platform.leadOwnership.leadId, lead!.id));
    expect(owner!.authorId).toBe(actors.authorB!.id);
  });
  it("signs authors in with a single-use email link, never the team, and keeps the return path internal", async () => {
    expect((await authRequest("sign-in/magic-link", { email: actors.firstEuro!.email, callbackURL: "/area-autore/conferma/abc" })).status).toBe(200);
    const link = await mailLink("magic-link:");
    const opened = await auth.handler(new Request(link));
    expect(opened.status).toBe(302); expect(opened.headers.get("location")).toContain("/area-autore/conferma/abc");
    const reused = await auth.handler(new Request(link));
    expect(reused.headers.get("location")).toContain("error=");
    expect((await authRequest("sign-in/magic-link", { email: actors.sellerA!.email, callbackURL: "/area-team" })).status).toBe(403);
    expect((await authRequest("sign-in/magic-link", { email: "nobody-here@example.test", callbackURL: "/area-autore" })).status).toBe(200);
    expect((await db.select().from(platform.emailOutbox)).filter(r => r.recipient === "nobody-here@example.test")).toHaveLength(0);
    const { safeReturnPath } = await import("@/lib/platform/realms");
    expect(safeReturnPath("/area-autore/conferma/" + randomUUID() + "?pacchetto=consigliato")).not.toBeNull();
    expect(safeReturnPath("https://evil.example/area-autore")).toBeNull();
    const funnel = await db.select().from(platform.funnelEvents);
    for (const name of ["quote_saved", "email_verified", "review_requested", "offer_made", "quote_accepted"]) expect(funnel.some(e => e.name === name && e.kind === "economic")).toBe(true);
    expect(funnel.some(e => e.name === "package_chosen" && e.kind === "ui")).toBe(true);
  });
});

describe("automatic invoicing with Fatture in Cloud", () => {
  const ficCalls: Array<{ method: string; url: string; body: unknown }> = [];
  let invoiceId: string;
  it("collects valid billing data once and refuses checkout without it", async () => {
    const bad = await call("authorA", "me/billing", "PUT", { kind: "private", name: "Synthetic Author", taxCode: "NOT-A-CODE", street: "Via Prova 1", postcode: "20100", city: "Milano", province: "MI", country: "IT" });
    expect(bad.status).toBe(422);
    await db.delete(platform.billingProfiles).where(eq(platform.billingProfiles.userId, actors.firstEuro!.id));
    const gated = await call("firstEuro", "checkout", "POST", { quoteId: (await data(await call("firstEuro", "quotes"))).quotes[0].id, kind: "deposit" });
    expect(gated.status).toBe(409); expect((await gated.json()).code).toBe("BILLING_REQUIRED");
    const saved = await data(await call("authorA", "me/billing", "PUT", { kind: "private", name: "Synthetic Author", taxCode: "rssmra80a01h501u", street: "Via Prova 1", postcode: "20100", city: "Milano", province: "mi", country: "IT" }));
    expect(saved.billing.taxCode).toBe("RSSMRA80A01H501U"); expect(saved.billing.province).toBe("MI"); expect(saved.billing).not.toHaveProperty("stripeCustomerId");
    expect((await data(await call("authorA", "me/billing"))).billing.city).toBe("Milano");
    expect((await data(await call("firstEuro", "me/billing"))).billing).toBeNull();
    const business = await call("firstEuro", "me/billing", "PUT", { kind: "business", name: "Casa Editrice Synthetic", vatNumber: "12345678901", street: "Corso Test 2", postcode: "10100", city: "Torino", province: "TO", country: "IT" });
    expect(business.status).toBe(422);
  });
  it("queues the invoice with the payment, issues it after the external call succeeds and serves the PDF only to its owner", async () => {
    const { issueQueuedInvoices } = await import("@/lib/platform/invoices");
    const [queued] = await db.select().from(platform.invoices).where(eq(platform.invoices.authorId, actors.authorA!.id));
    expect(queued?.status).toBe("queued"); invoiceId = queued!.id;
    expect(await issueQueuedInvoices(5)).toMatchObject({ skipped: true });
    process.env.FIC_ACCESS_TOKEN = "fic-synthetic-token"; process.env.FIC_COMPANY_ID = "4242"; delete process.env.FIC_SEND_TO_SDI;
    const realFetch = globalThis.fetch;
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://api-v2.fattureincloud.it/")) {
        ficCalls.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (new Headers(init?.headers).get("authorization") !== "Bearer fic-synthetic-token") return new Response("{}", { status: 401 });
        if (url.endsWith("/issued_documents") && init?.method === "POST") return Response.json({ data: { id: 501, number: 12, numeration: "/A", date: "2026-10-15", url: "https://fic.example.test/doc-501.pdf" } });
        if (url.includes("/e_invoice/send")) return Response.json({ data: {} });
        if (url.includes("/issued_documents/501")) return Response.json({ data: { id: 501, number: 12, url: "https://fic.example.test/doc-501.pdf" } });
        return new Response("not found", { status: 404 });
      }
      if (url === "https://fic.example.test/doc-501.pdf") return new Response(pdf, { headers: { "content-type": "application/pdf" } });
      return realFetch(input, init);
    });
    // The author had no billing data when the payment was recorded: the row waits, nothing is sent.
    await db.delete(platform.billingProfiles).where(eq(platform.billingProfiles.userId, actors.authorA!.id));
    expect(await issueQueuedInvoices(5)).toMatchObject({ issued: 0, failed: 1 });
    let [row] = await db.select().from(platform.invoices).where(eq(platform.invoices.id, invoiceId));
    expect(row!.status).toBe("retry"); expect(row!.attempts).toBe(1); expect(row!.error).toContain("fatturazione"); expect(ficCalls).toHaveLength(0);
    await data(await call("authorA", "me/billing", "PUT", { kind: "private", name: "Synthetic Author", taxCode: "RSSMRA80A01H501U", street: "Via Prova 1", postcode: "20100", city: "Milano", province: "MI", country: "IT" }));
    expect((await call("authorA", `invoices/${invoiceId}/retry`, "POST")).status).toBe(403);
    const retried = await data(await call("finance", `invoices/${invoiceId}/retry`, "POST"));
    expect(retried.invoice.status).toBe("created"); expect(retried.invoice.number).toBe("12/A");
    expect(ficCalls.map(c => c.method + " " + new URL(c.url).pathname)).toEqual(["POST /c/4242/issued_documents"]);
    const sent = ficCalls[0]!.body as { data: Record<string, unknown> };
    expect(sent.data.e_invoice).toBe(true); expect(sent.data.use_gross_prices).toBe(true);
    expect((sent.data.entity as Record<string, unknown>).tax_code).toBe("RSSMRA80A01H501U"); expect((sent.data.entity as Record<string, unknown>).ei_code).toBe("0000000");
    expect((sent.data.items_list as Array<Record<string, unknown>>)[0]!.gross_price).toBe(row!.grossCents / 100);
    expect((sent.data.payments_list as Array<Record<string, unknown>>)[0]).toMatchObject({ status: "paid", amount: row!.grossCents / 100 });
    expect((sent.data.ei_data as Record<string, unknown>).payment_method).toBe("MP08");
    [row] = await db.select().from(platform.invoices).where(eq(platform.invoices.id, invoiceId));
    expect(row!.ficDocumentId).toBe(501);
    const mails = await db.select().from(platform.emailOutbox);
    expect(mails.some(m => m.eventKey.startsWith(`invoice:${invoiceId}:`) && m.recipient.toLowerCase() === actors.authorA!.email.toLowerCase())).toBe(true);
    const own = await data(await call("authorA", "invoices"));
    expect(own.invoices.map((i: { id: string }) => i.id)).toContain(invoiceId); expect(own.invoices[0]).not.toHaveProperty("error");
    expect((await data(await call("finance", "invoices"))).invoices.find((i: { id: string }) => i.id === invoiceId)).toHaveProperty("attempts");
    const download = await call("authorA", `invoices/${invoiceId}/pdf`);
    expect(download.status).toBe(200); expect(download.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(pdf);
    expect((await call("authorB", `invoices/${invoiceId}/pdf`)).status).toBe(401);
    expect((await call("sellerA", `invoices/${invoiceId}/pdf`)).status).toBe(404);
    expect((await call("editorA", "invoices")).status).toBe(200);
    expect((await data(await call("editorA", "invoices"))).invoices).toHaveLength(0);
    expect((await data(await call("finance", "finance"))).invoices.some((i: { id: string }) => i.id === invoiceId)).toBe(true);
    // Already issued: another run leaves it alone and transmits nothing twice.
    expect(await issueQueuedInvoices(5)).toMatchObject({ issued: 0, failed: 0 });
    expect(ficCalls.filter(c => c.method === "POST")).toHaveLength(1);
    vi.mocked(globalThis.fetch).mockRestore();
    delete process.env.FIC_ACCESS_TOKEN; delete process.env.FIC_COMPANY_ID;
  });
  it("reports the invoicing status to finance and probes Fatture in Cloud without creating documents", async () => {
    expect([403, 404]).toContain((await call("authorA", "invoices/status")).status);
    const off = await data(await call("finance", "invoices/status"));
    expect(off).toMatchObject({ configured: false, probe: null, queue: expect.objectContaining({ created: 1 }) });
    expect(off.lastIssued?.number).toBe("12/A");
    process.env.FIC_ACCESS_TOKEN = "fic-synthetic-token"; process.env.FIC_COMPANY_ID = "4242";
    const probeCalls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input); probeCalls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/user/companies")) return Response.json({ data: { companies: [{ id: 4242, name: "Proemios Srl" }] } });
      if (url.endsWith("/c/4242/info/vat_types")) return Response.json({ data: [{ id: 0, value: 22, description: "", is_default: true }, { id: 6, value: 0, description: "Esente art. 10" }] });
      if (url.endsWith("/c/4242/info/payment_accounts")) return new Response("scope settings:r missing", { status: 403 });
      throw new Error(`unexpected ${url}`);
    });
    const on = await data(await call("owner", "invoices/status?verifica=1"));
    vi.mocked(globalThis.fetch).mockRestore();
    delete process.env.FIC_ACCESS_TOKEN; delete process.env.FIC_COMPANY_ID;
    expect(on.configured).toBe(true);
    expect(on.probe.company).toEqual({ id: 4242, name: "Proemios Srl" });
    expect(on.probe.vatTypes.map((v: { id: number }) => v.id)).toEqual([0, 6]);
    expect(on.probe.paymentAccounts).toEqual([]);
    expect(on.probe.errors.paymentAccounts).toMatch(/403/);
    expect(probeCalls.every((c) => c.startsWith("GET "))).toBe(true);
  });
  it("lets the dashboard decide payment methods unless they are listed explicitly", async () => {
    const { configuredPaymentMethods } = await import("@/lib/platform/payments");
    delete process.env.STRIPE_PAYMENT_METHODS; expect(configuredPaymentMethods()).toEqual([]);
    process.env.STRIPE_PAYMENT_METHODS = "card, klarna,customer_balance;drop"; expect(configuredPaymentMethods()).toEqual(["card", "klarna"]);
    delete process.env.STRIPE_PAYMENT_METHODS;
  });
});

describe("team overview, reminders and attribution", () => {
  it("shows each role only its own next actions and the owner the decisions still open", async () => {
    const seller = await data(await call("sellerA", "overview"));
    expect(seller.today.some((i: { kind: string }) => ["lead", "estimate", "followup", "unpaid", "handover", "review", "expiring", "expired"].includes(i.kind))).toBe(true);
    expect(seller.summary).toBeUndefined(); expect(seller.decisions).toBeUndefined();
    const editor = await data(await call("editorA", "overview"));
    expect(editor.today.every((i: { kind: string }) => !["lead", "review", "invoice"].includes(i.kind))).toBe(true);
    const finance = await data(await call("finance", "overview"));
    expect(finance.today.every((i: { kind: string }) => ["invoice", "order", "commissions", "refund"].includes(i.kind))).toBe(true);
    const owner = await data(await call("owner", "overview"));
    expect(owner.summary).toMatchObject({ awaitingReview: expect.any(Number), acceptedUnpaid: expect.any(Number) });
    expect(owner.decisions.some((d: { title: string }) => /commissioni|acquistabili|promemoria|IVA/i.test(d.title))).toBe(true);
    expect(owner.funnel.events.some((e: { name: string; kind: string }) => e.name === "quote_accepted" && e.kind === "economic")).toBe(true);
    expect((await call("authorA", "overview")).status).toBe(404);
  });
  it("sends each reminder once, stops when the state changes and respects the responsible's pause", async () => {
    const { runReminders } = await import("@/lib/platform/reminders");
    const email = "reminder-author@example.test";
    const [lead] = await db.insert(schema.leads).values({ nome: "Reminder Author", email, fonte: "preventivo", consensoPrivacy: true }).returning();
    const { computeQuote } = await import("@/lib/pricing");
    const packages = computeQuote(priceInput as Parameters<typeof computeQuote>[0]).packages;
    const [quote] = await db.insert(schema.quotes).values({ leadId: lead!.id, input: priceInput, pacchettiGenerati: packages, prezzoTotale: packages[1].total, acconto: packages[1].deposit, stato: "draft", createdAt: new Date(Date.now() - 8 * 86400_000) }).returning();
    await db.insert(platform.quoteRecords).values({ quoteId: quote!.id, pricingVersion: "test", commercialState: "offer", offeredAt: new Date(Date.now() - 8 * 86400_000), expiresAt: new Date(Date.now() + 86400_000) });
    const first = await runReminders();
    expect(first.sent).toBeGreaterThanOrEqual(3);
    const keys = (await db.select().from(platform.emailOutbox)).filter(r => r.recipient === email).map(r => r.eventKey);
    expect(keys).toContain(`reminder:unconfirmed:${quote!.id}:3d`); expect(keys).toContain(`reminder:unconfirmed:${quote!.id}:7d`); expect(keys).toContain(`reminder:expiry:${quote!.id}:1`);
    expect((await runReminders()).sent).toBe(0);
    // Accepted: the unconfirmed sequence stops; the unpaid one starts only after its own threshold.
    await db.update(platform.quoteRecords).set({ commercialState: "accepted", acceptedAt: new Date(Date.now() - 3 * 86400_000) }).where(eq(platform.quoteRecords.quoteId, quote!.id));
    await runReminders();
    const after = (await db.select().from(platform.emailOutbox)).filter(r => r.recipient === email).map(r => r.eventKey);
    expect(after).toContain(`reminder:unpaid:${quote!.id}:2d`); expect(after).not.toContain(`reminder:unpaid:${quote!.id}:5d`);
    expect(after.filter(k => k.startsWith("reminder:unconfirmed")).length).toBe(2);
    // Paused by the responsible: nothing more, even past the next threshold.
    await db.update(platform.quoteRecords).set({ remindersPausedAt: new Date(), acceptedAt: new Date(Date.now() - 6 * 86400_000) }).where(eq(platform.quoteRecords.quoteId, quote!.id));
    await runReminders();
    expect((await db.select().from(platform.emailOutbox)).filter(r => r.recipient === email && r.eventKey === `reminder:unpaid:${quote!.id}:5d`)).toHaveLength(0);
    // Disabled rules send nothing at all.
    await data(await call("owner", "settings", "PUT", { key: "reminder-rules", value: { version: "off", enabled: false } }));
    expect(await runReminders()).toMatchObject({ sent: 0, skipped: true });
    await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "reminder-rules"));
  });
  it("tracks the sales intervention separately from the assignment and lets the rule decide the commission", async () => {
    const { publicQuote } = await import("@/lib/platform/public-forms");
    const saved = await data(await publicQuote(new Request(`${origin}/api/preventivo`, { method: "POST", headers: { origin, "idempotency-key": randomUUID(), "content-type": "application/json" }, body: JSON.stringify({ input: { ...priceInput, requestedServices: [], singleService: "cover" }, contatto: { nome: "Autonomous Buyer", email: "autonomous@example.test", consensoPrivacy: true, consensoMarketing: false, ricontatto: true, telefono: "+39 000 0000" } }) })), 201);
    // A fixed-price single service is purchasable at once; the lead assignment alone is not an intervention.
    expect(saved.commercialState).toBe("offer");
    const [record] = await db.select().from(platform.quoteRecords).where(eq(platform.quoteRecords.quoteId, saved.quoteId));
    expect(record!.salesAssisted).toBe(false); expect(record!.expiresAt).not.toBeNull();
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.email, "autonomous@example.test"));
    expect(lead!.note).toContain("ricontattato");
    const detail = await data(await call("sellerA", `quotes/${saved.quoteId}`)).catch(() => null);
    if (detail) { expect(detail.attribution.salesAssisted).toBe(false); expect(detail.attribution.responsible).toBeTruthy(); }
    // Revising the proposal is an intervention.
    const owner = await data(await call("owner", `quotes/${saved.quoteId}`));
    await data(await call("owner", `quotes/${saved.quoteId}`, "PATCH", { version: owner.record.version, input: { ...priceInput, requestedServices: [], singleService: "cover", wordCount: 1000 } }));
    expect((await data(await call("owner", `quotes/${saved.quoteId}`))).attribution.salesAssisted).toBe(true);
    expect((await data(await call("owner", `quotes/${saved.quoteId}`))).attribution.commissionRule).toMatchObject({ assistedSalesOnly: false });
  });
  it("lists for the author what the team is waiting for and what waits for the author", async () => {
    const projects = await data(await call("authorA", "projects"));
    const mine = projects.projects.find((p: { quoteId: string | null }) => p.quoteId === quoteId);
    expect(mine).toMatchObject({ members: expect.any(Array), materialsCount: expect.any(Number), deliveriesAwaiting: expect.any(Array), unreadMessages: expect.any(Number) });
    const payments = await data(await call("authorA", `quotes/${quoteId}/payments`));
    expect(payments.project).toMatchObject({ id: mine.id, stage: expect.any(String) });
    expect(payments.journey).toBeTruthy();
  });
});
describe("contract, payment plan, refunds, withdrawal and project start", () => {
  const event = (type: string, object: unknown, id = `evt_test_${randomUUID()}`) => ({ id, type, livemode: false, data: { object } }) as Stripe.Event;
  const session = (orderId: string, quoteId: string, amount: number, intent: string, paid = true) => ({ id: `cs_test_${orderId}`, metadata: { orderId, quoteId }, client_reference_id: orderId, currency: "eur", amount_total: amount, payment_status: paid ? "paid" : "unpaid", payment_intent: intent, payment_method_types: ["card"] });
  let firstQuote: string, firstOrder: string, firstIntent: string, planQuote: string, planLead: string;
  it("keeps a verified payment even after expiry and failure events, and opens one project only", async () => {
    const { processStripeEvent } = await import("@/lib/platform/payments");
    firstQuote = (await data(await call("firstEuro", "quotes"))).quotes[0].id;
    const payments = await data(await call("firstEuro", `quotes/${firstQuote}/payments`));
    const [order] = await db.insert(platform.paymentOrders).values({ quoteId: firstQuote, authorId: actors.firstEuro!.id, tier: payments.schedule[0] ? (await data(await call("firstEuro", `quotes/${firstQuote}`))).record.selectedTier : "essenziale", amountCents: payments.deposit.grossCents, stripeSessionId: `cs_test_${randomUUID()}` }).returning();
    firstOrder = order!.id; firstIntent = `pi_test_${randomUUID()}`;
    const s = { ...session(firstOrder, firstQuote, payments.deposit.grossCents, firstIntent), id: order!.stripeSessionId! };
    await processStripeEvent(event("checkout.session.async_payment_failed", { ...s, payment_status: "unpaid" }));
    expect((await db.select().from(platform.paymentOrders).where(eq(platform.paymentOrders.id, firstOrder)))[0]!.status).toBe("failed");
    expect((await db.select().from(platform.projects).where(eq(platform.projects.quoteId, firstQuote)))).toHaveLength(0);
    // The bank transfer arrives later: the verified event wins over the earlier failure.
    await processStripeEvent(event("checkout.session.async_payment_succeeded", s));
    await processStripeEvent(event("checkout.session.expired", { ...s, payment_status: "unpaid" }));
    const [paid] = await db.select().from(platform.paymentOrders).where(eq(platform.paymentOrders.id, firstOrder));
    expect(paid!.status).toBe("paid"); expect(paid!.paymentMethod).toBe("card");
    const opened = await db.select().from(platform.projects).where(eq(platform.projects.quoteId, firstQuote));
    expect(opened).toHaveLength(1); expect(opened[0]!.startedAt).not.toBeNull();
    const after = await data(await call("firstEuro", `quotes/${firstQuote}/payments`));
    expect(after.journey).toBe("deposit_paid"); expect(after.project.id).toBe(opened[0]!.id); expect(after.contract.pdfUrl).toContain("/contracts/");
    expect(after.schedule.map((i: { kind: string; status: string }) => `${i.kind}:${i.status}`)).toEqual(["deposit:paid", "balance:due"]);
    // Disputes hold the order and its commissions; a dispute won restores the payment.
    await processStripeEvent(event("charge.dispute.created", { payment_intent: firstIntent, status: "needs_response" }));
    expect((await db.select().from(platform.paymentOrders).where(eq(platform.paymentOrders.id, firstOrder)))[0]!.status).toBe("disputed");
    await processStripeEvent(event("charge.dispute.closed", { payment_intent: firstIntent, status: "won" }));
    expect((await db.select().from(platform.paymentOrders).where(eq(platform.paymentOrders.id, firstOrder)))[0]!.status).toBe("paid");
    const author = await data(await call("firstEuro", "projects"));
    expect(author.projects.find((p: { id: string }) => p.id === opened[0]!.id).referent).toBeTruthy();
  });
  it("grants company installments within the rule, requires approval beyond it, binds them into the contract and starts work by the service rule", async () => {
    const { computeQuote } = await import("@/lib/pricing");
    const input = { ...priceInput, requestedServices: [], singleService: "cover" as const, wordCount: 1000 };
    const packages = computeQuote(input as Parameters<typeof computeQuote>[0]).packages;
    const [lead] = await db.insert(schema.leads).values({ nome: "Plan Buyer", email: actors.firstEuro!.email, fonte: "preventivo", consensoPrivacy: true }).returning();
    planLead = lead!.id;
    const [quote] = await db.insert(schema.quotes).values({ leadId: planLead, input, pacchettiGenerati: packages, prezzoTotale: packages[0].total, acconto: packages[0].deposit, stato: "draft" }).returning();
    planQuote = quote!.id;
    const { defaultPaymentPolicy } = await import("@/lib/platform/config");
    await db.insert(platform.quoteRecords).values({ quoteId: planQuote, pricingVersion: "test", commercialState: "offer", offeredAt: new Date(), expiresAt: new Date(Date.now() + 10 * 86400_000), taxPolicy: defaultPaymentPolicy });
    await db.insert(platform.leadOwnership).values({ leadId: planLead, authorId: actors.firstEuro!.id, assignedTo: actors.sellerA!.id });
    const blocked = await call("sellerA", `quotes/${planQuote}/plan`, "POST", { installments: 2 });
    expect(blocked.status).toBe(409); expect((await blocked.json()).code).toBe("APPROVAL_REQUIRED");
    await data(await call("owner", "settings", "PUT", { key: "purchase-rule", value: { version: "plan-test", autoOfferSingleServices: ["cover"], autoOfferFullPath: false, validityDays: 30, maxInstallments: 2, startAfter: { cover: "balance" }, balanceBeforeDelivery: true } }));
    expect((await data(await call("sellerA", `quotes/${planQuote}/plan`, "POST", { installments: 2 }))).exception).toBe(false);
    expect((await call("sellerA", `quotes/${planQuote}/plan`, "POST", { installments: 3 })).status).toBe(409);
    expect((await call("firstEuro", `quotes/${planQuote}/plan`, "POST", { installments: 1 })).status).toBe(404);
    const granted = await data(await call("owner", `quotes/${planQuote}/plan`, "POST", { installments: 3, note: "Eccezione concordata" }));
    expect(granted.exception).toBe(true);
    const before = await data(await call("firstEuro", `quotes/${planQuote}/payments`));
    const detail = await data(await call("firstEuro", `quotes/${planQuote}`));
    const gross = detail.packages[0].money.grossCents;
    expect(before.schedule).toHaveLength(4);
    expect(before.schedule.reduce((n: number, i: { amountCents: number }) => n + i.amountCents, 0)).toBe(gross);
    expect(before.plan).toMatchObject({ installments: 3, kind: "company_installment" });
    // Acceptance with the optional choices, evidence and the plan inside the order sheet.
    const accepted = await data(await call("firstEuro", `quotes/${planQuote}/accept`, "POST", { tier: detail.packages[0].tier, version: detail.record.version, policyVersion: defaultPaymentPolicy.version, termsAccepted: true, orderSheetAccepted: true, earlyStart: true, marketingConsent: true }, { "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "SyntheticBrowser/1.0" }));
    const [contract] = await db.select().from(platform.contracts).where(eq(platform.contracts.id, accepted.contractId));
    expect(contract!.acceptances).toEqual({ terms: true, orderSheet: true, earlyStart: true, marketing: true });
    expect(contract!.acceptedIp).toBe("203.0.113.9"); expect(contract!.acceptedUserAgent).toBe("SyntheticBrowser/1.0");
    expect(contract!.orderSheet.installments).toHaveLength(4); expect(contract!.termsHash).toMatch(/^[a-f0-9]{64}$/);
    expect((await db.select().from(schema.leads).where(eq(schema.leads.id, planLead)))[0]!.consensoMarketing).toBe(true);
    const staffView = await data(await call("sellerA", `contracts/${accepted.contractId}`));
    expect(staffView.contract.acceptedIp).toBe("203.0.113.9");
    expect((await data(await call("firstEuro", `contracts/${accepted.contractId}`))).contract).not.toHaveProperty("acceptedIp");
    expect((await call("owner", `quotes/${planQuote}/plan`, "POST", { installments: 1 })).status).toBe(409);
    expect((await call("owner", `quotes/${planQuote}`, "PATCH", { version: detail.record.version, input })).status).toBe(409);
    // Payments follow the schedule; for this service the work starts only with the full balance.
    const { processStripeEvent } = await import("@/lib/platform/payments");
    const schedule = before.schedule as Array<{ kind: "deposit" | "balance"; sequence: number; amountCents: number }>;
    for (const [index, item] of schedule.entries()) {
      const [order] = await db.insert(platform.paymentOrders).values({ quoteId: planQuote, authorId: actors.firstEuro!.id, tier: detail.packages[0].tier, kind: item.kind, sequence: item.sequence, plan: item.kind === "balance" ? "company_installment" : "standard", amountCents: item.amountCents, stripeSessionId: `cs_test_${randomUUID()}` }).returning();
      const s = { ...session(order!.id, planQuote, item.amountCents, `pi_test_${randomUUID()}`), id: order!.stripeSessionId! };
      await processStripeEvent(event("checkout.session.completed", s));
      const [project] = await db.select().from(platform.projects).where(eq(platform.projects.quoteId, planQuote));
      const [row] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, planQuote));
      if (index < schedule.length - 1) { expect(project!.startedAt).toBeNull(); expect(row!.stato).toBe("deposit_paid"); }
      else { expect(project!.startedAt).not.toBeNull(); expect(row!.stato).toBe("won"); }
      if (index === 0) {
        expect(project!.startCondition).toBe("balance");
        await data(await call("owner", `projects/${project!.id}/members`, "POST", { userId: actors.editorA!.id }));
        const early = await call("editorA", `projects/${project!.id}`, "PATCH", { stage: "editing" });
        expect(early.status).toBe(409); expect((await early.json()).code).toBe("PAYMENT_REQUIRED");
      }
    }
    expect((await db.select().from(platform.projects).where(eq(platform.projects.quoteId, planQuote)))).toHaveLength(1);
    const [project] = await db.select().from(platform.projects).where(eq(platform.projects.quoteId, planQuote));
    expect((await call("editorA", `projects/${project!.id}`, "PATCH", { stage: "editing" })).status).toBe(200);
    // Final delivery waits for the balance when the rule says so, then for an approved delivery.
    await db.update(platform.projects).set({ stage: "approved" }).where(eq(platform.projects.id, project!.id));
    await db.update(schema.quotes).set({ stato: "deposit_paid" }).where(eq(schema.quotes.id, planQuote));
    const unpaid = await call("editorA", `projects/${project!.id}`, "PATCH", { stage: "delivered" });
    expect(unpaid.status).toBe(409); expect((await unpaid.json()).code).toBe("BALANCE_REQUIRED");
    await db.update(schema.quotes).set({ stato: "won" }).where(eq(schema.quotes.id, planQuote));
    expect((await (await call("editorA", `projects/${project!.id}`, "PATCH", { stage: "delivered" })).json()).code).toBe("MISSING_DELIVERY");
    await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "purchase-rule"));
  });
  it("prepares and authorizes a refund with four eyes, moves money only through Stripe and books it on the verified event", async () => {
    const { stripe } = await import("@/lib/stripe");
    const { processStripeEvent } = await import("@/lib/platform/payments");
    const [paidOrder] = await db.select().from(platform.paymentOrders).where(eq(platform.paymentOrders.id, firstOrder));
    expect((await call("finance", "refunds", "POST", { orderId: firstOrder, amountCents: 100, reason: "Rettifica concordata con il cliente" })).status).toBe(403);
    const prepared = await data(await call("owner", "refunds", "POST", { orderId: firstOrder, amountCents: 100, reason: "Rettifica concordata con il cliente" }), 201);
    expect(prepared.moneyMoved).toBe(false);
    const same = await call("owner", `refunds/${prepared.request.id}/authorize`, "POST");
    expect(same.status).toBe(409); expect((await same.json()).code).toBe("FOUR_EYES");
    expect((await call("finance", `refunds/${prepared.request.id}/authorize`, "POST")).status).toBe(403);
    await db.update(platform.memberships).set({ grants: [...ROLE_GRANTS.finance, { permission: "refund.authorize", scope: "organization" }] }).where(eq(platform.memberships.userId, actors.finance!.id));
    const create = vi.spyOn(stripe().refunds, "create").mockResolvedValue({ id: "re_synthetic_1", status: "pending" } as never);
    const authorized = await data(await call("finance", `refunds/${prepared.request.id}/authorize`, "POST"));
    expect(authorized).toMatchObject({ stripeRefundId: "re_synthetic_1", moneyMoved: true, settled: false });
    expect(create).toHaveBeenCalledWith({ payment_intent: paidOrder!.stripePaymentIntentId, amount: 100, metadata: expect.any(Object) }, { idempotencyKey: `proemios-refund-${prepared.request.id}` });
    expect((await call("finance", `refunds/${prepared.request.id}/authorize`, "POST")).status).toBe(409);
    expect((await db.select().from(platform.ledgerEntries).where(eq(platform.ledgerEntries.orderId, firstOrder))).filter(e => e.kind === "refund")).toHaveLength(0);
    await processStripeEvent(event("refund.updated", { id: "re_synthetic_1", status: "succeeded", payment_intent: paidOrder!.stripePaymentIntentId, currency: "eur", amount: 100 }));
    const [executed] = await db.select().from(platform.refundRequests).where(eq(platform.refundRequests.id, prepared.request.id));
    expect(executed!.status).toBe("executed"); expect(executed!.authorizedBy).toBe(actors.finance!.id);
    expect((await db.select().from(platform.paymentOrders).where(eq(platform.paymentOrders.id, firstOrder)))[0]!.status).toBe("partially_refunded");
    // A provider failure keeps the request retryable and never books anything.
    const second = await data(await call("owner", "refunds", "POST", { orderId: firstOrder, amountCents: 50, reason: "Seconda rettifica di prova" }), 201);
    create.mockRejectedValueOnce(new Error("Stripe down"));
    expect((await call("finance", `refunds/${second.request.id}/authorize`, "POST")).status).toBe(502);
    expect((await db.select().from(platform.refundRequests).where(eq(platform.refundRequests.id, second.request.id)))[0]!.status).toBe("failed");
    create.mockRestore();
    await db.update(platform.memberships).set({ grants: null }).where(eq(platform.memberships.userId, actors.finance!.id));
  });
  it("lets a consumer withdraw online within 14 days, stops new payments and lets the team close the case", async () => {
    const detail = await data(await call("firstEuro", `quotes/${firstQuote}`));
    const contractId = detail.contract.id as string;
    expect(detail.contract.consumer).toBe(true); expect(detail.terms.status).toBe("approved");
    expect((await call("authorA", `contracts/${contractId}/withdraw`, "POST", {})).status).toBe(404);
    const withdrawn = await data(await call("firstEuro", `contracts/${contractId}/withdraw`, "POST", { note: "Ho cambiato idea." }));
    expect(withdrawn.contract.withdrawalRequestedAt).toBeTruthy(); expect(withdrawn.duplicate).toBe(false);
    expect((await data(await call("firstEuro", `contracts/${contractId}/withdraw`, "POST", {}))).duplicate).toBe(true);
    const mails = await db.select().from(platform.emailOutbox);
    expect(mails.some(m => m.eventKey === `contract:${contractId}:withdrawal:team`)).toBe(true);
    expect(mails.some(m => m.eventKey === `contract:${contractId}:withdrawal:author`)).toBe(true);
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? `whsec_${randomBytes(16).toString("hex")}`;
    const blocked = await call("firstEuro", "checkout", "POST", { quoteId: firstQuote, kind: "balance" });
    expect(blocked.status).toBe(409); expect((await blocked.json()).code).toBe("WITHDRAWN");
    expect((await call("editorA", `contracts/${contractId}/withdrawal`, "POST", { outcome: "accepted" })).status).toBe(404);
    expect((await call("admin", `contracts/${contractId}/withdrawal`, "POST", { outcome: "accepted" })).status).toBe(403);
    const closed = await data(await call("finance", `contracts/${contractId}/withdrawal`, "POST", { outcome: "accepted", note: "Rimborso autorizzato separatamente." }));
    expect(closed.contract.withdrawalOutcome).toBe("accepted");
    expect((await db.select().from(platform.projects).where(eq(platform.projects.quoteId, firstQuote)))[0]!.remindersPausedAt).not.toBeNull();
  });
});

describe("CRM pipeline, authorized import, recoveries and consents", () => {
  let marketLead: string, recoveryQuote: string, recoveryLead: string;
  const HOUR = 3600_000;
  it("derives the pipeline from facts, allows only manual states by hand and never marks a purchase without a verified payment", async () => {
    // The paid lead was reassigned to sellerB during the payment tests.
    const paid = await data(await call("sellerB", `leads/${leadId}`));
    expect(paid.lead.pipeline).toBe("won");
    expect((await call("sellerB", `leads/${leadId}`, "PATCH", { stage: "lost", lostReason: "Prova" })).status).toBe(409);
    expect((await call("sellerA", `leads/${leadId}`)).status).toBe(404);
    const created = await data(await call("sellerA", "leads", "POST", { nome: "Pipeline Test", email: "pipeline@example.test", consensoPrivacy: true }), 201);
    const fresh = await data(await call("sellerA", `leads/${created.lead.id}`));
    expect(fresh.lead.pipeline).toBe("received"); expect(fresh.activities.some((a: { kind: string }) => a.kind === "created")).toBe(true);
    expect((await call("sellerA", `leads/${created.lead.id}`, "PATCH", { stage: "won" })).status).toBe(409);
    expect((await call("sellerA", `leads/${created.lead.id}`, "PATCH", { stage: "quote_sent" })).status).toBe(409);
    expect((await call("sellerA", `leads/${created.lead.id}`, "PATCH", { stage: "lost" })).status).toBe(422);
    const due = new Date(Date.now() + 2 * HOUR).toISOString();
    await data(await call("sellerA", `leads/${created.lead.id}`, "PATCH", { stage: "negotiation", nextAction: "Richiamare per il pacchetto Consigliato", nextActionAt: due, contactPreferences: { email: true, phone: true, whatsapp: false, sms: false } }));
    const negotiating = await data(await call("sellerA", `leads/${created.lead.id}`));
    expect(negotiating.lead.pipeline).toBe("negotiation"); expect(negotiating.lead.nextAction).toContain("Richiamare");
    expect((await data(await call("sellerA", "overview"))).today.some((i: { kind: string; title: string }) => i.kind === "next-action" && i.title.includes("Pipeline Test"))).toBe(true);
    // A legacy quote for this lead becomes a derived state again once the team closes the negotiation.
    const lost = await data(await call("sellerA", `leads/${created.lead.id}`, "PATCH", { stage: "lost", lostReason: "Ha scelto un altro fornitore" }));
    expect(lost.pipeline).toBe("lost");
    const closed = await data(await call("sellerA", `leads/${created.lead.id}`));
    expect(closed.lead.lostReason).toBe("Ha scelto un altro fornitore"); expect(closed.lead.closedAt).toBeTruthy();
    expect(closed.activities.filter((a: { kind: string }) => a.kind === "state")).toHaveLength(2);
    // Manual channel activities respect the person's channel preferences; nothing is ever sent from here.
    expect((await call("sellerA", `leads/${created.lead.id}/activities`, "POST", { kind: "whatsapp", body: "Messaggio di prova", outcome: "reached" })).status).toBe(409);
    await data(await call("sellerA", `leads/${created.lead.id}/activities`, "POST", { kind: "call", body: "Telefonata: richiamare domani", outcome: "callback", nextAction: "Richiamare", nextActionAt: due }), 201);
    expect((await data(await call("sellerA", `leads/${created.lead.id}`))).lead.lastContactAt).toBeTruthy();
  });
  it("imports authorized marketplace contacts once, without any outbound message, and lets the assigned seller take over", async () => {
    expect((await call("sellerA", "leads/import", "POST", { fonte: "marketplace", sourceDetail: "AddLance", rows: [] })).status).toBe(403);
    expect((await call("sellerA", "leads", "POST", { nome: "Market Lead", email: "market@example.test", fonte: "marketplace", sourceDetail: "AddLance" })).status).toBe(403);
    const before = (await db.select().from(platform.emailOutbox)).length;
    const result = await data(await call("owner", "leads/import", "POST", { fonte: "marketplace", sourceDetail: "AddLance · offerta 1234", rows: [
      { nome: "Market Lead", email: "Market@example.test", telefono: "+39 333 0000000", externalRef: "addlance-1", consensoPrivacy: true, note: "Ha risposto all'offerta." },
      { nome: "Pipeline Test", email: "pipeline@example.test", externalRef: "addlance-2" },
      { nome: "X", email: "non-valida" },
    ] }), 201);
    expect(result).toMatchObject({ imported: 1, duplicates: 1, invalid: 1 });
    marketLead = result.leadIds[0];
    expect((await db.select().from(platform.emailOutbox)).length).toBe(before);
    const csv = await data(await handler(new Request(`${origin}/api/platform/leads/import?fonte=marketplace&origine=AddLance%20CSV`, { method: "POST", headers: { origin, cookie: actors.owner!.cookie, "content-type": "text/csv" }, body: 'nome,email,telefono,ref,consenso\n"Rossi, Anna",anna.rossi@example.test,,addlance-9,true\nMarket Lead,market@example.test,,addlance-1,true\n' })), 201);
    expect(csv).toMatchObject({ imported: 1, duplicates: 1, invalid: 0 });
    const [anna] = await db.select().from(schema.leads).where(eq(schema.leads.email, "anna.rossi@example.test"));
    expect(anna!.nome).toBe("Rossi, Anna"); expect(anna!.fonte).toBe("marketplace"); expect(anna!.sourceDetail).toBe("AddLance CSV");
    expect((await call("admin", "leads", "POST", { nome: "Market Lead", email: "market@example.test", fonte: "marketplace" })).status).toBe(409);
    // Unassigned until the team hands it over; then the seller works it with the person's channels only.
    expect((await call("sellerA", `leads/${marketLead}`)).status).toBe(404);
    expect((await call("sellerA", `leads/${marketLead}`, "PATCH", { assignedTo: actors.sellerA!.id })).status).toBe(404);
    await data(await call("owner", `leads/${marketLead}`, "PATCH", { assignedTo: actors.sellerA!.id, contactPreferences: { email: true, phone: true, whatsapp: true, sms: false } }));
    const mine = await data(await call("sellerA", `leads/${marketLead}`));
    expect(mine.lead.fonte).toBe("marketplace"); expect(mine.ownership.assignedTo).toBe(actors.sellerA!.id);
    expect(mine.activities.some((a: { kind: string }) => a.kind === "assignment")).toBe(true);
    await data(await call("sellerA", `leads/${marketLead}/activities`, "POST", { kind: "whatsapp", body: "Presentazione e richiesta del manoscritto", outcome: "reached" }), 201);
    expect((await call("sellerA", `leads/${marketLead}/activities`, "POST", { kind: "sms", body: "no", outcome: "other" })).status).toBe(409);
    const list = await data(await call("sellerA", "leads?fonte=marketplace"));
    expect(list.leads.map((l: { id: string }) => l.id)).toContain(marketLead);
    expect(list.leads.every((l: { fonte: string }) => l.fonte === "marketplace")).toBe(true);
  });
  it("recovers abandoned checkouts step by step, stops on payment, reply, takeover, revoked consent or frequency limit", async () => {
    const { runRecovery, unsubscribeLink } = await import("@/lib/platform/recovery");
    const { computeQuote } = await import("@/lib/pricing");
    const { defaultPaymentPolicy } = await import("@/lib/platform/config");
    const packages = computeQuote(priceInput as Parameters<typeof computeQuote>[0]).packages;
    async function scenario(email: string, options: { marketing?: boolean; emailAllowed?: boolean; status?: string } = {}) {
      const [lead] = await db.insert(schema.leads).values({ nome: "Recovery Case", email, fonte: "preventivo", consensoPrivacy: true, consensoMarketing: options.marketing ?? false, contactPreferences: options.emailAllowed === false ? { email: false, phone: true, whatsapp: false, sms: false } : null }).returning();
      const [quote] = await db.insert(schema.quotes).values({ leadId: lead!.id, input: priceInput, pacchettiGenerati: packages, prezzoTotale: packages[1].total, acconto: packages[1].deposit, stato: "draft" }).returning();
      await db.insert(platform.quoteRecords).values({ quoteId: quote!.id, pricingVersion: "test", commercialState: "accepted", acceptedAt: new Date(), acceptedBy: actors.authorA!.id, selectedTier: "consigliato", taxPolicy: defaultPaymentPolicy, offeredAt: new Date() });
      await db.insert(platform.leadOwnership).values({ leadId: lead!.id, authorId: actors.authorA!.id, assignedTo: actors.sellerA!.id });
      const [order] = await db.insert(platform.paymentOrders).values({ quoteId: quote!.id, authorId: actors.authorA!.id, tier: "consigliato", amountCents: 1000, status: options.status ?? "pending", stripeSessionId: `cs_test_${randomUUID()}` }).returning();
      return { leadId: lead!.id, quoteId: quote!.id, orderId: order!.id };
    }
    const mails = async (email: string) => (await db.select().from(platform.emailOutbox)).filter((m) => m.recipient === email);
    const start = Date.now();
    const main = await scenario("recovery-main@example.test", { status: "failed" });
    recoveryQuote = main.quoteId; recoveryLead = main.leadId;
    expect((await data(await call("sellerA", `leads/${main.leadId}`))).lead.pipeline).toBe("payment_failed");
    expect(await runRecovery(new Date(start + 1 * HOUR))).toMatchObject({ sent: 0, tasks: 0 });
    expect(await runRecovery(new Date(start + 3 * HOUR))).toMatchObject({ sent: 1 });
    expect(await runRecovery(new Date(start + 3 * HOUR))).toMatchObject({ sent: 0 });
    expect((await mails("recovery-main@example.test")).map((m) => m.subject)).toEqual(["Il tuo pagamento è rimasto in sospeso · Proemios"]);
    expect(await runRecovery(new Date(start + 25 * HOUR))).toMatchObject({ sent: 1 });
    const third = await runRecovery(new Date(start + 61 * HOUR));
    expect(third).toMatchObject({ sent: 0, tasks: 1 });
    expect((await mails("recovery-main@example.test"))).toHaveLength(2);
    const handed = await data(await call("sellerA", `leads/${main.leadId}`));
    expect(handed.lead.pipeline).toBe("recovery"); expect(handed.tasks.some((t: { title: string }) => t.title.startsWith("Recupera"))).toBe(true);
    expect((await db.select().from(platform.notifications).where(eq(platform.notifications.userId, actors.sellerA!.id))).some((n) => n.title === "Contatto da recuperare")).toBe(true);
    expect(handed.activities.filter((a: { kind: string }) => a.kind === "automation")).toHaveLength(3);
    // Paid in the meantime: nothing goes out, the state is "won" from the verified event.
    const { processStripeEvent } = await import("@/lib/platform/payments");
    const paidCase = await scenario("recovery-paid@example.test");
    const [paidOrder] = await db.select().from(platform.paymentOrders).where(eq(platform.paymentOrders.id, paidCase.orderId));
    await processStripeEvent({ id: `evt_test_${randomUUID()}`, type: "checkout.session.completed", livemode: false, data: { object: { id: paidOrder!.stripeSessionId, metadata: { orderId: paidCase.orderId, quoteId: paidCase.quoteId }, client_reference_id: paidCase.orderId, currency: "eur", amount_total: 1000, payment_status: "paid", payment_intent: `pi_test_${randomUUID()}` } } } as unknown as Stripe.Event);
    await runRecovery(new Date(start + 3 * HOUR));
    expect(await mails("recovery-paid@example.test")).toHaveLength(0);
    expect((await data(await call("sellerA", `leads/${paidCase.leadId}`))).lead.pipeline).toBe("won");
    // The person replied: the seller takes over, automations stop.
    const replied = await scenario("recovery-replied@example.test");
    await db.insert(platform.leadActivities).values({ leadId: replied.leadId, kind: "email", direction: "inbound", body: "Risposta della persona" });
    expect(await runRecovery(new Date(start + 3 * HOUR))).toMatchObject({ sent: 0 });
    expect(await mails("recovery-replied@example.test")).toHaveLength(0);
    const takeover = await scenario("recovery-takeover@example.test");
    await data(await call("sellerA", `leads/${takeover.leadId}/activities`, "POST", { kind: "call", body: "Parlato: pensa", outcome: "reached" }), 201);
    await runRecovery(new Date(start + 3 * HOUR));
    expect(await mails("recovery-takeover@example.test")).toHaveLength(0);
    // Email channel excluded by the person: skipped and recorded, never sent.
    const noEmail = await scenario("recovery-noemail@example.test", { emailAllowed: false });
    await runRecovery(new Date(start + 3 * HOUR));
    expect(await mails("recovery-noemail@example.test")).toHaveLength(0);
    expect((await db.select().from(platform.leadActivities).where(eq(platform.leadActivities.leadId, noEmail.leadId))).some((a) => a.outcome === "skipped")).toBe(true);
    // A marketing-purpose step needs explicit consent; the link in it revokes it without login.
    await data(await call("owner", "settings", "PUT", { key: "recovery-rules", value: { version: "mkt-test", enabled: true, triggers: ["checkout_started", "payment_failed"], steps: [{ key: "promo", afterHours: 1, channel: "email", purpose: "marketing", subject: "Una guida per te · Proemios", body: "ti mandiamo la nostra guida alla pubblicazione, senza impegno." }], maxPerWeek: 1, stopOnSellerActivity: true } }));
    const noConsent = await scenario("recovery-noconsent@example.test");
    const consented = await scenario("recovery-consent@example.test", { marketing: true });
    await runRecovery(new Date(start + 2 * HOUR));
    expect(await mails("recovery-noconsent@example.test")).toHaveLength(0);
    expect((await mails("recovery-consent@example.test")).map((m) => m.subject)).toEqual(["Una guida per te · Proemios"]);
    const { GET: revoke } = await import("@/app/api/consensi/revoca/route");
    expect((await revoke(new Request(`${origin}/api/consensi/revoca?lead=${consented.leadId}&t=wrong`))).status).toBe(400);
    expect((await revoke(new Request(unsubscribeLink(consented.leadId)))).status).toBe(200);
    const [revoked] = await db.select().from(schema.leads).where(eq(schema.leads.id, consented.leadId));
    expect(revoked!.consensoMarketing).toBe(false); expect(revoked!.marketingRevokedAt).toBeTruthy();
    void noConsent;
    await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "recovery-rules"));
  });
  it("keeps discounts inside the authorized thresholds, as new versions, with the alternatives suggested first", async () => {
    const created = await data(await call("sellerB", `leads/${leadId}/quotes`, "POST", { input: priceInput }), 201);
    const quote = created.quote.id as string;
    const await0 = (id: string) => call("sellerB", `quotes/${id}`);
    const version = async () => (await data(await await0(quote))).record.version as number;
    const blocked = await call("sellerB", `quotes/${quote}`, "PATCH", { version: await version(), input: priceInput, discountBps: 500, discountNote: "Richiesta del cliente" });
    expect(blocked.status).toBe(409); expect((await blocked.json()).code).toBe("APPROVAL_REQUIRED");
    await data(await call("owner", "settings", "PUT", { key: "purchase-rule", value: { version: "discount-test", autoOfferSingleServices: [], autoOfferFullPath: false, validityDays: 30, maxInstallments: 1, startAfter: {}, balanceBeforeDelivery: true, maxSellerDiscountBps: 1000, maxDiscountBps: 2000 } }));
    const ok = await data(await call("sellerB", `quotes/${quote}`, "PATCH", { version: await version(), input: priceInput, discountBps: 500, discountNote: "Richiesta del cliente" }));
    expect(ok).toMatchObject({ discountBps: 500, exception: false });
    const detail = await data(await await0(quote));
    const base = created.packages.find((p: { recommended: boolean }) => p.recommended).total;
    const discounted = detail.packages.find((p: { recommended: boolean }) => p.recommended);
    expect(discounted.total).toBe(base - Math.round(base * 0.05));
    expect(discounted.lineItems.some((li: { key: string; amount: number }) => li.key === "negotiatedDiscount" && li.amount < 0)).toBe(true);
    expect(detail.history).toHaveLength(1);
    expect((await call("sellerB", `quotes/${quote}`, "PATCH", { version: await version(), input: priceInput, discountBps: 1500 })).status).toBe(409);
    expect((await data(await call("owner", `quotes/${quote}`, "PATCH", { version: await version(), input: priceInput, discountBps: 1500 }))).exception).toBe(true);
    expect((await call("owner", `quotes/${quote}`, "PATCH", { version: await version(), input: priceInput, discountBps: 2500 })).status).toBe(422);
    const lead = await data(await call("sellerB", `leads/${leadId}`));
    expect(lead.activities.filter((a: { kind: string }) => a.kind === "negotiation")).toHaveLength(2);
    await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "purchase-rule"));
    void recoveryQuote; void recoveryLead;
  });
});

describe("Marketing role, granular delegations, campaigns and attribution", () => {
  let campaignId: string;
  it("gives Marketing only its own modules and keeps manuscripts, contacts, finance, users and keys out of reach", async () => {
    await createActor("marketing", "marketing");
    const dashboard = await data(await call("marketing", "marketing"));
    expect(dashboard.metrics.length).toBeGreaterThan(10);
    const byKey = (k: string) => dashboard.metrics.find((m: { key: string }) => m.key === k);
    expect(byKey("visits").status).toBe("to_connect");
    expect(byKey("contract_value").status).toBe("unauthorized");
    expect(byKey("purchases")).toMatchObject({ status: "ok", definition: expect.any(String), source: expect.any(String) });
    expect(dashboard.metrics.every((m: { demo: boolean }) => m.demo === false)).toBe(true);
    for (const path of ["leads", "finance", "team", "settings", "operations", "integrations", "commissions"]) expect([403, 404], path).toContain((await call("marketing", path)).status);
    // Like every account, the marketing person also has a self-service author profile: it shows only its own (empty) books and quotes.
    expect((await data(await call("marketing", "projects"))).projects).toHaveLength(0);
    expect((await data(await call("marketing", "quotes"))).quotes).toHaveLength(0);
    expect([403, 404]).toContain((await call("marketing", `projects/${projectA}`)).status);
    expect([403, 404]).toContain((await call("marketing", `quotes/${quoteId}`)).status);
    expect([403, 404]).toContain((await call("marketing", `leads/${leadId}`)).status);
    expect((await call("marketing", "marketing/contacts")).status).toBe(200);
    expect((await call("marketing", "automations/activate", "POST")).status).toBe(403);
    expect((await call("marketing", `leads/${leadId}`, "PATCH", { assignedTo: actors.sellerA!.id })).status).toBe(404);
    expect((await call("sellerA", "marketing")).status).toBe(403);
    expect((await call("sellerA", "campaigns")).status).toBe(403);
    expect([403, 404]).toContain((await call("authorA", "marketing")).status);
  });
  it("registers campaigns with tracked links, attributes requests, imports spend without duplicates and computes the KPIs", async () => {
    const created = await data(await call("marketing", "campaigns", "POST", { name: "Lancio autunno", channel: "google_ads", utmSource: "google", utmMedium: "cpc", utmCampaign: "lancio-autunno", budgetCents: 50000 }), 201);
    campaignId = created.campaign.id;
    expect(created.campaign.link).toContain("utm_source=google"); expect(created.campaign.link).toContain(`pc=${campaignId}`); expect(created.campaign.link).toContain("/preventivo");
    expect((await call("marketing", "campaigns", "POST", { name: "Doppione", channel: "google_ads", utmSource: "google", utmMedium: "cpc", utmCampaign: "lancio-autunno" })).status).toBe(409);
    expect((await call("marketing", "campaigns", "POST", { name: "Brutta", channel: "meta", utmSource: "Meta Ads", utmMedium: "cpc", utmCampaign: "x" })).status).toBe(422);
    // A public request carries the session attribution: no cookie, no personal data in the URL.
    const { publicQuote } = await import("@/lib/platform/public-forms");
    const saved = await data(await publicQuote(new Request(`${origin}/api/preventivo`, { method: "POST", headers: { origin, "idempotency-key": randomUUID(), "content-type": "application/json" }, body: JSON.stringify({ input: priceInput, contatto: { nome: "Campaign Buyer", email: "campaign-buyer@example.test", consensoPrivacy: true, consensoMarketing: true, telefono: "+39 333 1234567" }, attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: "lancio-autunno", campaignId, landingPath: "/preventivo?utm_source=google", referrer: "https://www.google.com/" } }) })), 201);
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.email, "campaign-buyer@example.test"));
    expect(lead!.attribution).toMatchObject({ utmSource: "google", campaignId }); expect(lead!.sourceDetail).toBe("lancio-autunno"); expect(lead!.leadScore).toBeGreaterThan(20); expect(lead!.marketingConsentAt).toBeTruthy();
    void saved;
    const spend = await data(await call("marketing", `campaigns/${campaignId}/spend`, "POST", { source: "google-ads", rows: [{ day: "2026-10-01", spend: 12.5, clicks: 40 }, { day: "2026-10-02", spend: 7.5, clicks: 20 }, { day: "2026-10-01", spend: 99, clicks: 1 }] }), 201);
    expect(spend).toMatchObject({ imported: 2, duplicates: 1, invalid: 0 });
    const csv = await data(await handler(new Request(`${origin}/api/platform/campaigns/${campaignId}/spend?origine=google-ads`, { method: "POST", headers: { origin, cookie: actors.marketing!.cookie, "content-type": "text/csv" }, body: "Giorno;Costo;Clic\n2026-10-03;5,00;10\n2026-10-02;1,00;1\n" })), 201);
    expect(csv).toMatchObject({ imported: 1, duplicates: 1 });
    const detail = await data(await call("marketing", `campaigns/${campaignId}`));
    expect(detail.campaign.results).toMatchObject({ leads: 1, quotes: 1, purchases: 0, spendCents: 2500, clicks: 70, costPerLeadCents: 2500, collectedCents: null, roas: null });
    expect(detail.campaign.results.budgetUsedPct).toBe(5);
    const dashboard = await data(await call("marketing", "marketing?giorni=90"));
    const byKey = (k: string) => dashboard.metrics.find((m: { key: string }) => m.key === k);
    expect(byKey("attributed_leads").value).toBeGreaterThanOrEqual(1);
    expect(byKey("ad_spend")).toMatchObject({ value: 2500, status: "ok" });
    expect(byKey("cost_per_lead").status).toBe("ok");
    // Authorized contacts: minimal fields only.
    const contacts = await data(await call("marketing", "marketing/contacts"));
    const buyer = contacts.contacts.find((c: { email: string }) => c.email === "campaign-buyer@example.test");
    expect(buyer).toMatchObject({ nome: "Campaign Buyer", fonte: "preventivo", campaign: "lancio-autunno" });
    expect(buyer).not.toHaveProperty("telefono"); expect(buyer).not.toHaveProperty("note");
    expect((await call("marketing", `marketing/contacts/${buyer.id}`, "PATCH", { assignedTo: actors.sellerA!.id })).status).toBe(403);
  });
  it("lets the owner delegate marketing permissions one by one to an Admin and keeps activation separate from drafting", async () => {
    const draft = await data(await call("marketing", "automations", "PUT", { value: { version: "bozza-1", enabled: true, triggers: ["payment_failed"], steps: [{ key: "gentle", afterHours: 4, channel: "email", purpose: "assistance", subject: "Serve aiuto? · Proemios", body: "se il pagamento non è andato a buon fine, possiamo aiutarti noi." }], maxPerWeek: 2, stopOnSellerActivity: true } }));
    expect(draft.draft.approvedBy).toContain("bozza:");
    expect((await db.select().from(platform.platformSettings).where(eq(platform.platformSettings.key, "recovery-rules")))).toHaveLength(0);
    const [membership] = (await db.select().from(platform.memberships).where(eq(platform.memberships.userId, actors.admin!.id))).filter((m) => m.role === "admin");
    expect((await call("admin", "marketing")).status).toBe(403);
    await data(await call("owner", `memberships/${membership!.id}`, "PATCH", { active: true, grants: [...ROLE_GRANTS.admin, { permission: "marketing.read", scope: "organization" }, { permission: "automation.activate", scope: "organization" }, { permission: "revenue.aggregate", scope: "organization" }, { permission: "crm.assign", scope: "organization" }] }));
    // Grants changed: the admin signs in again (the previous session was revoked).
    const login = await authRequest("sign-in/email", { email: actors.admin!.email, password });
    actors.admin!.cookie = cookies(login);
    const verify = await authRequest("two-factor/verify-totp", { code: URI.parse(secrets.get("admin")!).generate(), trustDevice: false }, actors.admin!.cookie);
    actors.admin!.cookie = cookies(verify, actors.admin!.cookie);
    const admin2 = await data(await call("admin", "marketing"));
    expect(admin2.metrics.find((m: { key: string }) => m.key === "contract_value").status).toBe("ok");
    expect(admin2.metrics.find((m: { key: string }) => m.key === "collected").value).toBeGreaterThan(0);
    expect((await call("admin", "campaigns", "POST", { name: "Non autorizzata", channel: "meta", utmSource: "meta", utmMedium: "cpc", utmCampaign: "no" })).status).toBe(403);
    const activated = await data(await call("admin", "automations/activate", "POST"));
    expect(activated.active.version).toBe("bozza-1");
    expect((await data(await call("admin", "automations"))).active.approvedBy).toBe(actors.admin!.id);
    const contacts = await data(await call("marketing", "marketing/contacts"));
    const buyer = contacts.contacts.find((c: { email: string }) => c.email === "campaign-buyer@example.test");
    await data(await call("admin", `marketing/contacts/${buyer.id}`, "PATCH", { assignedTo: actors.sellerA!.id }));
    expect((await data(await call("sellerA", "leads"))).leads.some((l: { id: string }) => l.id === buyer.id)).toBe(true);
    expect((await call("admin", "integrations")).status).toBe(403);
    await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "recovery-rules"));
    void campaignId;
  });
});
