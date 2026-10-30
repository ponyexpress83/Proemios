/**
 * Document Studio: il documento persistente di un manoscritto. Si importa una
 * volta dal file caricato (originale immutabile), si lavora per revisioni
 * successive con blocco ottimistico, le proposte (AI, editor, cliente) non
 * toccano il testo finché una persona non le accetta, e ogni consegna diventa
 * una versione ufficiale immutabile con DOCX, PDF e impronta.
 */
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { user } from "@/db/auth-schema";
import { contracts, notifications, projectFiles, projectMembers, projects, tasks } from "@/db/platform-schema";
import { aiJobs, docComments, docRevisions, docSuggestions, docVersions, documents, revisionCycles, type DocParagraph } from "@/db/document-schema";
import { audit, projectAccess, type Actor } from "../access";
import { can } from "../permissions";
import { notFound, PlatformError, readBody } from "../http";
import { readPrivate, storePrivate } from "../storage";
import { enqueueMail } from "../mail";
import { notify, type NotificationEvent } from "../crm-notify";
import type { Tx } from "../crm-relations";
import { impaginaEmail, esc } from "@/lib/email";
import { appOrigin } from "../config";
import { assertBalanceForFinalDelivery, finalDeliveryAllowed } from "../final-delivery";
import { SimplePdf } from "../pdf";
import { estraiTesto } from "@/lib/extract";
import { applyAll, applyProposal, hashParagraphs, locate, paragraphsFromText, wordCount, type Proposal } from "./text";
import { readDocx, writeFresh, writeOnOriginal } from "./ooxml";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const asTx = () => getDb() as unknown as Tx;

async function bytesOf(storageKey: string) {
  const reader = (await readPrivate(storageKey)).getReader();
  const parts: Uint8Array[] = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); }
  return Buffer.concat(parts);
}
export async function loadDocument(id: string) {
  const [doc] = await getDb().select().from(documents).where(eq(documents.id, id));
  if (!doc) throw notFound();
  return doc;
}
export async function revision(id: string) {
  const [rev] = await getDb().select().from(docRevisions).where(eq(docRevisions.id, id));
  if (!rev) throw notFound();
  return rev;
}
export async function currentRevision(doc: typeof documents.$inferSelect) {
  return revision(doc.currentRevisionId!);
}
/** Accesso del team: permessi sul progetto (assegnato o organizzazione). I clienti passano dalle funzioni «client». */
export async function staffAccess(actor: Actor, documentId: string, permission: "project.read" | "project.write" | "project.assign" | "file.deliver" = "project.read") {
  if (!actor.staff) throw notFound();
  const doc = await loadDocument(documentId);
  const access = await projectAccess(actor, doc.projectId, permission);
  return { doc, project: access.project };
}

/** Nuova revisione del documento di lavoro: fallisce se nel frattempo qualcuno ha salvato (blocco ottimistico). */
export async function saveRevision(tx: Tx, doc: typeof documents.$inferSelect, expected: number, paragraphs: DocParagraph[], reason: string, actorId: string | null) {
  const number = expected + 1;
  const updated = await tx.update(documents).set({ revisionNumber: number, updatedAt: new Date() }).where(and(eq(documents.id, doc.id), eq(documents.revisionNumber, expected))).returning({ id: documents.id });
  if (!updated.length) throw new PlatformError(409, "REVISION_CONFLICT", "Il documento è stato modificato nel frattempo: ricarica per vedere l'ultima versione.");
  const [rev] = await tx.insert(docRevisions).values({ documentId: doc.id, number, paragraphs, hash: hashParagraphs(paragraphs), reason, createdBy: actorId }).returning();
  await tx.update(documents).set({ currentRevisionId: rev!.id }).where(eq(documents.id, doc.id));
  return rev!;
}

