/**
 * Motore di pricing — funzione PURA, senza dipendenze da React o DB.
 * È il cuore commerciale del prodotto: interamente testato (tests/pricing.test.ts).
 *
 * Restituisce TRE PACCHETTI (non tre prezzi dello stesso pacchetto):
 *  - Essenziale: il minimo che risolve il problema dichiarato
 *  - Consigliato: il più completo in rapporto al valore (evidenziato)
 *  - Signature: include lancio, assistenza post-pubblicazione, revisioni extra
 */

import {
  WORDS_PER_PAGE,
  PROJECT_MINIMUM,
  EDITING_BANDS,
  PROOFREADING_BANDS,
  LAYOUT_PAGE_TIERS,
  FLAT_SERVICES,
  GHOSTWRITING,
  RUSH_SURCHARGE,
  VOLUME_DISCOUNTS,
  SIGNATURE_EXTRAS,
  DEPOSIT_RATE,
  type WordBand,
  type MaterialAmount,
} from "@/config/pricing";

// ----------------------------- Tipi di dominio -----------------------------

export type ProjectType = "romanzo" | "saggio" | "memoir" | "libro-professionale" | "solo-grafica";

export type TextState =
  "finito-revisionato" | "finito-da-revisionare" | "bozza-incompleta" | "solo-materiali";

export type ServiceKey =
  "editing" | "proofreading" | "layout" | "epub" | "cover" | "kdp" | "isbn" | "amazonListing";

export type Urgency = "standard" | "prioritaria";

export type PricingInput = {
  projectType: ProjectType;
  textState: TextState;
  /** Conteggio parole. Per "solo-materiali" è la lunghezza stimata del libro finale. */
  wordCount: number;
  /** Rilevante solo per ghostwriting ("solo-materiali"). Default: "parziale". */
  materialAmount?: MaterialAmount;
  /** Servizi esplicitamente richiesti dal cliente (aggiunti al pacchetto Essenziale). */
  requestedServices?: ServiceKey[];
  urgency?: Urgency;
};

export type LineItem = { key: string; label: string; amount: number };

export type PackageTier = "essenziale" | "consigliato" | "signature";

export type QuotePackage = {
  tier: PackageTier;
  name: string;
  headline: string;
  recommended: boolean;
  lineItems: LineItem[];
  includes: string[];
  excludes: string[];
  subtotal: number;
  /** Sconto volume applicato (valore assoluto, >= 0). */
  volumeDiscount: number;
  /** Maggiorazione urgenza (valore assoluto, >= 0). */
  rushSurcharge: number;
  /** True se il totale è stato portato al minimo di progetto. */
  minimumApplied: boolean;
  total: number;
  deposit: number;
};

export type QuoteResult = {
  wordCount: number;
  estimatedPages: number;
  isGhostwriting: boolean;
  packages: [QuotePackage, QuotePackage, QuotePackage];
  disclaimer: string;
};

// ----------------------------- Etichette -----------------------------

const LABELS: Record<string, string> = {
  editing: "Editing professionale",
  proofreading: "Correzione bozze",
  layout: "Impaginazione cartacea",
  epub: "Conversione EPUB",
  cover: "Copertina originale",
  kdp: "Pubblicazione Amazon KDP",
  isbn: "Assistenza ISBN",
  amazonListing: "Scheda Amazon ottimizzata",
  ghostwriting: "Scrittura del libro (ghostwriting)",
  launchStrategy: "Strategia e materiali di lancio",
  postPublishing: "Assistenza post-pubblicazione",
  extraRevisionRound: "Giro di revisioni aggiuntivo",
};

// ----------------------------- Helper puri -----------------------------

function round(n: number): number {
  return Math.round(n);
}

export function estimatePages(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));
}

function pickRate(bands: WordBand[], wordCount: number): number {
  for (const band of bands) {
    if (wordCount <= band.maxWords) return band.ratePerWord;
  }
  // L'ultima fascia ha maxWords = Infinity, quindi non si arriva mai qui.
  return bands[bands.length - 1]!.ratePerWord;
}

export function volumeDiscountRate(wordCount: number): number {
  // VOLUME_DISCOUNTS è ordinato dal più alto: applica il primo superato.
  for (const vd of VOLUME_DISCOUNTS) {
    if (wordCount >= vd.minWords) return vd.discount;
  }
  return 0;
}

export function editingCost(wordCount: number): number {
  return round(wordCount * pickRate(EDITING_BANDS, wordCount));
}

export function proofreadingCost(wordCount: number): number {
  return round(wordCount * pickRate(PROOFREADING_BANDS, wordCount));
}

export function layoutCost(wordCount: number): number {
  const pages = estimatePages(wordCount);
  for (const tier of LAYOUT_PAGE_TIERS) {
    if (pages <= tier.maxPages) return tier.price;
  }
  return LAYOUT_PAGE_TIERS[LAYOUT_PAGE_TIERS.length - 1]!.price;
}

