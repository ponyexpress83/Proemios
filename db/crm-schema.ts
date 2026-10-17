/**
 * CRM: contatti, aziende, trattative, assegnazioni, attribuzioni, profili del
 * team, link protetti, approvazioni, passaggio operativo, configurazione e
 * interfacce di integrazione. Scelta di isolamento: un'azienda per
 * installazione (vedi docs/CRM_ARCHITETTURA.md); nessuna colonna tenant finché
 * l'isolamento completo non è implementato e testato.
 */
import { pgTable, text, uuid, timestamp, jsonb, integer, boolean, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";
import type { Absence, BusinessHours } from "@/lib/crm-core/hours";

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
type Custom = Record<string, string | number | boolean | null>;

export const crmCompanies = pgTable("crm_companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  vatNumber: text("vat_number"),
  website: text("website"),
  custom: jsonb("custom").$type<Custom>().notNull().default({}),
  createdAt: created(),
  updatedAt: updated(),
});
/** La persona: una sola scheda per email normalizzata (le schede unite restano, con il rimando). */
export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    companyId: uuid("company_id"),
    /** Account collegato solo quando l'email è verificata dalla persona stessa. */
    userId: text("user_id").references(() => user.id),
    identityVerifiedAt: ts("identity_verified_at"),
    language: text("language").notNull().default("it"),
    mergedIntoId: uuid("merged_into_id"),
    custom: jsonb("custom").$type<Custom>().notNull().default({}),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("crm_contact_email_idx").on(t.emailNormalized).where(sql`${t.mergedIntoId} is null`),
    index("crm_contact_phone_idx").on(t.phoneNormalized),
    index("crm_contact_user_idx").on(t.userId),
  ],
);
/** L'opportunità: un contatto ne ha molte, una trattativa ha molte proposte. */
export const crmDeals = pgTable(
  "crm_deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id").notNull(),
    originLeadId: uuid("origin_lead_id"),
    title: text("title").notNull(),
    pipelineKey: text("pipeline_key").notNull().default("vendite"),
    /** Fase impostata a mano; le fasi derivate (proposta, accettazione, incasso) vengono dai fatti. */
    stage: text("stage").notNull().default("received"),
    ownerId: text("owner_id").references(() => user.id),
    priority: text("priority").notNull().default("normal"),
    nextAction: text("next_action"),
    nextActionAt: ts("next_action_at"),
    lostReasonKey: text("lost_reason_key"),
    lostNote: text("lost_note"),
    closedAt: ts("closed_at"),
    lastActivityAt: ts("last_activity_at"),
    custom: jsonb("custom").$type<Custom>().notNull().default({}),
    createdBy: text("created_by").references(() => user.id),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("crm_deal_contact_idx").on(t.contactId), index("crm_deal_owner_idx").on(t.ownerId), index("crm_deal_next_idx").on(t.nextActionAt)],
);
/** Storia di ogni assegnazione (richieste, trattative, progetti, compiti): chi, a chi, come, perché, con quale regola. */
export const crmAssignments = pgTable(
  "crm_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fromUser: text("from_user"),
    toUser: text("to_user"),
    method: text("method").notNull(),
    reason: text("reason").notNull(),
    ruleVersion: text("rule_version"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    actorId: text("actor_id"),
    createdAt: created(),
  },
  (t) => [index("crm_assignment_entity_idx").on(t.entityType, t.entityId, t.createdAt), index("crm_assignment_to_idx").on(t.toUser, t.createdAt)],
);
/** Istantanea dell'attribuzione alla vendita. Le correzioni creano una nuova versione, mai una sovrascrittura. */
export const crmAttributions = pgTable(
  "crm_attributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id").notNull(),
    version: integer("version").notNull().default(1),
    current: boolean("current").notNull().default(true),
    dealId: uuid("deal_id"),
    contactId: uuid("contact_id"),
    path: text("path").notNull(),
    marketing: jsonb("marketing").$type<Record<string, unknown>>(),
    affiliateId: text("affiliate_id"),
    sourcerId: text("sourcer_id"),
    ownerAtSale: text("owner_at_sale"),
    creditedSellerId: text("credited_seller_id"),
    closing: text("closing").notNull(),
    status: text("status").notNull(),
    reasons: jsonb("reasons").$type<Array<{ code: string; detail: string }>>().notNull().default([]),
    conflicts: jsonb("conflicts").$type<Array<{ code: string; detail: string; candidates: string[] }>>().notNull().default([]),
    beneficiaries: jsonb("beneficiaries").$type<{ seller: string | null; affiliate: string | null }>().notNull(),
    ruleVersion: text("rule_version").notNull(),
    commissionRuleVersion: text("commission_rule_version"),
    correctedBy: text("corrected_by"),
    correctionReason: text("correction_reason"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("crm_attribution_version_idx").on(t.quoteId, t.version), index("crm_attribution_seller_idx").on(t.creditedSellerId)],
);
/** Profilo operativo di una persona del team: competenze, lingue, orari, assenze, capacità e limiti. */
export const teamProfiles = pgTable("team_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id),
  team: text("team"),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  languages: jsonb("languages").$type<string[]>().notNull().default(["it"]),
  hours: jsonb("hours").$type<BusinessHours | null>(),
  absences: jsonb("absences").$type<Absence[]>().notNull().default([]),
  capacity: integer("capacity"),
  participates: boolean("participates").notNull().default(true),
  maxDiscountBps: integer("max_discount_bps"),
  maxInstallments: integer("max_installments"),
  /** Collaboratore esterno: vede solo ciò che gli viene assegnato. */
  external: boolean("external").notNull().default(false),
  lastAssignedAt: ts("last_assigned_at"),
  deactivatedAt: ts("deactivated_at"),
  deactivationReason: text("deactivation_reason"),
  updatedBy: text("updated_by"),
  updatedAt: updated(),
});
/** Link protetti, revocabili e con scadenza: proposta da vedere prima dell'account o pacchetto standard dalla trattativa. Nessun dato personale nel link. */
export const crmShareLinks = pgTable("crm_share_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  kind: text("kind").notNull(),
  dealId: uuid("deal_id"),
  quoteId: uuid("quote_id"),
  catalogKey: text("catalog_key"),
  createdBy: text("created_by").notNull().references(() => user.id),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  revokedBy: text("revoked_by"),
  views: integer("views").notNull().default(0),
  lastViewedAt: ts("last_viewed_at"),
  createdAt: created(),
});
/** Eccezioni che richiedono approvazione (sconto oltre soglia, voce personalizzata, rate oltre limite). */
export const crmApprovals = pgTable("crm_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  quoteId: uuid("quote_id"),
  dealId: uuid("deal_id"),
  requestedBy: text("requested_by").notNull().references(() => user.id),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: ts("decided_at"),
  note: text("note"),
  createdAt: created(),
});
/** Pacchetto di passaggio dalla vendita alla produzione: nasce una volta per progetto. */
export const crmHandoffs = pgTable("crm_handoffs", {
  projectId: uuid("project_id").primaryKey(),
  quoteId: uuid("quote_id").notNull(),
  dealId: uuid("deal_id"),
  contractId: uuid("contract_id"),
  sellerId: text("seller_id"),
  package: jsonb("package").$type<Record<string, unknown>>().notNull(),
  inconsistencies: jsonb("inconsistencies").$type<Array<{ code: string; detail: string }>>().notNull().default([]),
  missing: jsonb("missing").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("open"),
  acceptedBy: text("accepted_by"),
  acceptedAt: ts("accepted_at"),
  createdAt: created(),
  updatedAt: updated(),
});
/** Note del passaggio: decisioni, promesse (da approvare), richieste extra, rischi, domande e risposte. */
export const crmHandoffItems = pgTable(
  "crm_handoff_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    authorId: text("author_id").notNull().references(() => user.id),
    status: text("status").notNull().default("pending"),
    parentId: uuid("parent_id"),
    decidedBy: text("decided_by"),
    createdAt: created(),
  },
  (t) => [index("crm_handoff_item_project_idx").on(t.projectId)],
);
export const crmSavedViews = pgTable("crm_saved_views", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  entity: text("entity").notNull(),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<Record<string, string>>().notNull().default({}),
  layout: text("layout").notNull().default("table"),
  createdAt: created(),
});
/** Unioni di schede: chi, perché, con la fotografia della scheda unita. */
export const crmMerges = pgTable("crm_merges", {
  id: uuid("id").defaultRandom().primaryKey(),
  targetId: uuid("target_id").notNull(),
  sourceId: uuid("source_id").notNull(),
  matchedOn: jsonb("matched_on").$type<string[]>().notNull(),
  reason: text("reason").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  actorId: text("actor_id").notNull(),
  createdAt: created(),
});
export const crmFieldDefinitions = pgTable(
  "crm_field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entity: text("entity").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull(),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    required: boolean("required").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [uniqueIndex("crm_field_entity_key_idx").on(t.entity, t.key)],
);
/** Modelli di email (bozze da rivedere) e liste di controllo. */
export const crmTemplates = pgTable("crm_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body"),
  items: jsonb("items").$type<string[]>().notNull().default([]),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  updatedBy: text("updated_by"),
  updatedAt: updated(),
});
/** Richieste di assistenza collegate a ordine e progetto. */
export const supportRequests = pgTable(
  "support_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id"),
    authorId: text("author_id").references(() => user.id),
    projectId: uuid("project_id"),
    quoteId: uuid("quote_id"),
    orderId: uuid("order_id"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    assignedTo: text("assigned_to").references(() => user.id),
    createdAt: created(),
    updatedAt: updated(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("support_contact_idx").on(t.contactId), index("support_assignee_idx").on(t.assignedTo)],
);
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: text("user_id").notNull().references(() => user.id),
    event: text("event").notNull(),
    channel: text("channel").notNull(),
    updatedAt: updated(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.event] })],
);
/** Storia delle regole approvate: ogni versione resta leggibile anche dopo la sostituzione. */
export const settingVersions = pgTable(
  "setting_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    version: text("version").notNull(),
    value: jsonb("value").notNull(),
    approvedBy: text("approved_by"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("setting_version_idx").on(t.key, t.version)],
);
/** Chiavi API: solo l'impronta; il segreto si vede una volta. "form" = chiave pubblica con il solo scopo di acquisizione. */
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("server"),
  prefix: text("prefix").notNull().unique(),
  keyHash: text("key_hash").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull(),
  allowedOrigins: jsonb("allowed_origins").$type<string[]>().notNull().default([]),
  ratePerMinute: integer("rate_per_minute").notNull().default(60),
  createdBy: text("created_by").notNull().references(() => user.id),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
  createdAt: created(),
});
/** Registro degli eventi stabili: fonte unica per i webhook in uscita. */
export const crmEvents = pgTable(
  "crm_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Chiave di idempotenza dell'evento: lo stesso fatto non genera due eventi. */
    eventKey: text("event_key").notNull().unique(),
    type: text("type").notNull(),
    entityId: text("entity_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: created(),
  },
  (t) => [index("crm_event_type_idx").on(t.type, t.createdAt)],
);
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  /** Segreto di firma cifrato (JWE): mai restituito dopo la creazione. */
  secretEnc: text("secret_enc").notNull(),
  events: jsonb("events").$type<string[]>().notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: created(),
});
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpointId: uuid("endpoint_id").notNull(),
    eventId: uuid("event_id").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lockedUntil: ts("locked_until"),
    lastStatus: integer("last_status"),
    lastError: text("last_error"),
    deliveredAt: ts("delivered_at"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("webhook_delivery_idx").on(t.endpointId, t.eventId), index("webhook_delivery_due_idx").on(t.status, t.nextAttemptAt)],
);
