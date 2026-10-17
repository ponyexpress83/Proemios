/**
 * Regole configurabili del CRM, sempre versionate: ogni decisione registra la
 * versione della regola che l'ha prodotta. Le impostazioni salvate passano da
 * questi schemi; i valori predefiniti sono prudenti.
 */
import { z } from "zod";
import { businessHoursSchema, defaultBusinessHours } from "./hours";

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const ASSIGNMENT_MODES = ["automatic", "manual", "pool"] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];
export const LEAD_SOURCES = ["form", "campaign", "social", "manual", "seller", "marketplace", "partner", "api"] as const;
export type LeadSourceKind = (typeof LEAD_SOURCES)[number];

export const assignmentRulesSchema = z
  .object({
    version: z.string().min(1).max(60),
    /** Modalità predefinita: automatica. */
    mode: z.enum(ASSIGNMENT_MODES).default("automatic"),
    /** Modalità per fonte (es. marketplace in coda libera). */
    sourceModes: z.record(z.enum(LEAD_SOURCES), z.enum(ASSIGNMENT_MODES)).default({}),
    defaultLanguage: z.string().min(2).max(8).default("it"),
    /** Capacità usata per chi non ne ha una propria (trattative aperte). */
    defaultCapacity: z.number().int().min(1).max(1000).default(40),
    hours: businessHoursSchema.default(defaultBusinessHours),
    sla: z
      .object({
        responseMinutes: z.object({ low: z.number().int().min(5).max(20160), normal: z.number().int().min(5).max(20160), high: z.number().int().min(5).max(20160), urgent: z.number().int().min(5).max(20160) }).strict(),
        /** Minuti di servizio dopo la scadenza prima dell'escalation. */
        escalateAfterMinutes: z.number().int().min(0).max(20160),
      })
      .strict()
      .default({ responseMinutes: { low: 1440, normal: 480, high: 120, urgent: 60 }, escalateAfterMinutes: 120 }),
    pool: z
      .object({
        maxReservations: z.number().int().min(1).max(50),
        reservationMinutes: z.number().int().min(5).max(10080),
      })
      .strict()
      .default({ maxReservations: 3, reservationMinutes: 120 }),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
  })
  .strict();
export type AssignmentRules = z.infer<typeof assignmentRulesSchema>;
export const defaultAssignmentRules: AssignmentRules = assignmentRulesSchema.parse({ version: "assegnazione-2026-10-v1" });

export const attributionRulesSchema = z
  .object({
    version: z.string().min(1).max(60),
    /** Per quanti giorni un venditore resta referente di un cliente dopo l'ultima trattativa. */
    relationshipWindowDays: z.number().int().min(0).max(730).default(90),
    /** Acquisto successivo senza link: si accredita il referente recente o resta autonomo. */
    laterPurchase: z.enum(["credit_recent_owner", "autonomous"]).default("credit_recent_owner"),
    /** Trattative aperte con responsabili diversi sullo stesso cliente: si segnala sempre, mai scelta silenziosa. */
    concurrentDeals: z.literal("flag").default("flag"),
    /** Venditore e affiliato sulla stessa vendita: entrambi, solo uno dei due. */
    affiliateAndSeller: z.enum(["both", "seller_only", "affiliate_only"]).default("both"),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
  })
  .strict();
export type AttributionRules = z.infer<typeof attributionRulesSchema>;
export const defaultAttributionRules: AttributionRules = attributionRulesSchema.parse({ version: "attribuzione-2026-10-v1" });

export const opsRulesSchema = z
  .object({
    version: z.string().min(1).max(60),
    /** Categorie standard le cui fasi si possono prendere dalla coda (es. correzione bozze). */
    claimableCategories: z.array(z.string().min(1).max(40)).max(40).default(["proofreading", "epub", "isbn", "kdp", "amazonListing"]),
    /** Capacità predefinita di un operatore (compiti aperti). */
    defaultCapacity: z.number().int().min(1).max(500).default(8),
    /** Requisiti per passare alla produzione oltre a contratto, ordine e incasso verificato. */
    requireBillingProfile: z.boolean().default(true),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
  })
  .strict();
export type OpsRules = z.infer<typeof opsRulesSchema>;
export const defaultOpsRules: OpsRules = opsRulesSchema.parse({ version: "produzione-2026-10-v1" });

export const lossReasonsSchema = z
  .object({
    version: z.string().min(1).max(60),
    reasons: z.array(z.object({ key: z.string().regex(/^[a-z0-9_-]{2,40}$/), label: z.string().min(2).max(120), active: z.boolean().default(true) }).strict()).min(1).max(50),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
  })
  .strict();
export type LossReasons = z.infer<typeof lossReasonsSchema>;
export const defaultLossReasons: LossReasons = {
  version: "motivi-2026-10-v1",
  reasons: [
    { key: "price", label: "Prezzo oltre il budget", active: true },
    { key: "timing", label: "Tempi non compatibili", active: true },
    { key: "competitor", label: "Scelto un altro fornitore", active: true },
    { key: "no_answer", label: "Nessuna risposta dopo i contatti previsti", active: true },
    { key: "not_ready", label: "Progetto non ancora pronto", active: true },
    { key: "out_of_scope", label: "Servizio non offerto", active: true },
    { key: "other", label: "Altro (con nota)", active: true },
  ],
};
/** Marchio con cui il tenant si presenta: non è un tenant. */
export const brandSchema = z
  .object({ name: z.string().min(1).max(80), supportEmail: z.string().email().max(320).nullable().default(null), version: z.string().min(1).max(60).default("marchio-v1") })
  .strict();
export type Brand = z.infer<typeof brandSchema>;