export function ghostwritingCost(finalWords: number, material: MaterialAmount): number {
  const raw =
    finalWords * GHOSTWRITING.baseRatePerFinalWord * GHOSTWRITING.materialMultiplier[material];
  return round(Math.max(GHOSTWRITING.minimum, raw));
}

/** Costo di un servizio a forfait o a parola, per chiave. */
function serviceCost(key: ServiceKey, wordCount: number): number {
  switch (key) {
    case "editing":
      return editingCost(wordCount);
    case "proofreading":
      return proofreadingCost(wordCount);
    case "layout":
      return layoutCost(wordCount);
    case "epub":
      return FLAT_SERVICES.epub;
    case "cover":
      return FLAT_SERVICES.cover;
    case "kdp":
      return FLAT_SERVICES.kdpPublishing;
    case "isbn":
      return FLAT_SERVICES.isbn;
    case "amazonListing":
      return FLAT_SERVICES.amazonListing;
  }
}

/** Le chiavi a parola su cui si applica lo sconto volume. */
const PER_WORD_KEYS: ReadonlySet<ServiceKey> = new Set(["editing", "proofreading"]);

// ----------------------------- Composizione pacchetti -----------------------------

/** Tutte le componenti possibili di pubblicazione, in ordine di presentazione. */
const ALL_PUBLICATION_KEYS = [
  "ghostwriting",
  "editing",
  "proofreading",
  "cover",
  "layout",
  "epub",
  "kdp",
  "isbn",
  "amazonListing",
  "launchStrategy",
  "postPublishing",
  "extraRevisionRound",
] as const;

type ComponentKey = (typeof ALL_PUBLICATION_KEYS)[number];

type TierComposition = {
  serviceKeys: ServiceKey[];
  ghostwriting: boolean;
  signatureExtras: (keyof typeof SIGNATURE_EXTRAS)[];
};

/** Deriva le componenti dei tre pacchetti dallo stato del progetto. */
function composeTiers(input: PricingInput): Record<PackageTier, TierComposition> {
  const isGhostwriting = input.textState === "solo-materiali";
  const isGraphicsOnly = input.projectType === "solo-grafica";

  if (isGraphicsOnly) {
    return {
      essenziale: { serviceKeys: ["layout", "cover"], ghostwriting: false, signatureExtras: [] },
      consigliato: {
        serviceKeys: ["layout", "cover", "epub"],
        ghostwriting: false,
        signatureExtras: [],
      },
      signature: {
        serviceKeys: ["layout", "cover", "epub", "kdp", "amazonListing"],
        ghostwriting: false,
        signatureExtras: [],
      },
    };
  }

  if (isGhostwriting) {
    return {
      essenziale: {
        serviceKeys: ["layout", "epub", "kdp", "isbn"],
        ghostwriting: true,
        signatureExtras: [],
      },
      consigliato: {
        serviceKeys: ["layout", "cover", "epub", "kdp", "isbn", "amazonListing"],
        ghostwriting: true,
        signatureExtras: [],
      },
      signature: {
        serviceKeys: ["layout", "cover", "epub", "kdp", "isbn", "amazonListing"],
        ghostwriting: true,
        signatureExtras: ["launchStrategy", "postPublishing", "extraRevisionRound"],
      },
    };
  }

  // Testo esistente: il livello di revisione dipende dallo stato del testo.
  const baseRevision: ServiceKey =
    input.textState === "finito-revisionato" ? "proofreading" : "editing";

  return {
    essenziale: {
      serviceKeys: [baseRevision, "layout", "epub", "kdp", "isbn"],
      ghostwriting: false,
      signatureExtras: [],
    },
    consigliato: {
      // Consigliato porta sempre l'editing (upgrade se l'essenziale era correzione).
      serviceKeys: ["editing", "layout", "cover", "epub", "kdp", "isbn", "amazonListing"],
      ghostwriting: false,
      signatureExtras: [],
    },
    signature: {
      serviceKeys: ["editing", "layout", "cover", "epub", "kdp", "isbn", "amazonListing"],
      ghostwriting: false,
      signatureExtras: ["launchStrategy", "postPublishing", "extraRevisionRound"],
    },
  };
}

const TIER_META: Record<PackageTier, { name: string; headline: string; recommended: boolean }> = {
  essenziale: {
    name: "Essenziale",
    headline: "Il minimo che risolve il tuo problema, senza fronzoli.",
    recommended: false,
  },
  consigliato: {
    name: "Consigliato",
    headline: "Il percorso più completo in rapporto al valore.",
    recommended: true,
  },
  signature: {
    name: "Signature",
    headline: "Tutto incluso, con lancio e assistenza dopo la pubblicazione.",
    recommended: false,
  },
};

