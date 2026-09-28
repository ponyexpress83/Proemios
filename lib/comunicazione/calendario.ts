/**
 * Calendario per gli appuntamenti.
 *
 * Proemios non gestisce disponibilità, fusi orari e inviti: usa un servizio
 * esterno (Cal.com, o qualunque altro con un URL prenotabile). Qui c'è solo la
 * costruzione del link, con i parametri che risparmiano al cliente di
 * ridigitare quello che già sappiamo.
 *
 * Il modulo è puro e testabile: nessuna rete.
 */
import { publicEnv } from "@/lib/env";

export type ContestoAppuntamento = {
  nome?: string | null;
  email?: string | null;
  /** Riferimento interno, per ritrovare la prenotazione: mai dati personali. */
  riferimento?: string | null;
  note?: string | null;
};

export function calendarioConfigurato(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_CALENDAR_URL);
}

/**
 * Costruisce l'URL di prenotazione.
 *
 * `base` è iniettabile: la configurazione si legge una volta sola all'avvio, e
 * una funzione che la va a prendere da sé sarebbe impossibile da provare senza
 * riavviare il processo. Il valore predefinito resta quello di configurazione,
 * così i chiamanti non devono saperlo.
 *
 * Restituisce `null` se il calendario non è configurato, invece di un link
 * rotto: una pagina che dice «scrivici» è meglio di un pulsante che porta al
 * nulla.
 */
export function urlAppuntamento(
  contesto: ContestoAppuntamento = {},
  base: string | undefined = publicEnv.NEXT_PUBLIC_CALENDAR_URL,
): string | null {
  if (!base) return null;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  // Solo https: un calendario servito in chiaro riceverebbe in query string il
  // nome e l'email del cliente.
  if (url.protocol !== "https:") return null;

  if (contesto.nome) url.searchParams.set("name", contesto.nome);
  if (contesto.email) url.searchParams.set("email", contesto.email);
  if (contesto.riferimento) url.searchParams.set("rif", contesto.riferimento);
  if (contesto.note) url.searchParams.set("notes", contesto.note.slice(0, 500));

  return url.toString();
}
