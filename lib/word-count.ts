/**
 * Conteggio parole nel browser: il testo non lascia mai il dispositivo.
 * TXT e DOCX si leggono in locale (il DOCX è uno zip con `word/document.xml`,
 * decompresso con DecompressionStream). Il PDF non si legge qui: si incolla il
 * testo o si indica il numero a mano.
 */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) count++;
  return count;
}
export type CountResult = { words: number; method: "txt" | "docx" };
export class CountError extends Error {
  constructor(readonly reason: "formato" | "pdf" | "dimensione" | "illeggibile" | "non-supportato", message: string) {
    super(message);
  }
}
const MAX_BYTES = 20 * 1024 * 1024;
export async function wordsFromFile(file: File): Promise<CountResult> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_BYTES) throw new CountError("dimensione", "Il file è troppo grande per il conteggio nel browser: incolla il testo o indica il numero.");
  if (name.endsWith(".txt") || file.type === "text/plain") return { words: countWords(await file.text()), method: "txt" };
  if (name.endsWith(".pdf") || file.type === "application/pdf") throw new CountError("pdf", "I PDF non si contano nel browser: incolla il testo oppure indica il numero di parole. Il file non è stato inviato.");
  if (name.endsWith(".docx")) {
    const xml = await docxDocumentXml(new Uint8Array(await file.arrayBuffer()));
    return { words: countWords(docxText(xml)), method: "docx" };
  }
  throw new CountError("formato", "Formati letti nel browser: TXT e DOCX. In alternativa incolla il testo.");
}
/** Il testo del corpo di un DOCX, con paragrafi e tabulazioni resi come spazi. */
export function docxText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
/** Estrae `word/document.xml` da uno zip DOCX letto in memoria. */
export async function docxDocumentXml(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_558); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new CountError("illeggibile", "Il file DOCX non è leggibile.");
  const entries = view.getUint16(eocd + 10, true), dirOffset = view.getUint32(eocd + 16, true);
  let p = dirOffset;
  const decoder = new TextDecoder();
  for (let i = 0; i < entries; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new CountError("illeggibile", "Il file DOCX non è leggibile.");
    const method = view.getUint16(p + 10, true), compressed = view.getUint32(p + 20, true), nameLength = view.getUint16(p + 28, true), extraLength = view.getUint16(p + 30, true), commentLength = view.getUint16(p + 32, true), localOffset = view.getUint32(p + 42, true);
    const entryName = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (entryName === "word/document.xml") {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new CountError("illeggibile", "Il file DOCX non è leggibile.");
      const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const data = bytes.subarray(dataStart, dataStart + compressed);
      if (method === 0) return decoder.decode(data);
      if (method !== 8) throw new CountError("illeggibile", "Il DOCX usa una compressione non supportata.");
      if (typeof DecompressionStream === "undefined") throw new CountError("non-supportato", "Questo browser non può leggere i DOCX in locale: incolla il testo o indica il numero.");
      const copy = new Uint8Array(new ArrayBuffer(data.byteLength)); copy.set(data);
      const inflated = new Response(new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate-raw")));
      return await inflated.text();
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  throw new CountError("illeggibile", "Nel file manca il documento principale.");
}
