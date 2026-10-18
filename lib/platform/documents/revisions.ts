/**
 * Revisioni richieste dal cliente. Il cliente legge l'ultima versione
 * consegnata, commenta e propone modifiche; più osservazioni inviate insieme
 * formano un solo ciclo. All'invio Proemios verifica i cicli inclusi nel
 * contratto: se il ciclo è incluso e le regole lo consentono parte una
 * lavorazione AI mirata; se è extra o non determinabile decide una persona e
 * nessuna lavorazione a pagamento parte da sola.
 */
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { paymentOrders, platformSettings, projects } from "@/db/platform-schema";
import { docComments, docSuggestions, docVersions, documents, revisionCycles, type DocParagraph } from "@/db/document-schema";
import { audit, projectAccess, type Actor } from "../access";
import { json, notFound, PlatformError, readBody } from "../http";
import { revisionRulesSchema } from "../crm-config";
import { approvedAiRules, aiBlocker } from "../ai-client";
import { loadDocument, notifyClient, notifyProduction, projectContract, revision } from "./service";
import { startJob } from "./ai-engine";

const CLIENT_STATUS: Record<string, string> = { collecting: "In preparazione", submitted: "In lavorazione", ai_running: "In lavorazione", human_review: "In lavorazione", quality_check: "In lavorazione", approved: "In lavorazione", needs_decision: "In valutazione", needs_quote: "Richiede un preventivo", delivered: "Consegnata", rejected: "Non accolta" };
const CLIENT_KIND: Record<string, string> = { included: "Inclusa nel contratto", error_fix: "Correzione dovuta", extra: "Fuori contratto", pending_decision: "Da valutare" };

/** Accesso del cliente: solo i propri progetti, mai account del team. */
async function clientAccess(actor: Actor, documentId: string) {
  if (actor.staff) throw notFound();
  const doc = await loadDocument(documentId);
  const { project } = await projectAccess(actor, doc.projectId, "project.read");
  if (project.authorId !== actor.id) throw notFound();
  return { doc, project };
}
async function deliveredVersion(documentId: string) {
  const [v] = await getDb().select().from(docVersions).where(and(eq(docVersions.documentId, documentId), inArray(docVersions.kind, ["delivery", "final"]), sql`${docVersions.docxFileId} is not null`)).orderBy(desc(docVersions.number)).limit(1);
  return v ?? null;
}
async function openCycle(doc: typeof documents.$inferSelect, actorId: string, create: boolean) {
  const [open] = await getDb().select().from(revisionCycles).where(and(eq(revisionCycles.documentId, doc.id), eq(revisionCycles.status, "collecting"))).limit(1);
  if (open || !create) return open ?? null;
  const [last] = await getDb().select({ n: sql<number>`coalesce(max(${revisionCycles.number}),0)::int` }).from(revisionCycles).where(eq(revisionCycles.documentId, doc.id));
  const [created] = await getDb().insert(revisionCycles).values({ projectId: doc.projectId, documentId: doc.id, number: Number(last?.n ?? 0) + 1, requestedBy: actorId }).onConflictDoNothing().returning();
  if (created) return created;
  return (await getDb().select().from(revisionCycles).where(and(eq(revisionCycles.documentId, doc.id), eq(revisionCycles.status, "collecting"))).limit(1))[0]!;
}
/** Cicli inclusi: valore indicato sul progetto, altrimenti regola per servizio approvata; null se nessuno l'ha indicato. */
export async function includedRounds(project: typeof projects.$inferSelect) {
  if (project.revisionRounds != null) return project.revisionRounds;
  const [row] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, "revision-rules")).limit(1);
  const rules = revisionRulesSchema.safeParse(row?.value);
  const contract = await projectContract(project);
  if (!rules.success || !contract) return null;
  return rules.data.roundsIncludedByService[contract.orderSheet.service] ?? null;
}
async function usedRounds(projectId: string) {
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(revisionCycles).where(and(eq(revisionCycles.projectId, projectId), eq(revisionCycles.kind, "included"), ne(revisionCycles.status, "rejected")));
  return Number(row?.n ?? 0);
}

