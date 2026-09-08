import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  real,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { users } from "./utenti";
import { projects } from "./progetti";
import { fileVersions } from "./file";
import {
  categoriaInterventoEnum,
  livelloServizioEnum,
  modalitaRevisioneEnum,
  ruoloRunEnum,
  statoInterventoEnum,
  statoJobEnum,
  statoRunEnum,
  tempi,
} from "./comuni";

/**
 * Un Job è una lavorazione editoriale su una versione di file.
 *
 * Vincolo di prodotto: nessun Job passa da `queued` a `delivered` senza
 * attraversare `editorially_approved` e `approved`. La macchina a stati vive in
 * lib/produzione/stati.ts ed è testata; qui c'è solo la persistenza.
 */
export const editorialJobs = pgTable(
  "editorial_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codice: varchar("codice", { length: 30 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Versione di partenza: sempre un originale o una lavorazione precedente. */
    fileVersionOrigineId: uuid("file_version_origine_id").references(() => fileVersions.id, {
      onDelete: "set null",
    }),
    /** Versione prodotta dal Job, quando c'è. */
    fileVersionEsitoId: uuid("file_version_esito_id").references(() => fileVersions.id, {
      onDelete: "set null",
    }),

    livelloServizio: livelloServizioEnum("livello_servizio").notNull(),
    modalitaRevisione: modalitaRevisioneEnum("modalita_revisione").notNull().default("controllato"),
    stato: statoJobEnum("stato").notNull().default("queued"),

    assegnatoAId: uuid("assegnato_a_id").references(() => users.id, { onDelete: "set null" }),
    assegnatoDaId: uuid("assegnato_da_id").references(() => users.id, { onDelete: "set null" }),
    assegnatoAt: timestamp("assegnato_at", { withTimezone: true }),

    conteggioParole: integer("conteggio_parole"),
    conteggioInterventi: integer("conteggio_interventi").notNull().default(0),
    conteggioDaVerificare: integer("conteggio_da_verificare").notNull().default(0),

    /** Istruzioni editoriali per il Job. Nessun dato commerciale. */
    istruzioni: text("istruzioni"),
    scadenzaAt: timestamp("scadenza_at", { withTimezone: true }),
    prioritaria: boolean("prioritaria").notNull().default(false),

    approvatoEditorialmenteAt: timestamp("approvato_editorialmente_at", { withTimezone: true }),
    approvatoEditorialmenteDaId: uuid("approvato_editorialmente_da_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvatoAt: timestamp("approvato_at", { withTimezone: true }),
    approvatoDaId: uuid("approvato_da_id").references(() => users.id, { onDelete: "set null" }),
    consegnatoAt: timestamp("consegnato_at", { withTimezone: true }),

    /** Messaggio di errore sanitizzato: mai testo del manoscritto, mai segreti. */
    erroreMessaggio: varchar("errore_messaggio", { length: 500 }),
    ...tempi,
  },
  (t) => ({
    codiceIdx: index("editorial_jobs_codice_idx").on(t.codice),
    projectIdx: index("editorial_jobs_project_idx").on(t.projectId),
    statoIdx: index("editorial_jobs_stato_idx").on(t.stato),
    assegnatoIdx: index("editorial_jobs_assegnato_idx").on(t.assegnatoAId),
    orgIdx: index("editorial_jobs_organization_idx").on(t.organizationId),
  }),
);

/**
 * Esecuzione di un modello su un Job.
 *
 * **Questa tabella non esce mai verso il cliente.** Provider, modello, costi,
 * token, latenze e riferimenti ai prompt sono materiale di back-office: il DTO
 * cliente non ha nemmeno un campo dove metterli, e un test lo verifica.
 *
 * I prompt contenenti testo integrale non stanno qui: `promptRiferimento` è la
 * chiave di uno storage separato, cifrato e a retention breve.
 */
