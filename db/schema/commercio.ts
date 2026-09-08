import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizzazioni";
import { users } from "./utenti";
import { clients, quotes } from "./crm";
import {
  metodoPagamentoEnum,
  statoContrattoEnum,
  statoFatturaEnum,
  statoOrdineEnum,
  statoPagamentoEnum,
  tempi,
  tipoPagamentoEnum,
} from "./comuni";

/**
 * Ordine: il preventivo accettato che diventa impegno. Tutti gli importi sono
 * in centesimi di euro, IVA esclusa dove non indicato diversamente.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Codice leggibile mostrato al cliente e citato nelle email: O-2026-0001. */
    codice: varchar("codice", { length: 30 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),

    stato: statoOrdineEnum("stato").notNull().default("bozza"),
    imponibileCent: integer("imponibile_cent").notNull(),
    ivaCent: integer("iva_cent").notNull().default(0),
    totaleCent: integer("totale_cent").notNull(),
    /** Percentuale di acconto applicata, in punti base (4000 = 40%). */
    accontoPuntiBase: integer("acconto_punti_base").notNull(),
    accontoCent: integer("acconto_cent").notNull(),

    creatoDaId: uuid("creato_da_id").references(() => users.id, { onDelete: "set null" }),
    confermatoAt: timestamp("confermato_at", { withTimezone: true }),
    noteInterne: text("note_interne"),
    ...tempi,
  },
  (t) => ({
    codiceIdx: uniqueIndex("orders_codice_idx").on(t.codice),
    orgIdx: index("orders_organization_idx").on(t.organizationId),
    clientIdx: index("orders_client_idx").on(t.clientId),
    statoIdx: index("orders_stato_idx").on(t.stato),
  }),
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    stato: statoContrattoEnum("stato").notNull().default("bozza"),
    versione: integer("versione").notNull().default(1),
    /** Testo del contratto al momento dell'invio: congelato, non un riferimento. */
    testo: text("testo"),
    /** Chiave di storage del PDF firmato. Il file non sta in database. */
    chiaveDocumento: varchar("chiave_documento", { length: 500 }),
    inviatoAt: timestamp("inviato_at", { withTimezone: true }),
    firmatoAt: timestamp("firmato_at", { withTimezone: true }),
    firmatoDa: varchar("firmato_da", { length: 200 }),
    ...tempi,
  },
  (t) => ({
    orderIdx: index("contracts_order_idx").on(t.orderId),
    orgIdx: index("contracts_organization_idx").on(t.organizationId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    /** Milestone a cui il pagamento è legato, quando è un pagamento a stato avanzamento. */
    milestoneId: uuid("milestone_id"),

    tipo: tipoPagamentoEnum("tipo").notNull(),
    metodo: metodoPagamentoEnum("metodo").notNull().default("stripe"),
    stato: statoPagamentoEnum("stato").notNull().default("in_attesa"),
    importoCent: integer("importo_cent").notNull(),
    valuta: varchar("valuta", { length: 3 }).notNull().default("EUR"),

    /** Riferimenti Stripe. Mai chiavi API, solo identificativi di oggetti. */
    stripeSessionId: varchar("stripe_session_id", { length: 255 }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),

    /** Estremi del bonifico, quando il pagamento è fuori Stripe. */
    riferimentoEsterno: varchar("riferimento_esterno", { length: 200 }),
    registratoDaId: uuid("registrato_da_id").references(() => users.id, { onDelete: "set null" }),

    pagatoAt: timestamp("pagato_at", { withTimezone: true }),
    rimborsatoAt: timestamp("rimborsato_at", { withTimezone: true }),
    importoRimborsatoCent: integer("importo_rimborsato_cent").notNull().default(0),
    scadenzaAt: timestamp("scadenza_at", { withTimezone: true }),
    ...tempi,
  },
  (t) => ({
    orgIdx: index("payments_organization_idx").on(t.organizationId),
    orderIdx: index("payments_order_idx").on(t.orderId),
    statoIdx: index("payments_stato_idx").on(t.stato),
    sessionIdx: index("payments_stripe_session_idx").on(t.stripeSessionId),
    intentIdx: index("payments_stripe_intent_idx").on(t.stripePaymentIntentId),
  }),
);

/**
 * Fattura. Proemios non emette il documento: lo fa il provider di fatturazione
 * (Fatture in Cloud). Qui vive lo stato dell'emissione e il riferimento
 * restituito, così la piattaforma sa cosa è stato emesso senza duplicare il
 * documento fiscale.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),

    stato: statoFatturaEnum("stato").notNull().default("da_emettere"),
    imponibileCent: integer("imponibile_cent").notNull(),
    ivaCent: integer("iva_cent").notNull().default(0),
    totaleCent: integer("totale_cent").notNull(),

    /** Identificativo presso il provider e numero del documento emesso. */
    providerNome: varchar("provider_nome", { length: 60 }),
    providerDocumentoId: varchar("provider_documento_id", { length: 120 }),
    numeroDocumento: varchar("numero_documento", { length: 60 }),
    dataDocumento: timestamp("data_documento", { withTimezone: true }),
    urlDocumento: text("url_documento"),

    /** Anagrafica di fatturazione congelata al momento dell'emissione. */
    datiFatturazione: jsonb("dati_fatturazione").$type<Record<string, unknown>>(),
    erroreMessaggio: varchar("errore_messaggio", { length: 500 }),
    tentativi: integer("tentativi").notNull().default(0),
    ...tempi,
  },
  (t) => ({
    orgIdx: index("invoices_organization_idx").on(t.organizationId),
    clientIdx: index("invoices_client_idx").on(t.clientId),
    statoIdx: index("invoices_stato_idx").on(t.stato),
  }),
);

export type Ordine = typeof orders.$inferSelect;
export type NuovoOrdine = typeof orders.$inferInsert;
export type Contratto = typeof contracts.$inferSelect;
export type Pagamento = typeof payments.$inferSelect;
export type NuovoPagamento = typeof payments.$inferInsert;
export type Fattura = typeof invoices.$inferSelect;