/** Importa un manoscritto caricato: originale immutabile, revisione 1 e versione «Originale». Una volta sola per file. */
export async function createDocument(actor: Actor, projectId: string, fileId: string) {
  if (!actor.staff) throw notFound();
  await projectAccess(actor, projectId, "project.write");
  const [file] = await getDb().select().from(projectFiles).where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)));
  if (!file || file.kind !== "manuscript") throw notFound();
  if (file.status !== "ready") throw new PlatformError(409, "FILE_NOT_READY", "Il file non ha ancora superato il controllo di sicurezza.");
  const [existing] = await getDb().select().from(documents).where(eq(documents.originalFileId, fileId));
  if (existing) return { document: existing, created: false };
  const bytes = await bytesOf(file.storageKey);
  const format = file.mime === DOCX || file.name.toLowerCase().endsWith(".docx") ? "docx" : file.mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "txt";
  const paragraphs = format === "docx" ? await readDocx(bytes) : paragraphsFromText(await estraiTesto(bytes, format === "pdf" ? ".pdf" : ".txt"));
  if (!paragraphs.some((p) => p.text.trim())) throw new PlatformError(422, "EMPTY_DOCUMENT", "Dal file non è stato estratto testo.");
  const document = await getDb().transaction(async (raw) => {
    const tx = raw as unknown as Tx;
    const [doc] = await tx.insert(documents).values({ projectId, title: file.name.replace(/\.(docx|pdf|txt)$/i, ""), originalFileId: file.id, sourceFormat: format, createdBy: actor.id }).returning();
    const rev = await saveRevision(tx, doc!, 0, paragraphs, "import", actor.id);
    await tx.insert(docVersions).values({ documentId: doc!.id, number: 0, label: "Originale", kind: "original", revisionId: rev.id, contentHash: rev.hash, docxFileId: format === "docx" ? file.id : null, createdBy: actor.id });
    return { ...doc!, currentRevisionId: rev.id, revisionNumber: 1 };
  });
  await audit(actor, "document.created", "document", document.id, { projectId, fileId, format, words: wordCount(paragraphs) });
  return { document, created: true };
}

/** Proposte in attesa con lo stato rispetto al testo corrente: applicabile o superata. */
export async function pendingProposals(doc: typeof documents.$inferSelect, paragraphs: DocParagraph[]) {
  const rows = await getDb().select().from(docSuggestions).where(and(eq(docSuggestions.documentId, doc.id), eq(docSuggestions.status, "pending"))).orderBy(asc(docSuggestions.createdAt));
  const byId = new Map(paragraphs.map((p) => [p.id, p]));
  return rows.map((s) => {
    const p = byId.get(s.paragraphId);
    const at = p ? locate(p, toProposal(s)) : null;
    return { ...s, applicable: Boolean(at), at };
  });
}
export const toProposal = (s: typeof docSuggestions.$inferSelect): Proposal => ({ id: s.id, paragraphId: s.paragraphId, kind: s.kind === "insert_after" ? "insert_after" : "replace", start: s.start, end: s.end, originalText: s.originalText, suggestedText: s.suggestedText });

