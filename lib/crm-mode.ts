/**
 * Dove lavora il commerciale. «hubspot» (predefinito): contatti, trattative,
 * coda e marketing stanno in HubSpot; in Proemios restano richieste, proposte
 * con prezzo, contratti, pagamenti, produzione e provvigioni. «platform»
 * (NEXT_PUBLIC_CRM_MODE=platform) riporta tutto il CRM interno.
 * Nessun dato viene cancellato in nessuna delle due modalità.
 */
export type CrmMode = "hubspot" | "platform";
export function crmMode(): CrmMode {
  return process.env.NEXT_PUBLIC_CRM_MODE === "platform" ? "platform" : "hubspot";
}
/** Schede dello spazio team che in modalità HubSpot passano al CRM esterno. */
export const HUBSPOT_TABS = new Set(["deals", "contacts", "pool", "marketing"]);
/** Modelli di ruolo ritirati in modalità HubSpot: non più assegnabili, chi li ha li conserva. */
export const RETIRED_TEMPLATES = new Set(["marketing", "admin_marketing"]);
/** Ruoli che non si assegnano più con un invito diretto in modalità HubSpot. */
export const RETIRED_ROLES = new Set(["marketing"]);
