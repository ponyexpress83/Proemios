/**
 * Adattatore Google Docs dietro un'interfaccia neutra (EditorProvider): oggi
 * Google, domani ONLYOFFICE o Collabora senza cambiare il resto. Proemios
 * resta il registro: il documento Google è l'editor collaborativo del
 * documento di lavoro, non un secondo archivio.
 *
 * Proposte: la modalità «suggerimenti» delle API Docs (WriteMode.SUGGEST) è in
 * Developer Preview e non è stata verificata sul progetto Google Cloud in uso,
 * quindi non viene usata. Le proposte restano in Proemios e arrivano nel
 * documento Google solo come modifiche dirette dopo l'accettazione di una
 * persona, con controllo di versione (requiredRevisionId) contro le
 * sovrascritture.
 *
 * Stato: implementato e provato con API simulate; non verificato con Google.
 */
import { createHash, randomBytes } from "node:crypto";
import { CompactEncrypt, compactDecrypt } from "jose";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { externalConnections, documents, type DocParagraph } from "@/db/document-schema";
import { audit, type Actor } from "../access";
import { can } from "../permissions";
import { appOrigin } from "../config";
import { json, notFound, PlatformError, readBody, unavailable } from "../http";
import { currentRevision, saveRevision, staffAccess } from "./service";
import { newParagraphId } from "./text";
import type { Tx } from "../crm-relations";

export interface EditorProvider {
  id: "google_docs";
  create(title: string, paragraphs: DocParagraph[]): Promise<{ externalId: string; revisionId: string }>;
  read(externalId: string): Promise<{ paragraphs: Array<{ text: string; start: number; end: number }>; revisionId: string }>;
  replace(externalId: string, revisionId: string, edits: Array<{ start: number; end: number; text: string }>): Promise<{ revisionId: string }>;
  exportDocx(externalId: string): Promise<Buffer>;
  share(externalId: string, email: string, mode: "reader" | "commenter" | "writer"): Promise<void>;
  comments(externalId: string): Promise<Array<{ id: string; content: string; quote: string | null; author: string | null; resolved: boolean }>>;
}

const SCOPES = "openid email https://www.googleapis.com/auth/drive.file";
type Fetch = typeof fetch;
let fetcher: Fetch = (...args) => fetch(...args);
/** Solo per i test: API Google simulate. */
export function setGoogleFetch(f: Fetch | null) {
  fetcher = f ?? ((...args) => fetch(...args));
}
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const redirectUri = () => process.env.GOOGLE_REDIRECT_URI ?? `${appOrigin()}/api/integrations/google/callback`;
function key() {
  if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) throw unavailable();
  return createHash("sha256").update(`google-oauth:${process.env.BETTER_AUTH_SECRET}`).digest();
}
const seal = async (value: string) => new CompactEncrypt(new TextEncoder().encode(value)).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).encrypt(key());
const open = async (value: string) => new TextDecoder().decode((await compactDecrypt(value, key())).plaintext);

