import mammoth from "mammoth";

/**
 * Estrazione testo server-side dai file caricati.
 * Solo runtime Node (mammoth e pdf-parse non girano su edge).
 */

export const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const ESTENSIONI = [".docx", ".pdf", ".txt"] as const;
export type Estensione = (typeof ESTENSIONI)[number];

/** Motivi di fallimento distinti: servono per dare un messaggio utile. */
export type MotivoEstrazione = "formato" | "dimensione" | "illeggibile" | "vuoto";

export class EstrazioneError extends Error {
  constructor(
    readonly motivo: MotivoEstrazione,
    messaggio: string,
  ) {
    super(messaggio);
    this.name = "EstrazioneError";
  }
}

export function estensioneDi(filename: string): Estensione | null {
  const lower = filename.toLowerCase();
  return ESTENSIONI.find((e) => lower.endsWith(e)) ?? null;
}

export async function estraiTesto(buffer: Buffer, ext: Estensione): Promise<string> {
  let testo: string;

  switch (ext) {
    case ".txt":
      testo = buffer.toString("utf-8");
      break;

    case ".docx": {
      try {
        const { value } = await mammoth.extractRawText({ buffer });
        testo = value;
      } catch {
        throw new EstrazioneError("illeggibile", "Il .docx non è leggibile.");
      }
      break;
    }

    case ".pdf": {
      try {
        // Import dinamico: pdf-parse resta fuori dal bundle del client.
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const esito = await parser.getText();
        await parser.destroy();
        testo = esito.text;
      } catch {
        throw new EstrazioneError("illeggibile", "Il PDF non è leggibile.");
      }
      break;
    }
  }

  // Un PDF da scansione estrae stringa vuota o quasi: è il caso più comune
  // di "file caricato ma niente testo dentro".
  if (testo.trim().length < 20) {
    throw new EstrazioneError("vuoto", "Dal file non è stato estratto testo utile.");
  }

  return testo;
}
