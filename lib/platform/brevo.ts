import { eq } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { leadActivities, webhookEvents } from "@/db/platform-schema";
import { PlatformError, unavailable } from "./http";

/**
 * Brevo, predisposto: campagne e recuperi di marketing vivono lì, le email
 * operative restano su Resend. Qui ci sono solo due cose:
 * - la sincronizzazione del contatto autorizzato (consenso dato, mai revocato);
 * - il webhook che riporta disiscrizioni, rimbalzi e segnalazioni, con
 *   verifica del segreto condiviso, deduplica e ritentativo su errore.
 * Nessun editor di campagne nella piattaforma: si usa quello di Brevo.
 */
export function brevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}
const base = "https://api.brevo.com/v3";
export async function syncBrevoContact(leadId: string): Promise<{ synced: boolean; skipped?: string }> {
  if (!brevoConfigured() || process.env.PROEMIOS_TEST_RUN === "1") return { synced: false, skipped: "not-configured" };
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return { synced: false, skipped: "missing" };
  const allowed = lead.consensoMarketing && !lead.marketingRevokedAt;
  const listId = Number(process.env.BREVO_LIST_ID ?? 0);
  // Solo i dati necessari alla campagna: nome, email, origine. Mai note, telefono, testi o documenti.
  const response = await fetch(`${base}/contacts`, {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email: lead.email, updateEnabled: true, attributes: { NOME: lead.nome, ORIGINE: lead.fonte }, emailBlacklisted: !allowed, ...(allowed && listId ? { listIds: [listId] } : {}), ...(!allowed && listId ? { unlinkListIds: [listId] } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok && response.status !== 204) throw new Error(`Brevo ${response.status}`);
  return { synced: true };
}
export function brevoWebhookAuthorized(request: Request): boolean {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (!secret) return false;
  const given = request.headers.get("x-proemios-webhook-secret") ?? new URL(request.url).searchParams.get("t") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
const eventSchema = z.object({ event: z.string().max(40), email: z.string().email().max(320), id: z.union([z.string(), z.number()]).optional(), "message-id": z.string().optional(), date: z.string().optional(), ts: z.union([z.number(), z.string()]).optional(), reason: z.string().max(300).optional(), tag: z.string().max(100).optional() }).passthrough();
const REVOKING = new Set(["unsubscribed", "unsubscribe", "spam", "complaint", "hard_bounce", "hardBounce", "blocked", "invalid_email", "invalid"]);
export type BrevoResult = { received: true; duplicate?: boolean; applied?: number; ignored?: number };
export async function processBrevoEvents(payload: unknown): Promise<BrevoResult> {
  if (!process.env.DATABASE_URL) throw unavailable();
  const items = (Array.isArray(payload) ? payload : [payload]).slice(0, 200);
  let applied = 0, ignored = 0, duplicate = false;
  for (const raw of items) {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) throw new PlatformError(400, "INVALID_EVENT", "Evento non valido.");
    const e = parsed.data;
    const key = `brevo:${createHash("sha256").update(`${e.event}|${e.email.toLowerCase()}|${e["message-id"] ?? e.id ?? ""}|${e.ts ?? e.date ?? ""}`).digest("hex").slice(0, 40)}`;
    const outcome = await getDb().transaction(async (tx) => {
      const inserted = await tx.insert(webhookEvents).values({ eventId: key, type: `brevo.${e.event}` }).onConflictDoNothing().returning();
      if (!inserted.length) return "duplicate" as const;
      if (!REVOKING.has(e.event)) return "ignored" as const;
      const rows = await tx.select({ id: leads.id, prefs: leads.contactPreferences }).from(leads).where(eq(leads.email, e.email.toLowerCase()));
      for (const lead of rows) {
        const bounce = ["hard_bounce", "hardBounce", "blocked", "invalid_email", "invalid"].includes(e.event);
        await tx.update(leads).set({ consensoMarketing: false, marketingRevokedAt: new Date(), ...(bounce ? { contactPreferences: { email: false, phone: lead.prefs?.phone ?? false, whatsapp: lead.prefs?.whatsapp ?? false, sms: lead.prefs?.sms ?? false, note: lead.prefs?.note ?? null } } : {}), updatedAt: new Date() }).where(eq(leads.id, lead.id));
        await tx.insert(leadActivities).values({ leadId: lead.id, kind: "consent", channel: "email", direction: "inbound", purpose: "marketing", body: `Brevo: ${e.event}${e.reason ? ` (${e.reason.slice(0, 120)})` : ""}.`, outcome: bounce ? "bounced" : "revoked" });
      }
      return "applied" as const;
    });
    if (outcome === "duplicate") duplicate = true; else if (outcome === "applied") applied++; else ignored++;
  }
  return { received: true, duplicate: duplicate && !applied && !ignored ? true : undefined, applied, ignored };
}
