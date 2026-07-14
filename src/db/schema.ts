import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────
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
  "rejected",
]);

// ─── leads ────────────────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  telefono: text("telefono"),
  fonte: leadSourceEnum("fonte").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── quotes ───────────────────────────────────────────────────────────────
export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  // Input grezzo del configuratore (tipo progetto, servizi, lunghezza, ecc.)
  input: jsonb("input").notNull(),
  // I tre pacchetti calcolati (Essenziale / Consigliato / Signature)
  pacchetti: jsonb("pacchetti").notNull(),
  // Chiave del pacchetto scelto dal cliente al checkout
  pacchettoScelto: text("pacchetto_scelto"),
  stato: quoteStatusEnum("stato").notNull().default("draft"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── manuscript_analyses ──────────────────────────────────────────────────
export const manuscriptAnalyses = pgTable("manuscript_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  wordCount: integer("word_count").notNull(),
  report: jsonb("report").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── posts (blog su DB) ───────────────────────────────────────────────────
export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  titolo: text("titolo").notNull(),
  estratto: text("estratto"),
  contenuto: text("contenuto"), // MDX/markdown; null = solo outline
  outline: jsonb("outline"), // array di sezioni TODO in Fase 1
  categoria: text("categoria"),
  pubblicato: timestamp("pubblicato", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Tipi inferiti ────────────────────────────────────────────────────────
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type ManuscriptAnalysis = typeof manuscriptAnalyses.$inferSelect;
export type NewManuscriptAnalysis = typeof manuscriptAnalyses.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