/** Avvio del collegamento: solo chi gestisce integrazioni o impostazioni. Lo stato è legato a questa richiesta. */
export async function googleConnect(actor: Actor) {
  if (!can(actor.grants, "integrations.manage") && !can(actor.grants, "settings.manage")) throw notFound();
  if (!googleConfigured()) throw new PlatformError(503, "GOOGLE_NOT_CONFIGURED", "Imposta GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nell'ambiente.");
  const state = randomBytes(24).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  await getDb().insert(externalConnections).values({ provider: "google", status: "pending", stateHash, connectedBy: actor.id }).onConflictDoUpdate({ target: externalConnections.provider, set: { stateHash, connectedBy: actor.id, updatedAt: new Date(), ...(await getDb().select().from(externalConnections).where(eq(externalConnections.provider, "google")))[0]?.status === "connected" ? {} : { status: "pending" } } });
  await audit(actor, "google.connect_started", "integration", "google");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: SCOPES, access_type: "offline", prompt: "consent", state }).toString();
  return { url: url.toString() };
}
/** Ritorno da Google: scambia il codice, cifra il token, registra l'account collegato. */
export async function googleCallback(code: string, state: string) {
  const stateHash = createHash("sha256").update(state).digest("hex");
  const [conn] = await getDb().select().from(externalConnections).where(eq(externalConnections.provider, "google"));
  if (!conn || conn.stateHash !== stateHash) throw new PlatformError(400, "INVALID_STATE", "Richiesta di collegamento non riconosciuta.");
  const res = await fetcher("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: "authorization_code" }) });
  const token = (await res.json()) as { refresh_token?: string; id_token?: string; scope?: string; error?: string };
  if (!res.ok || !token.refresh_token) {
    await getDb().update(externalConnections).set({ status: "error", lastError: token.error ?? `HTTP ${res.status}`, stateHash: null, updatedAt: new Date() }).where(eq(externalConnections.provider, "google"));
    throw new PlatformError(502, "GOOGLE_TOKEN", "Google non ha restituito un token valido.");
  }
  const email = token.id_token ? (JSON.parse(Buffer.from(token.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string }).email ?? null : null;
  await getDb().update(externalConnections).set({ status: "connected", encryptedToken: await seal(token.refresh_token), scopes: token.scope ?? SCOPES, accountEmail: email, stateHash: null, lastError: null, connectedAt: new Date(), updatedAt: new Date() }).where(eq(externalConnections.provider, "google"));
}
export async function googleStatus() {
  const [conn] = await getDb().select().from(externalConnections).where(eq(externalConnections.provider, "google"));
  return { configured: googleConfigured(), status: conn?.status ?? "not_connected", accountEmail: conn?.accountEmail ?? null, connectedAt: conn?.connectedAt ?? null, lastError: conn?.lastError ?? null, suggestMode: "proemios" as const };
}
let cached: { token: string; until: number } | null = null;
async function accessToken() {
  if (cached && cached.until > Date.now()) return cached.token;
  const [conn] = await getDb().select().from(externalConnections).where(eq(externalConnections.provider, "google"));
  if (conn?.status !== "connected" || !conn.encryptedToken) throw new PlatformError(409, "GOOGLE_NOT_CONNECTED", "Google Docs non è collegato.");
  const res = await fetcher("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: await open(conn.encryptedToken), grant_type: "refresh_token" }) });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    // Token revocato o scaduto: il collegamento va rifatto, nessun tentativo silenzioso.
    await getDb().update(externalConnections).set({ status: body.error === "invalid_grant" ? "revoked" : "error", lastError: body.error ?? `HTTP ${res.status}`, updatedAt: new Date() }).where(eq(externalConnections.provider, "google"));
    throw new PlatformError(409, "GOOGLE_TOKEN_EXPIRED", "Il collegamento a Google è scaduto o revocato: va rifatto dalle impostazioni.");
  }
  cached = { token: body.access_token, until: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 120) * 1000 };
  return cached.token;
}
export function resetGoogleTokenCache() { cached = null; }
async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetcher(url, { ...init, headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  if (res.status === 400 && url.includes(":batchUpdate")) throw new PlatformError(409, "GOOGLE_CONFLICT", "Il documento Google è cambiato nel frattempo: sincronizza prima di applicare.");
  if (!res.ok) throw new PlatformError(502, "GOOGLE_API", `Google ha risposto ${res.status}.`);
  return (init.headers as Record<string, string> | undefined)?.accept === "binary" ? (Buffer.from(await res.arrayBuffer()) as unknown as T) : ((await res.json()) as T);
}
type GDoc = { documentId: string; revisionId: string; body: { content: Array<{ startIndex?: number; endIndex: number; paragraph?: { elements: Array<{ textRun?: { content: string } }> } }> } };

export const googleProvider: EditorProvider = {
  id: "google_docs",
  async create(title, paragraphs) {
    const doc = await call<{ documentId: string }>("https://docs.googleapis.com/v1/documents", { method: "POST", body: JSON.stringify({ title }) });
    const text = paragraphs.map((p) => p.text.replace(/\n/g, "\u000b")).join("\n");
    const updated = await call<{ writeControl?: { requiredRevisionId?: string } }>(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text } }] }) });
    return { externalId: doc.documentId, revisionId: updated.writeControl?.requiredRevisionId ?? (await this.read(doc.documentId)).revisionId };
  },
  async read(externalId) {
    const doc = await call<GDoc>(`https://docs.googleapis.com/v1/documents/${externalId}`);
    const paragraphs = doc.body.content.filter((c) => c.paragraph).map((c) => {
      const raw = c.paragraph!.elements.map((e) => e.textRun?.content ?? "").join("");
      return { text: raw.replace(/\n$/, "").replace(/\u000b/g, "\n"), start: c.startIndex ?? 1, end: c.endIndex };
    });
    return { paragraphs, revisionId: doc.revisionId };
  },
  async replace(externalId, revisionId, edits) {
    // Dall'ultima alla prima: gli indici precedenti restano validi.
    const requests = [...edits].sort((a, b) => b.start - a.start).flatMap((e) => [...(e.end > e.start ? [{ deleteContentRange: { range: { startIndex: e.start, endIndex: e.end } } }] : []), ...(e.text ? [{ insertText: { location: { index: e.start }, text: e.text.replace(/\n/g, "\u000b") } }] : [])]);
    const res = await call<{ writeControl?: { requiredRevisionId?: string } }>(`https://docs.googleapis.com/v1/documents/${externalId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests, writeControl: { requiredRevisionId: revisionId } }) });
    return { revisionId: res.writeControl?.requiredRevisionId ?? revisionId };
  },
  async exportDocx(externalId) {
    return call<Buffer>(`https://www.googleapis.com/drive/v3/files/${externalId}/export?mimeType=${encodeURIComponent("application/vnd.openxmlformats-officedocument.wordprocessingml.document")}`, { headers: { accept: "binary" } });
  },
  async share(externalId, email, mode) {
    // Nessuna email automatica da Google: l'invito al documento passa da Proemios.
    await call(`https://www.googleapis.com/drive/v3/files/${externalId}/permissions?sendNotificationEmail=false`, { method: "POST", body: JSON.stringify({ role: mode, type: "user", emailAddress: email }) });
  },
  async comments(externalId) {
    const res = await call<{ comments?: Array<{ id: string; content: string; resolved?: boolean; quotedFileContent?: { value?: string }; author?: { displayName?: string } }> }>(`https://www.googleapis.com/drive/v3/files/${externalId}/comments?fields=comments(id,content,resolved,quotedFileContent,author(displayName))`);
    return (res.comments ?? []).map((c) => ({ id: c.id, content: c.content, quote: c.quotedFileContent?.value ?? null, author: c.author?.displayName ?? null, resolved: Boolean(c.resolved) }));
  },
};