/** Vista del cliente: ultima versione consegnata, sue osservazioni, stato dei cicli. Nessun dato interno o AI. */
export async function clientDocuments(actor: Actor, projectId: string) {
  if (actor.staff) throw notFound();
  const { project } = await projectAccess(actor, projectId, "project.read");
  if (project.authorId !== actor.id) throw notFound();
  const docs = await getDb().select().from(documents).where(and(eq(documents.projectId, projectId), eq(documents.status, "active"))).orderBy(asc(documents.createdAt));
  const rounds = await includedRounds(project), used = await usedRounds(projectId);
  const out = [];
  for (const doc of docs) {
    const version = await deliveredVersion(doc.id);
    const paragraphs = version ? (await revision(version.revisionId)).paragraphs : [];
    const cycles = await getDb().select().from(revisionCycles).where(eq(revisionCycles.documentId, doc.id)).orderBy(desc(revisionCycles.number));
    const comments = await getDb().select({ id: docComments.id, paragraphId: docComments.paragraphId, quote: docComments.quote, body: docComments.body, cycleId: docComments.cycleId, createdAt: docComments.createdAt }).from(docComments).where(and(eq(docComments.documentId, doc.id), eq(docComments.visibility, "client"), eq(docComments.origin, "client")));
    const suggestions = await getDb().select({ id: docSuggestions.id, paragraphId: docSuggestions.paragraphId, originalText: docSuggestions.originalText, suggestedText: docSuggestions.suggestedText, status: docSuggestions.status, cycleId: docSuggestions.cycleId }).from(docSuggestions).where(and(eq(docSuggestions.documentId, doc.id), eq(docSuggestions.origin, "client")));
    const versions = await getDb().select({ id: docVersions.id, label: docVersions.label, number: docVersions.number, approvedAt: docVersions.approvedAt, docxFileId: docVersions.docxFileId, pdfFileId: docVersions.pdfFileId }).from(docVersions).where(and(eq(docVersions.documentId, doc.id), inArray(docVersions.kind, ["delivery", "final"]), sql`${docVersions.docxFileId} is not null`)).orderBy(desc(docVersions.number));
    out.push({
      id: doc.id,
      title: doc.title,
      access: doc.clientAccess,
      version: version ? { label: version.label, approvedAt: version.approvedAt } : null,
      paragraphs: paragraphs.map((p) => ({ id: p.id, text: p.text, style: p.style ?? null })),
      comments,
      suggestions,
      versions,
      cycles: cycles.map((c) => ({ id: c.id, number: c.number, status: CLIENT_STATUS[c.status] ?? c.status, kind: CLIENT_KIND[c.kind] ?? c.kind, submittedAt: c.submittedAt, open: c.status === "collecting" })),
    });
  }
  return { documents: out, rounds: { included: rounds, used } };
}

const clientCommentInput = z.object({ paragraphId: z.string().max(40).nullable(), quote: z.string().max(2000).nullable().optional(), body: z.string().trim().min(2).max(5000) }).strict();
export async function clientComment(actor: Actor, documentId: string, request: Request) {
  const { doc } = await clientAccess(actor, documentId);
  if (doc.clientAccess === "read") throw new PlatformError(403, "READ_ONLY", "Su questo documento puoi solo leggere.");
  const version = await deliveredVersion(doc.id);
  if (!version) throw new PlatformError(409, "NOTHING_DELIVERED", "Potrai commentare dopo la prima consegna.");
  const body = await readBody(request, clientCommentInput);
  const paragraphs = (await revision(version.revisionId)).paragraphs;
  if (body.paragraphId && !paragraphs.some((p) => p.id === body.paragraphId)) throw new PlatformError(422, "UNKNOWN_PARAGRAPH", "Passaggio non trovato.");
  const cycle = await openCycle(doc, actor.id, true);
  const [comment] = await getDb().insert(docComments).values({ documentId: doc.id, paragraphId: body.paragraphId, quote: body.quote ?? null, body: body.body, authorId: actor.id, origin: "client", visibility: "client", cycleId: cycle!.id }).returning();
  return json({ comment: { id: comment!.id, paragraphId: comment!.paragraphId, quote: comment!.quote, body: comment!.body } }, 201);
}

