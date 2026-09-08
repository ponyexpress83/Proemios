import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { users } from "./utenti";
import { clients } from "./crm";
import { orders } from "./commercio";
import {
  ruoloEnum,
  statoApprovazioneEnum,
  statoAttivitaEnum,
  statoMilestoneEnum,
  statoProgettoEnum,
  statoTappaEnum,
  tempi,
  tipoApprovazioneEnum,
} from "./comuni";

/**
 * Il progetto è l'unità di lavoro. `codice` (P-184) è l'identificativo che
 * compare ovunque, incluso davanti a chi non deve vedere il nome del cliente:
 * il codice identifica il lavoro senza identificare la persona.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codice: varchar("codice", { length: 20 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),

    /** Titolo dell'opera. Può essere un titolo di lavorazione. */
    titolo: varchar("titolo", { length: 300 }).notNull(),
    /**
     * Titolo mostrato a chi non deve conoscere l'opera per nome (progetti
     * riservati). Quando è valorizzato, i DTO destinati a quei ruoli lo usano
     * al posto di `titolo`.
     */
    titoloAlias: varchar("titolo_alias", { length: 120 }),

    /** Slug del percorso da config/percorsi.ts, quando il progetto ne segue uno. */
    percorsoSlug: varchar("percorso_slug", { length: 80 }),
    /** Slug dei servizi acquistati, da config/catalogo.ts. */
    serviziSlug: jsonb("servizi_slug").$type<string[]>().default([]),

    stato: statoProgettoEnum("stato").notNull().default("avvio"),
    /** 0-100, calcolato dalle tappe completate. Denormalizzato per le liste. */
    avanzamento: integer("avanzamento").notNull().default(0),

    projectManagerId: uuid("project_manager_id").references(() => users.id, {
      onDelete: "set null",
    }),
    conteggioParole: integer("conteggio_parole"),
    scadenzaAt: timestamp("scadenza_at", { withTimezone: true }),
    prioritaria: boolean("prioritaria").notNull().default(false),

    /** Brief strutturato prodotto dall'onboarding e verificato dallo staff. */
    brief: jsonb("brief").$type<Record<string, unknown>>(),
    briefVerificatoAt: timestamp("brief_verificato_at", { withTimezone: true }),
    briefVerificatoDaId: uuid("brief_verificato_da_id").references(() => users.id, {
      onDelete: "set null",
    }),

    /** Istruzioni editoriali visibili al revisore: mai dati commerciali. */
    istruzioniEditoriali: text("istruzioni_editoriali"),
    noteInterne: text("note_interne"),

    conclusoAt: timestamp("concluso_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    codiceIdx: uniqueIndex("projects_codice_idx").on(t.codice),
    orgIdx: index("projects_organization_idx").on(t.organizationId),
    clientIdx: index("projects_client_idx").on(t.clientId),
    statoIdx: index("projects_stato_idx").on(t.stato),
    pmIdx: index("projects_pm_idx").on(t.projectManagerId),
    scadenzaIdx: index("projects_scadenza_idx").on(t.scadenzaAt),
  }),
);

/**
 * Chi ha accesso a un progetto. L'appartenenza è la base dell'autorizzazione
 * per i ruoli operativi: un revisore vede un progetto perché è membro, non
 * perché il suo ruolo gli darebbe accesso a tutti.
 */
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Ruolo assunto nel progetto: può essere più stretto del ruolo globale. */
    ruolo: ruoloEnum("ruolo").notNull(),
    assegnatoDaId: uuid("assegnato_da_id").references(() => users.id, { onDelete: "set null" }),
    rimossoAt: timestamp("rimosso_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    unicoIdx: uniqueIndex("project_members_unico_idx").on(t.projectId, t.userId),
    userIdx: index("project_members_user_idx").on(t.userId),
  }),
);

/** Le fasi del progetto: quello che il cliente vede come avanzamento. */
export const projectStages = pgTable(
  "project_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 150 }).notNull(),
    descrizione: text("descrizione"),
    ordine: integer("ordine").notNull().default(0),
    stato: statoTappaEnum("stato").notNull().default("attesa"),
    inizioPrevistoAt: timestamp("inizio_previsto_at", { withTimezone: true }),
    finePrevistaAt: timestamp("fine_prevista_at", { withTimezone: true }),
    completataAt: timestamp("completata_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({ projectIdx: index("project_stages_project_idx").on(t.projectId) }),
);

/**
 * Milestone: una consegna che richiede una decisione del cliente, e che può
 * essere legata a un pagamento a stato avanzamento.
 */
export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").references(() => projectStages.id, { onDelete: "set null" }),
    nome: varchar("nome", { length: 200 }).notNull(),
    descrizione: text("descrizione"),
    stato: statoMilestoneEnum("stato").notNull().default("pianificata"),
    ordine: integer("ordine").notNull().default(0),
    scadenzaAt: timestamp("scadenza_at", { withTimezone: true }),
    /** Importo dovuto al raggiungimento, se la milestone è fatturabile. */
    importoCent: integer("importo_cent"),
    approvataAt: timestamp("approvata_at", { withTimezone: true }),
    approvataDaId: uuid("approvata_da_id").references(() => users.id, { onDelete: "set null" }),
    ...tempi,
  },
  (t) => ({
    projectIdx: index("milestones_project_idx").on(t.projectId),
    statoIdx: index("milestones_stato_idx").on(t.stato),
  }),
);

