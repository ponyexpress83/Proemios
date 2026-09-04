/**
 * Utilità dei mapper DTO.
 */

/**
 * Congela un DTO in sviluppo, così una mutazione accidentale a valle
 * («aggiungo qui il prezzo, tanto è comodo») fallisce subito invece di
 * diventare una fuga di dati in produzione.
 *
 * In produzione è un no-op: `Object.freeze` su ogni oggetto di una lista da
 * mille elementi costa, e il valore è didattico, non difensivo.
 */
export function sigilla<T extends object>(dto: T): T {
  return process.env.NODE_ENV === "production" ? dto : Object.freeze(dto);
}

/** Data in ISO, o null. I DTO non trasportano oggetti Date. */
export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Chiavi che non devono comparire in **nessun** DTO destinato al cliente.
 * Usata dai test come rete di sicurezza sopra le allowlist esplicite.
 */
export const CHIAVI_VIETATE_AL_CLIENTE = [
  "provider",
  "modello",
  "promptRiferimento",
  "versionePrompt",
  "tokenInput",
  "tokenOutput",
  "costoMicroCent",
  "latenzaMs",
  "confidenza",
  "motivazioneInterna",
  "motivazioniRouting",
  "noteInterne",
  "noteCommerciali",
  "margine",
  "attribution",
  "leadScore",
] as const;

/**
 * Chiavi che non devono comparire in nessun DTO destinato a un redattore.
 * Il redattore vede il lavoro, non il cliente e non il denaro.
 */
export const CHIAVI_VIETATE_AL_REDATTORE = [
  "email",
  "telefono",
  "indirizzo",
  "partitaIva",
  "codiceFiscale",
  "pec",
  "ragioneSociale",
  "cognome",
  "prezzoTotale",
  "importoCent",
  "totaleCent",
  "imponibileCent",
  "accontoCent",
  "valoreStimato",
  "attribution",
  "leadScore",
  "noteCommerciali",
  "costoMicroCent",
  "provider",
  "modello",
] as const;