/** Vista del team: testo, proposte, commenti (anche interni), versioni, cicli e lavorazioni. */
export async function staffDocumentView(actor: Actor, id: string) {
  const { doc, project } = await staffAccess(actor, id);
  const rev = await currentRevision(doc);
  const proposals = await pendingProposals(doc, rev.paragraphs);
  const comments = await getDb().select({ c: docComments, author: user.name }).from(docComments).leftJoin(user, eq(user.id, docComments.authorId)).where(eq(docComments.documentId, id)).orderBy(asc(docComments.createdAt));
  const versions = await getDb().select().from(docVersions).where(eq(docVersions.documentId, id)).orderBy(asc(docVersions.number));
  const cycles = await getDb().select().from(revisionCycles).where(eq(revisionCycles.documentId, id)).orderBy(desc(revisionCycles.number));
  const contract = await projectContract(project);
  const jobs = await getDb().select({ id: aiJobs.id, service: aiJobs.service, status: aiJobs.status, statusReason: aiJobs.statusReason, chunksDone: aiJobs.chunksDone, chunksTotal: aiJobs.chunksTotal, suggestions: aiJobs.suggestions, discarded: aiJobs.discarded, spentMicros: aiJobs.spentMicros, budgetMicros: aiJobs.budgetMicros, createdAt: aiJobs.createdAt, cycleId: aiJobs.cycleId }).from(aiJobs).where(eq(aiJobs.documentId, id)).orderBy(desc(aiJobs.createdAt));
  return {
    document: { ...doc, words: wordCount(rev.paragraphs) },
    project: { id: project.id, title: project.title, opsStatus: project.opsStatus, qaOwnerId: project.qaOwnerId, revisionRounds: project.revisionRounds, contractRevisions: contract?.orderSheet.revisions ?? null, contractService: contract?.orderSheet.service ?? null },
    revision: { id: rev.id, number: rev.number, hash: rev.hash, paragraphs: rev.paragraphs },
    proposals,
    comments: comments.map((r) => ({ ...r.c, authorName: r.c.origin === "ai" ? "Nota automatica" : r.author })),
    versions,
    cycles,
    jobs: can(actor.grants, "project.assign") || can(actor.grants, "operations.read") || can(actor.grants, "project.write", { assigned: true }) ? jobs : [],
    canEdit: can(actor.grants, "project.write", { assigned: true }),
    canDeliver: can(actor.grants, "file.deliver", { assigned: true }),
    finalDeliveryAllowed: await finalDeliveryAllowed(project),
  };
}

const decisionInput = z.object({ expectedRevision: z.number().int().min(1), items: z.array(z.object({ id: z.string().uuid(), decision: z.enum(["accept", "reject", "modify"]), text: z.string().max(20000).optional() }).strict()).min(1).max(500) }).strict();
/** Accetta, rifiuta o modifica proposte: le accettate diventano una revisione nuova; le non applicabili restano «superate». */
export async function decideProposals(actor: Actor, id: string, request: Request) {
  const { doc } = await staffAccess(actor, id, "project.write");
  const body = await readBody(request, decisionInput);
  const rows = await getDb().select().from(docSuggestions).where(and(eq(docSuggestions.documentId, id), inArray(docSuggestions.id, body.items.map((i) => i.id)), eq(docSuggestions.status, "pending")));
  const rev = await currentRevision(doc);
  if (rev.number !== body.expectedRevision) throw new PlatformError(409, "REVISION_CONFLICT", "Il documento è stato modificato nel frattempo: ricarica prima di decidere.");
  let paragraphs = rev.paragraphs;
  const outcome: Record<string, string> = {};
  // Da destra a sinistra nello stesso paragrafo, così le posizioni restano valide.
  const ordered = body.items.map((i) => ({ i, s: rows.find((r) => r.id === i.id) })).filter((x) => x.s).sort((a, b) => (a.s!.paragraphId === b.s!.paragraphId ? b.s!.start - a.s!.start : 0));
  for (const { i, s } of ordered) {
    if (i.decision === "reject") { outcome[s!.id] = "rejected"; continue; }
    if (i.decision === "modify" && !i.text) throw new PlatformError(422, "TEXT_REQUIRED", "Indica il testo modificato.");
    const next = applyProposal(paragraphs, toProposal(s!), i.decision === "modify" ? i.text! : s!.suggestedText);
    if (!next) { outcome[s!.id] = "stale"; continue; }
    paragraphs = next;
    outcome[s!.id] = i.decision === "modify" ? "modified" : "accepted";
  }
  const changed = Object.values(outcome).some((o) => o === "accepted" || o === "modified");
  await getDb().transaction(async (raw) => {
    const tx = raw as unknown as Tx;
    if (changed) await saveRevision(tx, doc, rev.number, paragraphs, "accept", actor.id);
    for (const { i, s } of ordered) await tx.update(docSuggestions).set({ status: outcome[s!.id]!, finalText: i.decision === "modify" ? i.text : null, decidedBy: actor.id, decidedAt: new Date() }).where(eq(docSuggestions.id, s!.id));
  });
  await audit(actor, "document.proposals_decided", "document", id, { counts: Object.values(outcome).reduce<Record<string, number>>((a, o) => ({ ...a, [o]: (a[o] ?? 0) + 1 }), {}) });
  return { outcome, revision: changed ? rev.number + 1 : rev.number };
}