/** Attività interne. Non visibili al cliente. */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").references(() => projectStages.id, { onDelete: "set null" }),
    titolo: varchar("titolo", { length: 300 }).notNull(),
    descrizione: text("descrizione"),
    stato: statoAttivitaEnum("stato").notNull().default("da_fare"),
    assegnatoAId: uuid("assegnato_a_id").references(() => users.id, { onDelete: "set null" }),
    creatoDaId: uuid("creato_da_id").references(() => users.id, { onDelete: "set null" }),
    scadenzaAt: timestamp("scadenza_at", { withTimezone: true }),
    completataAt: timestamp("completata_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    projectIdx: index("tasks_project_idx").on(t.projectId),
    assegnatoIdx: index("tasks_assegnato_idx").on(t.assegnatoAId),
    statoIdx: index("tasks_stato_idx").on(t.stato),
  }),
);

/**
 * Messaggi di progetto. `visibileAlCliente` decide se il messaggio compare nel
 * portale: le note fra operatori vivono nella stessa cronologia ma non escono.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    autoreId: uuid("autore_id").references(() => users.id, { onDelete: "set null" }),
    corpo: text("corpo").notNull(),
    visibileAlCliente: boolean("visibile_al_cliente").notNull().default(false),
    /** Allegati come chiavi di storage: nessun binario in database. */
    allegati: jsonb("allegati").$type<{ fileVersionId: string; nome: string }[]>().default([]),
    lettoDaCliente: boolean("letto_da_cliente").notNull().default(false),
    ...tempi,
  },
  (t) => ({
    projectIdx: index("messages_project_idx").on(t.projectId),
    createdAtIdx: index("messages_created_at_idx").on(t.createdAt),
  }),
);

/**
 * Richiesta di chiarimento: la domanda che il redattore pone sul testo e che,
 * filtrata, arriva al cliente. Il campo `domandaInterna` non esce mai dal
 * back-office; `domandaAlCliente` è la versione che il cliente legge.
 */
export const clarificationRequests = pgTable(
  "clarification_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    jobId: uuid("job_id"),
    richiedenteId: uuid("richiedente_id").references(() => users.id, { onDelete: "set null" }),
    domandaInterna: text("domanda_interna").notNull(),
    domandaAlCliente: text("domanda_al_cliente"),
    /** Riferimento nel testo, in forma di ancora: mai il testo integrale. */
    riferimento: varchar("riferimento", { length: 300 }),
    risposta: text("risposta"),
    rispostaDaId: uuid("risposta_da_id").references(() => users.id, { onDelete: "set null" }),
    rispostaAt: timestamp("risposta_at", { withTimezone: true }),
    inoltrataAlClienteAt: timestamp("inoltrata_al_cliente_at", { withTimezone: true }),
    chiusaAt: timestamp("chiusa_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    projectIdx: index("clarification_requests_project_idx").on(t.projectId),
    jobIdx: index("clarification_requests_job_idx").on(t.jobId),
  }),
);

/**
 * Approvazioni. Tre catene distinte, deliberatamente separate: il cliente
 * approva una milestone, il redattore approva editorialmente, operations
 * approva la consegna. Nessun ruolo può coprire due anelli.
 */
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    jobId: uuid("job_id"),
    fileVersionId: uuid("file_version_id"),

    tipo: tipoApprovazioneEnum("tipo").notNull(),
    stato: statoApprovazioneEnum("stato").notNull().default("richiesta"),
    richiestaAId: uuid("richiesta_a_id").references(() => users.id, { onDelete: "set null" }),
    richiestaDaId: uuid("richiesta_da_id").references(() => users.id, { onDelete: "set null" }),
    decisaDaId: uuid("decisa_da_id").references(() => users.id, { onDelete: "set null" }),
    decisaAt: timestamp("decisa_at", { withTimezone: true }),
    motivazione: text("motivazione"),
    scadeAt: timestamp("scade_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    projectIdx: index("approvals_project_idx").on(t.projectId),
    statoIdx: index("approvals_stato_idx").on(t.stato),
    richiestaAIdx: index("approvals_richiesta_a_idx").on(t.richiestaAId),
  }),
);

export type Progetto = typeof projects.$inferSelect;
export type NuovoProgetto = typeof projects.$inferInsert;
export type MembroProgetto = typeof projectMembers.$inferSelect;
export type TappaProgetto = typeof projectStages.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type Attivita = typeof tasks.$inferSelect;
export type Messaggio = typeof messages.$inferSelect;
export type RichiestaChiarimento = typeof clarificationRequests.$inferSelect;
export type Approvazione = typeof approvals.$inferSelect;
