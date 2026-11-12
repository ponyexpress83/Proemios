/**
 * Sincronizzazione piattaforma → HubSpot, dal registro degli eventi stabili
 * (`crm_events`). Gira nel lavoro frequente e non è mai sul percorso di
 * pagamenti, registrazioni o contratti: se HubSpot non risponde, gli eventi
 * restano in attesa e si riprovano al giro successivo.
 *
 * - lead.created → contatto, trattativa nella prima fase, attività «primo contatto»;
 * - quote.accepted → fase «contratto accettato», importo, servizio e pacchetto;
 * - payment.confirmed → acconto: trattativa vinta con le righe e attività per la
 *   produzione; saldo e rate: incasso registrato sulla trattativa;
 * - project.handoff_ready → progetto e stato della produzione sulla trattativa.
 *
 * Al primo avvio parte da «adesso» (HUBSPOT_SYNC_FROM per recuperare il
 * passato): i dati di prova già nel database non finiscono in HubSpot. Nelle
 * anteprime resta spenta salvo HUBSPOT_SYNC_PREVIEW=1.
 */
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmDeals, crmEvents } from "@/db/crm-schema";
import { platformSettings, quoteRecords } from "@/db/platform-schema";
import type { QuotePackage } from "@/lib/pricing";
import {
  HubSpotError,
  createDeal,
  createHubSpotClient,
  ensureDealTask,
  ensureHubSpotProperties,
  ensureLineItems,
  findDealBy,
  findOpenDealForContact,
  hubSpotConfig,
  onlyAvailable,
  ownerIdByEmail,
  updateDeal,
  upsertContact,
  type HubSpotClient,
  type HubSpotFetch,
} from "./hubspot";

export const HUBSPOT_EVENT_TYPES = ["lead.created", "quote.accepted", "payment.confirmed", "project.handoff_ready"] as const;
const STATE_KEY = "hubspot-sync";
const MAX_ATTEMPTS = 5;

type Failure = { eventId: string; type: string; error: string; at: string };
export type HubSpotSyncState = { after: string | null; done: string[]; attempts: Record<string, number>; failed: Failure[]; lastRunAt?: string; lastSuccessAt?: string; lastError?: string | null };
type Event = typeof crmEvents.$inferSelect;
type Available = Record<"contacts" | "deals", Set<string>>;
type Ctx = { client: HubSpotClient; available: Available; now: Date };

export function hubSpotEnabled() {
  if (!process.env.HUBSPOT_ACCESS_TOKEN?.trim()) return false;
  return process.env.VERCEL_ENV !== "preview" || process.env.HUBSPOT_SYNC_PREVIEW === "1";
}

export async function hubSpotSyncState(): Promise<HubSpotSyncState | null> {
  const [row] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, STATE_KEY));
  return (row?.value as HubSpotSyncState | undefined) ?? null;
}
async function saveState(state: HubSpotSyncState) {
  await getDb().insert(platformSettings).values({ key: STATE_KEY, value: state }).onConflictDoUpdate({ target: platformSettings.key, set: { value: state, updatedAt: new Date() } });
}

/** Errori da riprovare: limiti, errori del server, rete e tempi scaduti. */
function transient(error: unknown) {
  return !(error instanceof HubSpotError) || error.status === 429 || error.status >= 500;
}

export async function syncHubSpot(options: { limit?: number; fetchImpl?: HubSpotFetch; now?: Date } = {}) {
  if (!hubSpotEnabled()) return { skipped: "HubSpot non configurato" };
  const now = options.now ?? new Date();
  const limit = options.limit ?? 25;
  const stored = await hubSpotSyncState();
  const state: HubSpotSyncState = stored ?? { after: process.env.HUBSPOT_SYNC_FROM?.trim() || now.toISOString(), done: [], attempts: {}, failed: [] };
  const from = new Date(state.after ?? 0);
  const rows = await getDb()
    .select()
    .from(crmEvents)
    .where(and(inArray(crmEvents.type, [...HUBSPOT_EVENT_TYPES]), gte(crmEvents.createdAt, from)))
    .orderBy(asc(crmEvents.createdAt), asc(crmEvents.id))
    .limit(limit + state.done.length);
  const pending = rows.filter((r) => !state.done.includes(r.id)).slice(0, limit);
  let processed = 0, failed = 0;
  let ctx: Ctx | null = null;
  state.lastRunAt = now.toISOString();
  for (const event of pending) {
    try {
      ctx ??= { client: createHubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN!.trim(), options.fetchImpl), available: { contacts: new Set(), deals: new Set() }, now };
      if (!ctx.available.deals.size) ctx.available = await ensureHubSpotProperties(ctx.client);
      await handleEvent(ctx, event);
      processed++;
      state.lastSuccessAt = new Date().toISOString();
      state.lastError = null;
      delete state.attempts[event.id];
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      const attempts = (state.attempts[event.id] ?? 0) + 1;
      state.lastError = message;
      if (transient(error) && attempts < MAX_ATTEMPTS) {
        // Si riprova al prossimo giro, senza saltare l'ordine degli eventi.
        state.attempts[event.id] = attempts;
        break;
      }
      failed++;
      delete state.attempts[event.id];
      state.failed = [{ eventId: event.id, type: event.type, error: message, at: now.toISOString() }, ...state.failed].slice(0, 50);
      console.warn(`[HubSpot] evento ${event.type} ${event.id} non sincronizzato:`, message);
    }
    const at = event.createdAt.toISOString();
    if (state.after !== at) state.done = [];
    state.after = at;
    state.done.push(event.id);
  }
  await saveState(state);
  return { processed, failed, waiting: Math.max(0, pending.length - processed - failed) };
}

