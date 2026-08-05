/**
 * Tariffe di business — unica fonte di verità per il motore di pricing.
 * Nessuna logica qui: solo numeri. La logica vive in lib/pricing.ts (pura, testata).
 * Tutti gli importi sono in EURO, IVA esclusa.
 */

/** Parole per pagina standard (romanzo composto). Usato per stimare le pagine. */
export const WORDS_PER_PAGE = 300;

/** Prezzo minimo di progetto: nessun preventivo scende sotto questa soglia. */
export const PROJECT_MINIMUM = 149;

/**
 * Fasce a parola. La fascia si sceglie in base al conteggio parole:
 * si applica la prima fascia il cui `maxWords` è >= al conteggio.
 * L'ultima fascia ha maxWords = Infinity.
 */
export type WordBand = { maxWords: number; ratePerWord: number };

/** Editing (di linea/struttura). €/parola per fascia. */
export const EDITING_BANDS: WordBand[] = [
  { maxWords: 40_000, ratePerWord: 0.022 },
  { maxWords: 80_000, ratePerWord: 0.019 },
  { maxWords: 120_000, ratePerWord: 0.016 },
  { maxWords: Infinity, ratePerWord: 0.014 },
];

/** Correzione bozze. €/parola per fascia (circa metà dell'editing). */
export const PROOFREADING_BANDS: WordBand[] = [
  { maxWords: 40_000, ratePerWord: 0.01 },
  { maxWords: 80_000, ratePerWord: 0.009 },
  { maxWords: 120_000, ratePerWord: 0.008 },
  { maxWords: Infinity, ratePerWord: 0.007 },
];

/** Impaginazione cartacea: forfait per scaglioni di pagine. */
export type PageTier = { maxPages: number; price: number };
export const LAYOUT_PAGE_TIERS: PageTier[] = [
  { maxPages: 120, price: 250 },
  { maxPages: 250, price: 400 },
  { maxPages: 400, price: 600 },
  { maxPages: Infinity, price: 850 },
];

/** Servizi a forfait fisso. */
export const FLAT_SERVICES = {
  epub: 120,
  cover: 350,
  kdpPublishing: 200,
  isbn: 90, // assistenza ISBN esterno (il costo dell'ISBN è a parte)
  amazonListing: 150, // scheda Amazon ottimizzata
} as const;

/**
 * Ghostwriting / "dal diario al libro".
 * Prezzo = parole finali stimate × rate, modulato dalla quantità di materiale grezzo:
 * più materiale disponibile = meno lavoro di creazione = rate leggermente più basso.
 */
export const GHOSTWRITING = {
  baseRatePerFinalWord: 0.16,
  /** Moltiplicatori sul rate in base al materiale disponibile. */
  materialMultiplier: {
    abbondante: 0.85, // diari/vocali/appunti estesi
    parziale: 1.0, // qualche traccia
    scarso: 1.2, // quasi da zero, solo un'idea
  },
  /** Soglia minima per un progetto di ghostwriting (memoir). */
  minimum: 3_000,
} as const;

export type MaterialAmount = keyof typeof GHOSTWRITING.materialMultiplier;

/** Maggiorazione per tempi prioritari (percentuale sul totale servizi). */
export const RUSH_SURCHARGE = 0.3; // +30%

/**
 * Sconto volume sui servizi a parola (editing, correzione), oltre soglie di parole.
 * Si applica lo sconto più alto la cui soglia è superata.
 */
export type VolumeDiscount = { minWords: number; discount: number };
export const VOLUME_DISCOUNTS: VolumeDiscount[] = [
  { minWords: 120_000, discount: 0.08 },
  { minWords: 80_000, discount: 0.05 },
];

/** Servizi extra del pacchetto Signature (a forfait). */
export const SIGNATURE_EXTRAS = {
  launchStrategy: 900, // strategia e materiali di lancio
  postPublishing: 350, // assistenza post-pubblicazione
  extraRevisionRound: 300, // giro di revisioni aggiuntivo
} as const;

/** Acconto richiesto per bloccare la data (percentuale sul totale). */
export const DEPOSIT_RATE = 0.4; // 40%
