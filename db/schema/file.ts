import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { users } from "./utenti";
import { projects } from "./progetti";
import { ruoloVersioneEnum, statoVersioneEnum, tempi } from "./comuni";

/**
 * Il file logico: "il manoscritto", "la copertina". Le sue versioni stanno in
 * `file_versions` e non vengono mai sovrascritte.
 */
export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 400 }).notNull(),
    /** manoscritto | copertina | materiale | contratto | deliverable | altro */
    categoria: varchar("categoria", { length: 40 }).notNull().default("altro"),
    caricatoDaId: uuid("caricato_da_id").references(() => users.id, { onDelete: "set null" }),
    /** Versione corrente, denormalizzata per evitare una sottoquery in ogni lista. */
    versioneCorrenteId: uuid("versione_corrente_id"),
    archiviatoAt: timestamp("archiviato_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    projectIdx: index("files_project_idx").on(t.projectId),
    orgIdx: index("files_organization_idx").on(t.organizationId),
    categoriaIdx: index("files_categoria_idx").on(t.categoria),
  }),
);

/**
 * Una versione immutabile di un file.
 *
 * Regola fondativa: **l'originale non si tocca mai**. Ogni lavorazione produce
 * una nuova riga con `precedenteId` che punta a quella da cui deriva, così la
 * catena originale → lavorazione → revisionata → approvata → deliverable è
 * ricostruibile e verificabile a posteriori.
 *
 * `hashSha256` è calcolato al caricamento: consente di dimostrare che il file
 * consegnato è quello approvato e di riconoscere un caricamento duplicato.
 * Il binario vive nello storage (`chiaveStorage`), mai in database.
 */
export const fileVersions = pgTable(
  "file_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    jobId: uuid("job_id"),

    numeroVersione: integer("numero_versione").notNull(),
    ruolo: ruoloVersioneEnum("ruolo").notNull(),
    stato: statoVersioneEnum("stato").notNull().default("in_caricamento"),

    nomeFile: varchar("nome_file", { length: 400 }).notNull(),
    mimeType: varchar("mime_type", { length: 150 }).notNull(),
    dimensioneByte: bigint("dimensione_byte", { mode: "number" }).notNull(),
    hashSha256: varchar("hash_sha256", { length: 64 }).notNull(),
    /** Chiave opaca presso lo StorageProvider. Non è un URL pubblico. */
    chiaveStorage: varchar("chiave_storage", { length: 500 }).notNull(),
    /** Nome del driver che ha scritto il file: s3 | filesystem. */
    driverStorage: varchar("driver_storage", { length: 30 }).notNull(),

    precedenteId: uuid("precedente_id"),
    creatoDaId: uuid("creato_da_id").references(() => users.id, { onDelete: "set null" }),
    /** Metadati tecnici sanitizzati (conteggio parole, pagine, esito parsing). */
    metadati: jsonb("metadati").$type<Record<string, unknown>>(),
    /** Motivo per cui la versione è in needs_review (es. struttura DOCX non preservabile). */
    notaVerifica: varchar("nota_verifica", { length: 500 }),

    /** Cancellazione logica: la riga resta per l'audit, il binario viene rimosso. */
    cancellataAt: timestamp("cancellata_at", { withTimezone: true }),
    conservareFinoAt: timestamp("conservare_fino_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    fileIdx: index("file_versions_file_idx").on(t.fileId),
    projectIdx: index("file_versions_project_idx").on(t.projectId),
    jobIdx: index("file_versions_job_idx").on(t.jobId),
    hashIdx: index("file_versions_hash_idx").on(t.hashSha256),
    versioneIdx: uniqueIndex("file_versions_numero_idx").on(t.fileId, t.numeroVersione),
  }),
);

/**
 * Ciò che viene effettivamente consegnato al cliente. Un deliverable esiste
 * solo dopo l'approvazione operativa: è la riga che autorizza il download.
 */
export const deliverables = pgTable(
  "deliverables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id"),
    fileVersionId: uuid("file_version_id")
      .notNull()
      .references(() => fileVersions.id, { onDelete: "restrict" }),

    titolo: varchar("titolo", { length: 300 }).notNull(),
    descrizione: text("descrizione"),
    consegnatoAt: timestamp("consegnato_at", { withTimezone: true }),
    consegnatoDaId: uuid("consegnato_da_id").references(() => users.id, { onDelete: "set null" }),
    visibileAlCliente: boolean("visibile_al_cliente").notNull().default(false),
    scaricatoAt: timestamp("scaricato_at", { withTimezone: true }),
    conteggioDownload: integer("conteggio_download").notNull().default(0),
    ...tempi,
  },
  (t) => ({
    projectIdx: index("deliverables_project_idx").on(t.projectId),
    orgIdx: index("deliverables_organization_idx").on(t.organizationId),
  }),
);

export type FileProgetto = typeof files.$inferSelect;
export type NuovoFileProgetto = typeof files.$inferInsert;
export type VersioneFile = typeof fileVersions.$inferSelect;
export type NuovaVersioneFile = typeof fileVersions.$inferInsert;
export type Deliverable = typeof deliverables.$inferSelect;