const clientSuggestInput = z.object({ paragraphId: z.string().max(40), originalText: z.string().min(1).max(5000), suggestedText: z.string().max(5000) }).strict();
/** Proposta del cliente: resta una proposta, il testo approvato non cambia finché l'editor non la accetta. */
export async function clientSuggest(actor: Actor, documentId: string, request: Request) {
  const { doc } = await clientAccess(actor, documentId);
  if (!["suggest", "edit"].includes(doc.clientAccess)) throw new PlatformError(403, "COMMENT_ONLY", "Su questo documento puoi commentare, non proporre modifiche al testo.");
  const version = await deliveredVersion(doc.id);
  if (!version) throw new PlatformError(409, "NOTHING_DELIVERED", "Potrai proporre modifiche dopo la prima consegna.");
  const body = await readBody(request, clientSuggestInput);
  const paragraph = (await revision(version.revisionId)).paragraphs.find((p) => p.id === body.paragraphId);
  const start = paragraph ? paragraph.text.indexOf(body.originalText) : -1;
  if (!paragraph || start < 0) throw new PlatformError(422, "TEXT_NOT_FOUND", "Il testo da modificare non corrisponde al passaggio.");
  const cycle = await openCycle(doc, actor.id, true);
  const [s] = await getDb().insert(docSuggestions).values({ documentId: doc.id, baseRevisionId: version.revisionId, paragraphId: paragraph.id, start, end: start + body.originalText.length, originalText: body.originalText, suggestedText: body.suggestedText, origin: "client", cycleId: cycle!.id, createdBy: actor.id, category: "contenuto" }).returning();
  return json({ suggestion: { id: s!.id, paragraphId: s!.paragraphId, originalText: s!.originalText, suggestedText: s!.suggestedText, status: s!.status } }, 201);
}

/** Paragrafi coinvolti, allargati al capitolo quando richiesto (fino al titolo successivo). */
function expandScope(paragraphs: DocParagraph[], ids: string[], level: string): string[] | null {
  if (level === "document" || !ids.length) return null;
  if (level !== "chapter" && level !== "section") return ids;
  const isHeading = (p: DocParagraph) => Boolean(p.style && /heading|titolo/i.test(p.style));
  const out = new Set<string>();
  for (const id of ids) {
    const i = paragraphs.findIndex((p) => p.id === id);
    if (i < 0) continue;
    let a = i; while (a > 0 && !isHeading(paragraphs[a]!)) a--;
    let b = i + 1; while (b < paragraphs.length && !isHeading(paragraphs[b]!)) b++;
    paragraphs.slice(a, b).forEach((p) => out.add(p.id));
  }
  return [...out];
}

