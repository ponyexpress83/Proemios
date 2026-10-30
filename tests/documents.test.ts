import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readDocx, writeFresh, writeOnOriginal } from "@/lib/platform/documents/ooxml";
import { applyAll, applyProposal, diffWords, paragraphsFromText, hashParagraphs } from "@/lib/platform/documents/text";

const opts = (tracked: boolean) => ({ tracked, author: "Proemios (test)", date: new Date("2026-10-18T10:00:00Z") });
/** DOCX «di un autore»: titolo con stile, corsivo nel primo tratto, tabella, interruzione di riga. */
async function authorDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Capitolo uno</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">Era una notte </w:t></w:r><w:r><w:t>buia e tempestosa.</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cella di tabella</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:t>Marco disse:</w:t><w:br/><w:t>«Andiamo.»</w:t></w:r></w:p>
<w:p><w:r><w:t>Paragrafo da togliere.</w:t></w:r></w:p>
<w:sectPr/></w:body></w:document>`);
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

describe("document text model", () => {
  it("diffs word by word and keeps whitespace", () => {
    const segs = diffWords("Era una notte buia.", "Era una sera buia e fredda.");
    expect(segs.filter((s) => s.op !== "insert").map((s) => s.text).join("")).toBe("Era una notte buia.");
    expect(segs.filter((s) => s.op !== "delete").map((s) => s.text).join("")).toBe("Era una sera buia e fredda.");
  });
  it("applies proposals by position, re-locates a moved passage and refuses ambiguous ones", () => {
    const [p] = paragraphsFromText("Il cane abbaia. Il gatto dorme.");
    const moved = applyProposal([p!], { paragraphId: p!.id, kind: "replace", start: 0, end: 3, originalText: "Il cane", suggestedText: "Il cagnolino" });
    expect(moved![0]!.text).toBe("Il cagnolino abbaia. Il gatto dorme."); // posizione salvata sbagliata, ma il tratto compare una volta sola
    const ok = applyProposal([p!], { paragraphId: p!.id, kind: "replace", start: 16, end: 24, originalText: "Il gatto", suggestedText: "La gatta" });
    expect(ok![0]!.text).toBe("Il cane abbaia. La gatta dorme.");
    const shifted = { ...p!, text: "Oggi il cane abbaia. Il gatto dorme." };
    expect(applyProposal([shifted], { paragraphId: p!.id, kind: "replace", start: 16, end: 24, originalText: "Il gatto", suggestedText: "La gatta" })![0]!.text).toBe("Oggi il cane abbaia. La gatta dorme.");
    const twice = { ...p!, text: "Il gatto e il gatto." };
    expect(applyProposal([twice], { paragraphId: p!.id, kind: "replace", start: 50, end: 55, originalText: "gatto", suggestedText: "x" })).toBeNull();
    const all = applyAll([p!], [{ id: "a", paragraphId: p!.id, kind: "replace", start: 0, end: 7, originalText: "Il cane", suggestedText: "Il lupo" }, { id: "b", paragraphId: p!.id, kind: "replace", start: 16, end: 24, originalText: "Il gatto", suggestedText: "La gatta" }]);
    expect(all.paragraphs[0]!.text).toBe("Il lupo abbaia. La gatta dorme.");
    expect(all.applied.sort()).toEqual(["a", "b"]);
    expect(hashParagraphs(all.paragraphs)).not.toBe(hashParagraphs([p!]));
  });
});

describe("DOCX round trip with native Word revisions", () => {
  it("reads body paragraphs with styles and line breaks, skipping tables", async () => {
    const paragraphs = await readDocx(await authorDocx());
    expect(paragraphs.map((p) => p.text)).toEqual(["Capitolo uno", "Era una notte buia e tempestosa.", "Marco disse:\n«Andiamo.»", "Paragrafo da togliere."]);
    expect(paragraphs[0]!.style).toBe("Heading1");
    expect(paragraphs.map((p) => p.source)).toEqual([0, 1, 2, 3]);
  });
  it("writes tracked changes on the original: accepting gives the new text, rejecting gives the original", async () => {
    const original = await authorDocx();
    const base = await readDocx(original);
    const target = [
      base[0]!,
      { ...base[1]!, text: "Era una notte scura e tempestosa." },
      { id: "nuovo", text: "Un paragrafo aggiunto dall'editor.", style: null, source: null },
      base[2]!,
    ];
    const tracked = await writeOnOriginal(original, target, opts(true));
    expect((await readDocx(tracked, "accepted")).map((p) => p.text)).toEqual(["Capitolo uno", "Era una notte scura e tempestosa.", "Un paragrafo aggiunto dall'editor.", "Marco disse:\n«Andiamo.»", ""]);
    expect((await readDocx(tracked, "original")).map((p) => p.text)).toEqual(["Capitolo uno", "Era una notte buia e tempestosa.", "", "Marco disse:\n«Andiamo.»", "Paragrafo da togliere."]);
    const xml = await (await JSZip.loadAsync(tracked)).file("word/document.xml")!.async("string");
    expect(xml).toMatch(/<w:ins w:id="\d+" w:author="Proemios \(test\)" w:date="2026-10-18T10:00:00Z">/);
    expect(xml).toContain("<w:delText xml:space=\"preserve\">buia</w:delText>");
    expect(xml).toContain("Cella di tabella"); // la tabella non si tocca
    expect(xml).toContain("<w:i/>"); // il formato del primo tratto resta
    expect(xml).toContain("<w:sectPr/>");
    const clean = await writeOnOriginal(original, target, opts(false));
    const cleanXml = await (await JSZip.loadAsync(clean)).file("word/document.xml")!.async("string");
    expect(cleanXml).not.toMatch(/<w:(ins|del) /);
    expect((await readDocx(clean)).map((p) => p.text)).toEqual(["Capitolo uno", "Era una notte scura e tempestosa.", "Un paragrafo aggiunto dall'editor.", "Marco disse:\n«Andiamo.»"]);
  });
  it("builds a fresh DOCX for TXT or PDF manuscripts with the same revision semantics", async () => {
    const base = paragraphsFromText("Prima riga.\nSeconda riga da cambiare.\nTerza da togliere.");
    const target = [base[0]!, { ...base[1]!, text: "Seconda riga cambiata." }, { id: "x", text: "Nuova.", style: null, source: null }];
    const tracked = await writeFresh(base, target, opts(true));
    expect((await readDocx(tracked, "accepted")).map((p) => p.text).filter(Boolean)).toEqual(["Prima riga.", "Seconda riga cambiata.", "Nuova."]);
    expect((await readDocx(tracked, "original")).map((p) => p.text).filter(Boolean)).toEqual(["Prima riga.", "Seconda riga da cambiare.", "Terza da togliere."]);
  });
});