export const aiJobRuns = pgTable(
  "ai_job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => editorialJobs.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    ruolo: ruoloRunEnum("ruolo").notNull(),
    stato: statoRunEnum("stato").notNull().default("in_corso"),

    provider: varchar("provider", { length: 40 }).notNull(),
    modello: varchar("modello", { length: 120 }).notNull(),
    versionePrompt: varchar("versione_prompt", { length: 60 }),
    /** Chiave nello storage riservato dei prompt. Mai il prompt stesso. */
    promptRiferimento: varchar("prompt_riferimento", { length: 300 }),
    /** Motivazioni della scelta del router, per la revisione della qualità. */
    motivazioniRouting: jsonb("motivazioni_routing").$type<string[]>().default([]),

    tokenInput: integer("token_input"),
    tokenOutput: integer("token_output"),
    costoMicroCent: integer("costo_micro_cent"),
    latenzaMs: integer("latenza_ms"),
    tentativo: integer("tentativo").notNull().default(1),

    interventiProdotti: integer("interventi_prodotti").notNull().default(0),
    /** Errore tecnico sanitizzato. */
    erroreMessaggio: varchar("errore_messaggio", { length: 500 }),
    iniziataAt: timestamp("iniziata_at", { withTimezone: true }).notNull().defaultNow(),
    conclusaAt: timestamp("conclusa_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    jobIdx: index("ai_job_runs_job_idx").on(t.jobId),
    statoIdx: index("ai_job_runs_stato_idx").on(t.stato),
  }),
);

/**
 * Il singolo intervento sul testo: la moneta con cui si misura il lavoro.
 *
 * `internalReason` e `confidence` sono materiale di back-office e non escono
 * verso il cliente. `before`/`after` sono frammenti puntuali, non il testo
 * integrale: l'ancora (`ancora`) dice dove si applicano nel documento.
 */
export const editorialInterventions = pgTable(
  "editorial_interventions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => editorialJobs.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => aiJobRuns.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    categoria: categoriaInterventoEnum("categoria").notNull(),
    /** Posizione nel documento: id di paragrafo/run OOXML e offset. */
    ancora: jsonb("ancora")
      .$type<{ paragraphId?: string; runId?: string; start?: number; end?: number; indice?: number }>()
      .notNull(),
    prima: text("prima").notNull(),
    dopo: text("dopo").notNull(),
    confidenza: real("confidenza").notNull(),

    /** Motivazione tecnica interna. Non esce mai dal back-office. */
    motivazioneInterna: text("motivazione_interna").notNull(),
    /** Nota che il redattore sceglie di far leggere al cliente nel commento DOCX. */
    commentoPerAutore: text("commento_per_autore"),

    stato: statoInterventoEnum("stato").notNull().default("pending"),
    /** Testo sostitutivo scelto dal revisore quando modifica la proposta. */
    testoModificato: text("testo_modificato"),
    rivistoDaId: uuid("rivisto_da_id").references(() => users.id, { onDelete: "set null" }),
    rivistoAt: timestamp("rivisto_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    jobIdx: index("editorial_interventions_job_idx").on(t.jobId),
    runIdx: index("editorial_interventions_run_idx").on(t.runId),
    statoIdx: index("editorial_interventions_stato_idx").on(t.stato),
    categoriaIdx: index("editorial_interventions_categoria_idx").on(t.categoria),
  }),
);

/** Revisione umana di un Job: chi ha guardato, quando, con che esito. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => editorialJobs.id, { onDelete: "cascade" }),
    revisoreId: uuid("revisore_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    iniziataAt: timestamp("iniziata_at", { withTimezone: true }).notNull().defaultNow(),
    conclusaAt: timestamp("conclusa_at", { withTimezone: true }),
    interventiAccettati: integer("interventi_accettati").notNull().default(0),
    interventiRifiutati: integer("interventi_rifiutati").notNull().default(0),
    interventiModificati: integer("interventi_modificati").notNull().default(0),
    noteInterne: text("note_interne"),
    /** Esito dichiarato dal revisore: approvato | rimandato | escalation. */
    esito: varchar("esito", { length: 30 }),
    ...tempi,
  },
  (t) => ({
    jobIdx: index("reviews_job_idx").on(t.jobId),
    revisoreIdx: index("reviews_revisore_idx").on(t.revisoreId),
  }),
);

export type JobEditoriale = typeof editorialJobs.$inferSelect;
export type NuovoJobEditoriale = typeof editorialJobs.$inferInsert;
export type RunAi = typeof aiJobRuns.$inferSelect;
export type NuovaRunAi = typeof aiJobRuns.$inferInsert;
export type InterventoEditoriale = typeof editorialInterventions.$inferSelect;
export type NuovoInterventoEditoriale = typeof editorialInterventions.$inferInsert;
export type Revisione = typeof reviews.$inferSelect;
