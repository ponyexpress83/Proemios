import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";
import type { Grant, Role } from "@/lib/platform/permissions";

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const memberships = pgTable(
  "platform_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    grants: jsonb("grants").$type<Grant[] | null>(),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("membership_user_role_idx").on(t.userId, t.role)],
);
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updated(),
});
export const auditEvents = pgTable(
  "platform_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: created(),
  },
  (t) => [index("audit_actor_idx").on(t.actorId), index("audit_created_idx").on(t.createdAt)],
);
export const staffInvitations = pgTable("platform_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  role: text("role").$type<Role>().notNull(),
  grants: jsonb("grants").$type<Grant[] | null>(),
  tokenHash: text("token_hash").notNull().unique(),
  projectIds: jsonb("project_ids").$type<string[]>().notNull().default([]),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => user.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  acceptedBy: text("accepted_by"),
  acceptedSellerId: text("accepted_seller_id").references(() => user.id),
  createdAt: created(),
});
export const projects = pgTable(
  "platform_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull().default("romanzo"),
    stage: text("stage").notNull().default("brief"),
    quoteId: uuid("quote_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    remindersPausedAt: timestamp("reminders_paused_at", { withTimezone: true }),
    /** Chi segue l'autore (il venditore della proposta o chi viene assegnato dopo). */
    referentId: text("referent_id").references(() => user.id),
    /** Da quale incasso parte la lavorazione: deposit (acconto) o balance (saldo). */
    startCondition: text("start_condition").notNull().default("deposit"),
    /** Quando la condizione economica di avvio è stata soddisfatta. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("project_author_idx").on(t.authorId),
    // Un solo progetto per proposta pagata: il vincolo vale a livello di database.
    uniqueIndex("project_quote_idx").on(t.quoteId).where(sql`${t.quoteId} is not null`),
  ],
);
export const projectMembers = pgTable(
  "platform_project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
  },
  (t) => [uniqueIndex("project_member_idx").on(t.projectId, t.userId)],
);
export const projectFiles = pgTable(
  "platform_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    hash: text("hash").notNull(),
    storageKey: text("storage_key").notNull(),
    version: integer("version").notNull().default(1),
    previousId: uuid("previous_id"),
    kind: text("kind").notNull().default("manuscript"),
    status: text("status").notNull().default("quarantine"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    index("file_project_idx").on(t.projectId),
    uniqueIndex("file_version_idx").on(t.projectId, t.name, t.version),
  ],
);
export const approvals = pgTable(
  "platform_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    fileId: uuid("file_id")
      .notNull()
      .references(() => projectFiles.id),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    decision: text("decision").notNull(),
    comment: text("comment"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("approval_file_author_idx").on(t.fileId, t.authorId)],
);
export const messages = pgTable(
  "platform_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    internal: boolean("internal").notNull().default(false),
    createdAt: created(),
  },
  (t) => [index("message_project_idx").on(t.projectId)],
);
export const messageReads = pgTable(
  "platform_message_reads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("message_read_idx").on(t.messageId, t.userId)],
);
export const tasks = pgTable("platform_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id),
  leadId: uuid("lead_id"),
  assignedTo: text("assigned_to")
    .notNull()
    .references(() => user.id),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  internal: boolean("internal").notNull().default(true),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: created(),
});
export const leadOwnership = pgTable("platform_lead_ownership", {
  leadId: uuid("lead_id").primaryKey(),
  authorId: text("author_id").references(() => user.id),
  assignedTo: text("assigned_to").references(() => user.id),
  updatedAt: updated(),
});
/**
 * Storia del contatto: attività manuali (telefonate, WhatsApp, SMS, incontri),
 * cambi di stato, assegnazioni, automazioni inviate, importazioni. Le note
 * libere restano in platform_lead_notes; qui ogni riga ha un tipo e un canale.
 */
export const leadActivities = pgTable(
  "platform_lead_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id").notNull(),
    actorId: text("actor_id").references(() => user.id),
    kind: text("kind").notNull(),
    channel: text("channel"),
    direction: text("direction").notNull().default("outbound"),
    purpose: text("purpose"),
    body: text("body"),
    outcome: text("outcome"),
    eventKey: text("event_key").unique(),
    createdAt: created(),
  },
  (t) => [index("lead_activity_lead_idx").on(t.leadId, t.createdAt)],
);
export const leadNotes = pgTable("platform_lead_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  body: text("body").notNull(),
  createdAt: created(),
});
export const quoteRecords = pgTable("platform_quote_records", {
  quoteId: uuid("quote_id").primaryKey(),
  createdBy: text("created_by").references(() => user.id),
  pricingVersion: text("pricing_version").notNull(),
  version: integer("version").notNull().default(1),
  shareHash: text("share_hash").unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  selectedTier: text("selected_tier"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: text("accepted_by"),
  acceptedSellerId: text("accepted_seller_id").references(() => user.id),
  termsVersion: text("terms_version"),
  createdAt: created(),
  taxPolicy: jsonb("tax_policy"),
  commissionPolicy: jsonb("commission_policy"),
  /**
   * Stato commerciale, distinto dal pagamento e dal progetto:
   * estimate (stima indicativa) · review (in valutazione dal team) ·
   * offer (proposta definitiva acquistabile) · accepted (accettata).
   * Le righe nate prima di questa colonna valgono come proposte del team.
   */
  commercialState: text("commercial_state").notNull().default("offer"),
  reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  offeredAt: timestamp("offered_at", { withTimezone: true }),
  offeredBy: text("offered_by").references(() => user.id),
  /** Pacchetto scelto prima di avere un account: si conserva fino alla conferma. */
  preferredTier: text("preferred_tier"),
  /** Un venditore ha lavorato la proposta (revisione, invio, offerta): non la sola assegnazione del contatto. */
  salesAssisted: boolean("sales_assisted").notNull().default(false),
  remindersPausedAt: timestamp("reminders_paused_at", { withTimezone: true }),
  /**
   * Rateizzazione concessa dall'azienda sul saldo (distinta dalle rate che il
   * cliente ottiene da Klarna/Scalapay dentro Stripe, che per noi restano un
   * pagamento unico). Null: acconto + saldo.
   */
  paymentPlan: jsonb("payment_plan").$type<PaymentPlan>(),
  /** Sconto commerciale applicato dal team entro le soglie (basis points), con chi lo ha concesso. */
  discountBps: integer("discount_bps").notNull().default(0),
  discountBy: text("discount_by").references(() => user.id),
  discountNote: text("discount_note"),
  discountApprovedBy: text("discount_approved_by").references(() => user.id),
});
export type PaymentPlan = {
  installments: number;
  grantedBy: string;
  grantedAt: string;
  approvedBy?: string | null;
  note?: string | null;
};
export const quoteClaims = pgTable("platform_quote_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: created(),
});
export const affiliateProfiles = pgTable("platform_affiliates", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  code: text("code").notNull().unique(),
  active: boolean("active").notNull().default(false),
  createdAt: created(),
});
export const affiliateConversions = pgTable("platform_affiliate_conversions", {
  id: uuid("id").defaultRandom().primaryKey(),
  affiliateId: text("affiliate_id")
    .notNull()
    .references(() => user.id),
  quoteId: uuid("quote_id").notNull().unique(),
  ruleVersion: text("rule_version").notNull(),
  createdAt: created(),
});
export const paymentOrders = pgTable("platform_payment_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  tier: text("tier").notNull(),
  kind: text("kind").notNull().default("deposit"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("eur"),
  status: text("status").notNull().default("pending"),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  /** Numero della rata dello stesso tipo (1 per acconto e saldo unico). */
  sequence: integer("sequence").notNull().default(1),
  /** standard: acconto o saldo; company_installment: rata concessa dall'azienda. */
  plan: text("plan").notNull().default("standard"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  /** Metodo con cui Stripe ha confermato l'incasso (card, klarna, customer_balance…), se noto. */
  paymentMethod: text("payment_method"),
  createdAt: created(),
  updatedAt: updated(),
});
export const webhookEvents = pgTable("platform_webhook_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("processed"),
  createdAt: created(),
});
export const ledgerEntries = pgTable("platform_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => paymentOrders.id),
  eventKey: text("event_key").notNull().unique(),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("eur"),
  reference: text("reference"),
  createdAt: created(),
});
export const commissions = pgTable("platform_commissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  beneficiaryId: text("beneficiary_id")
    .notNull()
    .references(() => user.id),
  orderId: uuid("order_id")
    .notNull()
    .references(() => paymentOrders.id),
  eventKey: text("event_key").notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  ruleVersion: text("rule_version").notNull(),
  status: text("status").notNull().default("pending"),
  paymentReference: text("payment_reference"),
  createdAt: created(),
});
export const notifications = pgTable("platform_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  read: boolean("read").notNull().default(false),
  createdAt: created(),
});
export const emailOutbox = pgTable("platform_email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  replyTo: text("reply_to"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastError: text("last_error"),
  providerId: text("provider_id"),
  /** Allegati su supporto durevole (es. contratto): riferimenti allo storage privato, mai il contenuto. */
  attachments: jsonb("attachments").$type<Array<{ filename: string; storageKey: string; mime: string }>>(),
  createdAt: created(),
});
export const operationKeys = pgTable("platform_operation_keys", {
  key: text("key").primaryKey(),
  actorId: text("actor_id"),
  requestHash: text("request_hash").notNull(),
  result: jsonb("result"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
});
export const requestLimits = pgTable("platform_request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
});
export const dataRequests = pgTable("platform_data_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: created(),
});

