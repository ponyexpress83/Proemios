import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { countWords, docxDocumentXml, docxText, wordsFromFile } from "@/lib/word-count";

/** Uno zip minimo con una sola voce, come lo scrive Word. */
function zip(name: string, content: string, store = false): Uint8Array<ArrayBuffer> {
  const raw = Buffer.from(content, "utf8"), data = store ? raw : deflateRawSync(raw), nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(store ? 0 : 8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(store ? 0 : 8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(0, 42);
  const centralStart = local.length + nameBytes.length + data.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + nameBytes.length, 12); eocd.writeUInt32LE(centralStart, 16);
  const out = Buffer.concat([local, nameBytes, data, central, nameBytes, eocd]);
  const copy = new Uint8Array(new ArrayBuffer(out.length)); copy.set(out); return copy;
}
const xml = '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Capitolo</w:t></w:r><w:r><w:t xml:space="preserve"> uno</w:t></w:r></w:p><w:p><w:r><w:t>Il vento &amp; la barca</w:t><w:tab/><w:t>tornarono.</w:t></w:r></w:p></w:body></w:document>';
describe("conteggio parole nel browser", () => {
  it("conta parole vere, non punteggiatura o numeri di pagina isolati", () => {
    expect(countWords("Ciao, mondo! — 3 parole?")).toBe(4);
    expect(countWords("   ")).toBe(0);
    expect(countWords("l'acqua è fredda")).toBe(3);
  });
  it("legge un DOCX compresso e uno archiviato senza inviarlo", async () => {
    expect(docxText(await docxDocumentXml(zip("word/document.xml", xml)))).toBe("Capitolo uno\nIl vento & la barca tornarono.\n");
    expect(countWords(docxText(await docxDocumentXml(zip("word/document.xml", xml, true))))).toBe(7);
    const docx = new File([zip("word/document.xml", xml)], "romanzo.docx");
    expect(await wordsFromFile(docx)).toEqual({ words: 7, method: "docx" });
    expect(await wordsFromFile(new File(["uno due tre"], "note.txt", { type: "text/plain" }))).toEqual({ words: 3, method: "txt" });
  });
  it("rifiuta PDF e formati sconosciuti con un motivo chiaro", async () => {
    await expect(wordsFromFile(new File(["%PDF"], "testo.pdf"))).rejects.toMatchObject({ reason: "pdf" });
    await expect(wordsFromFile(new File(["x"], "testo.rtf"))).rejects.toMatchObject({ reason: "formato" });
    await expect(docxDocumentXml(zip("altro.xml", xml))).rejects.toMatchObject({ reason: "illeggibile" });
  });
});
