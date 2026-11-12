/**
 * Sincronizzazione verso HubSpot su un database PGlite con le migrazioni reali
 * e un HubSpot simulato in memoria. Nessuna chiamata reale: il servizio vero
 * resta da verificare con il token della app privata.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "@/db/schema";
import * as platform from "@/db/platform-schema";
import * as crm from "@/db/crm-schema";
import * as identity from "@/db/auth-schema";
import { businessDue } from "@/lib/platform/hubspot";

const shared = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => shared.db, dbConfigurato: () => true }));
import { syncHubSpot, hubSpotSyncState } from "@/lib/platform/hubspot-sync";

let database: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

/** HubSpot in memoria: solo gli endpoint usati dalla sincronizzazione. */
function fakeHubSpot() {
  const s = {
    props: { contacts: new Set<string>(["email", "firstname", "lastname", "phone"]), deals: new Set<string>(["dealname", "amount", "pipeline", "dealstage"]) } as Record<string, Set<string>>,
    contacts: new Map<string, { id: string; properties: Record<string, unknown> }>(),
    deals: new Map<string, { id: string; properties: Record<string, unknown>; contacts: Set<string>; lines: string[]; tasks: string[] }>(),
    lines: new Map<string, Record<string, unknown>>(),
    tasks: new Map<string, Record<string, unknown>>(),
    owners: [{ id: "o-ops", email: "alberto@example.test" }, { id: "o-sales", email: "vendite@example.test" }],
    calls: [] as string[],
    failNext: 0,
    seq: 0,
  };
  const id = () => String(++s.seq);
  const reply = (body: unknown, status = 200) => new Response(body === undefined ? null : JSON.stringify(body), { status });
  const impl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const path = url.pathname;
    s.calls.push(`${method} ${path}`);
    if (s.failNext > 0) { s.failNext--; return reply({ message: "rate limit" }, 429); }
    let m: RegExpMatchArray | null;
    if (method === "GET" && (m = path.match(/^\/crm\/v3\/properties\/(contacts|deals)$/))) return reply({ results: [...s.props[m[1]!]!].map((name) => ({ name })) });
    if (method === "POST" && /^\/crm\/v3\/properties\/(contacts|deals)\/groups$/.test(path)) return reply({}, 201);
    if (method === "POST" && (m = path.match(/^\/crm\/v3\/properties\/(contacts|deals)$/))) { s.props[m[1]!]!.add(body.name); return reply({}, 201); }
    if (method === "POST" && path === "/crm/v3/objects/contacts/batch/upsert") {
      const input0 = body.inputs[0];
      const existing = s.contacts.get(input0.id) ?? { id: id(), properties: {} };
      Object.assign(existing.properties, input0.properties);
      s.contacts.set(input0.id, existing);
      return reply({ results: [{ id: existing.id }] });
    }
    if (method === "GET" && path === "/crm/v3/owners") return reply({ results: s.owners.filter((o) => o.email === url.searchParams.get("email")) });
    if (method === "POST" && path === "/crm/v3/objects/deals/search") {
      const f = body.filterGroups[0].filters[0];
      return reply({ results: [...s.deals.values()].filter((d) => d.properties[f.propertyName] === f.value).map((d) => ({ id: d.id, properties: { ...d.properties, hs_is_closed: String(d.properties.dealstage === "closedwon") } })) });
    }
    if (method === "GET" && (m = path.match(/^\/crm\/v4\/objects\/contacts\/(\w+)\/associations\/deals$/))) return reply({ results: [...s.deals.values()].filter((d) => d.contacts.has(m![1]!)).map((d) => ({ toObjectId: d.id })) });
    if (method === "POST" && path === "/crm/v3/objects/deals/batch/read") return reply({ results: body.inputs.map((i: { id: string }) => s.deals.get(i.id)).filter(Boolean).map((d: { id: string; properties: Record<string, unknown> }) => ({ id: d.id, properties: { ...d.properties, hs_is_closed: String(d.properties.dealstage === "closedwon") } })) });
    if (method === "POST" && path === "/crm/v3/objects/deals") {
      const d = { id: id(), properties: { ...body.properties }, contacts: new Set<string>(body.associations.map((a: { to: { id: string } }) => a.to.id)), lines: [] as string[], tasks: [] as string[] };
      s.deals.set(d.id, d);
      return reply({ id: d.id }, 201);
    }
    if (method === "PATCH" && (m = path.match(/^\/crm\/v3\/objects\/deals\/(\w+)$/))) { Object.assign(s.deals.get(m[1]!)!.properties, body.properties); return reply({ id: m[1] }); }
    if (method === "PUT" && (m = path.match(/^\/crm\/v4\/objects\/deals\/(\w+)\/associations\/default\/contacts\/(\w+)$/))) { s.deals.get(m[1]!)!.contacts.add(m[2]!); return reply({}); }
    if (method === "GET" && (m = path.match(/^\/crm\/v4\/objects\/deals\/(\w+)\/associations\/(line_items|tasks)$/))) {
      const d = s.deals.get(m[1]!)!;
      return reply({ results: (m[2] === "tasks" ? d.tasks : d.lines).map((x) => ({ toObjectId: x })) });
    }
    if (method === "POST" && path === "/crm/v3/objects/line_items/batch/read") return reply({ results: body.inputs.map((i: { id: string }) => ({ properties: s.lines.get(i.id) })) });
    if (method === "POST" && path === "/crm/v3/objects/line_items/batch/create") {
      for (const input of body.inputs) { const lid = id(); s.lines.set(lid, input.properties); s.deals.get(input.associations[0].to.id)!.lines.push(lid); }
      return reply({ results: [] }, 201);
    }
    if (method === "POST" && path === "/crm/v3/objects/tasks/batch/read") return reply({ results: body.inputs.map((i: { id: string }) => ({ properties: s.tasks.get(i.id) })) });
    if (method === "POST" && path === "/crm/v3/objects/tasks") {
      const tid = id();
      s.tasks.set(tid, body.properties);
      for (const a of body.associations) if (s.deals.has(a.to.id) && a.types[0].associationTypeId === 216) s.deals.get(a.to.id)!.tasks.push(tid);
      return reply({ id: tid }, 201);
    }
    return reply({ message: `non simulato: ${method} ${path}` }, 400);
  };
  return { s, fetch: impl as unknown as typeof fetch };
}

