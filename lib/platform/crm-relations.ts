/**
 * Relazioni del CRM: contatto (persona), richiesta (lead), trattativa (deal).
 * Una nuova richiesta con la stessa email si aggancia al contatto esistente;
 * la stessa persona con una trattativa aperta non ne apre un'altra.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { crmContacts, crmDeals, crmEvents, settingVersions } from "@/db/crm-schema";
import { paymentOrders, platformSettings, quoteRecords } from "@/db/platform-schema";
import { normalizeEmail, normalizePhone } from "@/lib/crm-core/dedup";
import { pipelineSchema, type Pipeline } from "@/lib/crm-core/pipelines";
import { PIPELINE_STATES, PIPELINE_LABELS, MANUAL_STATES, PAID_STATUSES, pipelineState } from "./pipeline";
import type { CrmEvent } from "@/lib/crm-core/webhooks";

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Reader = Pick<Db, "select">;

export const DEFAULT_PIPELINE: Pipeline = {
  key: "vendite",
  name: "Vendite",
  archived: false,
  stages: PIPELINE_STATES.map((key) => ({
    key,
    label: PIPELINE_LABELS[key],
    kind: key === "won" ? "won" : key === "lost" || key === "unreachable" ? "lost" : "open",
    manual: MANUAL_STATES.includes(key),
  })),
};
export async function readSetting<T>(key: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, fallback: T, db: Reader = getDb()): Promise<T> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  const parsed = schema.safeParse(row?.value);
  return parsed.success ? parsed.data : fallback;
}
/** Salva una regola approvata e ne conserva la versione nella storia. */
export async function writeVersionedSetting(tx: Tx, key: string, value: Record<string, unknown> & { version: string }, approvedBy: string) {
  await tx.insert(platformSettings).values({ key, value }).onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
  await tx.insert(settingVersions).values({ key, version: value.version, value, approvedBy }).onConflictDoUpdate({ target: [settingVersions.key, settingVersions.version], set: { value, approvedBy } });
}
export async function pipelines(db: Reader = getDb()): Promise<Pipeline[]> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, "pipelines")).limit(1);
  const list = Array.isArray((row?.value as { pipelines?: unknown })?.pipelines) ? ((row!.value as { pipelines: unknown[] }).pipelines.map((p) => pipelineSchema.safeParse(p)).filter((p) => p.success).map((p) => p.data!) as Pipeline[]) : [];
  return [DEFAULT_PIPELINE, ...list.filter((p) => p.key !== DEFAULT_PIPELINE.key)];
}
export async function pipelineFor(key: string, db: Reader = getDb()): Promise<Pipeline> {
  return (await pipelines(db)).find((p) => p.key === key) ?? DEFAULT_PIPELINE;
}

/** Trova o crea il contatto per email normalizzata. Il nome non basta mai per unire. */
export async function ensureContact(tx: Tx, input: { name: string; email: string; phone?: string | null; language?: string | null }) {
  const emailNormalized = normalizeEmail(input.email);
  const [existing] = await tx.select().from(crmContacts).where(and(eq(crmContacts.emailNormalized, emailNormalized), isNull(crmContacts.mergedIntoId))).limit(1);
  if (existing) {
    // Il telefono si completa se mancava; non si sovrascrive quello registrato.
    if (!existing.phone && input.phone) await tx.update(crmContacts).set({ phone: input.phone, phoneNormalized: normalizePhone(input.phone), updatedAt: new Date() }).where(eq(crmContacts.id, existing.id));
    return { contact: existing, created: false };
  }
  const [contact] = await tx
    .insert(crmContacts)
    .values({ name: input.name, email: input.email.trim(), emailNormalized, phone: input.phone || null, phoneNormalized: normalizePhone(input.phone), language: input.language ?? "it" })
    .onConflictDoNothing()
    .returning();
  if (contact) return { contact, created: true };
  const [raced] = await tx.select().from(crmContacts).where(and(eq(crmContacts.emailNormalized, emailNormalized), isNull(crmContacts.mergedIntoId))).limit(1);
  return { contact: raced!, created: false };
}
export async function openDeals(db: Reader, contactId: string) {
  return db.select().from(crmDeals).where(and(eq(crmDeals.contactId, contactId), isNull(crmDeals.closedAt))).orderBy(desc(crmDeals.lastActivityAt), desc(crmDeals.createdAt));
}
/**
 * Collega una richiesta al suo contatto e a una trattativa: quella aperta del
 * contatto se esiste (stesso responsabile), altrimenti una nuova.
 */
