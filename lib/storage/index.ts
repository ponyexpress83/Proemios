/**
 * Selezione del driver di storage.
 *
 * Il driver è deciso dalla configurazione, una volta sola. Nessun modulo
 * applicativo istanzia un client S3 o legge una variabile d'ambiente di
 * storage: chiedono `storage()` e ricevono un `StorageProvider`.
 */
import path from "node:path";
import { StorageFilesystem } from "./filesystem";
import { StorageS3, type ConfigurazioneS3 } from "./s3";
import type { StorageProvider } from "./tipi";
import { ambienteLive } from "@/lib/env";

let istanza: StorageProvider | null = null;

function daAmbiente(): StorageProvider {
  const driver = process.env.STORAGE_DRIVER ?? (process.env.S3_BUCKET ? "s3" : "filesystem");

  /*
   * Sul sito vero il filesystem di Vercel è effimero e non è un posto dove
   * tenere manoscritti: se S3 non è configurato si fallisce, invece di
   * degradare in silenzio su disco locale.
   *
   * Il controllo è `ambienteLive()` e non `NODE_ENV`, per lo stesso motivo del
   * cancello in lib/env.ts: `next start` e le preview di Vercel girano con
   * NODE_ENV=production, e legare il divieto a quella variabile rendeva
   * impossibile caricare un file ovunque tranne che in `next dev` — quindi
   * impossibile provare il prodotto prima di avere un bucket.
   */
  if (ambienteLive() && driver !== "s3") {
    throw new Error(
      "Storage di produzione non configurato: imposta STORAGE_DRIVER=s3 e le variabili S3_*.",
    );
  }

  if (driver === "s3") {
    const configurazione: ConfigurazioneS3 = {
      bucket: obbligatoria("S3_BUCKET"),
      regione: process.env.S3_REGION ?? "eu-central-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId: obbligatoria("S3_ACCESS_KEY_ID"),
      secretAccessKey: obbligatoria("S3_SECRET_ACCESS_KEY"),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    };
    return new StorageS3(configurazione);
  }

  return new StorageFilesystem({
    radice: process.env.STORAGE_ROOT ?? path.join(process.cwd(), ".storage"),
    // In sviluppo una chiave effimera va bene: gli URL firmati scadono al
    // riavvio, che è esattamente ciò che serve in locale.
    segreto: process.env.STORAGE_SIGNING_SECRET ?? "sviluppo-non-per-produzione",
  });
}

function obbligatoria(nome: string): string {
  const valore = process.env[nome];
  if (!valore) {
    throw new Error(
      `${nome} non impostata: lo storage S3 richiede bucket e credenziali. Vedi .env.example.`,
    );
  }
  return valore;
}

export function storage(): StorageProvider {
  if (!istanza) istanza = daAmbiente();
  return istanza;
}

/** Sostituisce il driver. Solo per i test. */
export function impostaStoragePerTest(provider: StorageProvider | null): void {
  istanza = provider;
}

export * from "./tipi";
export * from "./chiavi";
export { StorageFilesystem } from "./filesystem";
export { StorageS3 } from "./s3";
