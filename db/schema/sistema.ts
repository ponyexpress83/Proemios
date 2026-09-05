import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { users } from "./utenti";
import { canaleNotificaEnum, tempi } from "./comuni";

/**
 * Registro degli eventi rilevanti per sicurezza e conformità.
 *
 * Regole non negoziabili, applicate da lib/audit:
 *  - `metadati` è sanitizzato: mai testo di manoscritto, mai PII oltre gli
 *    identificativi, mai segreti, mai prompt;
 *  - la riga non si aggiorna e non si cancella: l'audit è append-only;
 *  - l'attore può mancare (eventi di sistema), l'azione mai.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    attoreId: uuid("attore_id").references(() => users.id, { onDelete: "set null" }),
    /** Ruolo al momento del fatto: il ruolo dell'utente può cambiare dopo. */
    attoreRuolo: varchar("attore_ruolo", { length: 40 }),

    azione: varchar("azione", { length: 80 }).notNull(),
    /** Tipo e identificativo dell'oggetto toccato: project, file_version, payment… */
    entita: varchar("entita", { length: 60 }),
    entitaId: uuid("entita_id"),

    esito: varchar("esito", { length: 20 }).notNull().default("ok"),
    metadati: jsonb("metadati").$type<Record<string, unknown>>(),

    indirizzoIp: varchar("indirizzo_ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 400 }),
    /** Correla le righe prodotte dalla stessa richiesta HTTP o dallo stesso job. */
    richiestaId: varchar("richiesta_id", { length: 64 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    attoreIdx: index("audit_events_attore_idx").on(t.attoreId),
    azioneIdx: index("audit_events_azione_idx").on(t.azione),
    entitaIdx: index("audit_events_entita_idx").on(t.entita, t.entitaId),
    createdAtIdx: index("audit_events_created_at_idx").on(t.createdAt),
    orgIdx: index("audit_events_organization_idx").on(t.organizationId),
  }),
);

/**
 * Centro notifiche interno e verso il cliente. La stessa riga alimenta la
 * campanella in piattaforma e, se `canale` lo prevede, l'email.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    destinatarioId: uuid("destinatario_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    tipo: varchar("tipo", { length: 60 }).notNull(),
    canale: canaleNotificaEnum("canale").notNull().default("in_app"),
    titolo: varchar("titolo", { length: 200 }).notNull(),
    corpo: text("corpo"),
    /** Rotta interna a cui porta la notifica. Mai un URL esterno. */
    percorso: varchar("percorso", { length: 300 }),

    entita: varchar("entita", { length: 60 }),
    entitaId: uuid("entita_id"),

    lettaAt: timestamp("letta_at", { withTimezone: true }),
    inviataAt: timestamp("inviata_at", { withTimezone: true }),
    erroreInvio: varchar("errore_invio", { length: 300 }),
    ...tempi,
  },
  (t) => ({
    destinatarioIdx: index("notifications_destinatario_idx").on(t.destinatarioId),
    lettaIdx: index("notifications_letta_idx").on(t.lettaAt),
    createdAtIdx: index("notifications_created_at_idx").on(t.createdAt),
  }),
);

/**
 * Policy privacy di un provider AI. Un modello non passa il routing se il suo
 * provider non ha una policy verificata e adatta al tipo di Job.
 * Vive in database, non in codice, perché cambia senza rilasci e deve lasciare
 * traccia di chi l'ha rivista e quando.
 */
export const providerPolicies = pgTable(
  "provider_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 40 }).notNull(),
    modello: varchar("modello", { length: 120 }),

    addestramentoConsentito: boolean("addestramento_consentito").notNull().default(false),
    zeroDataRetention: boolean("zero_data_retention").notNull().default(false),
    giorniConservazione: varchar("giorni_conservazione", { length: 20 }),
    dpaDisponibile: boolean("dpa_disponibile").notNull().default(false),
    regioneDati: varchar("regione_dati", { length: 60 }),
    subresponsabili: jsonb("subresponsabili").$type<string[]>().default([]),

    approvatoManoscrittiInediti: boolean("approvato_manoscritti_inediti").notNull().default(false),
    approvatoProgettiSensibili: boolean("approvato_progetti_sensibili").notNull().default(false),

    note: text("note"),
    rivistoAt: timestamp("rivisto_at", { withTimezone: true }),
    rivistoDaId: uuid("rivisto_da_id").references(() => users.id, { onDelete: "set null" }),
    ...tempi,
  },
  (t) => ({ providerIdx: index("provider_policies_provider_idx").on(t.provider) }),
);

export type EventoAudit = typeof auditEvents.$inferSelect;
export type NuovoEventoAudit = typeof auditEvents.$inferInsert;
export type Notifica = typeof notifications.$inferSelect;
export type NuovaNotifica = typeof notifications.$inferInsert;
export type PolicyProvider = typeof providerPolicies.$inferSelect;

/**
 * Contatori per la limitazione della frequenza delle richieste.
 *
 * In database e non in memoria: su un runtime serverless ogni istanza ha la
 * propria memoria, e un contatore per istanza si aggira aprendo connessioni
 * finché non se ne prende una fresca. Un limite che si aggira così non è un
 * limite.
 *
 * La chiave contiene un hash dell'origine, non l'origine: un elenco di
 * indirizzi IP in chiaro è un dato personale che non serve conservare — per
 * contare basta sapere che due richieste vengono dalla stessa parte.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    chiave: varchar("chiave", { length: 120 }).primaryKey(),
    conteggio: integer("conteggio").notNull().default(0),
    finestraInizio: timestamp("finestra_inizio", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    finestraIdx: index("rate_limits_finestra_idx").on(t.finestraInizio),
  }),
);

export type LimiteRichieste = typeof rateLimits.$inferSelect;
