/**
 * Model router.
 *
 * Sceglie quale modello lavora un Job. È **puro**: non chiama provider, non
 * legge segreti, non tocca il database. Riceve modelli e policy e restituisce
 * una decisione motivata, che viene registrata sulla run — così a posteriori
 * si può sempre rispondere alla domanda «perché questo Job è andato lì?».
 *
 * L'ordine dei criteri non è negoziabile:
 *  1. **privacy** — un provider senza policy adatta è escluso, punto;
 *  2. **capacità** — un modello che non sa fare structured output non può
 *     produrre interventi;
 *  3. **qualità** — benchmark interno;
 *  4. costo e latenza, come criteri secondari.
 *
 * Il costo viene per ultimo di proposito: risparmiare su un manoscritto altrui
 * è il modo più veloce per perdere un cliente.
 */
import type { Capacita, DefinizioneModello, PolicyPrivacy, Provider } from "@/config/modelli";
import type { LivelloServizio } from "./livelli";

export type ModalitaRevisione = "controllato" | "premium";

export type RichiestaRouting = {
  livelloServizio: LivelloServizio;
  modalitaRevisione: ModalitaRevisione;
  /** Vero per i manoscritti non ancora pubblicati: quasi sempre. */
  manoscrittoInedito: boolean;
  /** Progetti con dati particolarmente delicati (memoir, storie familiari). */
  progettoSensibile?: boolean;
  capacitaRichieste: Capacita[];
  providerPreferito?: Provider;
  /** Token stimati del testo: un modello con contesto insufficiente è escluso. */
  tokenStimati?: number;
  /** Modelli da escludere, per esempio in una seconda run indipendente. */
  escludi?: string[];
};

export type DecisioneRouting = {
  primaria: DefinizioneModello;
  secondaria?: DefinizioneModello;
  adjudicator?: DefinizioneModello;
  /** Motivazioni leggibili, registrate sulla run. */
  motivazioni: string[];
};

export class NessunModelloAmmesso extends Error {
  readonly motivi: string[];
  constructor(motivi: string[]) {
    super("Nessun modello soddisfa i requisiti di privacy e capacità del Job.");
    this.name = "NessunModelloAmmesso";
    this.motivi = motivi;
  }
}

/**
 * Il cancello privacy. È il primo filtro e non ha eccezioni: un provider senza
 * DPA, con addestramento sui dati o non approvato per i manoscritti inediti non
 * riceve testo, per quanto sia bravo o economico.
 */
export function policyConsente(
  modello: DefinizioneModello,
  policy: readonly PolicyPrivacy[],
  richiesta: Pick<RichiestaRouting, "manoscrittoInedito" | "progettoSensibile">,
): { ok: true } | { ok: false; motivo: string } {
  const p = policy.find((x) => x.provider === modello.provider);
  if (!p) return { ok: false, motivo: `${modello.provider}: nessuna policy registrata` };
  if (!p.dpaDisponibile) return { ok: false, motivo: `${modello.provider}: nessun DPA` };
  if (p.addestramentoConsentito) {
    return { ok: false, motivo: `${modello.provider}: consente l'addestramento sui dati` };
  }
  if (richiesta.manoscrittoInedito && !p.approvatoManoscrittiInediti) {
    return { ok: false, motivo: `${modello.provider}: non approvato per manoscritti inediti` };
  }
  if (richiesta.progettoSensibile && !p.approvatoProgettiSensibili) {
    return { ok: false, motivo: `${modello.provider}: non approvato per progetti sensibili` };
  }
  return { ok: true };
}

/** Capacità minime che il livello di servizio richiede al modello. */
export const CAPACITA_PER_LIVELLO: Record<LivelloServizio, Capacita[]> = {
  "correzione-bozze": ["proofreading", "structured-output"],
  "revisione-linguistica": ["grammar", "structured-output"],
  "editing-stilistico": ["stylistic-editing", "structured-output"],
  "editing-narrativo": ["narrative-analysis", "structured-output"],
};

