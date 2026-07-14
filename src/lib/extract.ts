/**
 * Estrazione testo server-side da file caricati (.docx, .pdf, .txt).
 * mammoth per DOCX, pdf-parse per PDF. Solo lato server (Node runtime).
 */
import mammoth from "mammoth";

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".txt"] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export function estensioneConsentita(filename: string): AllowedExtension | null {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

export async function estraiTesto(buffer: Buffer, ext: AllowedExtension): Promise<string> {
  switch (ext) {
    case ".txt":
      return buffer.toString("utf-8");
    case ".docx": {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }
    case ".pdf": {
      // pdf-parse v2: import dinamico per restare fuori dal bundle client.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    }
  }
}
