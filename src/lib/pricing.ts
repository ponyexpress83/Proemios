import { PRICING, SERVIZIO_LABELS, type Servizio } from "@/config/pricing";
import type { ProjectType } from "@/config/services";

// ─── Tipi di input/output ──────────────────────────────────────────────────

export type TextState =
  "scritto-revisionato" | "scritto-da-revisionare" | "bozza-incompleta" | "solo-materiali";

export type Tempistica = "standard" | "prioritaria";

export interface QuoteInput {
  projectType: ProjectType;
  statoTesto: TextState;
  /** Conteggio parole del testo (per progetti con testo esistente). */
  parole: number;
  /** Pagine stimate del libro finale (usato quando statoTesto = "solo-materiali"). */
  pagineStimate?: number;
  /** Servizi selezionati esplicitamente nel configuratore. */
  servizi: Servizio[];
  tempistica: Tempistica;
}

export interface PriceComponent {
  servizio: Servizio | "ghostwriting";
  label: string;
  prezzo: number;
}

export type PackageKey = "essenziale" | "consigliato" | "signature";

export interface QuotePackage {
  key: PackageKey;
  nome: string;
  descrizione: string;
  componenti: PriceComponent[];
  /** Somma dei componenti, prima della maggiorazione tempistica. */
  subtotale: number;
  /** Totale finale (maggiorazione + minimo applicati). */
  totale: number;
  /** Acconto richiesto al checkout (frazione configurabile del totale). */
  acconto: number;
  inEvidenza: boolean;
}

export interface QuoteResult {
  paroleEffettive: number;
  pagineStimate: number;
  tempistica: Tempistica;
  maggiorazionePrioritaria: boolean;
  pacchetti: [QuotePackage, QuotePackage, QuotePackage];
}

// ─── Helper di calcolo (puri) ───────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n);
}

function bandLookup<T extends { prezzo: number }>(
  bands: readonly T[],
  match: (b: T) => boolean,
): number {
  const found = bands.find(match);
  // L'ultima fascia usa Infinity come limite, quindi find trova sempre un match.
  return found ? found.prezzo : bands[bands.length - 1]!.prezzo;
}

function editingCost(parole: number): number {
  return round(parole * PRICING.perParola.editing);
}

function correzioneCost(parole: number): number {
  return round(parole * PRICING.perParola.correzioneBozze);
}

function impaginazioneCost(pagine: number): number {
  return bandLookup(PRICING.impaginazioneCartacea, (b) => pagine <= b.maxPagine);
}

function epubCost(pagine: number): number {
  return bandLookup(PRICING.epub, (b) => pagine <= b.maxPagine);
}

function ghostwritingCost(parole: number): number {
  return bandLookup(PRICING.ghostwriting, (b) => parole <= b.maxParole);
}

/** Calcola il prezzo di un singolo servizio in funzione di parole/pagine. */
function componentFor(servizio: Servizio, parole: number, pagine: number): PriceComponent {
  const prezzo = (() => {
    switch (servizio) {
      case "editing":
        return editingCost(parole);
      case "correzioneBozze":
        return correzioneCost(parole);
      case "impaginazioneCartacea":
        return impaginazioneCost(pagine);
      case "epub":
        return epubCost(pagine);
      case "copertina":
        return PRICING.copertina;
      case "pubblicazioneKdp":
        return PRICING.pubblicazioneKdp;
      case "isbnEsterno":
        return PRICING.isbnEsterno;
      case "schedaAmazon":
        return PRICING.schedaAmazon;
    }
  })();
  return { servizio, label: SERVIZIO_LABELS[servizio], prezzo };
}

function ghostwritingComponent(parole: number): PriceComponent {
  return {
    servizio: "ghostwriting",
    label: "Ghostwriting",
    prezzo: ghostwritingCost(parole),
  };
}

/** Ordine canonico di visualizzazione dei servizi. */
const SERVIZIO_ORDER: Servizio[] = [
  "editing",
  "correzioneBozze",
  "impaginazioneCartacea",
  "epub",
  "copertina",
  "pubblicazioneKdp",
  "isbnEsterno",
  "schedaAmazon",
];

