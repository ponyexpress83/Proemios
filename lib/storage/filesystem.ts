/**
 * Driver su filesystem locale.
 *
 * Serve allo sviluppo e ai test di integrazione: permette di provare davvero
 * il ciclo caricamento → versione → download senza un bucket e senza rete.
 *
 * **Non è adatto alla produzione**: su Vercel il filesystem è effimero e non
 * condiviso fra istanze, e la firma degli URL qui è un HMAC verificato
 * dall'applicazione, non dal fornitore. Il costruttore lo dice a voce alta se
 * qualcuno prova a usarlo in produzione.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import {
  ChiaveGiaEsistente,
  OggettoNonTrovato,
  type EsitoScrittura,
  type MetadatiOggetto,
  type StorageProvider,
} from "./tipi";
import { chiaveValida } from "./chiavi";

export class StorageFilesystem implements StorageProvider {
  readonly nome = "filesystem";
  private readonly radice: string;
  private readonly segreto: string;

  constructor(opzioni: { radice: string; segreto: string }) {
    if (process.env.NODE_ENV === "production" && process.env.STORAGE_DRIVER !== "filesystem") {
      throw new Error(
        "Lo storage su filesystem non è utilizzabile in produzione: configura STORAGE_DRIVER=s3.",
      );
    }
    this.radice = opzioni.radice;
    this.segreto = opzioni.segreto;
  }

  private percorso(chiave: string): string {
    if (!chiaveValida(chiave)) throw new Error(`Chiave di storage non valida: ${chiave}`);
    // `path.resolve` più il controllo sul prefisso: due difese contro il
    // traversal, perché una sola regex è una difesa che prima o poi si buca.
    const assoluto = path.resolve(this.radice, chiave);
    if (!assoluto.startsWith(path.resolve(this.radice) + path.sep)) {
      throw new Error("Percorso fuori dalla radice dello storage.");
    }
    return assoluto;
  }

  async scrivi(
    chiave: string,
    contenuto: Buffer,
    _opzioni: { mimeType: string; nomeOriginale?: string },
  ): Promise<EsitoScrittura> {
    const percorso = this.percorso(chiave);
    if (await this.esiste(chiave)) throw new ChiaveGiaEsistente(chiave);

    await mkdir(path.dirname(percorso), { recursive: true });
    // `wx`: fallisce se il file esiste. Il controllo sopra non basta — fra
    // quello e la scrittura c'è una finestra in cui un'altra richiesta può
    // creare lo stesso file.
    await writeFile(percorso, contenuto, { flag: "wx" });

    return {
      chiave,
      dimensioneByte: contenuto.byteLength,
      hashSha256: createHash("sha256").update(contenuto).digest("hex"),
    };
  }

  async leggi(chiave: string): Promise<Buffer> {
    try {
      return await readFile(this.percorso(chiave));
    } catch {
      throw new OggettoNonTrovato(chiave);
    }
  }

  async metadati(chiave: string): Promise<MetadatiOggetto> {
    const percorso = this.percorso(chiave);
    try {
      const informazioni = await stat(percorso);
      const contenuto = await readFile(percorso);
      return {
        chiave,
        dimensioneByte: informazioni.size,
        mimeType: "application/octet-stream",
        hashSha256: createHash("sha256").update(contenuto).digest("hex"),
        creatoAt: informazioni.birthtime,
      };
    } catch {
      throw new OggettoNonTrovato(chiave);
    }
  }

  async esiste(chiave: string): Promise<boolean> {
    try {
      await access(this.percorso(chiave), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * URL firmato con HMAC e scadenza. La verifica avviene in
   * `app/api/file/[...chiave]/route.ts`, che è l'unico punto che serve i
   * contenuti dello storage locale.
   */
  async urlFirmato(
    chiave: string,
    opzioni: { secondi: number; nomeDownload?: string },
  ): Promise<string> {
    const scade = Math.floor(Date.now() / 1000) + opzioni.secondi;
    const firma = this.firma(chiave, scade);
    const parametri = new URLSearchParams({ scade: String(scade), firma });
    if (opzioni.nomeDownload) parametri.set("nome", opzioni.nomeDownload);
    return `/api/file/${chiave}?${parametri.toString()}`;
  }

  async cancella(chiave: string): Promise<void> {
    try {
      await unlink(this.percorso(chiave));
    } catch {
      // Cancellare qualcosa che non c'è è già lo stato voluto.
    }
  }

  firma(chiave: string, scade: number): string {
    return createHmac("sha256", this.segreto).update(`${chiave}:${scade}`).digest("hex");
  }

  /** Verifica a tempo costante: un confronto normale fa trapelare il prefisso. */
  verificaFirma(chiave: string, scade: number, firma: string): boolean {
    if (!Number.isFinite(scade) || scade * 1000 < Date.now()) return false;
    const attesa = Buffer.from(this.firma(chiave, scade));
    const ricevuta = Buffer.from(firma);
    if (attesa.length !== ricevuta.length) return false;
    return timingSafeEqual(attesa, ricevuta);
  }
}
