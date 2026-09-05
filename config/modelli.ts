/**
 * Definizioni dei modelli e policy privacy dei provider.
 *
 * **Configurazione server-side.** I nomi dei modelli non compaiono nel codice
 * applicativo: il router li sceglie da qui, e questo file non viene mai
 * importato da un componente client.
 *
 * `benchmarkStatus` è deliberatamente `unverified` per tutti finché non esiste
 * un benchmark interno su manoscritti italiani reali. Il router preferisce i
 * modelli approvati, ma non rifiuta gli altri: rifiutarli bloccherebbe la
 * piattaforma prima ancora di poterla misurare. La promozione a `approved` è
 * una decisione umana da prendere con i dati davanti, non un default.
 *
 * Le policy privacy qui sono i **valori di riferimento**: quelle operative
 * vivono in `provider_policies` a database, dove hanno data di revisione e
 * responsabile. Questo file serve al primo popolamento e ai test.
 */

/**
 * I provider ammessi. L'elenco è un valore e non solo un tipo perché serve
 * anche a runtime: la pagina delle policy deve poterli elencare, e una
 * validazione che confronta con un tipo TypeScript non esiste a runtime.
 */
export const PROVIDER = ["anthropic", "openai"] as const;

export type Provider = (typeof PROVIDER)[number];

export type Capacita =
  | "proofreading"
  | "grammar"
  | "structured-output"
  | "tool-use"
  | "docx-operations"
  | "stylistic-editing"
  | "narrative-analysis"
  | "editorial-report"
  | "adjudication";

export type DefinizioneModello = {
  id: string;
  provider: Provider;
  /** Identificativo presso il provider. Sovrascrivibile da variabile d'ambiente. */
  modello: string;
  capacita: Capacita[];
  abilitato: boolean;
  benchmarkStatus: "unverified" | "candidate" | "approved" | "rejected";
  premium: boolean;
  /** Finestra di contesto in token, per decidere se un testo ci sta intero. */
  contestoToken: number;
  /** Costo indicativo in micro-centesimi per 1.000 token, per la stima. */
  costoInputMicroCent: number;
  costoOutputMicroCent: number;
};

export const MODELLI: DefinizioneModello[] = [
  {
    id: "anthropic-premium",
    provider: "anthropic",
    modello: process.env.ANTHROPIC_MODEL_PREMIUM ?? "claude-opus-5",
    capacita: [
      "proofreading",
      "grammar",
      "structured-output",
      "tool-use",
      "stylistic-editing",
      "narrative-analysis",
      "editorial-report",
      "adjudication",
    ],
    abilitato: true,
    benchmarkStatus: "candidate",
    premium: true,
    contestoToken: 200_000,
    costoInputMicroCent: 1_500,
    costoOutputMicroCent: 7_500,
  },
  {
    id: "anthropic-standard",
    provider: "anthropic",
    modello: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    capacita: [
      "proofreading",
      "grammar",
      "structured-output",
      "tool-use",
      "stylistic-editing",
      "editorial-report",
    ],
    abilitato: true,
    benchmarkStatus: "candidate",
    premium: false,
    contestoToken: 200_000,
    costoInputMicroCent: 300,
    costoOutputMicroCent: 1_500,
  },
  {
    id: "openai-standard",
    provider: "openai",
    modello: process.env.OPENAI_MODEL ?? "gpt-4.1",
    capacita: ["proofreading", "grammar", "structured-output", "tool-use", "adjudication"],
    // Abilitato solo se la chiave esiste: un modello senza credenziali che
    // vince il routing produrrebbe un Job fallito invece di uno lavorato.
    abilitato: Boolean(process.env.OPENAI_API_KEY),
    benchmarkStatus: "unverified",
    premium: false,
    contestoToken: 128_000,
    costoInputMicroCent: 200,
    costoOutputMicroCent: 800,
  },
];

export type PolicyPrivacy = {
  provider: Provider;
  addestramentoConsentito: boolean;
  zeroDataRetention: boolean;
  giorniConservazione: number | null;
  dpaDisponibile: boolean;
  regioneDati: string;
  subresponsabili: string[];
  approvatoManoscrittiInediti: boolean;
  approvatoProgettiSensibili: boolean;
  note: string;
};

/**
 * Valori di riferimento delle policy.
 *
 * ATTENZIONE: questi valori descrivono le condizioni contrattuali attese, non
 * verificate. Prima del go-live vanno confermati sui contratti effettivamente
 * firmati e registrati in `provider_policies` con data di revisione e
 * responsabile. Un provider senza riga approvata in database **non passa il
 * routing**, indipendentemente da ciò che è scritto qui.
 */
export const POLICY_RIFERIMENTO: PolicyPrivacy[] = [
  {
    provider: "anthropic",
    addestramentoConsentito: false,
    zeroDataRetention: true,
    giorniConservazione: 0,
    dpaDisponibile: true,
    regioneDati: "Stati Uniti",
    subresponsabili: ["Amazon Web Services", "Google Cloud"],
    approvatoManoscrittiInediti: false,
    approvatoProgettiSensibili: false,
    note: "Da confermare su contratto firmato prima del go-live. Vedi docs/PRIVACY.md.",
  },
  {
    provider: "openai",
    addestramentoConsentito: false,
    zeroDataRetention: true,
    giorniConservazione: 0,
    dpaDisponibile: true,
    regioneDati: "Stati Uniti",
    subresponsabili: ["Microsoft Azure"],
    approvatoManoscrittiInediti: false,
    approvatoProgettiSensibili: false,
    note: "Da confermare su contratto firmato prima del go-live. Vedi docs/PRIVACY.md.",
  },
];

export function modelloPerId(id: string): DefinizioneModello | undefined {
  return MODELLI.find((m) => m.id === id);
}