const editInput = z.object({ expectedRevision: z.number().int().min(1), changes: z.array(z.object({ paragraphId: z.string().max(40), text: z.string().max(50000) }).strict()).min(1).max(200) }).strict();
/** Modifica diretta dell'editor (testo approvato): sempre una revisione nuova, mai una sovrascrittura silenziosa. */
export async function editDocument(actor: Actor, id: string, request: Request) {
  const { doc } = await staffAccess(actor, id, "project.write");
  const body = await readBody(request, editInput);
  const rev = await currentRevision(doc);
  if (rev.number !== body.expectedRevision) throw new PlatformError(409, "REVISION_CONFLICT", "Il documento è stato modificato nel frattempo: ricarica prima di salvare.");
  const map = new Map(body.changes.map((c) => [c.paragraphId, c.text]));
  if (body.changes.some((c) => !rev.paragraphs.some((p) => p.id === c.paragraphId))) throw new PlatformError(422, "UNKNOWN_PARAGRAPH", "Paragrafo non trovato.");
  const paragraphs = rev.paragraphs.map((p) => (map.has(p.id) ? { ...p, text: map.get(p.id)! } : p));
  const saved = await getDb().transaction((raw) => saveRevision(raw as unknown as Tx, doc, rev.number, paragraphs, "edit", actor.id));
  await audit(actor, "document.edited", "document", id, { paragraphs: body.changes.length, revision: saved.number });
  return { revision: saved.number };
}

const commentInput = z.object({ paragraphId: z.string().max(40).nullable().optional(), quote: z.string().max(2000).nullable().optional(), body: z.string().trim().min(1).max(5000), visibility: z.enum(["internal", "client"]).default("internal") }).strict();
export async function staffComment(actor: Actor, id: string, request: Request) {
  await staffAccess(actor, id, "project.write");
  const body = await readBody(request, commentInput);
  const [comment] = await getDb().insert(docComments).values({ documentId: id, paragraphId: body.paragraphId ?? null, quote: body.quote ?? null, body: body.body, authorId: actor.id, origin: "staff", visibility: body.visibility }).returning();
  return comment!;
}

/** Esportazione per il team: «tracked» mostra in Word ogni cambiamento rispetto all'originale, con le proposte in attesa; «clean» solo il testo accettato. */
export async function exportDocx(doc: typeof documents.$inferSelect, mode: "tracked" | "clean", author: string) {
  const rev = await currentRevision(doc);
  let target = rev.paragraphs;
  if (mode === "tracked") target = applyAll(rev.paragraphs, (await pendingProposals(doc, rev.paragraphs)).filter((p) => p.applicable).map(toProposal)).paragraphs;
  const date = new Date();
  if (doc.sourceFormat === "docx") {
    const [original] = await getDb().select().from(projectFiles).where(eq(projectFiles.id, doc.originalFileId));
    return writeOnOriginal(await bytesOf(original!.storageKey), target, { tracked: mode === "tracked", author, date });
  }
  const [first] = await getDb().select().from(docRevisions).where(and(eq(docRevisions.documentId, doc.id), eq(docRevisions.number, 1)));
  return writeFresh(first!.paragraphs, target, { tracked: mode === "tracked", author, date });
}
async function renderPdf(title: string, label: string, paragraphs: DocParagraph[]) {
  const pdf = await SimplePdf.create();
  pdf.line(title, { heading: true, size: 16 });
  pdf.line(label);
  pdf.space(10);
  for (const p of paragraphs) {
    if (!p.text.trim()) { pdf.space(8); continue; }
    pdf.line(p.text.replace(/\n/g, " "), { heading: Boolean(p.style && /heading|titolo/i.test(p.style)) });
    pdf.space(3);
  }
  return pdf.finish(`${title} · ${label}`);
}
async function storeGenerated(tx: Tx, projectId: string, actorId: string, name: string, mime: string, bytes: Buffer) {
  const key = await storePrivate(projectId, bytes, mime);
  const [previous] = await tx.select().from(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.name, name))).orderBy(desc(projectFiles.version)).limit(1);
  const [file] = await tx.insert(projectFiles).values({ projectId, uploadedBy: actorId, name, mime, size: bytes.length, hash: createHash("sha256").update(bytes).digest("hex"), storageKey: key, kind: "delivery", status: "ready", previousId: previous?.id, version: (previous?.version ?? 0) + 1 }).returning();
  return file!;
}

