/**
 * La pipeline commerciale, in forma pura.
 *
 * Sta a parte da `lib/dati/lead.ts` perché serve anche ai componenti client
 * (filtri, etichette, bottoni di transizione), e un import di valore da un
 * componente client verso il livello dati trascinerebbe Drizzle e il driver
 * Postgres dentro il bundle del browser. Qui non c'è nessuna dipendenza:
 * costanti e funzioni pure, testabili senza database.
 */

export const STATI_LEAD = [
  "nuovo",
  "qualificato",
  "call",
  "proposta",
  "cliente",
  "produzione",
  "post_pubblicazione",
  "perso",
] as const;

export type StatoLead = (typeof STATI_LEAD)[number];

/**
 * Transizioni ammesse. Un lead non salta da "nuovo" a "cliente" senza passare
 * dalle fasi intermedie: il funnel misurato deve corrispondere al funnel reale.
 * `perso` è raggiungibile da quasi ovunque, e da lì si può solo riaprire.
 */
export const TRANSIZIONI: Record<StatoLead, readonly StatoLead[]> = {
  nuovo: ["qualificato", "perso"],
  qualificato: ["call", "proposta", "perso"],
  call: ["proposta", "qualificato", "perso"],
  proposta: ["cliente", "call", "perso"],
  cliente: ["produzione", "perso"],
  produzione: ["post_pubblicazione", "cliente"],
  post_pubblicazione: [],
  perso: ["nuovo"],
};

export function transizioneAmmessa(da: StatoLead, a: StatoLead): boolean {
  return TRANSIZIONI[da].includes(a);
}

export function statiRaggiungibili(da: StatoLead): readonly StatoLead[] {
  return TRANSIZIONI[da];
}

/** Gli stadi del funnel commerciale, in ordine. `perso` sta fuori. */
export const SEQUENZA_FUNNEL: readonly StatoLead[] = [
  "nuovo",
  "qualificato",
  "call",
  "proposta",
  "cliente",
  "produzione",
];
