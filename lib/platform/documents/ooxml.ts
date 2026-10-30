/**
 * DOCX senza perdere la struttura. Si legge il testo dei paragrafi del corpo e
 * si scrive sul DOCX originale: i paragrafi invariati restano byte per byte,
 * quelli cambiati vengono riscritti con revisioni Word native (w:ins / w:del)
 * oppure in versione pulita. Tabelle, intestazioni, note, stili e sezioni non
 * vengono toccati. Limite dichiarato: in un paragrafo modificato la
 * formattazione interna (es. una parola in corsivo) segue quella del primo
 * tratto del paragrafo.
 */
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { DocParagraph } from "@/db/document-schema";
import { diffWords, newParagraphId } from "./text";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
type El = Element;
const children = (el: Node, name?: string): El[] => {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!name || (n as El).localName === name)) out.push(n as El);
  return out;
};
const firstChild = (el: Node, name: string) => children(el, name)[0] ?? null;

/** Testo di un paragrafo: gli inserimenti tracciati contano, le cancellazioni tracciate no (vista «accetta tutto»). */
function paragraphText(p: El, view: "accepted" | "original" = "accepted"): string {
  let out = "";
  const walk = (node: El) => {
    for (const child of children(node)) {
      const name = child.localName;
      if (name === "del" && view === "accepted") continue;
      if (name === "ins" && view === "original") continue;
      if (name === "t" || (name === "delText" && view === "original")) out += child.textContent ?? "";
      else if (name === "tab") out += "\t";
      else if (name === "br" || name === "cr") out += "\n";
      else if (name === "pPr" || name === "rPr") continue;
      else walk(child);
    }
  };
  walk(p);
  return out;
}
function bodyOf(doc: Document) {
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body) throw new Error("DOCX senza corpo del documento.");
  return body;
}
const styleOf = (p: El) => firstChild(firstChild(p, "pPr") ?? p, "pStyle")?.getAttributeNS(W, "val") ?? null;

export async function readDocx(buffer: Uint8Array, view: "accepted" | "original" = "accepted"): Promise<DocParagraph[]> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("DOCX senza word/document.xml.");
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return children(bodyOf(doc), "p").map((p, i) => ({ id: newParagraphId(), text: paragraphText(p, view), style: styleOf(p), source: i }));
}

type WriteOptions = { tracked: boolean; author: string; date: Date };
let revisionId = 9000;
function makeRun(doc: Document, rPr: El | null, text: string, deleted = false): El {
  const r = doc.createElementNS(W, "w:r");
  if (rPr) r.appendChild(rPr.cloneNode(true));
  const parts = text.split(/(\t|\n)/);
  for (const part of parts) {
    if (!part) continue;
    if (part === "\t") r.appendChild(doc.createElementNS(W, "w:tab"));
    else if (part === "\n") r.appendChild(doc.createElementNS(W, "w:br"));
    else {
      const t = doc.createElementNS(W, deleted ? "w:delText" : "w:t");
      t.setAttribute("xml:space", "preserve");
      t.appendChild(doc.createTextNode(part));
      r.appendChild(t);
    }
  }
  return r;
}
function mark(doc: Document, kind: "ins" | "del", o: WriteOptions): El {
  const m = doc.createElementNS(W, `w:${kind}`);
  m.setAttributeNS(W, "w:id", String(++revisionId));
  m.setAttributeNS(W, "w:author", o.author);
  m.setAttributeNS(W, "w:date", o.date.toISOString().replace(/\.\d+Z$/, "Z"));
  return m;
}
/** Riscrive il contenuto di un paragrafo esistente; mantiene le proprietà del paragrafo e il formato del primo tratto. */
function rewriteParagraph(doc: Document, p: El, before: string, after: string, o: WriteOptions) {
  const pPr = firstChild(p, "pPr");
  const firstRun = p.getElementsByTagNameNS(W, "r")[0] ?? null;
  const rPr = firstRun ? firstChild(firstRun, "rPr") : null;
  for (const child of children(p)) if (child !== pPr) p.removeChild(child);
  if (!o.tracked) { p.appendChild(makeRun(doc, rPr, after)); return; }
  for (const seg of diffWords(before, after)) {
    if (seg.op === "equal") p.appendChild(makeRun(doc, rPr, seg.text));
    else { const m = mark(doc, seg.op === "insert" ? "ins" : "del", o); m.appendChild(makeRun(doc, rPr, seg.text, seg.op === "delete")); p.appendChild(m); }
  }
}
/** Segna il segno di paragrafo come inserito o cancellato (serve a Word per unire o separare i paragrafi). */
function markParagraphMark(doc: Document, p: El, kind: "ins" | "del", o: WriteOptions) {
  let pPr = firstChild(p, "pPr");
  if (!pPr) { pPr = doc.createElementNS(W, "w:pPr"); p.insertBefore(pPr, p.firstChild); }
  let rPr = firstChild(pPr, "rPr");
  if (!rPr) { rPr = doc.createElementNS(W, "w:rPr"); pPr.appendChild(rPr); }
  rPr.insertBefore(mark(doc, kind, o), rPr.firstChild);
}
function newParagraph(doc: Document, paragraph: DocParagraph, rPr: El | null, o: WriteOptions): El {
  const p = doc.createElementNS(W, "w:p");
  if (paragraph.style) {
    const pPr = doc.createElementNS(W, "w:pPr");
    const st = doc.createElementNS(W, "w:pStyle");
    st.setAttributeNS(W, "w:val", paragraph.style);
    pPr.appendChild(st);
    p.appendChild(pPr);
  }
  if (o.tracked) {
    markParagraphMark(doc, p, "ins", o);
    const m = mark(doc, "ins", o);
    m.appendChild(makeRun(doc, rPr, paragraph.text));
    p.appendChild(m);
  } else p.appendChild(makeRun(doc, rPr, paragraph.text));
  return p;
}