const versionInput = z.object({ label: z.string().trim().min(2).max(80).optional(), deliver: z.boolean().default(true), cycleId: z.string().uuid().nullable().optional(), final: z.boolean().default(false) }).strict();
/**
 * Approvazione di una versione ufficiale: immutabile, con DOCX pulito, PDF e
 * impronta. Con «deliver» i file diventano consegne visibili al cliente e il
 * ciclo di revisione si chiude. Se il progetto è in controllo qualità, consegna
 * solo chi ne è responsabile. La Definitiva si consegna solo a saldo confermato
 * quando la regola d'acquisto lo prevede.
 */
export async function approveVersion(actor: Actor, id: string, request: Request) {
  const { doc, project } = await staffAccess(actor, id, "file.deliver");
  const body = await readBody(request, versionInput);
  if (body.deliver && project.opsStatus === "quality_check" && project.qaOwnerId && project.qaOwnerId !== actor.id && !actor.roles.includes("owner")) throw new PlatformError(409, "QA_PENDING", "Il documento è in controllo qualità: la consegna spetta a chi ne è responsabile.");
  // La Definitiva consegnata è la consegna finale: stesso vincolo del saldo della fase «consegnato», prima di qualunque scrittura.
  if (body.final && body.deliver) await assertBalanceForFinalDelivery(project);
  const pendingJobs = await getDb().select({ id: aiJobs.id }).from(aiJobs).where(and(eq(aiJobs.documentId, id), inArray(aiJobs.status, ["queued", "running"])));
  if (pendingJobs.length) throw new PlatformError(409, "AI_RUNNING", "C'è una lavorazione AI in corso su questo documento: aspetta la fine o fermala.");
  const rev = await currentRevision(doc);
  const [last] = await getDb().select().from(docVersions).where(eq(docVersions.documentId, id)).orderBy(desc(docVersions.number)).limit(1);
  if (last && last.revisionId === rev.id && last.kind !== "original") throw new PlatformError(409, "NO_CHANGES", "Questa revisione è già una versione ufficiale.");
  const number = (last?.number ?? 0) + 1;
  const label = body.label ?? (body.final ? "Definitiva" : `V${number}`);
  const docx = await exportDocx(doc, "clean", actor.name);
  const pdf = await renderPdf(doc.title, label, rev.paragraphs);
  const version = await getDb().transaction(async (raw) => {
    const tx = raw as unknown as Tx;
    const docxFile = body.deliver ? await storeGenerated(tx, project.id, actor.id, `${doc.title}.docx`, DOCX, docx) : null;
    const pdfFile = body.deliver ? await storeGenerated(tx, project.id, actor.id, `${doc.title}.pdf`, "application/pdf", pdf) : null;
    const [v] = await tx.insert(docVersions).values({ documentId: id, number, label, kind: body.final ? "final" : "delivery", revisionId: rev.id, contentHash: rev.hash, docxFileId: docxFile?.id ?? null, pdfFileId: pdfFile?.id ?? null, cycleId: body.cycleId ?? null, approvedBy: actor.id, approvedAt: new Date(), createdBy: actor.id }).returning();
    if (body.cycleId) await tx.update(revisionCycles).set({ status: body.deliver ? "delivered" : "approved", deliveredVersionId: v!.id, updatedAt: new Date() }).where(and(eq(revisionCycles.id, body.cycleId), eq(revisionCycles.documentId, id)));
    if (body.deliver) await tx.update(projects).set({ stage: "review", opsStatus: "client_review", updatedAt: new Date() }).where(eq(projects.id, project.id));
    return v!;
  });
  await audit(actor, "document.version_approved", "document", id, { version: number, label, deliver: body.deliver, hash: rev.hash });
  if (body.deliver) await notifyClient(project, "Nuova versione del tuo testo", `È disponibile «${label}». Puoi leggerla, commentarla e scaricarla nella tua area.`);
  return version;
}

