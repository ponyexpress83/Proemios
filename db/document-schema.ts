/**
 * Document Studio, motore editoriale AI, cicli di revisione e costi.
 *
 * Proemios è il sistema di riferimento: progetto, autorizzazioni, versioni,
 * approvazioni e consegne vivono qui. L'editor esterno (Google Docs, in futuro
 * ONLYOFFICE o Collabora) è un adattatore: il documento di lavoro resta lo
 * stesso per tutto il progetto e ogni versione ufficiale è immutabile.
 *
 * Confine cliente/back-office: lavorazioni AI, modelli, costi, note interne e
 * prompt non vanno mai serializzati verso l'area cliente.
 */
import { pgTable, text, uuid, timestamp, jsonb, integer, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { projects, projectFiles } from "./platform-schema";

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Un paragrafo del documento di lavoro. `source` è l'indice del paragrafo nel DOCX originale, se c'è. */
export type DocParagraph = { id: string; text: string; style?: string | null; source?: number | null };

/** Documento persistente di un manoscritto: uno per file originale, per tutta la vita del progetto. */
export const documents = pgTable(
  "doc_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    title: text("title").notNull(),
    /** Originale immutabile: il file caricato, mai sovrascritto. */
    originalFileId: uuid("original_file_id").notNull().references(() => projectFiles.id),
    sourceFormat: text("source_format").notNull(),
    /** Revisione corrente del documento di lavoro e contatore per il blocco ottimistico. */
    currentRevisionId: uuid("current_revision_id"),
    revisionNumber: integer("revision_number").notNull().default(0),
    /** internal | google_docs: dove si modifica il testo. Proemios resta il registro. */
    provider: text("provider").notNull().default("internal"),
    externalId: text("external_id"),
    externalRevisionId: text("external_revision_id"),
    /** Cosa può fare il cliente sul documento: read | comment | suggest | edit. */
    clientAccess: text("client_access").notNull().default("comment"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("doc_original_idx").on(t.originalFileId), index("doc_project_idx").on(t.projectId)],
);

/** Stati successivi del documento di lavoro. Ogni modifica crea una revisione nuova: niente si perde. */
export const docRevisions = pgTable(
  "doc_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    number: integer("number").notNull(),
    paragraphs: jsonb("paragraphs").$type<DocParagraph[]>().notNull(),
    hash: text("hash").notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("doc_revision_number_idx").on(t.documentId, t.number)],
);

/** Versioni ufficiali (Originale, V1, V2…, Definitiva): immutabili, con impronta del contenuto. */
export const docVersions = pgTable(
  "doc_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    number: integer("number").notNull(),
    label: text("label").notNull(),
    /** original | delivery | final */
    kind: text("kind").notNull(),
    revisionId: uuid("revision_id").notNull().references(() => docRevisions.id),
    contentHash: text("content_hash").notNull(),
    docxFileId: uuid("docx_file_id").references(() => projectFiles.id),
    pdfFileId: uuid("pdf_file_id").references(() => projectFiles.id),
    cycleId: uuid("cycle_id"),
    approvedBy: text("approved_by").references(() => user.id),
    approvedAt: ts("approved_at"),
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("doc_version_number_idx").on(t.documentId, t.number)],
);

/**
 * Proposte di modifica: dell'AI, dell'editor o del cliente. Non toccano il
 * testo finché una persona autorizzata non le accetta.
 */
export const docSuggestions = pgTable(
  "doc_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    baseRevisionId: uuid("base_revision_id").notNull().references(() => docRevisions.id),
    paragraphId: text("paragraph_id").notNull(),
    /** replace: sostituisce un tratto del paragrafo · insert_after: nuovo paragrafo dopo questo. */
    kind: text("kind").notNull().default("replace"),
    start: integer("start").notNull(),
    end: integer("end").notNull(),
    originalText: text("original_text").notNull(),
    suggestedText: text("suggested_text").notNull(),
    reason: text("reason"),
    category: text("category").notNull().default("other"),
    /** ai | editor | client */
    origin: text("origin").notNull(),
    jobId: uuid("job_id"),
    cycleId: uuid("cycle_id"),
    /** pending | accepted | rejected | modified | stale */
    status: text("status").notNull().default("pending"),
    finalText: text("final_text"),
    decidedBy: text("decided_by").references(() => user.id),
    decidedAt: ts("decided_at"),
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [index("doc_suggestion_status_idx").on(t.documentId, t.status), index("doc_suggestion_job_idx").on(t.jobId)],
);

/** Commenti sul documento. `internal` non arriva mai al cliente. */
export const docComments = pgTable(
  "doc_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    paragraphId: text("paragraph_id"),
    quote: text("quote"),
    body: text("body").notNull(),
    authorId: text("author_id").notNull().references(() => user.id),
    /** internal | client */
    visibility: text("visibility").notNull(),
    cycleId: uuid("cycle_id"),
    /** open | resolved */
    status: text("status").notNull().default("open"),
    createdAt: created(),
  },
  (t) => [index("doc_comment_doc_idx").on(t.documentId, t.createdAt)],
);