export async function attachLead(tx: Tx, leadId: string, options: { title?: string; createdBy?: string | null } = {}) {
  const [lead] = await tx.select().from(leads).where(eq(leads.id, leadId)).for("update");
  if (!lead) throw new Error("lead missing");
  const { contact } = lead.contactId ? { contact: (await tx.select().from(crmContacts).where(eq(crmContacts.id, lead.contactId)))[0]! } : await ensureContact(tx, { name: lead.nome, email: lead.email, phone: lead.telefono, language: lead.language });
  if (lead.dealId) {
    const [deal] = await tx.select().from(crmDeals).where(eq(crmDeals.id, lead.dealId));
    if (!lead.contactId) await tx.update(leads).set({ contactId: contact.id }).where(eq(leads.id, leadId));
    return { lead: { ...lead, contactId: contact.id }, contact, deal: deal!, reused: true };
  }
  const [open] = await openDeals(tx, contact.id);
  const deal =
    open ??
    (await tx
      .insert(crmDeals)
      .values({ contactId: contact.id, originLeadId: lead.id, title: options.title ?? lead.nome, priority: lead.priority, createdBy: options.createdBy ?? null, lastActivityAt: new Date() })
      .returning())[0]!;
  await tx.update(leads).set({ contactId: contact.id, dealId: deal.id, updatedAt: new Date() }).where(eq(leads.id, leadId));
  if (open) await tx.update(crmDeals).set({ lastActivityAt: new Date(), updatedAt: new Date() }).where(eq(crmDeals.id, open.id));
  return { lead: { ...lead, contactId: contact.id, dealId: deal.id }, contact, deal, reused: Boolean(open) };
}
/** Fatti della trattativa (proposte e ordini) per derivare la fase effettiva. */
export async function dealFacts(db: Reader, dealIds: string[]) {
  if (!dealIds.length) return { quotes: [] as Array<{ quote: typeof quotes.$inferSelect; record: typeof quoteRecords.$inferSelect }>, orders: [] as Array<typeof paymentOrders.$inferSelect> };
  const rows = await db.select({ quote: quotes, record: quoteRecords }).from(quoteRecords).innerJoin(quotes, eq(quotes.id, quoteRecords.quoteId)).where(inArray(quoteRecords.dealId, dealIds)).orderBy(desc(quotes.createdAt));
  const ids = rows.map((r) => r.quote.id);
  const orders = ids.length ? await db.select().from(paymentOrders).where(inArray(paymentOrders.quoteId, ids)) : [];
  return { quotes: rows, orders };
}
export function dealStage(deal: typeof crmDeals.$inferSelect, pipeline: Pipeline, facts: Awaited<ReturnType<typeof dealFacts>>): { stage: string; status: "open" | "won" | "lost"; quoteId: string | null } {
  const own = facts.quotes.filter((r) => r.record.dealId === deal.id);
  const paid = own.find((r) => facts.orders.some((o) => o.quoteId === r.quote.id && PAID_STATUSES.includes(o.status)));
  const latest = paid ?? own[0];
  let stage: string;
  if (pipeline.key === DEFAULT_PIPELINE.key) {
    stage = pipelineState({ stage: deal.stage, quote: latest?.quote ?? null, record: latest?.record ?? null, orders: latest ? facts.orders.filter((o) => o.quoteId === latest.quote.id) : [] });
  } else {
    stage = paid ? (pipeline.stages.find((s) => s.kind === "won")?.key ?? deal.stage) : deal.stage;
  }
  const kind = pipeline.stages.find((s) => s.key === stage)?.kind ?? "open";
  return { stage, status: kind, quoteId: latest?.quote.id ?? null };
}
/** Registra un evento stabile (una volta sola per chiave): i webhook in uscita partono da qui. */
export async function emitEvent(db: Pick<Db, "insert">, type: CrmEvent, eventKey: string, entityId: string | null, payload: Record<string, unknown>) {
  await db.insert(crmEvents).values({ type, eventKey: `${type}:${eventKey}`, entityId, payload }).onConflictDoNothing();
}
export const sqlNow = sql`now()`;