/** Notifica al cliente: in app e per email, con il link alla sua area. Nessun dettaglio interno. */
export async function notifyClient(project: typeof projects.$inferSelect, title: string, body: string) {
  const href = `/area-autore?progetto=${project.id}`;
  await getDb().insert(notifications).values({ userId: project.authorId, title, body, href });
  const [author] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, project.authorId));
  if (author) await enqueueMail(`document:${project.id}:${createHash("sha256").update(title + body + Date.now()).digest("hex").slice(0, 16)}`, { to: author.email, subject: title, html: impaginaEmail(title, `<p>${esc(body)}</p><p><a href="${esc(appOrigin())}${href}">Apri la tua area</a></p>`) });
}
/** Chi riceve gli avvisi di produzione su un progetto: responsabile operativo, editor assegnati, controllo qualità. */
export async function productionRecipients(projectId: string) {
  const [project] = await getDb().select().from(projects).where(eq(projects.id, projectId));
  const assignees = await getDb().select({ id: tasks.assignedTo }).from(tasks).where(and(eq(tasks.projectId, projectId), sql`${tasks.assignedTo} is not null`, sql`${tasks.status} <> 'done'`));
  const editors = assignees.map((a) => a.id!).filter(Boolean);
  const staffMembers = editors.length ? [] : (await getDb().select({ id: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, projectId))).map((m) => m.id).filter((id) => id !== project?.authorId);
  return [...new Set([project?.opsLeadId, ...editors, ...staffMembers].filter(Boolean) as string[])];
}
export async function notifyProduction(projectId: string, event: NotificationEvent, title: string, body: string, href: string, key: string) {
  for (const userId of await productionRecipients(projectId)) await notify(asTx(), userId, event, { title, body, href, key });
}

/** Documenti del progetto e manoscritti importabili. */
export async function projectDocuments(actor: Actor, projectId: string) {
  await projectAccess(actor, projectId, "project.read");
  if (!actor.staff) throw notFound();
  const docs = await getDb().select().from(documents).where(eq(documents.projectId, projectId)).orderBy(asc(documents.createdAt));
  const files = await getDb().select({ id: projectFiles.id, name: projectFiles.name, version: projectFiles.version, status: projectFiles.status, createdAt: projectFiles.createdAt }).from(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.kind, "manuscript"))).orderBy(desc(projectFiles.createdAt));
  return { documents: docs, importable: files.filter((f) => f.status === "ready" && !docs.some((d) => d.originalFileId === f.id)) };
}
/** Il contratto accettato più recente del progetto (servizio, revisioni a testo). */
export async function projectContract(project: typeof projects.$inferSelect) {
  if (!project.quoteId) return null;
  const [row] = await getDb().select().from(contracts).where(eq(contracts.quoteId, project.quoteId)).orderBy(desc(contracts.version)).limit(1);
  return row ?? null;
}
