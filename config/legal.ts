/**
 * Dati legali e parametri dei documenti.
 *
 * I documenti (privacy, termini, cookie) sono redatti con testo standard
 * completo e leggono da qui tutto ciò che dipende dall'anagrafica.
 * Per andare online basta compilare i campi marcati DA_INSERIRE in questo
 * file: non serve toccare le pagine.
 *
 * Resta necessaria la validazione di un professionista prima della
 * pubblicazione: il testo è standard e ragionevole, non un parere legale.
 */

/** Segnaposto: se il valore inizia così, l'interfaccia lo evidenzia. */
export const DA_INSERIRE = "DA INSERIRE";

export const TITOLARE = {
  /** Ragione sociale completa (es. "Proemios S.r.l." o "Mario Rossi"). */
  ragioneSociale: `${DA_INSERIRE}: ragione sociale`,
  /** Forma giuridica (es. "società a responsabilità limitata", "ditta individuale"). */
  formaGiuridica: `${DA_INSERIRE}: forma giuridica`,
  sedeLegale: `${DA_INSERIRE}: indirizzo completo della sede legale`,
  partitaIva: `${DA_INSERIRE}: partita IVA`,
  codiceFiscale: `${DA_INSERIRE}: codice fiscale`,
  /** Registro imprese e numero REA, se applicabile. */
  registroImprese: `${DA_INSERIRE}: registro imprese e numero REA`,
  pec: `${DA_INSERIRE}: indirizzo PEC`,
  /** Responsabile della protezione dei dati: null se non nominato. */
  dpo: null as string | null,
} as const;

/** Foro competente per le controversie con clienti non consumatori. */
export const FORO_COMPETENTE = `${DA_INSERIRE}: foro competente`;

/** Data di ultimo aggiornamento dei documenti (formato leggibile). */
export const AGGIORNAMENTO_DOCUMENTI = `${DA_INSERIRE}: data`;

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
