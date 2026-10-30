/**
 * Firma dei webhook in uscita: HMAC-SHA256 su "timestamp.corpo". Chi riceve
 * verifica firma e finestra temporale, e usa l'id evento per scartare i doppioni.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}
export function verifySignature(secret: string, body: string, header: string, toleranceSeconds = 300, now = Math.floor(Date.now() / 1000)): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t) || Math.abs(now - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
/** Attesa prima del tentativo successivo: 30 s, 1, 2, 4… minuti, al massimo 6 ore. */
export const retryDelaySeconds = (attempt: number) => Math.min(30 * 2 ** Math.max(0, attempt - 1), 6 * 3600);
export const MAX_WEBHOOK_ATTEMPTS = 8;
export const CRM_EVENTS = ["lead.created", "lead.assigned", "deal.stage_changed", "quote.accepted", "payment.confirmed", "project.handoff_ready"] as const;
export type CrmEvent = (typeof CRM_EVENTS)[number];