const DESIGN_SERVICES: Servizio[] = ["copertina", "impaginazioneCartacea", "epub"];

// ─── Composizione dei tre pacchetti ─────────────────────────────────────────

interface TierSpec {
  base: Servizio[];
  includeGhostwriting: boolean;
}

/**
 * Determina la composizione base dei tre pacchetti in funzione del tipo di
 * progetto e dello stato del testo. La selezione esplicita dei servizi
 * dell'utente viene poi unita a Consigliato e Signature.
 */
function tierSpecs(input: QuoteInput): Record<PackageKey, TierSpec> {
  const isGrafica = input.projectType === "grafica";
  const isGhost = !isGrafica && input.statoTesto === "solo-materiali";

  if (isGrafica) {
    return {
      essenziale: { base: ["copertina"], includeGhostwriting: false },
      consigliato: { base: ["copertina", "impaginazioneCartacea"], includeGhostwriting: false },
      signature: {
        base: ["copertina", "impaginazioneCartacea", "epub"],
        includeGhostwriting: false,
      },
    };
  }

  if (isGhost) {
    return {
      essenziale: {
        base: ["impaginazioneCartacea", "epub"],
        includeGhostwriting: true,
      },
      consigliato: {
        base: ["impaginazioneCartacea", "epub", "copertina", "pubblicazioneKdp"],
        includeGhostwriting: true,
      },
      signature: {
        base: [
          "impaginazioneCartacea",
          "epub",
          "copertina",
          "pubblicazioneKdp",
          "isbnEsterno",
          "schedaAmazon",
        ],
        includeGhostwriting: true,
      },
    };
  }

  // Testo esistente: per Essenziale si usa la correzione bozze (percorso più
  // economico e coerente); per Consigliato/Signature l'editing, a meno che il
  // testo sia già stato revisionato.
  const revisionePrincipale: Servizio =
    input.statoTesto === "scritto-revisionato" ? "correzioneBozze" : "editing";

  return {
    essenziale: {
      base: ["correzioneBozze", "impaginazioneCartacea", "epub"],
      includeGhostwriting: false,
    },
    consigliato: {
      base: [revisionePrincipale, "impaginazioneCartacea", "epub", "copertina", "pubblicazioneKdp"],
      includeGhostwriting: false,
    },
    signature: {
      base: [
        revisionePrincipale,
        "impaginazioneCartacea",
        "epub",
        "copertina",
        "pubblicazioneKdp",
        "isbnEsterno",
        "schedaAmazon",
      ],
      includeGhostwriting: false,
    },
  };
}

const PACKAGE_META: Record<PackageKey, { nome: string; descrizione: string }> = {
  essenziale: {
    nome: "Essenziale",
    descrizione: "Il minimo necessario per portare il testo alla pubblicazione.",
  },
  consigliato: {
    nome: "Consigliato",
    descrizione: "Il percorso completo che consigliamo: qualità e visibilità in equilibrio.",
  },
  signature: {
    nome: "Signature",
    descrizione: "Produzione premium e lancio curato in ogni dettaglio.",
  },
};

