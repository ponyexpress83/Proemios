import { route, json, PlatformError, unavailable } from "@/lib/platform/http";
import { brevoConfigured, brevoWebhookAuthorized, processBrevoEvents } from "@/lib/platform/brevo";
export const runtime = "nodejs";
/**
 * Webhook Brevo: segreto condiviso (header x-proemios-webhook-secret o
 * parametro t), corpo massimo 1 MB, eventi deduplicati; un errore risponde
 * 500 così Brevo riprova.
 */
export const POST = route(async (request) => {
  if (!brevoConfigured() || !process.env.BREVO_WEBHOOK_SECRET || !process.env.DATABASE_URL) throw unavailable();
  if (!brevoWebhookAuthorized(request)) throw new PlatformError(401, "INVALID_SECRET", "Segreto non valido.");
  const raw = await request.text();
  if (raw.length > 1_000_000) throw new PlatformError(413, "TOO_LARGE", "Richiesta troppo grande.");
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw new PlatformError(400, "INVALID_JSON", "Corpo non valido."); }
  return json(await processBrevoEvents(payload));
});
