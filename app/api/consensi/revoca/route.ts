import { route } from "@/lib/platform/http";
import { revokeMarketingConsent } from "@/lib/platform/recovery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Link di disiscrizione dalle comunicazioni facoltative: firmato, senza
 * accesso, idempotente. Non tocca le comunicazioni contrattuali.
 */
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const ok = await revokeMarketingConsent(url.searchParams.get("lead") ?? "", url.searchParams.get("t") ?? "");
  const body = ok ? "<p>Fatto: non riceverai più comunicazioni facoltative da Proemios. Le email sulla tua pratica aperta continuano.</p>" : "<p>Link non valido o scaduto. Scrivici e provvediamo noi.</p>";
  return new Response(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Preferenze · Proemios</title></head><body style="font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 24px">${body}</body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
});