async function handleEvent(ctx: Ctx, event: Event) {
  const p = event.payload as Record<string, unknown>;
  if (event.type === "lead.created") return leadCreated(ctx, String(p.leadId), (p.dealId as string | null) ?? null, (p.source as string | null) ?? null);
  if (event.type === "quote.accepted") return quoteAccepted(ctx, String(p.quoteId), (p.tier as string | null) ?? null);
  if (event.type === "payment.confirmed") return paymentConfirmed(ctx, String(p.quoteId), String(p.kind), Number(p.sequence ?? 1), Number(p.amountCents ?? 0));
  if (event.type === "project.handoff_ready") return handoffReady(ctx, String(p.projectId), (p.quoteId as string | null) ?? null, (p.opsStatus as string | null) ?? null);
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstname: parts[0] ?? "", lastname: parts.slice(1).join(" ") };
}
async function emailOf(userId: string | null | undefined) {
  if (!userId) return null;
  const [row] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
  return row?.email ?? null;
}
/** Contatto per email. L'origine si scrive solo alla nuova richiesta: gli eventi successivi non la sovrascrivono. */
async function contactFor(ctx: Ctx, lead: typeof leads.$inferSelect, source?: string | null) {
  const { firstname, lastname } = splitName(lead.nome);
  const origin = source === undefined ? null : source ?? lead.sourceKind ?? lead.fonte;
  return upsertContact(ctx.client, lead.email.toLowerCase(), onlyAvailable({ firstname, lastname, phone: lead.telefono, proemios_origine: origin, proemios_lead_id: lead.id }, ctx.available.contacts));
}
/** Responsabile in HubSpot: chi segue la trattativa in Proemios, altrimenti il responsabile commerciale configurato. */
async function salesOwner(ctx: Ctx, crmDealId: string | null) {
  const [deal] = crmDealId ? await getDb().select({ ownerId: crmDeals.ownerId }).from(crmDeals).where(eq(crmDeals.id, crmDealId)) : [];
  return (await ownerIdByEmail(ctx.client, await emailOf(deal?.ownerId))) ?? (await ownerIdByEmail(ctx.client, hubSpotConfig().salesOwnerEmail));
}

/** Trattativa HubSpot di una trattativa Proemios: la ritrova, collega quella aperta dal commerciale o la crea. */
async function ensureDeal(ctx: Ctx, lead: typeof leads.$inferSelect, crmDealId: string | null, contactId: string) {
  const cfg = hubSpotConfig();
  const key = crmDealId ?? lead.id;
  const found = (await findDealBy(ctx.client, "proemios_deal_id", key, ctx.available.deals))?.id ?? null;
  if (found) return { id: found, created: false };
  const props = onlyAvailable({ proemios_deal_id: key, proemios_lead_id: lead.id }, ctx.available.deals);
  const open = await findOpenDealForContact(ctx.client, contactId, cfg.pipeline);
  if (open) {
    await updateDeal(ctx.client, open, props, contactId);
    return { id: open, created: false };
  }
  const [deal] = crmDealId ? await getDb().select({ title: crmDeals.title }).from(crmDeals).where(eq(crmDeals.id, crmDealId)) : [];
  const owner = await salesOwner(ctx, crmDealId);
  const id = await createDeal(ctx.client, { ...props, dealname: `Proemios · ${deal?.title ?? lead.nome}`.slice(0, 250), pipeline: cfg.pipeline, dealstage: cfg.leadStage, ...(owner ? { hubspot_owner_id: owner } : {}) }, contactId);
  return { id, created: true };
}