/**
 * Scrive `target` sul DOCX originale. I paragrafi con `source` corrispondono a
 * quelli dell'originale; quelli senza sono nuovi; i paragrafi dell'originale
 * assenti da `target` sono cancellati (barrati se `tracked`).
 */
export async function writeOnOriginal(original: Uint8Array, target: DocParagraph[], o: WriteOptions): Promise<Buffer> {
  const zip = await JSZip.loadAsync(original);
  const xml = await zip.file("word/document.xml")!.async("string");
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const body = bodyOf(doc);
  const originals = children(body, "p");
  const kept = new Set(target.filter((t) => t.source != null).map((t) => t.source!));
  const defaultRPr = (() => { const r = originals.map((p) => p.getElementsByTagNameNS(W, "r")[0]).find(Boolean); return r ? firstChild(r, "rPr") : null; })();
  let anchor: El | null = null;
  for (const t of target) {
    const existing = t.source != null ? originals[t.source] : undefined;
    if (existing) {
      const before = paragraphText(existing);
      if (before !== t.text) rewriteParagraph(doc, existing, before, t.text, o);
      anchor = existing;
    } else {
      const p = newParagraph(doc, t, defaultRPr, o);
      const ref = anchor ? anchor.nextSibling : (originals[0] ?? null);
      body.insertBefore(p, ref);
      anchor = p;
    }
  }
  originals.forEach((p, i) => {
    if (kept.has(i)) return;
    if (!o.tracked) { body.removeChild(p); return; }
    const before = paragraphText(p);
    rewriteParagraph(doc, p, before, "", o);
    markParagraphMark(doc, p, "del", o);
  });
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}

/** DOCX nuovo per i manoscritti nati da TXT o PDF: base e destinazione si allineano per id di paragrafo. */
export async function writeFresh(base: DocParagraph[], target: DocParagraph[], o: WriteOptions): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1, 2, 3].map((n) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${36 - n * 4}"/></w:rPr></w:style>`).join("")}</w:styles>`);
  const doc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body/></w:document>`, "text/xml");
  const body = bodyOf(doc);
  const byId = new Map(base.map((p) => [p.id, p]));
  const targetIds = new Set(target.map((p) => p.id));
  const emit = (p: DocParagraph, before: string | null) => {
    const el = doc.createElementNS(W, "w:p");
    if (p.style) { const pPr = doc.createElementNS(W, "w:pPr"); const st = doc.createElementNS(W, "w:pStyle"); st.setAttributeNS(W, "w:val", p.style); pPr.appendChild(st); el.appendChild(pPr); }
    body.appendChild(el);
    if (before === null) { if (o.tracked) { markParagraphMark(doc, el, "ins", o); const m = mark(doc, "ins", o); m.appendChild(makeRun(doc, null, p.text)); el.appendChild(m); } else el.appendChild(makeRun(doc, null, p.text)); }
    else rewriteParagraph(doc, el, before, p.text, o);
  };
  // Ordine della destinazione; i paragrafi tolti compaiono barrati nel punto in cui erano.
  let baseIndex = 0;
  for (const p of target) {
    const b = byId.get(p.id);
    if (b) {
      const at = base.indexOf(b);
      for (; baseIndex < at; baseIndex++) { const gone = base[baseIndex]!; if (!targetIds.has(gone.id) && o.tracked) { emit({ ...gone, text: "" }, gone.text); markParagraphMark(doc, body.lastChild as El, "del", o); } }
      baseIndex = Math.max(baseIndex, at + 1);
      emit(p, b.text);
    } else emit(p, null);
  }
  for (; baseIndex < base.length; baseIndex++) { const gone = base[baseIndex]!; if (!targetIds.has(gone.id) && o.tracked) { emit({ ...gone, text: "" }, gone.text); markParagraphMark(doc, body.lastChild as El, "del", o); } }
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}
