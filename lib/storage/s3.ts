/**
 * Driver S3-compatible: AWS S3 in regione UE, oppure qualunque servizio che
 * parli lo stesso protocollo (Cloudflare R2, Scaleway, MinIO).
 *
 * Requisiti operativi che il codice presuppone e la documentazione ribadisce
 * (docs/SECURITY.md):
 *  - bucket **non pubblico**, con Block Public Access attivo;
 *  - cifratura a riposo attiva sul bucket;
 *  - credenziali con i soli permessi Get/Put/Head/Delete su quel prefisso;
 *  - versioning del bucket attivo, come rete di sicurezza sotto
 *    l'immutabilità applicativa.
 */
import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ChiaveGiaEsistente,
  OggettoNonTrovato,
  type EsitoScrittura,
  type MetadatiOggetto,
  type StorageProvider,
} from "./tipi";
import { chiaveValida } from "./chiavi";

export type ConfigurazioneS3 = {
  bucket: string;
  regione: string;
  /** Endpoint personalizzato per i servizi compatibili. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Necessario per MinIO e simili. */
  forcePathStyle?: boolean;
};

export class StorageS3 implements StorageProvider {
  readonly nome = "s3";
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configurazione: ConfigurazioneS3) {
    this.bucket = configurazione.bucket;
    this.client = new S3Client({
      region: configurazione.regione,
      endpoint: configurazione.endpoint,
      forcePathStyle: configurazione.forcePathStyle,
      credentials: {
        accessKeyId: configurazione.accessKeyId,
        secretAccessKey: configurazione.secretAccessKey,
      },
    });
  }

  private controlla(chiave: string): string {
    if (!chiaveValida(chiave)) throw new Error(`Chiave di storage non valida: ${chiave}`);
    return chiave;
  }

  async scrivi(
    chiave: string,
    contenuto: Buffer,
    opzioni: { mimeType: string; nomeOriginale?: string },
  ): Promise<EsitoScrittura> {
    this.controlla(chiave);
    if (await this.esiste(chiave)) throw new ChiaveGiaEsistente(chiave);

    const hash = createHash("sha256").update(contenuto).digest("hex");

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chiave,
        Body: contenuto,
        ContentType: opzioni.mimeType,
        // `IfNoneMatch: *` fa rifiutare la scrittura se l'oggetto esiste già.
        // È il controllo che rende l'immutabilità una garanzia del servizio e
        // non una speranza applicativa: fra `esiste` e `scrivi` c'è comunque
        // una finestra in cui un'altra richiesta può creare l'oggetto.
        IfNoneMatch: "*",
        // Nessun nome di file leggibile nei metadati: il nome originale vive
        // in database, dove è protetto dai permessi.
        Metadata: { sha256: hash },
      }),
    );

    return { chiave, dimensioneByte: contenuto.byteLength, hashSha256: hash };
  }

  async leggi(chiave: string): Promise<Buffer> {
    this.controlla(chiave);
    try {
      const risposta = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: chiave }),
      );
      const byte = await risposta.Body?.transformToByteArray();
      if (!byte) throw new OggettoNonTrovato(chiave);
      return Buffer.from(byte);
    } catch (errore) {
      if (errore instanceof OggettoNonTrovato) throw errore;
      throw new OggettoNonTrovato(chiave);
    }
  }

  async metadati(chiave: string): Promise<MetadatiOggetto> {
    this.controlla(chiave);
    try {
      const risposta = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: chiave }),
      );
      return {
        chiave,
        dimensioneByte: risposta.ContentLength ?? 0,
        mimeType: risposta.ContentType ?? "application/octet-stream",
        hashSha256: risposta.Metadata?.sha256 ?? "",
        creatoAt: risposta.LastModified ?? new Date(),
      };
    } catch {
      throw new OggettoNonTrovato(chiave);
    }
  }

  async esiste(chiave: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: chiave }));
      return true;
    } catch {
      return false;
    }
  }

  async urlFirmato(
    chiave: string,
    opzioni: { secondi: number; nomeDownload?: string },
  ): Promise<string> {
    this.controlla(chiave);
    // Il tetto di 15 minuti è deliberato: un URL firmato è un permesso che
    // viaggia, e più dura più assomiglia a un file pubblico.
    const secondi = Math.min(opzioni.secondi, 900);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: chiave,
        ResponseContentDisposition: opzioni.nomeDownload
          ? `attachment; filename="${opzioni.nomeDownload.replace(/["\\]/g, "")}"`
          : undefined,
      }),
      { expiresIn: secondi },
    );
  }

  async cancella(chiave: string): Promise<void> {
    this.controlla(chiave);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: chiave }));
  }
}
