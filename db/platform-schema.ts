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
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("project_author_idx").on(t.authorId)],
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
});
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
  status: text("status").notNull().default("prepared"),
  createdAt: created(),
  updatedAt: updated(),
});
