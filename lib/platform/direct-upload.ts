/**
 * Caricamento diretto dei file grandi (oltre i 4 MB del corpo delle funzioni
 * Vercel): il browser carica sull'archivio Blob privato con un token
 * temporaneo emesso qui, poi chiede la registrazione. La registrazione rilegge
 * il file dall'archivio e applica gli stessi controlli dei file piccoli
 * (formato, scanner per DOCX e PDF, versioni); se non li supera il file viene
 * cancellato. Il percorso contiene progetto e persona: nessuno può registrare
 * un file caricato da altri o su un altro progetto.
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { projectFiles } from "@/db/platform-schema";
import { demand, projectAccess, type Actor } from "./access";
import { json, PlatformError, readBody } from "./http";
import { limitRequest } from "./rate-limit";
import { DIRECT_UPLOAD_MAX_BYTES, deletePrivate, readPrivate } from "./storage";
import { saveUpload } from "./projects";

const EXTENSIONS: Record<string, string> = { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf", txt: "text/plain" };
const SEGMENT = /^[A-Za-z0-9_-]{6,80}$/;

/** Percorso ammesso: projects/<progetto>/direct/<persona>/<uuid>.<estensione>. */
export function directPathAllowed(pathname: string, projectId: string, actorId: string) {
  const m = /^projects\/([0-9a-f-]{36})\/direct\/([^/]+)\/([0-9a-f-]{36})\.(docx|pdf|txt)$/.exec(pathname);
  return Boolean(m && m[1] === projectId && m[2] === actorId && SEGMENT.test(actorId));
}
/** Chiave registrabile: un URL dell'archivio Blob con il percorso ammesso (o un file di prova nei test locali). */
export function directKeyAllowed(key: string, projectId: string, actorId: string) {
  if (key.startsWith("test:")) return process.env.PROEMIOS_TEST_RUN === "1" && !process.env.VERCEL && /^test:[a-f0-9-]{36}$/.test(key);
  let url: URL;
  try { url = new URL(key); } catch { return false; }
  return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com") && !url.search && directPathAllowed(url.pathname.slice(1), projectId, actorId);
}
const directConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Emissione del token temporaneo per il caricamento diretto. */
export async function directUploadToken(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "POST") throw new PlatformError(405, "METHOD", "Metodo non ammesso.");
  const access = await projectAccess(actor, projectId, "file.upload");
  if (!directConfigured()) throw new PlatformError(503, "DIRECT_UPLOAD_UNAVAILABLE", "Il caricamento dei file grandi non è attivo: usa un file fino a 4 MB.");
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  // Solo l'emissione del token: nessun callback dall'archivio, la registrazione la chiede il browser.
  if (!body || body.type !== "blob.generate-client-token") throw new PlatformError(422, "INVALID_REQUEST", "Richiesta non valida.");
  await limitRequest("uploads", actor.id, 20, 3600);
  const result = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      if (!directPathAllowed(pathname, projectId, actor.id)) throw new PlatformError(422, "INVALID_PATH", "Percorso del file non valido.");
      const kind = z.object({ kind: z.enum(["manuscript", "delivery"]) }).safeParse(JSON.parse(clientPayload ?? "{}")).data?.kind ?? "manuscript";
      if (kind === "delivery") demand(actor, "file.deliver", access.resource);
      return { allowedContentTypes: Object.values(EXTENSIONS), maximumSizeInBytes: DIRECT_UPLOAD_MAX_BYTES, addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 10 * 60_000 };
    },
  });
  return json(result);
}

const registerInput = z.object({ key: z.string().min(10).max(500), name: z.string().trim().min(1).max(200), kind: z.enum(["manuscript", "delivery"]).default("manuscript") }).strict();
/** Registrazione del file caricato: stessi controlli dei file piccoli; se non li supera il file viene cancellato. */
export async function registerDirectUpload(request: Request, actor: Actor, projectId: string) {
  if (request.method !== "POST") throw new PlatformError(405, "METHOD", "Metodo non ammesso.");
  const access = await projectAccess(actor, projectId, "file.upload");
  const body = await readBody(request, registerInput);
  if (body.kind === "delivery") demand(actor, "file.deliver", access.resource);
  if (!directKeyAllowed(body.key, projectId, actor.id)) throw new PlatformError(422, "INVALID_KEY", "File caricato non riconosciuto.");
  const extension = body.name.split(".").pop()?.toLowerCase();
  if (!body.key.startsWith("test:") && !body.key.endsWith(`.${extension}`)) throw new PlatformError(422, "EXTENSION_MISMATCH", "Il nome del file non corrisponde al file caricato.");
  const [already] = await getDb().select({ id: projectFiles.id }).from(projectFiles).where(eq(projectFiles.storageKey, body.key)).limit(1);
  if (already) throw new PlatformError(409, "ALREADY_REGISTERED", "Questo file è già stato registrato.");
  const bytes = await readCapped(body.key);
  return saveUpload(actor, access, projectId, body.name, body.kind, bytes, body.key);
}
async function readCapped(key: string) {
  const reader = (await readPrivate(key)).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > DIRECT_UPLOAD_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      await deletePrivate(key).catch(() => {});
      throw new PlatformError(413, "FILE_TOO_LARGE", `Il file supera il limite di ${Math.round(DIRECT_UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}
