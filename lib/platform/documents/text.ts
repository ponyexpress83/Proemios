/**
 * Modello di testo del documento di lavoro: paragrafi con id stabile, impronta,
 * confronto parola per parola e applicazione delle proposte. Nessun accesso al
 * database: funzioni pure, verificabili nei test.
 */
import { createHash, randomBytes } from "node:crypto";
import type { DocParagraph } from "@/db/document-schema";

export const newParagraphId = () => `p_${randomBytes(5).toString("hex")}`;
export const hashParagraphs = (paragraphs: DocParagraph[]) => createHash("sha256").update(JSON.stringify(paragraphs.map((p) => [p.text, p.style ?? null]))).digest("hex");
export const wordCount = (paragraphs: DocParagraph[]) => paragraphs.reduce((n, p) => n + (p.text.match(/\S+/g)?.length ?? 0), 0);

/** Testo semplice: un paragrafo per riga non vuota (le righe vuote separano, non diventano paragrafi). */
export function paragraphsFromText(text: string): DocParagraph[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n/)
    .map((l) => l.replace(/\s+$/u, ""))
    .filter((l) => l.trim().length > 0)
    .map((line) => ({ id: newParagraphId(), text: line, style: null, source: null }));
}

/** Confronto parola per parola: segmenti uguali, tolti e aggiunti. Oltre una certa dimensione sostituisce il paragrafo intero. */
export type Segment = { op: "equal" | "delete" | "insert"; text: string };
const tokenize = (s: string) => s.match(/\s+|[\p{L}\p{N}'’]+|[^\s\p{L}\p{N}]/gu) ?? [];
export function diffWords(before: string, after: string): Segment[] {
  if (before === after) return before ? [{ op: "equal", text: before }] : [];
  const a = tokenize(before), b = tokenize(after);
  if (a.length * b.length > 4_000_000) return [...(before ? [{ op: "delete" as const, text: before }] : []), ...(after ? [{ op: "insert" as const, text: after }] : [])];
  const dp: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: Segment[] = [];
  const push = (op: Segment["op"], text: string) => { const last = out[out.length - 1]; if (last && last.op === op) last.text += text; else out.push({ op, text }); };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push("equal", a[i]!); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { push("delete", a[i]!); i++; }
    else { push("insert", b[j]!); j++; }
  }
  while (i < a.length) push("delete", a[i++]!);
  while (j < b.length) push("insert", b[j++]!);
  return out;
}

export type Proposal = { id?: string; paragraphId: string; kind: "replace" | "insert_after"; start: number; end: number; originalText: string; suggestedText: string };
/**
 * Dove si trova oggi il tratto originale di una proposta. La posizione salvata
 * vale come indizio; se il testo è cambiato si cerca il tratto, ma solo se
 * compare una volta: altrimenti la proposta è superata («stale»).
 */
export function locate(paragraph: DocParagraph, p: Proposal): { start: number; end: number } | null {
  if (p.kind === "insert_after") return { start: paragraph.text.length, end: paragraph.text.length };
  if (paragraph.text.slice(p.start, p.end) === p.originalText) return { start: p.start, end: p.end };
  if (!p.originalText) return null;
  const first = paragraph.text.indexOf(p.originalText);
  if (first < 0 || paragraph.text.indexOf(p.originalText, first + 1) >= 0) return null;
  return { start: first, end: first + p.originalText.length };
}
/** Applica una proposta e restituisce i nuovi paragrafi, o null se non è più applicabile. */
export function applyProposal(paragraphs: DocParagraph[], p: Proposal, text = p.suggestedText): DocParagraph[] | null {
  const index = paragraphs.findIndex((x) => x.id === p.paragraphId);
  if (index < 0) return null;
  const paragraph = paragraphs[index]!;
  if (p.kind === "insert_after") {
    const inserted: DocParagraph = { id: newParagraphId(), text, style: null, source: null };
    return [...paragraphs.slice(0, index + 1), inserted, ...paragraphs.slice(index + 1)];
  }
  const at = locate(paragraph, p);
  if (!at) return null;
  const next = { ...paragraph, text: paragraph.text.slice(0, at.start) + text + paragraph.text.slice(at.end) };
  return paragraphs.map((x, i) => (i === index ? next : x));
}
/** Testo con tutte le proposte ancora applicabili, per l'anteprima e per l'esportazione con revisioni. */
export function applyAll(paragraphs: DocParagraph[], proposals: Proposal[]) {
  let current = paragraphs;
  const applied: string[] = [], stale: string[] = [];
  // Da destra a sinistra dentro lo stesso paragrafo, così le posizioni restano valide.
  const ordered = [...proposals].sort((x, y) => (x.paragraphId === y.paragraphId ? y.start - x.start : 0));
  for (const p of ordered) {
    const next = applyProposal(current, p);
    if (next) { current = next; if (p.id) applied.push(p.id); } else if (p.id) stale.push(p.id);
  }
  return { paragraphs: current, applied, stale };
}
