/**
 * Piani in abbonamento degli Strumenti AI (linea 3).
 *
 * In Fase 1 questi piani sono PRESENTATI pubblicamente (pagina /strumenti-ai)
 * con raccolta lista d'attesa, per validare la domanda e posizionare Proemios
 * come SaaS AI. La fatturazione a subscription (Stripe) si attiva in Fase 2:
 * lo schema DB (`subscriptions`) è già predisposto, e `SUBSCRIPTIONS_LIVE`
 * fa da feature flag per accendere il checkout ricorrente senza refactor.
 */

export const SUBSCRIPTIONS_LIVE = false; // Fase 2: portare a true per attivare Stripe subscription

export type BillingPeriod = "monthly" | "annual";

export type AiPlan = {
  slug: "free" | "pro" | "premium";
  name: string;
  claim: string;
  /** Prezzo mensile in euro. Sul piano annuale si applica ANNUAL_DISCOUNT. */
  monthly: number | null; // null = gratis
  highlighted?: boolean;
  features: string[];
  /** Limiti/crediti indicativi (mostrati in UI). */
  limits: string;
  /** CTA in Fase 1 (waitlist) vs Fase 2 (checkout). */
  waitlistCta: string;
};

/** Sconto sul piano annuale (equivale a ~2 mesi gratis). */
export const ANNUAL_DISCOUNT = 0.1667; // -16,67%

export const AI_PLANS: AiPlan[] = [
  {
    slug: "free",
    name: "Free",
    claim: "Per iniziare: la prima diagnosi del tuo manoscritto.",
    monthly: 0,
    limits: "1 analisi manoscritto / mese · strumenti base",
    features: [
      "Analisi manoscritto (prima diagnosi)",
      "Preventivo esatto illimitato",
      "Metriche di leggibilità e ritmo",
    ],
    waitlistCta: "Inizia gratis",
  },
  {
    slug: "pro",
    name: "Pro",
    claim: "Per l'autore che pubblica sul serio su Amazon.",
    monthly: 19,
    highlighted: true,
    limits: "Analisi illimitate · strumenti Amazon inclusi",
    features: [
      "Tutto del piano Free",
      "Analisi manoscritto illimitate",
      "Assistente editoriale AI (self-publishing)",
      "Ottimizzatore scheda Amazon: titolo, keyword, categorie",
      "Generatore quarta di copertina e descrizione",
      "Suggerimenti Kindle Unlimited e strategia di lancio",
    ],
    waitlistCta: "Unisciti alla lista d'attesa",
  },
  {
    slug: "premium",
    name: "Premium",
    claim: "Per chi pubblica più libri e vuole tutto a portata.",
    monthly: 39,
    limits: "Tutto illimitato · priorità · più progetti",
    features: [
      "Tutto del piano Pro",
      "Gestione di più progetti in parallelo",
      "Generatore di concept di copertina (bozze AI)",
      "Archivio manoscritti e versioni",
      "Supporto prioritario",
      "Anteprima delle nuove funzioni",
    ],
    waitlistCta: "Unisciti alla lista d'attesa",
  },
];

/** Prezzo effettivo per periodo (mensile o annuale scontato), arrotondato all'euro. */
export function planPrice(plan: AiPlan, period: BillingPeriod): number | null {
  if (plan.monthly == null || plan.monthly === 0) return plan.monthly;
  if (period === "monthly") return plan.monthly;
  const annualMonthly = plan.monthly * (1 - ANNUAL_DISCOUNT);
  return Math.round(annualMonthly * 12);
}