function buildPackage(tier: PackageTier, comp: TierComposition, input: PricingInput): QuotePackage {
  const wordCount = input.wordCount;
  const urgency = input.urgency ?? "standard";
  const material = input.materialAmount ?? "parziale";

  const lineItems: LineItem[] = [];
  const includedKeys = new Set<ComponentKey>();

  if (comp.ghostwriting) {
    lineItems.push({
      key: "ghostwriting",
      label: LABELS.ghostwriting!,
      amount: ghostwritingCost(wordCount, material),
    });
    includedKeys.add("ghostwriting");
  }

  // Servizi (dedup, ordine canonico per presentazione).
  const orderedServiceKeys = (ALL_PUBLICATION_KEYS as readonly string[]).filter((k) =>
    comp.serviceKeys.includes(k as ServiceKey),
  ) as ServiceKey[];

  let volumeDiscount = 0;
  const vdRate = volumeDiscountRate(wordCount);

  for (const key of orderedServiceKeys) {
    const amount = serviceCost(key, wordCount);
    lineItems.push({ key, label: LABELS[key]!, amount });
    includedKeys.add(key);
    if (PER_WORD_KEYS.has(key) && vdRate > 0) {
      volumeDiscount += amount * vdRate;
    }
  }

  for (const extra of comp.signatureExtras) {
    lineItems.push({ key: extra, label: LABELS[extra]!, amount: SIGNATURE_EXTRAS[extra] });
    includedKeys.add(extra);
  }

  volumeDiscount = round(volumeDiscount);

  const rawSubtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const afterDiscount = rawSubtotal - volumeDiscount;
  const rushSurcharge = urgency === "prioritaria" ? round(afterDiscount * RUSH_SURCHARGE) : 0;
  let total = afterDiscount + rushSurcharge;

  let minimumApplied = false;
  if (total < PROJECT_MINIMUM) {
    total = PROJECT_MINIMUM;
    minimumApplied = true;
  }

  const includes = (ALL_PUBLICATION_KEYS as readonly ComponentKey[])
    .filter((k) => includedKeys.has(k))
    .map((k) => LABELS[k]!);

  const excludes = (ALL_PUBLICATION_KEYS as readonly ComponentKey[])
    .filter((k) => !includedKeys.has(k))
    .map((k) => LABELS[k]!);

  return {
    tier,
    name: TIER_META[tier].name,
    headline: TIER_META[tier].headline,
    recommended: TIER_META[tier].recommended,
    lineItems,
    includes,
    excludes,
    subtotal: rawSubtotal,
    volumeDiscount,
    rushSurcharge,
    minimumApplied,
    total: round(total),
    deposit: round(total * DEPOSIT_RATE),
  };
}

// ----------------------------- API pubblica -----------------------------

const DISCLAIMER =
  "Questo preventivo è una stima basata sui dati che hai inserito. Il prezzo definitivo viene confermato dopo una call, in cui verifichiamo il testo e le tue esigenze.";

export function computeQuote(input: PricingInput): QuoteResult {
  const wordCount = Math.max(0, Math.floor(input.wordCount || 0));
  const withWords: PricingInput = { ...input, wordCount };

  const tiers = composeTiers(withWords);

  // Aggiungi i servizi esplicitamente richiesti al solo pacchetto Essenziale.
  if (input.requestedServices?.length) {
    for (const key of input.requestedServices) {
      if (!tiers.essenziale.serviceKeys.includes(key)) {
        tiers.essenziale.serviceKeys.push(key);
      }
    }
  }

  const packages: [QuotePackage, QuotePackage, QuotePackage] = [
    buildPackage("essenziale", tiers.essenziale, withWords),
    buildPackage("consigliato", tiers.consigliato, withWords),
    buildPackage("signature", tiers.signature, withWords),
  ];

  return {
    wordCount,
    estimatedPages: estimatePages(wordCount),
    isGhostwriting: input.textState === "solo-materiali",
    packages,
    disclaimer: DISCLAIMER,
  };
}

// ----------------- Stima di costo per il report di analisi -----------------

/**
 * Fascia di costo indicativa mostrata nel report dell'analisi manoscritto,
 * calcolata sul conteggio parole REALE del file (brief §3.4.3).
 *
 * Minimo  = la sola revisione al livello consigliato.
 * Massimo = revisione + produzione completa (impaginazione, EPUB, copertina, KDP).
 *
 * Usa le stesse tariffe del configuratore: le due cifre non devono mai
 * contraddirsi fra loro.
 */
export function costBandForAnalysis(
  wordCount: number,
  level: "correzione-bozze" | "editing-leggero" | "editing-profondo",
): { min: number; max: number } {
  const words = Math.max(1, Math.round(wordCount));

  const revision =
    level === "correzione-bozze"
      ? proofreadingCost(words)
      : level === "editing-profondo"
        ? editingCost(words)
        : Math.round((proofreadingCost(words) + editingCost(words)) / 2);

  const production =
    layoutCost(words) + FLAT_SERVICES.epub + FLAT_SERVICES.cover + FLAT_SERVICES.kdpPublishing;

  const min = Math.max(PROJECT_MINIMUM, revision);
  const max = Math.max(min, Math.round(revision + production));

  return { min, max };
}