/** Collega il documento di lavoro a un nuovo documento Google con il testo corrente. */
export async function linkGoogle(actor: Actor, documentId: string) {
  const { doc } = await staffAccess(actor, documentId, "project.assign");
  if (doc.externalId) throw new PlatformError(409, "ALREADY_LINKED", "Il documento è già collegato a Google Docs.");
  const rev = await currentRevision(doc);
  const created = await googleProvider.create(doc.title, rev.paragraphs);
  await getDb().update(documents).set({ provider: "google_docs", externalId: created.externalId, externalRevisionId: created.revisionId, updatedAt: new Date() }).where(eq(documents.id, documentId));
  await audit(actor, "document.google_linked", "document", documentId);
  return { externalId: created.externalId };
}
/**
 * Porta in Proemios le modifiche fatte in Google come nuova revisione.
 * Conflitto se anche in Proemios il testo è cambiato dopo l'ultima
 * sincronizzazione: nessuna delle due versioni viene sovrascritta.
 */
export async function pullGoogle(actor: Actor, documentId: string, expectedRevision: number) {
  const { doc } = await staffAccess(actor, documentId, "project.write");
  if (!doc.externalId) throw new PlatformError(409, "NOT_LINKED", "Documento non collegato a Google Docs.");
  const rev = await currentRevision(doc);
  if (rev.number !== expectedRevision) throw new PlatformError(409, "REVISION_CONFLICT", "Il documento in Proemios è cambiato: ricarica prima di sincronizzare.");
  const remote = await googleProvider.read(doc.externalId);
  if (remote.revisionId === doc.externalRevisionId) return { changed: false };
  const paragraphs = alignParagraphs(rev.paragraphs, remote.paragraphs.map((p) => p.text));
  const saved = await getDb().transaction(async (raw) => {
    const s = await saveRevision(raw as unknown as Tx, doc, rev.number, paragraphs, "sync", actor.id);
    await raw.update(documents).set({ externalRevisionId: remote.revisionId }).where(eq(documents.id, documentId));
    return s;
  });
  await audit(actor, "document.google_pulled", "document", documentId, { revision: saved.number });
  return { changed: true, revision: saved.number };
}
/** Applica a Google i paragrafi cambiati in Proemios (proposte accettate), solo se Google non è cambiato nel frattempo. */
export async function pushGoogle(actor: Actor, documentId: string) {
  const { doc } = await staffAccess(actor, documentId, "project.write");
  if (!doc.externalId || !doc.externalRevisionId) throw new PlatformError(409, "NOT_LINKED", "Documento non collegato a Google Docs.");
  const remote = await googleProvider.read(doc.externalId);
  if (remote.revisionId !== doc.externalRevisionId) throw new PlatformError(409, "GOOGLE_CONFLICT", "Il documento Google è cambiato: sincronizza prima di applicare.");
  const rev = await currentRevision(doc);
  if (remote.paragraphs.length !== rev.paragraphs.length) throw new PlatformError(409, "STRUCTURE_CHANGED", "Paragrafi aggiunti o tolti: esporta e ricollega, oppure sincronizza da Google.");
  const edits = rev.paragraphs.map((p, i) => ({ p, r: remote.paragraphs[i]! })).filter(({ p, r }) => p.text !== r.text).map(({ p, r }) => ({ start: r.start, end: r.end - 1, text: p.text }));
  if (!edits.length) return { changed: 0 };
  const result = await googleProvider.replace(doc.externalId, doc.externalRevisionId, edits);
  await getDb().update(documents).set({ externalRevisionId: result.revisionId, updatedAt: new Date() }).where(eq(documents.id, documentId));
  await audit(actor, "document.google_pushed", "document", documentId, { paragraphs: edits.length });
  return { changed: edits.length };
}
/**
 * Mantiene gli id dei paragrafi: quelli identici si agganciano per testo
 * (sottosequenza comune più lunga); tra due agganci, i paragrafi cambiati si
 * abbinano in ordine, quelli in più diventano nuovi e quelli in meno spariscono.
 */