export const quoteVersions = pgTable("platform_quote_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull(),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdBy: text("created_by").references(() => user.id),
  createdAt: created(),
}, t => [uniqueIndex("quote_version_idx").on(t.quoteId, t.version)]);
export const accountPreferences = pgTable("platform_account_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id),
  optionalEmail: boolean("optional_email").notNull().default(false),
  savedFilters: jsonb("saved_filters").$type<Record<string, string>>().notNull().default({}),
  updatedAt: updated(),
});
export const analysisJobs = pgTable("platform_analysis_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  operationKey: text("operation_key").notNull().unique(),
  requestHash: text("request_hash").notNull(),
  filename: text("filename").notNull(),
  sourceKey: text("source_key"),
  metrics: jsonb("metrics").notNull(),
  status: text("status").notNull().default("queued"),
  report: jsonb("report"),
  attempts: integer("attempts").notNull().default(0),
  errorCode: text("error_code"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
  updatedAt: updated(),
}, t => [index("analysis_user_idx").on(t.userId), index("analysis_status_idx").on(t.status)]);
export const refundRequests = pgTable("platform_refund_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => paymentOrders.id),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason").notNull(),
  preparedBy: text("prepared_by").notNull().references(() => user.id),
  authorizedBy: text("authorized_by").references(() => user.id),
  /** prepared → authorized (richiesta a Stripe) → executed (evento refund.succeeded) | failed */
  status: text("status").notNull().default("prepared"),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  stripeRefundId: text("stripe_refund_id").unique(),
  lastError: text("last_error"),
  createdAt: created(),
  updatedAt: updated(),
});
/**
 * Contratto concluso online: scheda d'ordine strutturata + condizioni generali
 * nella versione accettata, con prova proporzionata dell'accettazione. La copia
 * stabile (PDF) sta nello storage privato; qui restano snapshot e impronte.
 */