function buildPackage(
  key: PackageKey,
  spec: TierSpec,
  input: QuoteInput,
  parole: number,
  pagine: number,
  extraServizi: Servizio[],
): QuotePackage {
  const isGrafica = input.projectType === "grafica";

  // Unione dei servizi selezionati dall'utente (solo per Consigliato/Signature).
  const selectable = isGrafica
    ? extraServizi.filter((s) => DESIGN_SERVICES.includes(s))
    : extraServizi;
  const mergeExtras = key !== "essenziale";
  const serviziSet = new Set<Servizio>(spec.base);
  if (mergeExtras) selectable.forEach((s) => serviziSet.add(s));

  const componenti: PriceComponent[] = [];
  if (spec.includeGhostwriting) componenti.push(ghostwritingComponent(parole));

  SERVIZIO_ORDER.filter((s) => serviziSet.has(s)).forEach((s) => {
    // Se c'è ghostwriting, editing e correzione sono già inclusi nella scrittura.
    if (spec.includeGhostwriting && (s === "editing" || s === "correzioneBozze")) return;
    componenti.push(componentFor(s, parole, pagine));
  });

  const subtotale = componenti.reduce((sum, c) => sum + c.prezzo, 0);
  const conPriorita =
    input.tempistica === "prioritaria" ? subtotale * (1 + PRICING.prioritaria) : subtotale;
  const totale = Math.max(PRICING.minimoProgetto, round(conPriorita));
  const acconto = round(totale * PRICING.accontoFrazione);

  return {
    key,
    nome: PACKAGE_META[key].nome,
    descrizione: PACKAGE_META[key].descrizione,
    componenti,
    subtotale,
    totale,
    acconto,
    inEvidenza: key === "consigliato",
  };
}

// ─── API pubblica ────────────────────────────────────────────────────────────

/**
 * Motore di pricing: funzione pura. Dato l'input del configuratore, restituisce
 * tre pacchetti (Essenziale / Consigliato / Signature) con composizione e
 * prezzo diversi, oltre alle metriche di supporto.
 */
export function calcolaPreventivo(input: QuoteInput): QuoteResult {
  const isGhost = input.projectType !== "grafica" && input.statoTesto === "solo-materiali";

  // Parole effettive: da pagine stimate per i progetti "solo materiali".
  const paroleEffettive = isGhost
    ? Math.max(1, Math.round((input.pagineStimate ?? 0) * PRICING.parolePerPagina))
    : Math.max(1, Math.round(input.parole));

  const pagineStimate = Math.max(1, Math.ceil(paroleEffettive / PRICING.parolePerPagina));

  const specs = tierSpecs(input);
  const extras = input.servizi ?? [];

  const essenziale = buildPackage(
    "essenziale",
    specs.essenziale,
    input,
    paroleEffettive,
    pagineStimate,
    extras,
  );
  const consigliato = buildPackage(
    "consigliato",
    specs.consigliato,
    input,
    paroleEffettive,
    pagineStimate,
    extras,
  );
  const signature = buildPackage(
    "signature",
    specs.signature,
    input,
    paroleEffettive,
    pagineStimate,
    extras,
  );

  return {
    paroleEffettive,
    pagineStimate,
    tempistica: input.tempistica,
    maggiorazionePrioritaria: input.tempistica === "prioritaria",
    pacchetti: [essenziale, consigliato, signature],
  };
}

// ─── Stima per l'analisi manoscritto ─────────────────────────────────────────

export type LivelloIntervento = "correzione" | "editing-leggero" | "editing-profondo";

export interface FasciaCosto {
  min: number;
  max: number;
  livello: LivelloIntervento;
}

/**
 * Stima una fascia di costo indicativa per l'intervento consigliato dall'analisi
 * manoscritto, calcolata sul conteggio parole reale del file. Usa le stesse
 * tariffe del configuratore per coerenza.
 */
export function stimaFasciaCosto(parole: number, livello: LivelloIntervento): FasciaCosto {
  const pagine = Math.max(1, Math.ceil(parole / PRICING.parolePerPagina));
  const produzioneBase = impaginazioneCost(pagine) + epubCost(pagine);

  const revisione = (() => {
    switch (livello) {
      case "correzione":
        return correzioneCost(parole);
      case "editing-leggero":
        return round((correzioneCost(parole) + editingCost(parole)) / 2);
      case "editing-profondo":
        return editingCost(parole);
    }
  })();

  // Minimo: solo la revisione. Massimo: revisione + produzione completa + copertina.
  const min = Math.max(PRICING.minimoProgetto, revisione);
  const max = Math.max(
    min,
    round(revisione + produzioneBase + PRICING.copertina + PRICING.pubblicazioneKdp),
  );

  return { min, max, livello };
}
