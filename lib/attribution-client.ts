/**
 * Attribuzione di sessione, lato browser, senza cookie: i parametri di
 * campagna della visita restano in sessionStorage e viaggiano solo con la
 * richiesta che la persona invia (preventivo, contatto). Niente identificatori
 * persistenti, niente dati personali negli URL. Con Do Not Track attivo non si
 * conserva nulla.
 *
 * Regola documentata: prima origine nota per pagina di atterraggio, referrer e
 * data della prima visita; ultima origine nota per UTM, click id e campagna.
 * Cambio di dispositivo, nuova sessione o consenso negato = origine sconosciuta.
 */
import type { LeadAttribution } from "./attribution";

const KEY = "proemios-attribution-v1", VISITOR = "proemios-visitor-v1";
const PARAMS: Record<string, keyof LeadAttribution> = { utm_source: "utmSource", utm_medium: "utmMedium", utm_campaign: "utmCampaign", utm_content: "utmContent", utm_term: "utmTerm", gclid: "gclid", fbclid: "fbclid", pc: "campaignId" };
function allowed(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined" && navigator.doNotTrack !== "1";
}
export function captureSessionAttribution(href = typeof location !== "undefined" ? location.href : ""): void {
  if (!allowed() || !href) return;
  try {
    const url = new URL(href);
    const existing = readSessionAttribution() ?? {};
    const next: LeadAttribution = { ...existing, landingPath: existing.landingPath ?? `${url.pathname}${url.search}`.slice(0, 500), referrer: existing.referrer ?? (document.referrer.slice(0, 500) || undefined), firstSeenAt: existing.firstSeenAt ?? new Date().toISOString() };
    let campaign = false;
    for (const [param, key] of Object.entries(PARAMS)) {
      const value = url.searchParams.get(param)?.trim();
      if (value) { next[key] = value.slice(0, 500); campaign = true; }
    }
    if (!campaign && Object.keys(existing).length) return;
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* la misurazione non blocca mai la pagina */ }
}
export function readSessionAttribution(): LeadAttribution | null {
  if (!allowed()) return null;
  try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as LeadAttribution) : null; } catch { return null; }
}
/** Chiave di sessione anonima per contare passi e abbandoni del configuratore: vive quanto la scheda. */
export function sessionVisitorKey(): string | undefined {
  if (!allowed()) return undefined;
  try {
    let key = sessionStorage.getItem(VISITOR);
    if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(VISITOR, key); }
    return key;
  } catch { return undefined; }
}