export const contracts = pgTable(
  "platform_contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id").notNull(),
    version: integer("version").notNull(),
    tier: text("tier").notNull(),
    authorId: text("author_id").notNull().references(() => user.id),
    termsVersion: text("terms_version").notNull(),
    termsHash: text("terms_hash").notNull(),
    orderSheet: jsonb("order_sheet").$type<OrderSheet>().notNull(),
    orderSheetHash: text("order_sheet_hash").notNull(),
    storageKey: text("storage_key"),
    pdfHash: text("pdf_hash"),
    acceptances: jsonb("acceptances").$type<ContractAcceptances>().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    acceptedIp: text("accepted_ip"),
    acceptedUserAgent: text("accepted_user_agent"),
    /** Cliente consumatore (persona fisica senza partita IVA): tutele del Codice del Consumo. */
    consumer: boolean("consumer").notNull().default(true),
    withdrawalDeadline: timestamp("withdrawal_deadline", { withTimezone: true }),
    withdrawalRequestedAt: timestamp("withdrawal_requested_at", { withTimezone: true }),
    withdrawalNote: text("withdrawal_note"),
    withdrawalHandledAt: timestamp("withdrawal_handled_at", { withTimezone: true }),
    withdrawalOutcome: text("withdrawal_outcome"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("contract_quote_version_idx").on(t.quoteId, t.version), index("contract_author_idx").on(t.authorId)],
);
/**
 * Registro delle campagne: ogni campagna ha UTM propri e un link tracciato.
 * L'attribuzione a lead, proposte e incassi avviene per id di campagna (parametro
 * «pc» del link) o, in mancanza, per corrispondenza degli UTM. La spesa arriva
 * da import CSV o inserimento manuale, mai da collegamenti pubblicitari automatici.
 */
