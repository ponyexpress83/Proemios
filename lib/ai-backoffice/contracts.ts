import { z } from "zod";

export const editorialServiceLevelSchema = z.enum([
  "correzione-bozze",
  "revisione-linguistica",
  "editing-stilistico",
  "editing-narrativo",
]);
export type EditorialServiceLevel = z.infer<typeof editorialServiceLevelSchema>;

/**
 * Per i servizi editoriali la revisione umana e sempre obbligatoria prima della consegna.
 * "controllato" e "premium" descrivono quanto AI viene usata prima dell'approvazione umana.
 */
export const humanReviewModeSchema = z.enum(["controllato", "premium"]);
export type HumanReviewMode = z.infer<typeof humanReviewModeSchema>;

export const editorialJobStatusSchema = z.enum([
  "queued",
  "running",
  "needs_review",
  "needs_input",
  "editorially_approved",
  "approved",
  "delivered",
  "failed",
  "cancelled",
]);
export type EditorialJobStatus = z.infer<typeof editorialJobStatusSchema>;

export const interventionCategorySchema = z.enum([
  "refuso",
  "ortografia",
  "punteggiatura",
  "grammatica",
  "sintassi",
  "ripetizione",
  "uniformita-tipografica",
  "stile",
  "dubbio-da-verificare",
]);
export type InterventionCategory = z.infer<typeof interventionCategorySchema>;

export const interventionStatusSchema = z.enum(["pending", "accepted", "rejected", "modified"]);

export const editorialInterventionSchema = z.object({
  id: z.string().min(1),
  category: interventionCategorySchema,
  anchor: z.object({
    paragraphId: z.string().optional(),
    runId: z.string().optional(),
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().nonnegative().optional(),
  }),
  before: z.string(),
  after: z.string(),
  confidence: z.number().min(0).max(1),
  internalReason: z.string().min(1).max(2000),
  authorComment: z.string().max(2000).optional(),
  status: interventionStatusSchema.default("pending"),
});
export type EditorialIntervention = z.infer<typeof editorialInterventionSchema>;

export const staffRoleSchema = z.enum([
  "super_admin",
  "operations_admin",
  "editorial_manager",
  "editor_reviewer",
  "finance",
  "client",
]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const permissionSchema = z.enum([
  "view_assigned_job",
  "view_manuscript",
  "review_interventions",
  "modify_intervention",
  "request_clarification",
  "mark_editorially_approved",
  "view_client_identity",
  "view_client_contact",
  "view_contract",
  "view_price",
  "view_payment",
  "view_marketing_attribution",
  "view_ai_run",
  "view_ai_cost",
  "change_model",
  "rerun_ai",
  "assign_staff",
  "approve_delivery",
  "deliver_to_client",
]);
export type Permission = z.infer<typeof permissionSchema>;

export const staffAccountSchema = z.object({
  id: z.string().min(1),
  role: staffRoleSchema,
  active: z.boolean().default(true),
  displayName: z.string().min(1).max(200),
  email: z.string().email(),
});
export type StaffAccount = z.infer<typeof staffAccountSchema>;

export const rolePermissions: Record<StaffRole, readonly Permission[]> = {
  super_admin: permissionSchema.options,
  operations_admin: [
    "view_assigned_job",
    "view_manuscript",
    "view_client_identity",
    "view_client_contact",
    "view_contract",
    "view_price",
    "view_payment",
    "view_marketing_attribution",
    "assign_staff",
    "approve_delivery",
    "deliver_to_client",
  ],
  editorial_manager: [
    "view_assigned_job",
    "view_manuscript",
    "review_interventions",
    "modify_intervention",
    "request_clarification",
    "mark_editorially_approved",
    "view_ai_run",
    "change_model",
    "rerun_ai",
    "assign_staff",
  ],
  editor_reviewer: [
    "view_assigned_job",
    "view_manuscript",
    "review_interventions",
    "modify_intervention",
    "request_clarification",
    "mark_editorially_approved",
  ],
  finance: ["view_client_identity", "view_client_contact", "view_contract", "view_price", "view_payment"],
  client: [],
};

export function roleHasPermission(role: StaffRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export const aiProviderSchema = z.enum(["openai", "anthropic"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const modelCapabilitySchema = z.enum([
  "proofreading",
  "grammar",
  "structured-output",
  "tool-use",
  "docx-operations",
  "stylistic-editing",
  "narrative-analysis",
  "editorial-report",
  "adjudication",
]);
export type ModelCapability = z.infer<typeof modelCapabilitySchema>;

export const providerPrivacyPolicySchema = z.object({
  provider: aiProviderSchema,
  trainingUseAllowed: z.boolean(),
  zeroDataRetentionAvailable: z.boolean(),
  defaultRetentionDays: z.number().int().nonnegative().nullable(),
  dpaAvailable: z.boolean(),
  gdprReviewed: z.boolean(),
  allowedForUnpublishedManuscripts: z.boolean(),
  notes: z.string().max(4000).optional(),
});
export type ProviderPrivacyPolicy = z.infer<typeof providerPrivacyPolicySchema>;

export const modelDefinitionSchema = z.object({
  id: z.string().min(1),
  provider: aiProviderSchema,
  model: z.string().min(1),
  capabilities: z.array(modelCapabilitySchema).min(1),
  enabled: z.boolean().default(true),
  benchmarkStatus: z.enum(["unverified", "candidate", "approved", "rejected"]).default("unverified"),
  premium: z.boolean().default(false),
});
export type ModelDefinition = z.infer<typeof modelDefinitionSchema>;

export const routingRequestSchema = z.object({
  serviceLevel: editorialServiceLevelSchema,
  reviewMode: humanReviewModeSchema,
  unpublishedManuscript: z.boolean().default(true),
  requiredCapabilities: z.array(modelCapabilitySchema).default([]),
  preferredProvider: aiProviderSchema.optional(),
});
export type RoutingRequest = z.infer<typeof routingRequestSchema>;
