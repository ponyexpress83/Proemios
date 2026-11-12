/**
 * Client HubSpot minimo per la sincronizzazione piattaforma → CRM.
 *
 * HubSpot è il CRM delle persone (contatti, trattative, attività, marketing);
 * la piattaforma resta la fonte di verità di proposte, contratti, pagamenti,
 * produzione e provvigioni. Qui si scrivono solo contatti, trattative con le
 * righe d'ordine, attività e le proprietà «proemios_*».
 *
 * Variabili:
 * - HUBSPOT_ACCESS_TOKEN: token della app privata (obbligatorio).
 * - HUBSPOT_DEAL_PIPELINE: id della pipeline delle vendite (predefinita "default").
 * - HUBSPOT_DEAL_STAGE_LEAD / _ACCEPTED / _WON: id delle fasi (predefinite quelle della pipeline standard).
 * - HUBSPOT_WORK_HOURS: orario di lavoro per le scadenze, "10-17" ora di Roma.
 */

const API = "https://api.hubapi.com";

export type HubSpotFetch = typeof fetch;

export class HubSpotError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function hubSpotConfig() {
  return {
    pipeline: process.env.HUBSPOT_DEAL_PIPELINE?.trim() || "default",
    leadStage: process.env.HUBSPOT_DEAL_STAGE_LEAD?.trim() || "appointmentscheduled",
    acceptedStage: process.env.HUBSPOT_DEAL_STAGE_ACCEPTED?.trim() || "contractsent",
    wonStage: process.env.HUBSPOT_DEAL_STAGE_WON?.trim() || "closedwon",
    salesOwnerEmail: process.env.HUBSPOT_SALES_OWNER_EMAIL?.trim() || null,
    opsOwnerEmail: process.env.HUBSPOT_OPS_OWNER_EMAIL?.trim() || null,
  };
}

