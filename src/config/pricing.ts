/**
 * Tutte le tariffe del motore di preventivo, in un unico posto.
 * Valori in EURO. Modificabili senza toccare la logica in `lib/pricing.ts`.
 *
 * Le tariffe sono indicative e pensate per generare tre pacchetti coerenti
 * (Essenziale / Consigliato / Signature). Ogni voce documenta l'unità.
 */

export interface PageBandRate {
  /** Numero massimo di pagine per questa fascia (incluso). */
  maxPagine: number;
  /** Prezzo forfait per la fascia. */
  prezzo: number;
}

export interface GhostwritingBand {
  /** Numero massimo di parole del libro finale (incluso). */
  maxParole: number;
  /** Prezzo forfait di ghostwriting per la fascia. */
  prezzo: number;
}

export const PRICING = {
  /** Parole medie per pagina impaginata (per stimare le pagine dal conteggio parole). */
  parolePerPagina: 300,

  /** Tariffa a parola. */
  perParola: {
    editing: 0.016, // €/parola — editing (fascia media 0,012–0,02)
    correzioneBozze: 0.008, // €/parola — correzione bozze (0,006–0,01)
  },

  /** Impaginazione cartacea: forfait per fascia di pagine. */
  impaginazioneCartacea: [
    { maxPagine: 120, prezzo: 250 },
    { maxPagine: 250, prezzo: 400 },
    { maxPagine: 400, prezzo: 600 },
    { maxPagine: Infinity, prezzo: 850 },
  ] as PageBandRate[],

  /** Conversione/impaginazione EPUB: forfait per fascia di pagine. */
  epub: [
    { maxPagine: 250, prezzo: 150 },
    { maxPagine: Infinity, prezzo: 250 },
  ] as PageBandRate[],

  /** Copertina: forfait. */
  copertina: 450,

  /** Pubblicazione su Amazon KDP: forfait. */
  pubblicazioneKdp: 300,

  /** ISBN esterno (di proprietà dell'autore): forfait di gestione. */
  isbnEsterno: 90,

  /** Scheda Amazon ottimizzata (metadata + testo di vendita): forfait. */
  schedaAmazon: 180,

  /** Ghostwriting: fascia in base al volume del libro finale. */
  ghostwriting: [
    { maxParole: 30000, prezzo: 3500 },
    { maxParole: 60000, prezzo: 6500 },
    { maxParole: 90000, prezzo: 9500 },
    { maxParole: 120000, prezzo: 13000 },
    { maxParole: Infinity, prezzo: 16000 },
  ] as GhostwritingBand[],

  /** Maggiorazione per tempistica prioritaria. */
  prioritaria: 0.25,

  /** Acconto richiesto al checkout, come frazione del totale. */
  accontoFrazione: 0.4,

  /** Prezzo minimo di un progetto (evita preventivi irrisori). */
  minimoProgetto: 149,
} as const;

export type Servizio =
  | "editing"
  | "correzioneBozze"
  | "impaginazioneCartacea"
  | "epub"
  | "copertina"
  | "pubblicazioneKdp"
  | "isbnEsterno"
  | "schedaAmazon";

/** Etichette leggibili per i servizi (i18n-ready). */
export const SERVIZIO_LABELS: Record<Servizio, string> = {
  editing: "Editing",
  correzioneBozze: "Correzione bozze",
  impaginazioneCartacea: "Impaginazione cartacea",
  epub: "Formato EPUB",
  copertina: "Copertina",
  pubblicazioneKdp: "Pubblicazione KDP",
  isbnEsterno: "ISBN esterno",
  schedaAmazon: "Scheda Amazon ottimizzata",
};
