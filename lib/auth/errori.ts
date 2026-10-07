/**
 * Errori di autorizzazione.
 *
 * `NonAutorizzato` non porta mai nel messaggio ciò che l'attore non poteva
 * vedere: un errore che dice «non puoi vedere il progetto di Mario Rossi» ha
 * appena rivelato che Mario Rossi è un cliente. Il dettaglio va nell'audit,
 * non nella risposta.
 */
export class NonAutenticato extends Error {
  readonly stato = 401;
  constructor() {
    super("Autenticazione richiesta.");
    this.name = "NonAutenticato";
  }
}

export class NonAutorizzato extends Error {
  readonly stato = 403;
  /** Permesso o regola mancante. Va nell'audit, non nella risposta HTTP. */
  readonly motivoInterno: string;
  constructor(motivoInterno: string) {
    super("Non hai i permessi per questa operazione.");
    this.name = "NonAutorizzato";
    this.motivoInterno = motivoInterno;
  }
}

/**
 * Risorsa inesistente **oppure** non accessibile: le due condizioni producono
 * la stessa risposta di proposito. Distinguerle direbbe a chi sonda gli id
 * quali risorse esistono (IDOR per differenza di messaggio).
 */
export class NonTrovato extends Error {
  readonly stato = 404;
  readonly motivoInterno: string;
  constructor(motivoInterno: string) {
    super("Risorsa non trovata.");
    this.name = "NonTrovato";
    this.motivoInterno = motivoInterno;
  }
}

export function isErroreAutorizzazione(
  e: unknown,
): e is NonAutenticato | NonAutorizzato | NonTrovato {
  return e instanceof NonAutenticato || e instanceof NonAutorizzato || e instanceof NonTrovato;
}