const submitInput = z.object({ notes: z.string().trim().max(5000).optional(), level: z.enum(["selection", "paragraph", "chapter", "section", "document"]).default("paragraph") }).strict();
/** «Invia richiesta di revisione»: verifica, classifica, registra, avvia l'AI solo se incluso e consentito, avvisa la produzione. */
export async function submitRevisionRequest(actor: Actor, documentId: string, request: Request) {
  const { doc, project } = await clientAccess(actor, documentId);
  const body = await readBody(request, submitInput);
  const cycle = await openCycle(doc, actor.id, false);
  const version = await deliveredVersion(doc.id);
  if (!version) throw new PlatformError(409, "NOTHING_DELIVERED", "Non ci sono ancora consegne da rivedere.");
  const comments = cycle ? await getDb().select().from(docComments).where(eq(docComments.cycleId, cycle.id)) : [];
  const suggestions = cycle ? await getDb().select().from(docSuggestions).where(eq(docSuggestions.cycleId, cycle.id)) : [];
  if (!comments.length && !suggestions.length && (body.notes?.length ?? 0) < 10) throw new PlatformError(422, "EMPTY_REQUEST", "Aggiungi almeno un commento o una descrizione di ciò che vuoi rivedere.");
  const target = cycle ?? (await openCycle(doc, actor.id, true))!;
  const paragraphs = (await revision(version.revisionId)).paragraphs;
  const ids = [...new Set([...comments.map((c) => c.paragraphId), ...suggestions.map((s) => s.paragraphId)].filter(Boolean) as string[])];
  const scopeIds = expandScope(paragraphs, ids, body.level);
  const rounds = await includedRounds(project), used = await usedRounds(project.id);
  const kind = rounds === null ? "pending_decision" : used < rounds ? "included" : "extra";
  const status = kind === "included" ? "submitted" : kind === "extra" ? "needs_quote" : "needs_decision";
  await getDb().update(revisionCycles).set({ kind, status, notes: body.notes ?? null, scope: { paragraphIds: scopeIds ?? [], level: body.level }, submittedAt: new Date(), updatedAt: new Date() }).where(eq(revisionCycles.id, target.id));
  await audit(actor, "revision.requested", "document", doc.id, { cycle: target.number, kind, comments: comments.length, suggestions: suggestions.length });
  let started: string | null = null, reason: string | null = null;
  if (kind === "included") {
    const result = await tryAutoStart(doc.id, target.id, scopeIds, comments, suggestions, body.notes ?? null);
    started = result.jobId; reason = result.reason;
  }
  const href = `/spazio?tab=studio&doc=${doc.id}`;
  const summary = `${comments.length} commenti e ${suggestions.length} proposte del cliente`;
  if (kind === "included") await notifyProduction(project.id, "revision_requested", `Richiesta di revisione n. ${target.number} (inclusa)`, started ? `${summary}. La lavorazione AI mirata è partita: riceverai un avviso al termine.` : `${summary}. Da lavorare: ${reason ?? "avvio automatico non previsto"}.`, href, `revision:${target.id}`);
  else await notifyProduction(project.id, "revision_requested", kind === "extra" ? `Richiesta di revisione fuori contratto (n. ${target.number})` : `Richiesta di revisione da valutare (n. ${target.number})`, kind === "extra" ? `${summary}. I cicli inclusi (${rounds}) sono esauriti: serve un preventivo prima di lavorare.` : `${summary}. I cicli inclusi non sono indicati per questo progetto: decidi se è inclusa, una correzione dovuta o extra.`, href, `revision:${target.id}`);
  if (kind === "extra" && project.referentId) await notifyProduction(project.id, "revision_requested", "Revisione extra: preparare un preventivo", summary, `/spazio?progetto=${project.id}`, `revision-quote:${target.id}`);
  return json({ cycle: { number: target.number, status: CLIENT_STATUS[status], kind: CLIENT_KIND[kind] } });
}

/** Avvio automatico solo se le regole lo consentono; altrimenti il ciclo resta da lavorare a mano, con il motivo. */
async function tryAutoStart(documentId: string, cycleId: string, scopeIds: string[] | null, comments: Array<typeof docComments.$inferSelect>, suggestions: Array<typeof docSuggestions.$inferSelect>, notes: string | null): Promise<{ jobId: string | null; reason: string | null }> {
  const [row] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, "revision-rules")).limit(1);
  const rules = revisionRulesSchema.safeParse(row?.value);
  if (!rules.success || !rules.data.autoStartIncluded) return { jobId: null, reason: "avvio automatico delle revisioni non approvato nelle regole" };
  const ai = await approvedAiRules();
  if (!ai?.autoStartServices.includes("client_revision")) return { jobId: null, reason: "le regole dell'AI non prevedono l'avvio automatico delle revisioni" };
  const blocker = await aiBlocker();
  if (blocker) return { jobId: null, reason: blocker };
  const instructions = [
    ...comments.map((c) => ({ paragraphId: c.paragraphId, quote: c.quote, text: c.body })),
    ...suggestions.map((s) => ({ paragraphId: s.paragraphId, quote: s.originalText, text: `Il cliente propone di sostituire «${s.originalText}» con «${s.suggestedText}».` })),
    ...(notes ? [{ paragraphId: null, quote: null, text: notes }] : []),
  ];
  try {
    const job = await startJob(null, documentId, { service: "client_revision", paragraphIds: scopeIds, instructions, cycleId });
    return { jobId: job.id, reason: null };
  } catch (error) {
    return { jobId: null, reason: error instanceof Error ? error.message : "avvio non riuscito" };
  }
}