export function alignParagraphs(before: DocParagraph[], texts: string[]): DocParagraph[] {
  const n = before.length, m = texts.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = before[i]!.text === texts[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const anchors: Array<[number, number]> = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (before[i]!.text === texts[j]) { anchors.push([i, j]); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  anchors.push([n, m]);
  const out: DocParagraph[] = [];
  let pi = 0, pj = 0;
  for (const [ai, aj] of anchors) {
    const gapBefore = before.slice(pi, ai), gapTexts = texts.slice(pj, aj);
    gapTexts.forEach((text, k) => out.push(k < gapBefore.length ? { ...gapBefore[k]!, text } : { id: newParagraphId(), text, style: null, source: null }));
    if (ai < n) out.push(before[ai]!);
    pi = ai + 1; pj = aj + 1;
  }
  return out;
}

const shareInput = z.object({ mode: z.enum(["reader", "commenter"]) }).strict();
/** Condivide il documento Google con il cliente: per impostazione commento, mai modifica diretta. Le note interne restano in Proemios. */
export async function shareWithClient(actor: Actor, documentId: string, request: Request) {
  const { doc, project } = await staffAccess(actor, documentId, "project.assign");
  if (!doc.externalId) throw new PlatformError(409, "NOT_LINKED", "Documento non collegato a Google Docs.");
  const body = await readBody(request, shareInput);
  const { user } = await import("@/db/auth-schema");
  const [author] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, project.authorId));
  await googleProvider.share(doc.externalId, author!.email, body.mode);
  await audit(actor, "document.google_shared", "document", documentId, { mode: body.mode });
  return json({ ok: true });
}
