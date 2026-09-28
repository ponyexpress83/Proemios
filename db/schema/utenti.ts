import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { ruoloEnum, tempi } from "./comuni";

/**
 * Identità applicativa. Una sola tabella per staff e clienti: il confine fra i
 * due passa dal ruolo e dai permessi, non da due sistemi di login separati che
 * finirebbero per divergere sulle regole di sicurezza.
 *
 * `organizationId` non è mai nullo: anche lo staff Proemios appartiene
 * all'organizzazione di tipo `studio`. Così il filtro di tenant è una sola
 * regola, senza eccezioni da ricordare.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    /*
     * `name` e `image` portano i nomi previsti dal contratto di Auth.js: sono
     * colonne di cui l'adapter è proprietario, e rinominarle significherebbe
     * mappare a mano ogni operazione dell'adapter. Il resto dello schema resta
     * in italiano.
     */
    name: varchar("name", { length: 200 }),
    image: text("image"),

    ruolo: ruoloEnum("ruolo").notNull().default("client"),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    attivo: boolean("attivo").notNull().default(true),
    /** Disattivazione con motivo: serve all'audit e alla schermata staff. */
    disattivatoAt: timestamp("disattivato_at", { withTimezone: true }),
    motivoDisattivazione: varchar("motivo_disattivazione", { length: 300 }),

    ultimoAccessoAt: timestamp("ultimo_accesso_at", { withTimezone: true }),
    /** Predisposizione MFA staff: attivabile senza migrazione. */
    mfaAbilitata: boolean("mfa_abilitata").notNull().default(false),
    mfaSegreto: text("mfa_segreto"),

    ...tempi,
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    orgIdx: index("users_organization_idx").on(t.organizationId),
    ruoloIdx: index("users_ruolo_idx").on(t.ruolo),
  }),
);

/* ── Tabelle richieste da Auth.js (adapter Drizzle) ───────────────────────── */

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 80 }),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    userIdx: index("accounts_user_idx").on(t.userId),
  }),
);

/**
 * Sessioni su database, non JWT: revocare l'accesso a una persona deve avere
 * effetto immediato, e un JWT già emesso resterebbe valido fino alla scadenza.
 */
export const sessions = pgTable(
  "sessions",
  {
    sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
    /** Metadati minimi per la schermata "sessioni attive": mai dati sensibili. */
    userAgent: varchar("user_agent", { length: 400 }),
    indirizzoIp: varchar("indirizzo_ip", { length: 64 }),
    creataAt: timestamp("creata_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userIdx: index("sessions_user_idx").on(t.userId) }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 320 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

/* ── Profilo staff ───────────────────────────────────────────────────────── */

/**
 * Dati specifici di chi lavora: non stanno su `users` perché riguardano una
 * minoranza delle righe e perché la scheda staff è visibile a ruoli diversi da
 * quelli che possono vedere l'anagrafica dei clienti.
 */
export const staffAccounts = pgTable(
  "staff_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titolo: varchar("titolo", { length: 120 }),
    specializzazioni: jsonb("specializzazioni").$type<string[]>().default([]),
    /** Capacità indicativa in parole a settimana, per assegnare i Job. */
    capacitaSettimanaleParole: integer("capacita_settimanale_parole"),
    noteInterne: text("note_interne"),
    ...tempi,
  },
  (t) => ({ userIdx: uniqueIndex("staff_accounts_user_idx").on(t.userId) }),
);

/* ── Inviti ──────────────────────────────────────────────────────────────── */

/**
 * Invito a entrare in piattaforma. Il token è conservato come hash: chi legge
 * il database non deve poter usare un invito altrui.
 */
export const inviti = pgTable(
  "inviti",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    ruolo: ruoloEnum("ruolo").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    invitatoDaId: uuid("invitato_da_id").references(() => users.id, { onDelete: "set null" }),
    scadeAt: timestamp("scade_at", { withTimezone: true }).notNull(),
    accettatoAt: timestamp("accettato_at", { withTimezone: true }),
    revocatoAt: timestamp("revocato_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    emailIdx: index("inviti_email_idx").on(t.email),
    tokenIdx: uniqueIndex("inviti_token_idx").on(t.tokenHash),
    orgIdx: index("inviti_organization_idx").on(t.organizationId),
  }),
);

export type Utente = typeof users.$inferSelect;
export type NuovoUtente = typeof users.$inferInsert;
export type ProfiloStaff = typeof staffAccounts.$inferSelect;
export type Invito = typeof inviti.$inferSelect;
export type NuovoInvito = typeof inviti.$inferInsert;