const pkg = { tier: "consigliato", name: "Consigliato", headline: "", recommended: true, lineItems: [{ key: "editing", label: "Editing professionale", amount: 1800 }, { key: "layout", label: "Impaginazione cartacea", amount: 400 }], includes: [], excludes: [], subtotal: 2200, total: 2200, deposit: 880 };
let leadId: string, quoteId: string, dealId: string, sellerId: string;

beforeAll(async () => {
  const directory = await mkdtemp(join(tmpdir(), "proemios-hubspot-"));
  database = await PGlite.create({ dataDir: join(directory, "db") });
  for (const name of (await readdir("drizzle")).filter((n) => n.endsWith(".sql")).sort()) await database.exec(await readFile(join("drizzle", name), "utf8"));
  db = drizzle(database, { schema }); shared.db = db;
  delete process.env.VERCEL_ENV;
  Object.assign(process.env, { HUBSPOT_ACCESS_TOKEN: "synthetic-hubspot-token", HUBSPOT_SYNC_FROM: "2000-01-01T00:00:00.000Z", HUBSPOT_OPS_OWNER_EMAIL: "alberto@example.test", HUBSPOT_SALES_OWNER_EMAIL: "vendite@example.test" });
  const [seller] = await db.insert(identity.user).values({ id: "seller-1", name: "Venditrice", email: "vendite@example.test", emailVerified: true }).returning();
  sellerId = seller!.id;
  const [lead] = await db.insert(schema.leads).values({ nome: "Marta Rossi", email: "Marta.Rossi@example.test", telefono: "+39 333 0000000", fonte: "preventivo" }).returning();
  leadId = lead!.id;
  const [contact] = await db.insert(crm.crmContacts).values({ name: "Marta Rossi", email: "marta.rossi@example.test", emailNormalized: "marta.rossi@example.test" }).returning();
  const [deal] = await db.insert(crm.crmDeals).values({ contactId: contact!.id, title: "Romanzo di Marta", ownerId: sellerId }).returning();
  dealId = deal!.id;
  const [quote] = await db.insert(schema.quotes).values({ leadId, input: { projectType: "romanzo", requestedServices: ["editing", "layout"] }, pacchettiGenerati: [pkg] }).returning();
  quoteId = quote!.id;
  await db.insert(platform.quoteRecords).values({ quoteId, pricingVersion: "test", dealId, selectedTier: "consigliato" });
});
afterAll(async () => { await database.close(); });
beforeEach(async () => { await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "hubspot-sync")); await db.delete(crm.crmEvents); });

