/**
 * Eventi di marketing verso Google Analytics 4, solo con consenso esplicito e
 * senza dati personali. Gli eventi operativi (notifiche, promemoria, pratiche)
 * non passano mai di qui; la fonte economica resta la piattaforma (ordini
 * verificati dal webhook), non gli eventi del browser.
 */
export type ConversionEvent =
  | "quote_started"
  | "estimate_viewed"
  | "package_chosen"
  | "proposal_viewed"
  | "checkout_opened"
  | "quote_generated"
  | "consultation_clicked"
  | "lead_submitted"
  | "manuscript_analysis_completed"
  | "purchase";
export const CONSENT_KEY = "proemios-consent-v1";
export type ConsentState = { analytics: boolean; at: string };
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown> | IArguments>;
    gtag?: (...args: unknown[]) => void;
  }
}
export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(CONSENT_KEY); return raw ? (JSON.parse(raw) as ConsentState) : null; } catch { return null; }
}
export function writeConsent(analytics: boolean): ConsentState {
  const state = { analytics, at: new Date().toISOString() };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(state)); } catch { /* memoria non disponibile */ }
  if (typeof window !== "undefined" && window.gtag) window.gtag("consent", "update", { analytics_storage: analytics ? "granted" : "denied" });
  return state;
}
export function analyticsAllowed(): boolean {
  return typeof navigator !== "undefined" && navigator.doNotTrack !== "1" && readConsent()?.analytics === true;
}
/** Invia un evento a GA4 solo con consenso; i parametri ammessi sono numeri, booleani e stringhe brevi senza email. */
export function trackEvent(event: ConversionEvent, data: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined" || !analyticsAllowed() || !window.gtag) return;
  const safe = Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v !== "string" || (v.length <= 60 && !v.includes("@"))));
  window.gtag("event", event, safe);
}
