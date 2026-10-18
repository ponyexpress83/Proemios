import { put, get, del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { PlatformError, unavailable } from "./http";

function testDirectory() {
  return process.env.PROEMIOS_TEST_RUN === "1" && !process.env.VERCEL
    ? process.env.PROEMIOS_TEST_FILE_DIR
    : undefined;
}
export function storageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) ||
    testDirectory(),
  );
}
export async function storePrivate(
  projectId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  if (!storageConfigured()) throw unavailable();
  const directory = testDirectory();
  if (directory) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const name = randomUUID();
    await writeFile(join(directory, name), bytes, { mode: 0o600 });
    return `test:${name}`;
  }
  const blob = await put(`projects/${projectId}/${randomUUID()}`, Buffer.from(bytes), {
    access: "private",
    contentType: mime,
    addRandomSuffix: false,
  });
  return blob.url;
}
export async function readPrivate(key: string): Promise<ReadableStream<Uint8Array>> {
  const directory = testDirectory();
  if (key.startsWith("test:") && directory) {
    const name = key.slice(5);
    if (!/^[a-f0-9-]{36}$/.test(name)) throw unavailable();
    const bytes = await readFile(join(directory, name));
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }
  if (!storageConfigured() || !key.startsWith("https://")) throw unavailable();
  const result = await get(key, { access: "private" });
  if (!result || result.statusCode !== 200) throw unavailable();
  return result.stream;
}
export async function deletePrivate(key: string) {
  const directory = testDirectory();
  if (key.startsWith("test:") && directory) {
    const name = key.slice(5);
    if (!/^[a-f0-9-]{36}$/.test(name)) throw unavailable();
    await unlink(join(directory, name)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }
  await del(key);
}
export function inspectUpload(name: string, bytes: Uint8Array): { mime: string; text: boolean } {
  if (!name || name.length > 200 || /[\x00-\x1f/\\]/.test(name))
    throw new PlatformError(422, "INVALID_FILE", "Nome del file non valido.");
  if (bytes.byteLength === 0 || bytes.byteLength > 4 * 1024 * 1024)
    throw new PlatformError(413, "INVALID_FILE_SIZE", "Carica un file non vuoto di massimo 4 MB.");
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "txt") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\u0000")) throw new Error();
    } catch {
      throw new PlatformError(422, "INVALID_TEXT", "Il testo deve essere un file UTF-8 leggibile.");
    }
    return { mime: "text/plain; charset=utf-8", text: true };
  }
  if (extension === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
    return { mime: "application/pdf", text: false };
  if (
    extension === "docx" &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 3 &&
    bytes[3] === 4
  ) {
    // Validate the central directory before any extraction; reject encrypted/oversized archives.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let expanded = 0,
      entries = 0,
      document = false,
      types = false;
    for (let offset = 0; offset + 46 <= bytes.length; offset++)
      if (view.getUint32(offset, true) === 0x02014b50) {
        const flags = view.getUint16(offset + 8, true),
          size = view.getUint32(offset + 24, true),
          nameLength = view.getUint16(offset + 28, true);
        const entry = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
        if (
          flags & 1 ||
          size > 20 * 1024 * 1024 ||
          entry.startsWith("/") ||
          entry.split("/").includes("..")
        )
          throw new PlatformError(
            422,
            "UNSAFE_ARCHIVE",
            "Il documento contiene un archivio non ammesso.",
          );
        expanded += size;
        entries++;
        document ||= entry === "word/document.xml";
        types ||= entry === "[Content_Types].xml";
      }
    if (!document || !types || expanded > 30 * 1024 * 1024 || entries > 1000)
      throw new PlatformError(
        422,
        "INVALID_DOCX",
        "Il documento DOCX non è valido o supera i limiti.",
      );
    return {
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      text: false,
    };
  }
  throw new PlatformError(422, "INVALID_FILE_TYPE", "Carica un file TXT, DOCX o PDF valido.");
}
export async function scanUpload(bytes: Uint8Array): Promise<boolean> {
  const endpoint = process.env.FILE_SCANNER_URL,
    token = process.env.FILE_SCANNER_TOKEN;
  if (!endpoint || !token) return false;
  if (!endpoint.startsWith("https://")) throw unavailable();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const result = await response.json();
  if (result.clean === false)
    throw new PlatformError(
      422,
      "UNSAFE_FILE",
      "Il file non ha superato il controllo di sicurezza.",
    );
  return result.clean === true;
}