async function leadCreated(ctx: Ctx, leadId: string, crmDealId: string | null, source: string | null) {
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return;
  const contactId = await contactFor(ctx, lead, source);
  const deal = await ensureDeal(ctx, lead, crmDealId, contactId);
  const owner = await salesOwner(ctx, crmDealId);
  await ensureDealTask(ctx.client, deal.id, contactId, owner, { subject: `Primo contatto: ${lead.nome}`, body: `Nuova richiesta da ${source ?? lead.sourceKind ?? lead.fonte}. La proposta con prezzo si prepara in Proemios.`, marker: `[richiesta ${lead.id}]` }, 4, ctx.now);
}

async function quoteContext(quoteId: string) {
  const [quote] = await getDb().select().from(quotes).where(eq(quotes.id, quoteId));
  if (!quote?.leadId) return null;
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, quote.leadId));
  const [record] = await getDb().select().from(quoteRecords).where(eq(quoteRecords.quoteId, quoteId));
  if (!lead) return null;
  const packages = (quote.pacchettiGenerati as QuotePackage[] | null) ?? [];
  const pkg = packages.find((p) => p.tier === record?.selectedTier) ?? null;
  const input = (quote.input ?? {}) as { singleService?: string; projectType?: string };
  return { quote, lead, record, pkg, service: input.singleService ?? input.projectType ?? null };
}

async function quoteAccepted(ctx: Ctx, quoteId: string, tier: string | null) {
  const q = await quoteContext(quoteId);
  if (!q) return;
  const pkg = q.pkg ?? ((q.quote.pacchettiGenerati as QuotePackage[] | null) ?? []).find((p) => p.tier === tier) ?? null;
  const contactId = await contactFor(ctx, q.lead);
  const deal = await ensureDeal(ctx, q.lead, q.record?.dealId ?? q.lead.dealId ?? null, contactId);
  await updateDeal(ctx.client, deal.id, onlyAvailable({ dealstage: hubSpotConfig().acceptedStage, ...(pkg ? { amount: pkg.total.toFixed(2) } : {}), proemios_quote_id: quoteId, proemios_servizio: q.service, proemios_pacchetto: pkg?.name ?? tier, proemios_stato: "contratto accettato, acconto da pagare" }, ctx.available.deals), contactId);
}

async function paymentConfirmed(ctx: Ctx, quoteId: string, kind: string, sequence: number, amountCents: number) {
  const q = await quoteContext(quoteId);
  if (!q) return;
  const cfg = hubSpotConfig();
  const contactId = await contactFor(ctx, q.lead);
  const deal = await ensureDeal(ctx, q.lead, q.record?.dealId ?? q.lead.dealId ?? null, contactId);
  const euro = (amountCents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 });
  const label = kind === "deposit" ? "acconto" : `saldo${sequence > 1 ? ` (rata ${sequence})` : ""}`;
  const props: Record<string, string | number | null> = { proemios_quote_id: quoteId, proemios_incassi: `${label}: € ${euro} verificato da Stripe`, proemios_stato: kind === "deposit" ? "acconto incassato" : "saldo incassato" };
  if (kind === "deposit") Object.assign(props, { dealstage: cfg.wonStage, closedate: ctx.now.toISOString(), ...(q.pkg ? { amount: q.pkg.total.toFixed(2), proemios_pacchetto: q.pkg.name } : {}), proemios_servizio: q.service });
  await updateDeal(ctx.client, deal.id, onlyAvailable(props, ctx.available.deals), contactId);
  if (kind !== "deposit") return;
  if (q.pkg) await ensureLineItems(ctx.client, deal.id, q.pkg.lineItems.map((l) => ({ name: l.label, priceCents: Math.round(l.amount * 100), quantity: 1, sku: l.key })), quoteId);
  const ops = (await ownerIdByEmail(ctx.client, cfg.opsOwnerEmail)) ?? (await salesOwner(ctx, q.record?.dealId ?? null));
  await ensureDealTask(ctx.client, deal.id, contactId, ops, { subject: `Acconto incassato: avvia la produzione · ${q.lead.nome}`, body: `${q.pkg?.name ?? "Servizio"} per ${q.lead.nome}. In Proemios: accetta il passaggio alla produzione, controlla i materiali, assegna l'editor.`, marker: `[acconto ${quoteId}]` }, 4, ctx.now);
}

async function handoffReady(ctx: Ctx, projectId: string, quoteId: string | null, opsStatus: string | null) {
  if (!quoteId) return;
  const q = await quoteContext(quoteId);
  if (!q) return;
  const { OPS_LABELS } = await import("./crm-handoff");
  const contactId = await contactFor(ctx, q.lead);
  const deal = await ensureDeal(ctx, q.lead, q.record?.dealId ?? q.lead.dealId ?? null, contactId);
  await updateDeal(ctx.client, deal.id, onlyAvailable({ proemios_project_id: projectId, proemios_stato_produzione: opsStatus ? (OPS_LABELS as Record<string, string>)[opsStatus] ?? opsStatus : null }, ctx.available.deals), null);
}