function punteggio(modello: DefinizioneModello, richiesta: RichiestaRouting): number {
  let p = 0;

  // Qualità verificata prima di tutto il resto.
  if (modello.benchmarkStatus === "approved") p += 1_000;
  else if (modello.benchmarkStatus === "candidate") p += 300;

  // Aderenza al livello richiesto.
  const richieste = CAPACITA_PER_LIVELLO[richiesta.livelloServizio];
  p += richieste.filter((c) => modello.capacita.includes(c)).length * 100;

  if (richiesta.modalitaRevisione === "premium" && modello.premium) p += 150;
  if (richiesta.providerPreferito === modello.provider) p += 50;

  // Il costo entra alla fine e con peso piccolo: separa modelli altrimenti
  // equivalenti, non ribalta una differenza di qualità.
  const costo = modello.costoInputMicroCent + modello.costoOutputMicroCent;
  p -= Math.min(80, costo / 200);

  return p;
}

export function scegliModello(
  richiesta: RichiestaRouting,
  modelli: readonly DefinizioneModello[],
  policy: readonly PolicyPrivacy[],
): DecisioneRouting {
  const esclusi: string[] = [];
  const capacita = [
    ...new Set([...CAPACITA_PER_LIVELLO[richiesta.livelloServizio], ...richiesta.capacitaRichieste]),
  ];

  const candidati = modelli
    .filter((m) => {
      if (!m.abilitato) {
        esclusi.push(`${m.id}: disabilitato`);
        return false;
      }
      if (m.benchmarkStatus === "rejected") {
        esclusi.push(`${m.id}: scartato dal benchmark`);
        return false;
      }
      if (richiesta.escludi?.includes(m.id)) return false;

      const privacy = policyConsente(m, policy, richiesta);
      if (!privacy.ok) {
        esclusi.push(`${m.id}: ${privacy.motivo}`);
        return false;
      }

      const mancanti = capacita.filter((c) => !m.capacita.includes(c));
      if (mancanti.length > 0) {
        esclusi.push(`${m.id}: mancano ${mancanti.join(", ")}`);
        return false;
      }

      if (richiesta.tokenStimati && richiesta.tokenStimati > m.contestoToken * 0.8) {
        esclusi.push(`${m.id}: contesto insufficiente per ${richiesta.tokenStimati} token`);
        return false;
      }

      return true;
    })
    .sort((a, b) => punteggio(b, richiesta) - punteggio(a, richiesta));

  const primaria = candidati[0];
  if (!primaria) throw new NessunModelloAmmesso(esclusi);

  const motivazioni = [
    `primaria:${primaria.id}`,
    `livello:${richiesta.livelloServizio}`,
    `modalita:${richiesta.modalitaRevisione}`,
    `benchmark:${primaria.benchmarkStatus}`,
  ];
  if (esclusi.length > 0) motivazioni.push(`esclusi:${esclusi.length}`);

  if (richiesta.modalitaRevisione !== "premium") {
    return { primaria, motivazioni };
  }

  // In modalità premium la seconda run deve essere **indipendente**: si
  // preferisce un altro provider, perché due modelli dello stesso fornitore
  // tendono a sbagliare nello stesso modo, e un accordo fra loro non è una
  // conferma.
  const secondaria =
    candidati.find((m) => m.provider !== primaria.provider) ??
    candidati.find((m) => m.id !== primaria.id);

  const adjudicator = candidati.find(
    (m) => m.capacita.includes("adjudication") && m.id !== secondaria?.id,
  );

  if (!secondaria) motivazioni.push("attenzione:nessuna-seconda-run-indipendente");
  else if (secondaria.provider === primaria.provider) {
    motivazioni.push("attenzione:seconda-run-stesso-provider");
  }
  if (!adjudicator) motivazioni.push("attenzione:nessun-adjudicator");

  return { primaria, secondaria, adjudicator, motivazioni };
}
