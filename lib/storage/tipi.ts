/**
 * Contratto dello storage.
 *
 * Tutto il codice applicativo parla con questa interfaccia, mai con un SDK.
 * Il motivo non è astrazione fine a sé stessa: i manoscritti sono il bene più
 * delicato che la piattaforma custodisce, e poter cambiare fornitore — o far
 * girare i test su disco senza rete — è una condizione operativa, non un lusso.
 *
 * Regole che ogni driver deve rispettare:
 *  - **nessun accesso pubblico**: gli oggetti non sono leggibili senza URL
 *    firmato, e la firma ha una scadenza breve;
 *  - **nessuna sovrascrittura**: `scrivi` su una chiave esistente fallisce.
 *    Le versioni dei file sono immutabili, e un driver che sovrascrive
 *    renderebbe la catena delle versioni una bugia;
 *  - **la chiave non è un nome di file**: è opaca, non indovinabile e non
 *    contiene il nome dell'opera né dati del cliente.
 */

export type MetadatiOggetto = {
  chiave: string;
  dimensioneByte: number;
  mimeType: string;
  hashSha256: string;
  creatoAt: Date;
};

export type EsitoScrittura = {
  chiave: string;
  dimensioneByte: number;
  hashSha256: string;
};

export class ChiaveGiaEsistente extends Error {
  constructor(chiave: string) {
    super(`La chiave ${chiave} esiste già: le versioni dei file sono immutabili.`);
    this.name = "ChiaveGiaEsistente";
  }
}

export class OggettoNonTrovato extends Error {
  constructor(chiave: string) {
    super(`Oggetto non trovato: ${chiave}`);
    this.name = "OggettoNonTrovato";
  }
}

export interface StorageProvider {
  /** Nome del driver, registrato su ogni versione di file. */
  readonly nome: string;

  /**
   * Scrive un oggetto. Fallisce con `ChiaveGiaEsistente` se la chiave esiste:
   * è la garanzia di immutabilità, e va applicata dal driver perché un
   * controllo a livello applicativo perde le corse fra due scritture.
   */
  scrivi(
    chiave: string,
    contenuto: Buffer,
    opzioni: { mimeType: string; nomeOriginale?: string },
  ): Promise<EsitoScrittura>;

  leggi(chiave: string): Promise<Buffer>;

  metadati(chiave: string): Promise<MetadatiOggetto>;

  esiste(chiave: string): Promise<boolean>;

  /**
   * URL firmato a tempo per il download diretto. `secondi` è deliberatamente
   * limitato: un URL firmato che dura ore è un URL pubblico con un ritardo.
   */
  urlFirmato(
    chiave: string,
    opzioni: { secondi: number; nomeDownload?: string },
  ): Promise<string>;

  /** Cancellazione definitiva. Usata solo dalla conservazione programmata. */
  cancella(chiave: string): Promise<void>;
}
