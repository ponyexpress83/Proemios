import { randomBytes } from "node:crypto";

/**
 * Costruzione delle chiavi di storage.
 *
 * Una chiave non deve dire nulla di ciò che contiene. `progetti/villa-aldini/
 * manoscritto-chiara-neri.docx` rivela l'opera e l'autrice a chiunque veda un
 * log, un nome di bucket o un URL firmato scaduto. Il formato usato è:
 *
 *   org/<organizationId>/prog/<projectId>/<ruolo>/<casuale>.<estensione>
 *
 * L'organizzazione e il progetto restano leggibili di proposito: servono per
 * applicare politiche di conservazione e per cancellare tutto ciò che riguarda
 * un cliente quando lo chiede. Sono identificativi opachi, non nomi.
 */

const ESTENSIONI: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/epub+zip": "epub",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/zip": "zip",
};

export function estensionePer(mimeType: string): string {
  return ESTENSIONI[mimeType] ?? "bin";
}

export function costruisciChiave(params: {
  organizationId: string;
  projectId: string;
  ruolo: string;
  mimeType: string;
}): string {
  const casuale = randomBytes(16).toString("hex");
  const estensione = estensionePer(params.mimeType);
  return `org/${params.organizationId}/prog/${params.projectId}/${params.ruolo}/${casuale}.${estensione}`;
}

/**
 * Chiave dello storage riservato dei prompt. Vive in un prefisso separato
 * perché ha una politica di conservazione diversa — breve — e un accesso più
 * ristretto: contiene testo integrale dell'opera.
 */
export function chiavePrompt(params: { organizationId: string; runId: string }): string {
  return `prompt/${params.organizationId}/${params.runId}.json`;
}

/** Vero se la chiave ha la forma attesa. Difesa contro il path traversal. */
export function chiaveValida(chiave: string): boolean {
  if (chiave.includes("..") || chiave.startsWith("/") || chiave.includes("\\")) return false;
  return /^(org|prompt)\/[A-Za-z0-9-]+\/[A-Za-z0-9/_.-]+$/.test(chiave);
}
