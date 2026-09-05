/**
 * Il catalogo degli eventi di conversione.
 *
 * Modulo puro, importabile tanto dal browser quanto dal server, perché gli
 * eventi vivono in due mondi diversi e la distinzione è la cosa più importante
 * di questo file:
 *
 *  - gli eventi **di navigazione** succedono nel browser (un preventivo
 *    generato, un checkout aperto) e finiscono nel `dataLayer` di GTM;
 *  - gli eventi **di esito** succedono sul server, spesso giorni dopo, e spesso
 *    senza nessun browser aperto: un lead qualificato da un operatore, una
 *    proposta inviata, un ordine pagato via bonifico. Il `dataLayer` non li
 *    vedrà mai, perché nessuna pagina è aperta quando accadono.
 *
 * Mandare gli eventi di esito con un pixel sarebbe possibile solo mentendo:
 * bisognerebbe sparare `purchase` quando il cliente torna sulla pagina di
 * ringraziamento, cioè misurare il ritorno alla pagina invece dell'incasso —
 * e perdere ogni bonifico, ogni pagamento da un altro dispositivo, ogni
 * chiusura della scheda subito dopo il pagamento. Perciò gli eventi di esito
 * si registrano lato server, con la loro attribuzione, e si mandano alle
 * piattaforme come conversioni offline.
 */

/** Eventi che nascono da un'azione nel browser. */
export const EVENTI_NAVIGAZIONE = [
  "lead_created",
  "quote_started",
  "quote_generated",
  "consultation_clicked",
  "checkout_started",
  "manuscript_analysis_completed",
] as const;

/** Eventi che nascono da un fatto sul server, spesso senza browser aperti. */
export const EVENTI_ESITO = ["qualified_lead", "proposal_sent", "client_won", "purchase"] as const;

export type EventoNavigazione = (typeof EVENTI_NAVIGAZIONE)[number];
export type EventoEsito = (typeof EVENTI_ESITO)[number];
export type EventoConversione = EventoNavigazione | EventoEsito;

export const EVENTI: readonly EventoConversione[] = [...EVENTI_NAVIGAZIONE, ...EVENTI_ESITO];

/**
 * Valore economico dichiarato per un evento, quando ne ha uno.
 *
 * `null` significa «nessun valore»: un evento senza importo reale non deve
 * portarne uno inventato. Google ottimizza su questi numeri, e un valore finto
 * insegna alla campagna a comprare il pubblico sbagliato — un danno che si vede
 * mesi dopo e si attribuisce a tutt'altro.
 */
export const HA_VALORE: Record<EventoConversione, boolean> = {
  lead_created: false,
  quote_started: false,
  quote_generated: true,
  consultation_clicked: false,
  checkout_started: true,
  manuscript_analysis_completed: false,
  qualified_lead: false,
  proposal_sent: true,
  client_won: true,
  purchase: true,
};

/**
 * Lo stato del lead che fa scattare un evento di esito.
 *
 * Legare gli eventi alla pipeline reale invece che a chiamate sparse significa
 * che il funnel misurato **è** il funnel: non si può segnare `client_won` senza
 * che il lead sia diventato cliente, perché è il cambio di stato a emetterlo.
 */
export const EVENTO_PER_STATO_LEAD: Record<string, EventoEsito | null> = {
  nuovo: null,
  qualificato: "qualified_lead",
  call: null,
  proposta: "proposal_sent",
  cliente: "client_won",
  produzione: null,
  post_pubblicazione: null,
  perso: null,
};

export type ParametriEvento = {
  /** Valore in centesimi. Si converte in euro solo al confine con la piattaforma. */
  valoreCent?: number;
  valuta?: string;
  /** Identificativo di transazione, per la deduplicazione lato piattaforma. */
  transazioneId?: string;
  quoteId?: string;
  ordineId?: string;
  leadId?: string;
  /**
   * Parametri aggiuntivi non personali (conteggio parole, pacchetto scelto).
   * Il tipo esclude gli oggetti di proposito: un oggetto annidato è il modo
   * più facile per far finire un'anagrafica intera nel dataLayer.
   */
  extra?: Record<string, string | number | boolean>;
};

/** Chiavi che non devono mai comparire in un payload di analytics. */
export const CHIAVI_VIETATE_IN_ANALYTICS = [
  "email",
  "nome",
  "cognome",
  "telefono",
  "indirizzo",
  "partitaIva",
  "codiceFiscale",
  "titolo",
  "manoscritto",
  "testo",
] as const;

/**
 * Costruisce il payload da mandare al `dataLayer`.
 *
 * Non contiene mai dati personali: né email, né nome, né telefono. Il
 * `dataLayer` è leggibile da qualunque script sulla pagina, comprese le
 * estensioni del browser, e un'email che passa di lì è un'email uscita dal
 * nostro controllo.
 */
export function payloadDataLayer(
  evento: EventoNavigazione,
  parametri: ParametriEvento = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = { event: evento };

  if (HA_VALORE[evento] && typeof parametri.valoreCent === "number") {
    payload.value = Math.round(parametri.valoreCent) / 100;
    payload.currency = parametri.valuta ?? "EUR";
  }
  if (parametri.transazioneId) payload.transaction_id = parametri.transazioneId;
  if (parametri.quoteId) payload.quote_id = parametri.quoteId;
  if (parametri.ordineId) payload.order_id = parametri.ordineId;

  for (const [chiave, valore] of Object.entries(parametri.extra ?? {})) {
    // Un parametro che somiglia a un dato personale non passa, comunque sia
    // arrivato fin qui: il dataLayer lo legge qualunque script sulla pagina.
    if (CHIAVI_VIETATE_IN_ANALYTICS.some((v) => chiave.toLowerCase().includes(v.toLowerCase()))) {
      continue;
    }
    payload[chiave] = valore;
  }

  return payload;
}
