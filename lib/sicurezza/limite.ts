/**
 * Limitazione della frequenza delle richieste.
 *
 * La logica è pura e separata dallo store: così si può provare il
 * comportamento — quando scatta, quando si riapre la finestra, cosa risponde —
 * senza database e senza aspettare il tempo reale.
 *
 * Il modello è a **finestra fissa**: semplice, prevedibile, e sufficiente per
 * dei form pubblici. Una finestra scorrevole sarebbe più precisa al confine fra
 * due periodi, ma costerebbe una riga per richiesta invece di una per finestra,
 * e la precisione in più non protegge da niente che questa non fermi.
 */

export type Regola = {
  /** Richieste ammesse nella finestra. */
  massimo: number;
  /** Durata della finestra in secondi. */
  finestraSecondi: number;
};

/** Le regole per endpoint. Chi non è elencato non è limitato. */
export const REGOLE: Record<string, Regola> = {
  // I form pubblici: generosi per una persona, stretti per uno script.
  "contatto": { massimo: 5, finestraSecondi: 600 },
  "preventivo": { massimo: 10, finestraSecondi: 600 },
  // L'analisi del manoscritto costa: un modello ci lavora davvero.
  "analisi": { massimo: 3, finestraSecondi: 3600 },
  "agenzie": { massimo: 5, finestraSecondi: 3600 },
  "lista-attesa": { massimo: 5, finestraSecondi: 3600 },
  // L'accesso: stretto, perché è il bersaglio di chi prova indirizzi a caso.
  "accesso": { massimo: 8, finestraSecondi: 900 },
  // Il checkout apre una sessione di pagamento: poche, e mai a raffica.
  "checkout": { massimo: 10, finestraSecondi: 600 },
};

export type StatoFinestra = {
  conteggio: number;
  /** Momento in cui la finestra corrente è iniziata. */
  inizio: number;
};

export type EsitoLimite = {
  ammessa: boolean;
  /** Richieste ancora disponibili nella finestra. */
  restanti: number;
  /** Secondi da aspettare prima di riprovare. Zero se ammessa. */
  attendiSecondi: number;
  /** Nuovo stato da salvare. */
  stato: StatoFinestra;
};

/**
 * Decide se ammettere una richiesta.
 *
 * Funzione pura: riceve lo stato e l'istante, non li va a cercare. È ciò che
 * permette di provare il comportamento al secondo esatto in cui la finestra si
 * riapre, senza `sleep` nei test.
 */
export function valuta(
  stato: StatoFinestra | null,
  regola: Regola,
  adessoMs: number,
): EsitoLimite {
  const durataMs = regola.finestraSecondi * 1000;

  if (!stato || adessoMs - stato.inizio >= durataMs) {
    return {
      ammessa: true,
      restanti: regola.massimo - 1,
      attendiSecondi: 0,
      stato: { conteggio: 1, inizio: adessoMs },
    };
  }

  const conteggio = stato.conteggio + 1;
  if (conteggio > regola.massimo) {
    const attendiMs = stato.inizio + durataMs - adessoMs;
    return {
      ammessa: false,
      restanti: 0,
      attendiSecondi: Math.max(1, Math.ceil(attendiMs / 1000)),
      // Il conteggio non cresce oltre il massimo: chi insiste non si allunga
      // da solo la punizione, e il numero in database resta leggibile.
      stato,
    };
  }

  return {
    ammessa: true,
    restanti: regola.massimo - conteggio,
    attendiSecondi: 0,
    stato: { conteggio, inizio: stato.inizio },
  };
}

/**
 * Costruisce la chiave di conteggio.
 *
 * L'IP è **hashato**: un elenco di indirizzi in chiaro è un dato personale che
 * non ci serve conservare, e per contare le richieste basta sapere che due
 * vengono dalla stessa origine, non quale sia.
 */
export async function chiaveLimite(
  endpoint: string,
  identificatore: string,
): Promise<string> {
  const dati = new TextEncoder().encode(`${endpoint}:${identificatore}`);
  const digest = await crypto.subtle.digest("SHA-256", dati);
  const esadecimale = Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${endpoint}:${esadecimale}`;
}

/**
 * L'indirizzo da cui arriva la richiesta.
 *
 * Dietro un proxy fidato (Vercel) l'IP vero è il **primo** di
 * `x-forwarded-for`: gli altri sono i proxy attraversati. Prendere l'ultimo, o
 * concatenarli, permetterebbe a chiunque di aggirare il limite mandando
 * un'intestazione costruita a mano.
 */
export function origineRichiesta(intestazioni: Headers): string {
  const inoltrato = intestazioni.get("x-forwarded-for");
  if (inoltrato) {
    const primo = inoltrato.split(",")[0]?.trim();
    if (primo) return primo;
  }
  return intestazioni.get("x-real-ip") ?? "sconosciuto";
}
