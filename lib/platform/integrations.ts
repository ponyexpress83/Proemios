import { stripeConfigurato } from "@/lib/stripe";
import { mailConfigured } from "./config";
import { ficConfigured, ficSendsToSdi } from "./fic";
import { demand, type Actor } from "./access";
import { json, notFound } from "./http";

/**
 * Stato dei collegamenti esterni: solo «configurato / non configurato» e un
 * dettaglio non sensibile. Le credenziali restano nelle variabili d'ambiente
 * e non passano mai dall'interfaccia.
 */
export type IntegrationState = { label: string; configured: boolean; detail: string; mode: "operational" | "prepared" | "missing"; docs: string };
export async function integrationStatus(): Promise<Record<"stripe" | "resend" | "fic" | "analytics" | "brevo" | "googleAds" | "meta" | "whatsapp" | "sms" | "looker", IntegrationState>> {
  const live = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  const brevo = Boolean(process.env.BREVO_API_KEY);
  const ga = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  return {
    stripe: { label: "Stripe (pagamenti)", configured: stripeConfigurato() && Boolean(process.env.STRIPE_WEBHOOK_SECRET), detail: stripeConfigurato() ? `${live ? "chiave live" : "chiave di test"}${process.env.STRIPE_WEBHOOK_SECRET ? ", webhook configurato" : ", webhook mancante"}` : "chiave mancante", mode: stripeConfigurato() && process.env.STRIPE_WEBHOOK_SECRET ? "operational" : "missing", docs: "docs/FATTURAZIONE_E_PAGAMENTI.md" },
    resend: { label: "Resend (email operative)", configured: mailConfigured(), detail: process.env.RESEND_API_KEY ? `mittente ${process.env.EMAIL_FROM ?? "predefinito"}` : process.env.PROEMIOS_TEST_RUN === "1" ? "trasporto di test" : "chiave mancante", mode: mailConfigured() ? "operational" : "missing", docs: "docs/INTEGRAZIONI.md" },
    fic: { label: "Fatture in Cloud", configured: ficConfigured(), detail: ficConfigured() ? (ficSendsToSdi() ? "emissione e invio SdI" : "emissione senza invio SdI") : "token o azienda mancanti", mode: ficConfigured() ? "operational" : "prepared", docs: "docs/FATTURAZIONE_E_PAGAMENTI.md" },
    analytics: { label: "Google Analytics 4", configured: Boolean(ga), detail: ga ? `misurazione ${ga.slice(0, 4)}…, eventi senza dati personali` : "ID di misurazione mancante (NEXT_PUBLIC_GA4_MEASUREMENT_ID)", mode: ga ? "operational" : "prepared", docs: "docs/INTEGRAZIONI.md" },
    brevo: { label: "Brevo (campagne e recuperi)", configured: brevo, detail: brevo ? `liste e webhook${process.env.BREVO_WEBHOOK_SECRET ? " con firma" : ", firma webhook mancante"}` : "chiave mancante (BREVO_API_KEY)", mode: brevo ? "operational" : "prepared", docs: "docs/INTEGRAZIONI.md" },
    googleAds: { label: "Google Ads", configured: false, detail: "nessun collegamento automatico: spesa via import CSV nel registro campagne", mode: "prepared", docs: "docs/INTEGRAZIONI.md" },
    meta: { label: "Meta Ads", configured: false, detail: "nessun collegamento automatico: spesa via import CSV nel registro campagne", mode: "prepared", docs: "docs/INTEGRAZIONI.md" },
    whatsapp: { label: "WhatsApp Business", configured: false, detail: "attività manuali dal telefono aziendale; nessun invio automatico", mode: "prepared", docs: "docs/INTEGRAZIONI.md" },
    sms: { label: "SMS", configured: false, detail: "attività manuali; nessun invio automatico", mode: "prepared", docs: "docs/INTEGRAZIONI.md" },
    looker: { label: "Looker Studio", configured: false, detail: "facoltativo: export CSV dei contatti e del registro come sorgente", mode: "prepared", docs: "docs/INTEGRAZIONI.md" },
  };
}
export async function integrationCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demand(actor, "integrations.manage");
  return json({ integrations: await integrationStatus() });
}