export const campaigns = pgTable(
  "platform_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    channel: text("channel").notNull().default("other"),
    status: text("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    destination: text("destination").notNull().default("/preventivo"),
    utmSource: text("utm_source").notNull(),
    utmMedium: text("utm_medium").notNull(),
    utmCampaign: text("utm_campaign").notNull(),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    partnerId: text("partner_id").references(() => user.id),
    sellerId: text("seller_id").references(() => user.id),
    budgetCents: integer("budget_cents").notNull().default(0),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("campaign_utm_idx").on(t.utmSource, t.utmMedium, t.utmCampaign)],
);
export const campaignSpend = pgTable(
  "platform_campaign_spend",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    spendCents: integer("spend_cents").notNull().default(0),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    source: text("source").notNull().default("manual"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: created(),
  },
  (t) => [uniqueIndex("campaign_spend_day_idx").on(t.campaignId, t.day, t.source)],
);
export type ContractAcceptances = {
  terms: true;
  orderSheet: true;
  earlyStart: boolean;
  marketing: boolean;
};
export type OrderSheetLine = { key: string; label: string; amount: number };
export type OrderSheet = {
  reference: string;
  quoteVersion: number;
  pricingVersion: string;
  policyVersion: string;
  termsVersion: string;
  service: string;
  projectType: string;
  packageName: string;
  tier: string;
  quantity: { wordCount: number; textState: string; urgency: string };
  lines: OrderSheetLine[];
  includes: string[];
  excludes: string[];
  revisions: string;
  deliveries: string;
  deadlines: string;
  startConditions: string;
  amounts: { vatMode: string; vatRateBps: number; netCents: number; taxCents: number; grossCents: number; depositCents: number; balanceCents: number };
  installments: Array<{ kind: "deposit" | "balance"; sequence: number; amountCents: number; label: string }>;
  customer: { name: string; kind: string; taxCode: string | null; vatNumber: string | null; address: string; email: string } | null;
  supplier: { name: string; legalForm: string; address: string; vat: string; email: string };
  earlyStartText: string;
  withdrawalText: string;
};
/** Dati di fatturazione dell'autore: senza, nessun incasso può diventare fattura. */
export const billingProfiles = pgTable("platform_billing_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id),
  kind: text("kind").notNull().default("private"),
  name: text("name").notNull(),
  taxCode: text("tax_code"),
  vatNumber: text("vat_number"),
  street: text("street").notNull(),
  postcode: text("postcode").notNull(),
  city: text("city").notNull(),
  province: text("province"),
  country: text("country").notNull().default("IT"),
  sdiCode: text("sdi_code"),
  pec: text("pec"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: created(),
  updatedAt: updated(),
});
/**
 * Fatture emesse su Fatture in Cloud per ogni incasso confermato. La riga
 * nasce "queued" dentro la transazione del webhook; la chiamata esterna avviene
 * dopo, con tentativi ripetuti dal cron, così un errore dell'API non blocca
 * mai la registrazione dell'incasso.
 */
export const invoices = pgTable("platform_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().unique().references(() => paymentOrders.id),
  authorId: text("author_id").notNull().references(() => user.id),
  quoteId: uuid("quote_id").notNull(),
  kind: text("kind").notNull(),
  grossCents: integer("gross_cents").notNull(),
  netCents: integer("net_cents").notNull(),
  taxCents: integer("tax_cents").notNull(),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("queued"),
  ficDocumentId: integer("fic_document_id"),
  number: text("number"),
  issuedOn: text("issued_on"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: created(),
  updatedAt: updated(),
}, t => [index("invoices_author_idx").on(t.authorId), index("invoices_status_idx").on(t.status)]);

/**
 * Misurazione del percorso di acquisto. Gli eventi "ui" arrivano dal browser
 * (senza cookie, IP o identità); quelli "economic" li scrive il server quando
 * un fatto è verificato (email verificata, accettazione, checkout, incasso).
 */
export const funnelEvents = pgTable("platform_funnel_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("ui"),
  quoteId: uuid("quote_id"),
  visitorKey: text("visitor_key"),
  meta: jsonb("meta"),
  createdAt: created(),
}, t => [index("funnel_name_idx").on(t.name, t.createdAt)]);