const emit = (type: string, key: string, payload: Record<string, unknown>, at: Date) => db.insert(crm.crmEvents).values({ type, eventKey: `${type}:${key}`, entityId: key, payload, createdAt: at });

describe("HubSpot: from platform events to the sales CRM", () => {
  it("creates contact, deal and first-contact task; closes it as won on the deposit with lines and a production task; never duplicates", async () => {
    const t0 = new Date("2026-11-12T09:00:00Z");
    await emit("lead.created", leadId, { leadId, dealId, source: "preventivatore" }, t0);
    await emit("quote.accepted", quoteId, { quoteId, dealId, tier: "consigliato" }, new Date(t0.getTime() + 1000));
    await emit("payment.confirmed", "pi_1", { quoteId, dealId, kind: "deposit", sequence: 1, amountCents: 88000 }, new Date(t0.getTime() + 2000));
    const hs = fakeHubSpot();
    expect(await syncHubSpot({ fetchImpl: hs.fetch, now: t0 })).toMatchObject({ processed: 3, failed: 0 });
    const contact = hs.s.contacts.get("marta.rossi@example.test")!;
    expect(contact.properties).toMatchObject({ firstname: "Marta", lastname: "Rossi", proemios_origine: "preventivatore", proemios_lead_id: leadId });
    expect(hs.s.deals.size).toBe(1);
    const deal = [...hs.s.deals.values()][0]!;
    expect(deal.properties).toMatchObject({ dealname: "Proemios · Romanzo di Marta", pipeline: "default", dealstage: "closedwon", amount: "2200.00", proemios_deal_id: dealId, proemios_quote_id: quoteId, proemios_pacchetto: "Consigliato", proemios_stato: "acconto incassato", hubspot_owner_id: "o-sales" });
    expect(deal.properties.proemios_incassi).toContain("acconto: € 880,00");
    expect(deal.lines.map((l) => hs.s.lines.get(l)!.name)).toEqual(["Editing professionale", "Impaginazione cartacea"]);
    const tasks = deal.tasks.map((t) => hs.s.tasks.get(t)!);
    expect(tasks.map((t) => t.hs_task_subject)).toEqual(["Primo contatto: Marta Rossi", "Acconto incassato: avvia la produzione · Marta Rossi"]);
    expect(tasks[0]!.hubspot_owner_id).toBe("o-sales"); expect(tasks[1]!.hubspot_owner_id).toBe("o-ops");
    // Le proprietà proemios_* sono state create.
    expect(hs.s.props.deals!.has("proemios_deal_id")).toBe(true);
    // Un secondo giro non rifà nulla; ripartendo da capo nulla si duplica.
    expect(await syncHubSpot({ fetchImpl: hs.fetch, now: t0 })).toMatchObject({ processed: 0 });
    await db.delete(platform.platformSettings).where(eq(platform.platformSettings.key, "hubspot-sync"));
    expect(await syncHubSpot({ fetchImpl: hs.fetch, now: t0 })).toMatchObject({ processed: 3 });
    expect(hs.s.deals.size).toBe(1); expect(deal.lines).toHaveLength(2); expect(deal.tasks).toHaveLength(2);
  });

  it("links the deal a seller already opened in HubSpot instead of creating a duplicate", async () => {
    const hs = fakeHubSpot();
    const cid = "900";
    hs.s.contacts.set("marta.rossi@example.test", { id: cid, properties: {} });
    hs.s.deals.set("901", { id: "901", properties: { pipeline: "default", dealstage: "qualifiedtobuy", dealname: "Aperta dal commerciale" }, contacts: new Set([cid]), lines: [], tasks: [] });
    await emit("lead.created", `${leadId}-b`, { leadId, dealId, source: "telefono" }, new Date("2026-11-12T09:00:00Z"));
    await syncHubSpot({ fetchImpl: hs.fetch });
    expect(hs.s.deals.size).toBe(1);
    expect(hs.s.deals.get("901")!.properties).toMatchObject({ proemios_deal_id: dealId, dealname: "Aperta dal commerciale" });
  });

  it("waits and retries in order when HubSpot is busy, then records a permanent failure without blocking the queue", async () => {
    const hs = fakeHubSpot();
    await emit("lead.created", `${leadId}-c`, { leadId, dealId, source: "sito" }, new Date("2026-11-12T09:00:00Z"));
    hs.s.failNext = 1;
    expect(await syncHubSpot({ fetchImpl: hs.fetch })).toMatchObject({ processed: 0, failed: 0, waiting: 1 });
    expect((await hubSpotSyncState())!.attempts).not.toEqual({});
    expect(await syncHubSpot({ fetchImpl: hs.fetch })).toMatchObject({ processed: 1 });
    // Un evento senza dati corrispondenti in Proemios viene saltato e non blocca i successivi.
    await emit("payment.confirmed", "pi_bad", { quoteId: "00000000-0000-0000-0000-000000000000", dealId, kind: "deposit", sequence: 1, amountCents: 1 }, new Date("2026-11-12T09:00:05Z"));
    await emit("quote.accepted", `${quoteId}-c`, { quoteId, dealId, tier: "consigliato" }, new Date("2026-11-12T09:00:06Z"));
    expect(await syncHubSpot({ fetchImpl: hs.fetch })).toMatchObject({ processed: 2, failed: 0 });
  });

  it("starts from now on first run and stays off in previews and without a token", async () => {
    const hs = fakeHubSpot();
    await emit("lead.created", `${leadId}-old`, { leadId, dealId }, new Date("2020-01-01T00:00:00Z"));
    const from = process.env.HUBSPOT_SYNC_FROM; delete process.env.HUBSPOT_SYNC_FROM;
    try {
      expect(await syncHubSpot({ fetchImpl: hs.fetch })).toMatchObject({ processed: 0 });
      expect(hs.s.calls).toHaveLength(0);
    } finally { process.env.HUBSPOT_SYNC_FROM = from; }
    process.env.VERCEL_ENV = "preview";
    try { expect(await syncHubSpot({ fetchImpl: hs.fetch })).toEqual({ skipped: "HubSpot non configurato" }); } finally { delete process.env.VERCEL_ENV; }
    const token = process.env.HUBSPOT_ACCESS_TOKEN; delete process.env.HUBSPOT_ACCESS_TOKEN;
    try { expect(await syncHubSpot({ fetchImpl: hs.fetch })).toEqual({ skipped: "HubSpot non configurato" }); } finally { process.env.HUBSPOT_ACCESS_TOKEN = token; }
  });

  it("schedules tasks inside working hours (Mon-Fri 10-17, Rome)", () => {
    // Venerdì 16:00 a Roma + 4 ore lavorative → lunedì 13:00.
    const due = businessDue(new Date("2026-11-13T15:00:00Z"), 4);
    expect(due.toISOString()).toBe("2026-11-16T12:00:00.000Z");
  });
});