const decideInput = z.object({ kind: z.enum(["included", "error_fix", "extra", "extra_paid", "rejected"]), reason: z.string().trim().min(3).max(1000), quoteId: z.string().uuid().optional(), startAi: z.boolean().default(false) }).strict();
/** Decisione del responsabile su un ciclo da valutare o extra. «extra_paid» vale solo con un preventivo collegato e incassato. */
export async function decideCycle(actor: Actor, cycleId: string, request: Request) {
  const [cycle] = await getDb().select().from(revisionCycles).where(eq(revisionCycles.id, cycleId));
  if (!cycle || !actor.staff) throw notFound();
  const { project } = await projectAccess(actor, cycle.projectId, "project.assign");
  const body = await readBody(request, decideInput);
  if (!["needs_decision", "needs_quote", "submitted"].includes(cycle.status)) throw new PlatformError(409, "INVALID_STATE", "Il ciclo non è in attesa di una decisione.");
  if (body.kind === "extra_paid") {
    const quoteId = body.quoteId ?? cycle.quoteId;
    if (!quoteId) throw new PlatformError(422, "QUOTE_REQUIRED", "Collega il preventivo della revisione extra.");
    const paid = await getDb().select({ id: paymentOrders.id }).from(paymentOrders).where(and(eq(paymentOrders.quoteId, quoteId), eq(paymentOrders.status, "paid"))).limit(1);
    if (!paid.length) throw new PlatformError(409, "NOT_PAID", "Il preventivo della revisione extra non risulta incassato.");
  }
  const status = body.kind === "rejected" ? "rejected" : body.kind === "extra" ? "needs_quote" : "submitted";
  const kind = body.kind === "extra_paid" ? "extra" : body.kind === "rejected" ? cycle.kind : body.kind;
  await getDb().update(revisionCycles).set({ kind, status, decidedBy: actor.id, decisionReason: body.reason, quoteId: body.quoteId ?? cycle.quoteId, updatedAt: new Date() }).where(eq(revisionCycles.id, cycleId));
  await audit(actor, "revision.decided", "revision_cycle", cycleId, { kind: body.kind, reason: body.reason });
  if (body.kind === "rejected") await notifyClient(project, "Richiesta di revisione non accolta", body.reason);
  if (status === "submitted" && body.startAi) {
    const comments = await getDb().select().from(docComments).where(eq(docComments.cycleId, cycleId));
    const suggestions = await getDb().select().from(docSuggestions).where(eq(docSuggestions.cycleId, cycleId));
    const instructions = [...comments.filter((c) => c.origin === "client").map((c) => ({ paragraphId: c.paragraphId, quote: c.quote, text: c.body })), ...suggestions.filter((s) => s.origin === "client").map((s) => ({ paragraphId: s.paragraphId, quote: s.originalText, text: `Il cliente propone di sostituire «${s.originalText}» con «${s.suggestedText}».` })), ...(cycle.notes ? [{ paragraphId: null, quote: null, text: cycle.notes }] : [])];
    const job = await startJob(actor.id, cycle.documentId, { service: "client_revision", paragraphIds: cycle.scope?.paragraphIds?.length ? cycle.scope.paragraphIds : null, instructions, cycleId });
    return json({ ok: true, jobId: job.id });
  }
  return json({ ok: true });
}

/** Invio al controllo qualità: serve un responsabile della qualità diverso da chi lavora; lo si avvisa. */
export async function sendToQualityCheck(actor: Actor, documentId: string) {
  const doc = await loadDocument(documentId);
  if (!actor.staff) throw notFound();
  const { project } = await projectAccess(actor, doc.projectId, "project.write");
  if (!project.qaOwnerId) throw new PlatformError(409, "QA_OWNER_REQUIRED", "Indica prima chi fa il controllo qualità sul progetto.");
  if (project.qaOwnerId === actor.id) throw new PlatformError(409, "QA_SEPARATION", "Il controllo qualità spetta a una persona diversa da chi ha lavorato il testo.");
  await getDb().update(projects).set({ opsStatus: "quality_check", updatedAt: new Date() }).where(eq(projects.id, project.id));
  await getDb().update(revisionCycles).set({ status: "quality_check", updatedAt: new Date() }).where(and(eq(revisionCycles.documentId, documentId), inArray(revisionCycles.status, ["human_review", "submitted"])));
  const { notify } = await import("../crm-notify");
  const { asTx } = await import("./service");
  await notify(asTx(), project.qaOwnerId, "quality_check", { title: "Documento da controllare in qualità", body: `${doc.title}: pronto per il controllo qualità.`, href: `/spazio?tab=studio&doc=${documentId}`, key: `qa:${documentId}:${Date.now()}` });
  await audit(actor, "document.sent_to_qa", "document", documentId);
  return json({ ok: true });
}

