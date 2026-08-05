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

/** Fornitori che trattano dati per conto del titolare (art. 28 GDPR). */
export const RESPONSABILI_ESTERNI = [
  { nome: "Vercel Inc.", ruolo: "hosting e distribuzione del sito", sede: "Stati Uniti" },
  { nome: "Neon Inc.", ruolo: "database gestito", sede: "Unione Europea / Stati Uniti" },
  { nome: "Stripe Payments Europe Ltd.", ruolo: "gestione dei pagamenti", sede: "Irlanda" },
  { nome: "Resend Inc.", ruolo: "invio delle email transazionali", sede: "Stati Uniti" },
  {
    nome: "Anthropic PBC",
    ruolo: "elaborazione dell'estratto di testo per il report di analisi",
    sede: "Stati Uniti",
  },
] as const;

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
