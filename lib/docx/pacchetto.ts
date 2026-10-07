/**
 * Il pacchetto DOCX.
 *
 * Un DOCX è un archivio ZIP con dentro un insieme di parti XML. Questa classe
 * lo apre **conservando tutto**: le parti che non vengono toccate escono
 * identiche a come sono entrate, comprese quelle che non conosciamo — font
 * incorporati, impostazioni, temi, oggetti OLE.
 *
 * È il punto in cui si decide se la promessa «il documento consegnato è il tuo
 * documento» è vera o è una figura retorica.
 */
import JSZip from "jszip";

export const PARTE_DOCUMENTO = "word/document.xml";
export const PARTE_COMMENTI = "word/comments.xml";
export const PARTE_RELAZIONI_DOCUMENTO = "word/_rels/document.xml.rels";
export const PARTE_CONTENT_TYPES = "[Content_Types].xml";

export class PacchettoNonValido extends Error {
  constructor(motivo: string) {
    super(`Il file non è un documento Word valido: ${motivo}`);
    this.name = "PacchettoNonValido";
  }
}

export class PacchettoDocx {
  private constructor(
    private readonly zip: JSZip,
    /** Parti modificate, per chiave. Le altre escono dall'archivio originale. */
    private readonly modificate: Map<string, string> = new Map(),
  ) {}

  static async apri(contenuto: Buffer): Promise<PacchettoDocx> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(contenuto);
    } catch {
      throw new PacchettoNonValido("non è un archivio leggibile");
    }

    if (!zip.file(PARTE_DOCUMENTO)) {
      throw new PacchettoNonValido(`manca ${PARTE_DOCUMENTO}`);
    }
    return new PacchettoDocx(zip);
  }

  /** Elenco di tutte le parti presenti, per la diagnostica. */
  parti(): string[] {
    return Object.keys(this.zip.files).filter((n) => !this.zip.files[n]!.dir);
  }

  ha(parte: string): boolean {
    return this.modificate.has(parte) || Boolean(this.zip.file(parte));
  }

  async leggiTesto(parte: string): Promise<string> {
    const modificata = this.modificate.get(parte);
    if (modificata !== undefined) return modificata;

    const file = this.zip.file(parte);
    if (!file) throw new PacchettoNonValido(`parte mancante: ${parte}`);
    return file.async("string");
  }

  async leggiBinario(parte: string): Promise<Buffer> {
    const file = this.zip.file(parte);
    if (!file) throw new PacchettoNonValido(`parte mancante: ${parte}`);
    return Buffer.from(await file.async("uint8array"));
  }

  /** Sostituisce una parte. Le altre restano intatte. */
  scrivi(parte: string, contenuto: string): void {
    this.modificate.set(parte, contenuto);
  }

  /**
   * Riscrive l'archivio.
   *
   * `mkdir: false` e la compressione DEFLATE riproducono ciò che scrive Word.
   * Le parti non modificate vengono ricopiate dall'archivio originale: non
   * vengono rigenerate, quindi non possono cambiare.
   */
  async salva(): Promise<Buffer> {
    for (const [parte, contenuto] of this.modificate) {
      this.zip.file(parte, contenuto);
    }
    return this.zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }
}
