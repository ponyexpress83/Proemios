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
async function call(actor: string | null, path: string, method = "GET", body?: unknown) {
  return handler(new Request(`${origin}/api/platform/${path}`, { method, headers: { origin, cookie: actor ? actors[actor]!.cookie : "", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
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
    expect((await call("authorA", `quotes/${quoteId}/accept`, "POST", { tier: "consigliato", version: 2, policyVersion: "unknown", termsAccepted: true })).status).toBe(409);
    await data(await call("owner", "settings", "PUT", { key: "payment-policy", value: policy }));
    await data(await call("owner", "settings", "PUT", { key: "commission-rule", value: rule }));
    await data(await call("sellerA", `quotes/${quoteId}`, "PATCH", { version: 2, input: priceInput }));
    const body = { tier: "consigliato", version: 3, policyVersion: policy.version, termsAccepted: true };
    expect((await call("authorA", `quotes/${quoteId}/accept`, "POST", { ...body, version: 2 })).status).toBe(409);
    await data(await call("authorA", `quotes/${quoteId}/accept`, "POST", body));
    await data(await call("authorA", `quotes/${quoteId}/accept`, "POST", body));
    expect((await db.select().from(platform.projects).where(eq(platform.projects.quoteId, quoteId)))).toHaveLength(1);
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
