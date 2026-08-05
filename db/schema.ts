/**
 * Schema Drizzle — Proemios.
 *
 * Fase 1: crea solo le tabelle usate ora (leads, quotes, manuscript_analyses,
 * agency_leads). Lo schema è però PROGETTATO per reggere le Fasi 2-3 senza
 * refactor: vedi il blocco "FASE 2-3" in fondo per le entità future
 * (users, organizations, subscriptions, projects, project_stages, deliverables).
 *
 * Principio guida: `leads` è l'entità di contatto neutra; in Fase 2 un lead potrà
 * essere collegato a un `user` (colonna user_id già prevista, nullable). Nulla di
 * ciò che scriviamo ora deve diventare un ostacolo per quelle entità.
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

// ------------------------------- Enums -------------------------------

export const leadSourceEnum = pgEnum("lead_source", [
  "preventivo",
  "analisi",
  "contatto",
  "agenzie",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "deposit_paid",
  "won",
  "lost",
]);

// ------------------------------- leads -------------------------------

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Predisposizione Fase 2: collegamento all'account utente (nullable finché non esiste).
    userId: uuid("user_id"),
    nome: varchar("nome", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    telefono: varchar("telefono", { length: 40 }),
    fonte: leadSourceEnum("fonte").notNull(),
    consensoPrivacy: boolean("consenso_privacy").notNull().default(false),
    consensoMarketing: boolean("consenso_marketing").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("leads_email_idx").on(t.email),
    fonteIdx: index("leads_fonte_idx").on(t.fonte),
    createdAtIdx: index("leads_created_at_idx").on(t.createdAt),
  }),
);

// ------------------------------- quotes -------------------------------

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Input del configuratore (PricingInput serializzato). */
    input: jsonb("input").notNull(),
    /** I tre pacchetti generati (QuoteResult.packages). */
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

// ------------------------- manuscript_analyses -------------------------

export const manuscriptAnalyses = pgTable(
  "manuscript_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 400 }).notNull(),
    wordCount: integer("word_count").notNull(),
    /** Report AI validato (non conserviamo il testo integrale del manoscritto). */
    report: jsonb("report").notNull(),
    /** Cancellazione automatica dopo MANUSCRIPT_RETENTION_DAYS. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("analyses_lead_idx").on(t.leadId),
    expiresIdx: index("analyses_expires_idx").on(t.expiresAt),
    createdAtIdx: index("analyses_created_at_idx").on(t.createdAt),
  }),
);

// ------------------------------ agency_leads ------------------------------

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

// ------------------------------ Tipi inferiti ------------------------------

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type ManuscriptAnalysis = typeof manuscriptAnalyses.$inferSelect;
export type NewManuscriptAnalysis = typeof manuscriptAnalyses.$inferInsert;
export type AgencyLead = typeof agencyLeads.$inferSelect;
export type NewAgencyLead = typeof agencyLeads.$inferInsert;

/*
 * ============================ FASE 2-3 (NON creare ora) ============================
 *
 * Queste entità NON vanno implementate in Fase 1. Sono documentate qui perché lo
 * schema attuale le regga senza riscritture. Quando si aggiungeranno:
 *
 *  users            id, email(unique), nome, created_at, ...    (magic link auth)
 *                   -> leads.user_id la referenzierà.
 *  organizations    id, nome, tipo('agency'|'studio'), ...      (portale white label)
 *  subscriptions    id, user_id|org_id, plan('free'|'pro'|'premium'),
 *                   period('monthly'|'annual'), status, stripe_subscription_id,
 *                   current_period_end, ...                     (abbonamenti AI)
 *  projects         id, user_id, quote_id, titolo, stato, ...   (dashboard cliente)
 *  project_stages   id, project_id, tipo('editing'|'cover'|'layout'|'isbn'|'kdp'),
 *                   stato, updated_at, ...
 *  deliverables     id, project_id, stage_id, filename, url, approvato, ...
 *
 * quotes.lead_id e leads (senza user obbligatorio) restano compatibili: un preventivo
 * potrà evolvere in project senza migrazioni distruttive.
 */
