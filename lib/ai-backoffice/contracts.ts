import { z } from "zod";

export const editorialServiceLevelSchema = z.enum([
  "correzione-bozze",
  "revisione-linguistica",
  "editing-stilistico",
  "editing-narrativo",
]);
export type EditorialServiceLevel = z.infer<typeof editorialServiceLevelSchema>;

export const humanReviewModeSchema = z.enum(["automatico", "controllato", "premium"]);
export type HumanReviewMode = z.infer<typeof humanReviewModeSchema>;

export const editorialJobStatusSchema = z.enum([
  "queued",
  "running",
  "needs_review",
  "needs_input",
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
