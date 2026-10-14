/**
 * Dati legali e parametri dei documenti.
 *
 * Proemios è il marchio con cui Smart Content S.r.l.s. eroga i servizi
 * editoriali: il titolare del trattamento e la controparte contrattuale sono
 * sempre la società, non il marchio.
 *
 * I documenti (privacy, termini, cookie) sono redatti con testo standard
 * completo e leggono da qui tutto ciò che dipende dall'anagrafica: per
 * aggiornarli basta toccare questo file.
 *
 * Fonte dei dati: visura ordinaria del Registro Imprese della Maremma e del
 * Tirreno, documento n. T 446465279. Prima della pubblicazione conviene
 * verificare su visura aggiornata che sede, PEC e amministratori non siano
 * cambiati, e far validare i documenti a un professionista: il testo è
 * standard e ragionevole, non un parere legale.
 */

/** Segnaposto: se il valore inizia così, l'interfaccia lo evidenzia. */
export const DA_INSERIRE = "DA INSERIRE";

export const TITOLARE = {
  /** Ragione sociale in forma breve, quella che compare nel testo corrente. */
  ragioneSociale: "Smart Content S.r.l.s.",
  /** Denominazione per esteso come risulta al Registro Imprese. */
  denominazioneCompleta: "SMART CONTENT SOCIETÀ A RESPONSABILITÀ LIMITATA SEMPLIFICATA",
  formaGiuridica: "società a responsabilità limitata semplificata",
  sedeLegale: "Via Girardengo 5, 58100 Grosseto (GR), Italia",
  partitaIva: "01616260533",
  codiceFiscale: "01616260533",
  registroImprese: "Registro Imprese della Maremma e del Tirreno, n. 01616260533 — REA GR-203630",
  pec: "smartcontent@pec.it",
  capitaleSociale: "euro 1.000,00 interamente versato",
  rappresentanteLegale: "Valerio Gestri, Presidente del Consiglio di Amministrazione",
  /** Responsabile della protezione dei dati: null se non nominato. */
  dpo: null as string | null,
} as const;

/** Come il marchio si lega alla società che lo esercita. */
export const MARCHIO = {
  nome: "Proemios",
  /** Riga breve per il colophon e le firme delle email. */
  attribuzione: `Proemios è un servizio di ${TITOLARE.ragioneSociale}`,
} as const;

/** Foro competente per le controversie con clienti non consumatori. */
export const FORO_COMPETENTE = "Foro di Grosseto";

/** Data di ultimo aggiornamento dei documenti (formato leggibile). */
export const AGGIORNAMENTO_DOCUMENTI = "5 agosto 2026";

/** Periodi di conservazione dichiarati nell'informativa privacy. */
export const CONSERVAZIONE = {
  leadNonConvertiti: "24 mesi dall'ultimo contatto",
  clienti: "10 anni dalla chiusura del rapporto (obblighi contabili e fiscali)",
  consensoMarketing: "fino a revoca, e comunque non oltre 24 mesi dall'ultimo contatto",
  logTecnici: "12 mesi",
} as const;

export type Responsabile = { nome: string; ruolo: string; sede: string };

/** Fornitori che trattano dati per conto del titolare (art. 28 GDPR). */
const RESPONSABILI_INFRASTRUTTURA: Responsabile[] = [
  { nome: "Vercel Inc.", ruolo: "hosting e distribuzione del sito", sede: "Stati Uniti" },
  { nome: "Neon Inc.", ruolo: "database gestito", sede: "Unione Europea / Stati Uniti" },
  { nome: "Stripe Payments Europe Ltd.", ruolo: "gestione dei pagamenti", sede: "Irlanda" },
  { nome: "Resend Inc.", ruolo: "invio delle email transazionali", sede: "Stati Uniti" },
];

const RUOLO_MODELLI =
  "elaborazione del testo dei manoscritti con modelli linguistici (report di analisi gratuita e lavorazioni editoriali)";

const RESPONSABILI_MODELLI: Record<"anthropic" | "openai", Responsabile> = {
  anthropic: { nome: "Anthropic PBC", ruolo: RUOLO_MODELLI, sede: "Stati Uniti" },
  openai: { nome: "OpenAI, L.L.C.", ruolo: RUOLO_MODELLI, sede: "Stati Uniti" },
};

/**
 * I responsabili da elencare nell'informativa.
 *
 * I fornitori di modelli compaiono se la piattaforma è configurata per usarli:
 * l'informativa deve dire chi tratta davvero il testo, non chi potrebbe. La
 * regola sul provider dell'analisi è la stessa di `lib/ai.ts`, ripetuta qui
 * per non trascinare gli SDK dei fornitori dentro un file di configurazione
 * importato da pagine e piè di pagina. La vera autorizzazione resta il
 * cancello in `provider_policies`: qui si dichiara, non si decide.
 */
export function responsabiliEsterni(): Responsabile[] {
  const analisi = process.env.ANALISI_PROVIDER === "openai" ? "openai" : "anthropic";
  const modelli: Responsabile[] = [];
  if (process.env.ANTHROPIC_API_KEY || analisi === "anthropic") {
    modelli.push(RESPONSABILI_MODELLI.anthropic);
  }
  if (process.env.OPENAI_API_KEY || analisi === "openai") {
    modelli.push(RESPONSABILI_MODELLI.openai);
  }
  return [...RESPONSABILI_INFRASTRUTTURA, ...modelli];
}

/** True se il valore è ancora un segnaposto da compilare. */
export function daCompilare(valore: string | null): boolean {
  return typeof valore === "string" && valore.startsWith(DA_INSERIRE);
}

/** Quanti campi anagrafici restano da compilare. */
export function campiMancanti(): number {
  const valori: (string | null)[] = [
    ...Object.values(TITOLARE),
    FORO_COMPETENTE,
    AGGIORNAMENTO_DOCUMENTI,
  ];
  return valori.filter((v) => daCompilare(v)).length;
}