/**
 * Un ciclo di revisione chiesto dal cliente. Più commenti della stessa
 * richiesta formano un solo ciclo. Il tipo (incluso, correzione dovuta a un
 * errore, extra) decide se la lavorazione può partire senza nuovi accordi.
 */
export const revisionCycles = pgTable(
  "doc_revision_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    number: integer("number").notNull(),
    /** included | error_fix | extra | pending_decision */
    kind: text("kind").notNull().default("pending_decision"),
    /** collecting | submitted | needs_decision | needs_quote | ai_running | human_review | quality_check | approved | delivered | rejected */
    status: text("status").notNull().default("collecting"),
    requestedBy: text("requested_by").references(() => user.id),
    notes: text("notes"),
    scope: jsonb("scope").$type<{ paragraphIds: string[]; level: "selection" | "paragraph" | "chapter" | "section" | "document" }>(),
    submittedAt: ts("submitted_at"),
    decidedBy: text("decided_by").references(() => user.id),
    decisionReason: text("decision_reason"),
    quoteId: uuid("quote_id"),
    deliveredVersionId: uuid("delivered_version_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("doc_cycle_number_idx").on(t.documentId, t.number), index("doc_cycle_project_idx").on(t.projectId, t.status)],
);

/** Lavorazione AI: coda persistente, budget, ripresa dopo un errore. Solo back-office. */
export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    cycleId: uuid("cycle_id"),
    service: text("service").notNull(),
    /** queued | running | paused | needs_review | completed | failed | cancelled | blocked */
    status: text("status").notNull().default("queued"),
    statusReason: text("status_reason"),
    scope: jsonb("scope").$type<{ paragraphIds: string[] | null }>().notNull(),
    instructions: jsonb("instructions").$type<Array<{ paragraphId: string | null; quote: string | null; text: string }>>().notNull().default([]),
    glossary: jsonb("glossary").$type<string[]>().notNull().default([]),
    model: text("model").notNull(),
    effort: text("effort").notNull(),
    baseRevisionId: uuid("base_revision_id").notNull(),
    budgetMicros: bigint("budget_micros", { mode: "number" }).notNull(),
    spentMicros: bigint("spent_micros", { mode: "number" }).notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    chunksTotal: integer("chunks_total").notNull().default(0),
    chunksDone: integer("chunks_done").notNull().default(0),
    suggestions: integer("suggestions").notNull().default(0),
    discarded: integer("discarded").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lockedUntil: ts("locked_until"),
    createdBy: text("created_by"),
    createdAt: created(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    updatedAt: updated(),
  },
  (t) => [index("ai_job_status_idx").on(t.status, t.createdAt), index("ai_job_doc_idx").on(t.documentId)],
);

/** Porzioni di una lavorazione: ognuna si ripete da sola, senza rifare le altre. */
export const aiJobChunks = pgTable(
  "ai_job_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => aiJobs.id),
    index: integer("index").notNull(),
    paragraphIds: jsonb("paragraph_ids").$type<string[]>().notNull(),
    /** pending | done | failed */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("ai_chunk_idx").on(t.jobId, t.index)],
);

/** Registro di ogni chiamata a un modello: base dei costi AI per progetto e per funzione. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** editorial | client_revision | sales_assistant | analysis */
    purpose: text("purpose").notNull(),
    projectId: uuid("project_id"),
    jobId: uuid("job_id"),
    dealId: uuid("deal_id"),
    actorId: text("actor_id"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    /** Costo in milionesimi di dollaro, dal listino del modello in vigore al momento. */
    costMicros: bigint("cost_micros", { mode: "number" }).notNull(),
    priceVersion: text("price_version").notNull(),
    outcome: text("outcome").notNull(),
    createdAt: created(),
  },
  (t) => [index("ai_usage_project_idx").on(t.projectId), index("ai_usage_created_idx").on(t.createdAt)],
);

/** Costi diretti di un progetto registrati da una persona (compenso editor, altri costi). In euro. */
export const projectCosts = pgTable(
  "project_costs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    /** editor_fee | other */
    kind: text("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    createdBy: text("created_by").notNull().references(() => user.id),
    createdAt: created(),
  },
  (t) => [index("project_cost_idx").on(t.projectId)],
);

/** Collegamenti a servizi esterni dell'organizzazione (es. Google). Il token è cifrato. */
export const externalConnections = pgTable(
  "external_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    accountEmail: text("account_email"),
    encryptedToken: text("encrypted_token"),
    scopes: text("scopes"),
    /** pending | connected | error | revoked */
    status: text("status").notNull().default("pending"),
    stateHash: text("state_hash"),
    lastError: text("last_error"),
    connectedBy: text("connected_by").references(() => user.id),
    connectedAt: ts("connected_at"),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("external_provider_idx").on(t.provider)],
);