export function createHubSpotClient(token: string, fetchImpl: HubSpotFetch = fetch) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      throw new HubSpotError(res.status, `HubSpot ${method} ${path.split("?")[0]} ${res.status}: ${detail || res.statusText}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  return { call };
}

export type HubSpotClient = ReturnType<typeof createHubSpotClient>;

/** Proprietà personalizzate create (se mancano) nel gruppo «proemios». Testo libero: nessun valore viene rifiutato. */
export const CUSTOM_PROPERTIES: Record<"contacts" | "deals", Array<{ name: string; label: string }>> = {
  contacts: [
    { name: "proemios_origine", label: "Proemios: origine della richiesta" },
    { name: "proemios_lead_id", label: "Proemios: richiesta (id)" },
  ],
  deals: [
    { name: "proemios_deal_id", label: "Proemios: trattativa (id)" },
    { name: "proemios_lead_id", label: "Proemios: richiesta (id)" },
    { name: "proemios_quote_id", label: "Proemios: proposta (id)" },
    { name: "proemios_servizio", label: "Proemios: servizio" },
    { name: "proemios_pacchetto", label: "Proemios: pacchetto" },
    { name: "proemios_stato", label: "Proemios: stato commerciale" },
    { name: "proemios_incassi", label: "Proemios: incassi verificati" },
    { name: "proemios_project_id", label: "Proemios: progetto" },
    { name: "proemios_stato_produzione", label: "Proemios: stato della produzione" },
  ],
};

/**
 * Proprietà disponibili per contatti e trattative, creando le «proemios_*»
 * mancanti. Se il token non può crearle si prosegue con quelle che esistono.
 */
export async function ensureHubSpotProperties(client: HubSpotClient) {
  const available: Record<"contacts" | "deals", Set<string>> = { contacts: new Set(), deals: new Set() };
  for (const object of ["contacts", "deals"] as const) {
    const list = await client.call<{ results: Array<{ name: string }> }>("GET", `/crm/v3/properties/${object}`);
    for (const p of list.results ?? []) available[object].add(p.name);
    const missing = CUSTOM_PROPERTIES[object].filter((p) => !available[object].has(p.name));
    if (!missing.length) continue;
    try {
      await client.call("POST", `/crm/v3/properties/${object}/groups`, { name: "proemios", label: "Proemios", displayOrder: -1 });
    } catch (error) {
      if (!(error instanceof HubSpotError && error.status === 409)) console.warn("[HubSpot] gruppo proprietà non creato:", (error as Error).message);
    }
    for (const p of missing) {
      try {
        await client.call("POST", `/crm/v3/properties/${object}`, { name: p.name, label: p.label, groupName: "proemios", type: "string", fieldType: "text" });
        available[object].add(p.name);
      } catch (error) {
        if (error instanceof HubSpotError && error.status === 409) available[object].add(p.name);
        else console.warn(`[HubSpot] proprietà ${p.name} non creata:`, (error as Error).message);
      }
    }
  }
  return available;
}

export function onlyAvailable(props: Record<string, string | number | null | undefined>, available: Set<string>) {
  return Object.fromEntries(
    Object.entries(props).filter(([k, v]) => v !== null && v !== undefined && v !== "" && (!k.startsWith("proemios_") || available.has(k))),
  ) as Record<string, string | number>;
}

export async function upsertContact(client: HubSpotClient, email: string, properties: Record<string, string | number>) {
  const res = await client.call<{ results: Array<{ id: string }> }>("POST", "/crm/v3/objects/contacts/batch/upsert", {
    inputs: [{ id: email, idProperty: "email", properties: { ...properties, email } }],
  });
  const id = res.results?.[0]?.id;
  if (!id) throw new Error("HubSpot: contatto senza id");
  return id;
}

const ownerCache = new Map<string, string | null>();
export async function ownerIdByEmail(client: HubSpotClient, email: string | null | undefined) {
  if (!email) return null;
  const key = email.toLowerCase();
  if (ownerCache.has(key)) return ownerCache.get(key)!;
  try {
    const res = await client.call<{ results: Array<{ id: string; email?: string }> }>("GET", `/crm/v3/owners?email=${encodeURIComponent(key)}&limit=1`);
    const id = res.results?.find((o) => o.email?.toLowerCase() === key)?.id ?? null;
    ownerCache.set(key, id);
    return id;
  } catch (error) {
    console.warn("[HubSpot] responsabile non trovato:", (error as Error).message);
    return null;
  }
}
export function clearOwnerCache() {
  ownerCache.clear();
}

type DealRow = { id: string; properties: Record<string, string | null> };

/** Trattativa con una proprietà proemios_* uguale al valore (ritentativi idempotenti). */
export async function findDealBy(client: HubSpotClient, property: string, value: string | null | undefined, available: Set<string>) {
  if (!value || !available.has(property)) return null;
  const res = await client.call<{ results: DealRow[] }>("POST", "/crm/v3/objects/deals/search", {
    filterGroups: [{ filters: [{ propertyName: property, operator: "EQ", value }] }],
    properties: ["dealstage", "pipeline", "hubspot_owner_id", "hs_is_closed"],
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
    limit: 1,
  });
  const d = res.results?.[0];
  return d ? { id: d.id, ownerId: d.properties.hubspot_owner_id ?? null, closed: d.properties.hs_is_closed === "true" } : null;
}

/**
 * Trattativa aperta del contatto nella pipeline delle vendite e non ancora
 * collegata a Proemios: è quella che il commerciale ha aperto in HubSpot. La
 * si collega invece di crearne un doppione; se ce n'è più d'una, la più recente.
 */
export async function findOpenDealForContact(client: HubSpotClient, contactId: string, pipeline: string) {
  const assoc = await client.call<{ results: Array<{ toObjectId: string | number }> }>("GET", `/crm/v4/objects/contacts/${contactId}/associations/deals?limit=100`);
  const ids = (assoc.results ?? []).map((r) => String(r.toObjectId));
  if (!ids.length) return null;
  const read = await client.call<{ results: DealRow[] }>("POST", "/crm/v3/objects/deals/batch/read", {
    inputs: ids.map((id) => ({ id })),
    properties: ["pipeline", "dealstage", "hs_is_closed", "proemios_deal_id", "hs_lastmodifieddate"],
  });
  const open = (read.results ?? []).filter((d) => d.properties.pipeline === pipeline && d.properties.hs_is_closed !== "true" && !d.properties.proemios_deal_id);
  open.sort((a, b) => String(b.properties.hs_lastmodifieddate ?? "").localeCompare(String(a.properties.hs_lastmodifieddate ?? "")));
  return open[0]?.id ?? null;
}

export async function createDeal(client: HubSpotClient, properties: Record<string, string | number>, contactId: string) {
  const res = await client.call<{ id: string }>("POST", "/crm/v3/objects/deals", {
    properties,
    associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
  });
  return res.id;
}

export async function updateDeal(client: HubSpotClient, dealId: string, properties: Record<string, string | number>, contactId: string | null) {
  await client.call("PATCH", `/crm/v3/objects/deals/${dealId}`, { properties });
  if (contactId) await client.call("PUT", `/crm/v4/objects/deals/${dealId}/associations/default/contacts/${contactId}`);
}

export type OrderLine = { name: string; priceCents: number; quantity: number; sku?: string };

/** Righe d'ordine: create una sola volta per proposta (i ritentativi non duplicano). */
export async function ensureLineItems(client: HubSpotClient, dealId: string, lines: OrderLine[], orderRef: string) {
  if (!lines.length) return 0;
  const existing = await client.call<{ results: Array<{ toObjectId: string | number }> }>("GET", `/crm/v4/objects/deals/${dealId}/associations/line_items?limit=100`);
  if ((existing.results ?? []).length) {
    const ids = existing.results.map((r) => ({ id: String(r.toObjectId) }));
    const read = await client.call<{ results: Array<{ properties: Record<string, string | null> }> }>("POST", "/crm/v3/objects/line_items/batch/read", { inputs: ids, properties: ["hs_sku"] });
    if ((read.results ?? []).some((r) => String(r.properties.hs_sku ?? "").startsWith(`${orderRef}:`))) return 0;
  }
  await client.call("POST", "/crm/v3/objects/line_items/batch/create", {
    inputs: lines.map((l, i) => ({
      properties: { name: l.name, quantity: String(l.quantity), price: (l.priceCents / 100).toFixed(2), hs_sku: `${orderRef}:${l.sku ?? i}` },
      associations: [{ to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 20 }] }],
    })),
  });
  return lines.length;
}

/** Attività collegata a una trattativa; il marcatore nel testo evita i doppioni ai ritentativi. */
export async function ensureDealTask(
  client: HubSpotClient,
  dealId: string,
  contactId: string | null,
  ownerId: string | null,
  text: { subject: string; body: string; marker: string },
  dueHours: number,
  now = new Date(),
) {
  const existing = await client.call<{ results: Array<{ toObjectId: string | number }> }>("GET", `/crm/v4/objects/deals/${dealId}/associations/tasks?limit=100`);
  const ids = (existing.results ?? []).map((r) => ({ id: String(r.toObjectId) }));
  if (ids.length) {
    const read = await client.call<{ results: Array<{ properties: Record<string, string | null> }> }>("POST", "/crm/v3/objects/tasks/batch/read", { inputs: ids, properties: ["hs_task_body"] });
    if ((read.results ?? []).some((t) => String(t.properties.hs_task_body ?? "").includes(text.marker))) return null;
  }
  const res = await client.call<{ id: string }>("POST", "/crm/v3/objects/tasks", {
    properties: {
      hs_task_subject: text.subject.slice(0, 250),
      hs_task_body: `${text.body}\n${text.marker}`,
      hs_task_status: "NOT_STARTED",
      hs_task_priority: "HIGH",
      hs_task_type: "TODO",
      hs_timestamp: businessDue(now, dueHours).toISOString(),
      ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
    },
    associations: [
      { to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 216 }] },
      ...(contactId ? [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }] }] : []),
    ],
  });
  return res.id;
}

/** Ora di Roma (0-23) e giorno della settimana (0 = domenica) di un istante. */
function romeClock(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { hour: Number(get("hour")) % 24, minute: Number(get("minute")), day: days.indexOf(get("weekday")) };
}

/**
 * Scadenza dentro l'orario di lavoro (lun-ven, 10-17 ora di Roma, configurabile
 * con HUBSPOT_WORK_HOURS): ciò che arriva fuori orario scade nella prima fascia
 * utile, così nessuno trova attività già in ritardo al mattino.
 */
export function businessDue(now: Date, hours: number) {
  const [startH, endH] = (process.env.HUBSPOT_WORK_HOURS ?? "10-17").split("-").map(Number) as [number, number];
  let t = new Date(now.getTime());
  let left = hours * 60;
  for (let guard = 0; guard < 24 * 60 * 14 && left > 0; guard++) {
    const c = romeClock(t);
    const working = c.day >= 1 && c.day <= 5 && c.hour >= startH && c.hour < endH;
    if (working) {
      const step = Math.min(left, (endH - c.hour) * 60 - c.minute);
      t = new Date(t.getTime() + step * 60_000);
      left -= step;
    } else {
      t = new Date(t.getTime() + 15 * 60_000);
    }
  }
  return t;
}
