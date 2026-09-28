/**
 * Contratto del provider di fatturazione.
 *
 * Proemios **non emette** il documento fiscale: lo fa un provider esterno
 * (Fatture in Cloud), che conosce numerazione, esterometro, SDI e le regole
 * che cambiano ogni anno. Qui vive solo l'adattatore, e il database conserva il
 * riferimento a ciò che è stato emesso — non una seconda copia del documento.
 *
 * L'interfaccia è deliberatamente piccola. Un provider di fatturazione ha
 * decine di endpoint; quelli che servono a questo prodotto sono tre, e tenere
 * l'interfaccia stretta significa che sostituirlo è un lavoro di giorni e non
 * di mesi.
 */

export type DatiFatturazione = {
  /** Ragione sociale o nome e cognome. */
  denominazione: string;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  paese?: string | null;
  partitaIva?: string | null;
  codiceFiscale?: string | null;
  /** Codice destinatario SDI o PEC: uno dei due serve per la fattura elettronica. */
  codiceDestinatario?: string | null;
  pec?: string | null;
  email?: string | null;
};

export type RigaFattura = {
  descrizione: string;
  quantita: number;
  /** Prezzo unitario imponibile, in centesimi. */
  prezzoUnitarioCent: number;
  ivaPuntiBase: number;
};

export type RichiestaEmissione = {
  /** Riferimento interno: finisce nelle note del documento, non è il numero. */
  riferimento: string;
  cliente: DatiFatturazione;
  righe: RigaFattura[];
  /** Data del documento. Assente: la decide il provider. */
  data?: Date;
  note?: string;
};

export type DocumentoEmesso = {
  /** Identificativo presso il provider: serve a ritrovarlo, non è il numero. */
  providerDocumentoId: string;
  numeroDocumento: string;
  dataDocumento: Date;
  imponibileCent: number;
  ivaCent: number;
  totaleCent: number;
  /** URL del PDF presso il provider, quando lo espone. */
  urlDocumento?: string | null;
};

/**
 * Errore del provider. `ritentabile` distingue un problema di rete — che vale
 * la pena riprovare — da un rifiuto sui dati, che riprovare non risolve e anzi
 * rischia di emettere due documenti.
 */
export class ErroreFatturazione extends Error {
  constructor(
    messaggio: string,
    readonly ritentabile: boolean,
    readonly dettaglio?: string,
  ) {
    super(messaggio);
    this.name = "ErroreFatturazione";
  }
}

export interface ProviderFatturazione {
  readonly nome: string;
  /** Vero se le credenziali ci sono. Senza, l'emissione resta manuale. */
  configurato(): boolean;
  emetti(richiesta: RichiestaEmissione): Promise<DocumentoEmesso>;
  /** URL del PDF, se il provider lo genera su richiesta. */
  urlDocumento?(providerDocumentoId: string): Promise<string | null>;
}

/**
 * Provider «manuale»: non emette niente e lo dice.
 *
 * È il comportamento predefinito finché le credenziali non ci sono, e non è un
 * ripiego: un prodotto che finge di aver emesso una fattura è peggio di uno che
 * dichiara di non poterlo fare. La riga resta `da_emettere` e
 * l'amministrazione la vede in elenco.
 */
export class ProviderManuale implements ProviderFatturazione {
  readonly nome = "manuale";
  configurato() {
    return false;
  }
  async emetti(): Promise<DocumentoEmesso> {
    throw new ErroreFatturazione(
      "Nessun provider di fatturazione configurato: la fattura va emessa a mano.",
      false,
    );
  }
}
