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
} from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { users } from "./utenti";
import { leadSourceEnum, quoteStatusEnum, statoLeadEnum, tempi } from "./comuni";

/**
 * Anagrafica commerciale. Esiste anche senza account: un lead diventa cliente
 * prima di avere un login, e i dati di fatturazione arrivano dopo.
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    /** Account con cui il cliente accede al portale, quando ne ha uno. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    tipo: varchar("tipo", { length: 20 }).notNull().default("privato"), // privato | azienda
    nome: varchar("nome", { length: 200 }).notNull(),
    cognome: varchar("cognome", { length: 200 }),
    ragioneSociale: varchar("ragione_sociale", { length: 300 }),
    email: varchar("email", { length: 320 }).notNull(),
    telefono: varchar("telefono", { length: 40 }),

    /** Dati di fatturazione. Visibili solo a finance/operations/super_admin. */
    indirizzo: jsonb("indirizzo").$type<{
      via?: string;
      cap?: string;
      citta?: string;
      provincia?: string;
      paese?: string;
    }>(),
    partitaIva: varchar("partita_iva", { length: 30 }),
    codiceFiscale: varchar("codice_fiscale", { length: 30 }),
    codiceDestinatario: varchar("codice_destinatario", { length: 20 }),
    pec: varchar("pec", { length: 320 }),

    /**
     * Alias usato nei contesti in cui l'identità del cliente non serve al
     * lavoro: è il nome che vede un revisore al posto di quello vero.
     */
    alias: varchar("alias", { length: 80 }),

    noteCommerciali: text("note_commerciali"),
    ...tempi,
  },
  (t) => ({
    orgIdx: index("clients_organization_idx").on(t.organizationId),
    emailIdx: index("clients_email_idx").on(t.email),
    userIdx: index("clients_user_idx").on(t.userId),
  }),
);

/**
 * Lead. La tabella esisteva già dalla release Ads Ready: qui viene estesa con
 * tenant, proprietario, pipeline e valore, senza toccare le colonne esistenti
 * (la migrazione è additiva e reversibile).
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id"),
    nome: varchar("nome", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    telefono: varchar("telefono", { length: 40 }),
    fonte: leadSourceEnum("fonte").notNull(),
    /** Stato CRM storico, testuale. Resta per compatibilità con i dati esistenti. */
    stage: varchar("stage", { length: 40 }).notNull().default("new"),
    leadScore: integer("lead_score"),
    /**
     * Attribuzione di prima visita, scritta dalla release Ads Ready. Le chiavi
     * sono quelle di `LeadAttribution` in lib/attribution.ts: il tipo descrive
     * dati già presenti in database, non un formato nuovo.
     */
    attribution: jsonb("attribution").$type<import("@/lib/attribution").LeadAttribution>(),
    consensoPrivacy: boolean("consenso_privacy").notNull().default(false),
    consensoMarketing: boolean("consenso_marketing").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    // ── Estensioni Fase 2 ──
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    /** Pipeline tipizzata. `stage` resta la colonna storica; questa è quella usata. */
    stato: statoLeadEnum("stato").notNull().default("nuovo"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    valoreStimato: integer("valore_stimato"),
    ultimaAttivitaAt: timestamp("ultima_attivita_at", { withTimezone: true }),
    prossimaAttivitaAt: timestamp("prossima_attivita_at", { withTimezone: true }),
    prossimaAttivita: varchar("prossima_attivita", { length: 300 }),
    callPrenotataAt: timestamp("call_prenotata_at", { withTimezone: true }),
    persoMotivo: varchar("perso_motivo", { length: 300 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("leads_email_idx").on(t.email),
    fonteIdx: index("leads_fonte_idx").on(t.fonte),
    stageIdx: index("leads_stage_idx").on(t.stage),
    scoreIdx: index("leads_score_idx").on(t.leadScore),
    createdAtIdx: index("leads_created_at_idx").on(t.createdAt),
    statoIdx: index("leads_stato_idx").on(t.stato),
    ownerIdx: index("leads_owner_idx").on(t.ownerId),
    orgIdx: index("leads_organization_idx").on(t.organizationId),
  }),
);

/**
 * Diario del lead: ogni cambio di stato, nota, chiamata, email o conversione.
 * È la fonte della cronologia in scheda e della misura del funnel.
 */
export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tipo: varchar("tipo", { length: 60 }).notNull(),
    attoreId: uuid("attore_id").references(() => users.id, { onDelete: "set null" }),
    descrizione: varchar("descrizione", { length: 500 }),
    /** Payload sanitizzato: mai testo di manoscritto, mai segreti. */
    dettagli: jsonb("dettagli").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("lead_events_lead_idx").on(t.leadId),
    tipoIdx: index("lead_events_tipo_idx").on(t.tipo),
    createdAtIdx: index("lead_events_created_at_idx").on(t.createdAt),
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

    // ── Estensioni Fase 2 ──
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    /** Preventivo redatto a mano da un operatore, invece che dal configuratore. */
    redattoDaId: uuid("redatto_da_id").references(() => users.id, { onDelete: "set null" }),
    validoFinoAt: timestamp("valido_fino_at", { withTimezone: true }),
    noteInterne: text("note_interne"),
  },
  (t) => ({
    leadIdx: index("quotes_lead_idx").on(t.leadId),
    statoIdx: index("quotes_stato_idx").on(t.stato),
    createdAtIdx: index("quotes_created_at_idx").on(t.createdAt),
    stripeSessionIdx: index("quotes_stripe_session_idx").on(t.stripeSessionId),
    clientIdx: index("quotes_client_idx").on(t.clientId),
  }),
);

/**
 * Righe di preventivo. Il configuratore genera pacchetti interi in `quotes`;
 * questa tabella serve ai preventivi composti a mano e ai bundle di percorso,
 * dove ogni servizio deve essere quotato e discusso singolarmente.
 */
export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    /** Slug di config/catalogo.ts, oppure una voce libera. */
    servizioSlug: varchar("servizio_slug", { length: 80 }),
    descrizione: varchar("descrizione", { length: 300 }).notNull(),
    quantita: integer("quantita").notNull().default(1),
    /** Importi in centesimi: sui prezzi non si usano float. */
    prezzoUnitarioCent: integer("prezzo_unitario_cent").notNull(),
    scontoCent: integer("sconto_cent").notNull().default(0),
    totaleCent: integer("totale_cent").notNull(),
    ordine: integer("ordine").notNull().default(0),
    ...tempi,
  },
  (t) => ({ quoteIdx: index("quote_items_quote_idx").on(t.quoteId) }),
);

/** Analisi manoscritto del lead magnet. Esiste dalla release precedente. */
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

/** Richieste dalle agenzie prima che diventino organizzazioni. */
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
    /** Organizzazione creata alla conversione dell'agenzia. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({ leadIdx: index("agency_leads_lead_idx").on(t.leadId) }),
);

export type Cliente = typeof clients.$inferSelect;
export type NuovoCliente = typeof clients.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type EventoLead = typeof leadEvents.$inferSelect;
export type NuovoEventoLead = typeof leadEvents.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type RigaPreventivo = typeof quoteItems.$inferSelect;
export type ManuscriptAnalysis = typeof manuscriptAnalyses.$inferSelect;
export type NewManuscriptAnalysis = typeof manuscriptAnalyses.$inferInsert;
export type AgencyLead = typeof agencyLeads.$inferSelect;
export type NewAgencyLead = typeof agencyLeads.$inferInsert;
