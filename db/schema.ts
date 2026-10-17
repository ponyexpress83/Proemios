/**
 * Schema Drizzle — Proemios.
 *
 * Fase 1: crea solo le tabelle usate ora (leads, quotes, manuscript_analyses,
 * agency_leads). Lo schema e progettato per reggere le Fasi 2-3 senza refactor.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export * from "./auth-schema";
export * from "./platform-schema";
export * from "./crm-schema";

export const leadSourceEnum = pgEnum("lead_source", [
  "preventivo",
  "analisi",
  "contatto",
  "agenzie",
  /** Contatto preso da un marketplace di servizi (es. AddLance) con inserimento autorizzato. */
  "marketplace",
  /** Importazione autorizzata da file (CSV) o inserimento manuale del team. */
  "import",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "deposit_paid",
  "won",
  "lost",
]);

export type ContactPreferences = { email: boolean; phone: boolean; whatsapp: boolean; sms: boolean; note?: string | null };
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id"),
    nome: varchar("nome", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    telefono: varchar("telefono", { length: 40 }),
    fonte: leadSourceEnum("fonte").notNull(),
    /** Stato CRM volutamente testuale: puo evolvere senza migrazioni enum. */
    stage: varchar("stage", { length: 40 }).notNull().default("new"),
    /** Score operativo 0-100 per dare priorita alle call. */
    leadScore: integer("lead_score"),
    /** UTM, click id, landing e referrer della prima visita attribuibile. */
    attribution: jsonb("attribution"),
    consensoPrivacy: boolean("consenso_privacy").notNull().default(false),
    consensoMarketing: boolean("consenso_marketing").notNull().default(false),
    /** Quando il consenso alle comunicazioni facoltative è stato dato o revocato. */
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    marketingRevokedAt: timestamp("marketing_revoked_at", { withTimezone: true }),
    /** Canali ammessi per il contatto commerciale, scelti dalla persona o registrati dal team. */
    contactPreferences: jsonb("contact_preferences").$type<ContactPreferences>(),
    /** Dettaglio dell'origine: nome del marketplace, campagna, file importato. */
    sourceDetail: varchar("source_detail", { length: 200 }),
    /** Identificativo esterno (es. id dell'offerta sul marketplace) per non importare due volte. */
    externalRef: varchar("external_ref", { length: 200 }),
    /** Prossima azione concordata e scadenza: una sola per contatto. */
    nextAction: varchar("next_action", { length: 300 }),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    note: text("note"),
    /** Persona e trattativa a cui appartiene la richiesta: una richiesta non è un contatto né un'opportunità. */
    contactId: uuid("contact_id"),
    dealId: uuid("deal_id"),
    /** Tipo di origine (modulo, campagna, social, inserimento, venditore, marketplace, partner, API). */
    sourceKind: varchar("source_kind", { length: 20 }),
    /** Chi ha portato il contatto (venditore o partner), distinto da chi lo segue. */
    sourcedBy: text("sourced_by"),
    priority: varchar("priority", { length: 10 }).notNull().default("normal"),
    language: varchar("language", { length: 8 }).notNull().default("it"),
    requiredSkill: varchar("required_skill", { length: 40 }),
    /** assigned · queued (nessuno idoneo, coda monitorata) · pool (coda a scelta libera) · reserved · manual */
    assignmentStatus: varchar("assignment_status", { length: 12 }).notNull().default("assigned"),
    reservedBy: text("reserved_by"),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    custom: jsonb("custom").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contactIdx: index("leads_contact_idx").on(t.contactId),
    assignmentIdx: index("leads_assignment_idx").on(t.assignmentStatus, t.slaDueAt),
    emailIdx: index("leads_email_idx").on(t.email),
    externalRefIdx: index("leads_external_ref_idx").on(t.externalRef),
    nextActionIdx: index("leads_next_action_idx").on(t.nextActionAt),
    fonteIdx: index("leads_fonte_idx").on(t.fonte),
    stageIdx: index("leads_stage_idx").on(t.stage),
    scoreIdx: index("leads_score_idx").on(t.leadScore),
    createdAtIdx: index("leads_created_at_idx").on(t.createdAt),
  }),
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    input: jsonb("input").notNull(),
    pacchettiGenerati: jsonb("pacchetti_generati").notNull(),
    pacchettoScelto: varchar("pacchetto_scelto", { length: 40 }),
    prezzoTotale: integer("prezzo_totale"),
    acconto: integer("acconto"),
    stato: quoteStatusEnum("stato").notNull().default("draft"),
    stripeSessionId: varchar("stripe_session_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("quotes_lead_idx").on(t.leadId),
    statoIdx: index("quotes_stato_idx").on(t.stato),
    createdAtIdx: index("quotes_created_at_idx").on(t.createdAt),
    stripeSessionIdx: index("quotes_stripe_session_idx").on(t.stripeSessionId),
  }),
);

export const manuscriptAnalyses = pgTable(
  "manuscript_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 400 }).notNull(),
    wordCount: integer("word_count").notNull(),
    report: jsonb("report").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("analyses_lead_idx").on(t.leadId),
    expiresIdx: index("analyses_expires_idx").on(t.expiresAt),
    createdAtIdx: index("analyses_created_at_idx").on(t.createdAt),
  }),
);

export const agencyLeads = pgTable(
  "agency_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    nomeAgenzia: varchar("nome_agenzia", { length: 200 }).notNull(),
    sito: varchar("sito", { length: 320 }),
    serviziEsternalizzati: text("servizi_esternalizzati"),
    volumeStimato: varchar("volume_stimato", { length: 120 }),
  },
  (t) => ({
    leadIdx: index("agency_leads_lead_idx").on(t.leadId),
  }),
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type ManuscriptAnalysis = typeof manuscriptAnalyses.$inferSelect;
export type NewManuscriptAnalysis = typeof manuscriptAnalyses.$inferInsert;
export type AgencyLead = typeof agencyLeads.$inferSelect;
export type NewAgencyLead = typeof agencyLeads.$inferInsert;

/*
 * FASE 2-3
 * users, organizations, subscriptions, projects, project_stages, deliverables.
 * leads.user_id resta nullable per consentire al preventivo di diventare progetto
 * senza migrazioni distruttive.
 */
