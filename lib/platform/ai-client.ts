/**
 * Chiamate ai modelli Claude lato server, con output validato, costo e
 * registro. Ogni chiamata passa da qui: nessun'altra parte del codice parla
 * con il provider, così costi, limiti e confine cliente/back-office restano
 * in un punto solo. Le lavorazioni partono solo se l'AI è abilitata
 * dall'ambiente e se le regole (modello, limiti di spesa) sono state
 * approvate da chi gestisce le impostazioni.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import type { z as z4 } from "zod/v4";
import { getDb } from "@/db";
import { aiUsage } from "@/db/document-schema";
import { platformSettings } from "@/db/platform-schema";
import { PlatformError } from "./http";

/** Listino Anthropic per milione di token (USD), ottobre 2026. Un modello senza prezzo non si usa: il budget non sarebbe controllabile. */
export const PRICE_VERSION = "anthropic-listino-2026-10";
export const MODEL_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

/** Regole dell'AI: approvate e versionate nelle impostazioni (chiave `ai-rules`). Nessun valore predefinito vale come approvato. */
export const aiRulesSchema = z
  .object({
    version: z.string().min(1).max(60),
    model: z.string().refine((m) => m in MODEL_PRICES, "Modello senza prezzo di listino: non utilizzabile."),
    effort: z.enum(EFFORTS),
    /** Tetto per singola lavorazione e tetto mensile complessivo, in dollari. */
    maxJobUsd: z.number().positive().max(500),
    monthlyCapUsd: z.number().positive().max(20000),
    /** Servizi che possono partire in automatico (es. revisioni incluse). */
    autoStartServices: z.array(z.string()).max(20).default([]),
    salesAssistant: z.boolean().default(false),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
  })
  .strict();
export type AiRules = z.infer<typeof aiRulesSchema>;
/** Proposta mostrata nelle impostazioni: da verificare, non approvata. */
export const AI_RULES_PROPOSAL: AiRules = { version: "ai-proposta-v1", model: "claude-opus-5-5", effort: "medium", maxJobUsd: 15, monthlyCapUsd: 300, autoStartServices: ["client_revision"], salesAssistant: false };

export async function approvedAiRules(): Promise<AiRules | null> {
  const [row] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, "ai-rules")).limit(1);
  const parsed = aiRulesSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : null;
}
export function aiEnvironmentReady() {
  return process.env.EDITORIAL_AI_ENABLED === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
}
/** Motivo per cui l'AI non può lavorare adesso, o null se può. */
export async function aiBlocker(): Promise<string | null> {
  if (process.env.EDITORIAL_AI_ENABLED !== "1") return "AI editoriale non abilitata nell'ambiente (EDITORIAL_AI_ENABLED).";
  if (!process.env.ANTHROPIC_API_KEY) return "Chiave Anthropic assente nell'ambiente.";
  const rules = await approvedAiRules();
  if (!rules) return "Regole dell'AI (modello e limiti di spesa) non ancora approvate.";
  const spent = await monthSpentMicros();
  if (spent >= rules.monthlyCapUsd * 1_000_000) return `Tetto mensile di spesa AI raggiunto (${(spent / 1_000_000).toFixed(2)} $ su ${rules.monthlyCapUsd} $).`;
  return null;
}
export async function monthSpentMicros(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await getDb().select({ n: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::bigint` }).from(aiUsage).where(gte(aiUsage.createdAt, start));
  return Number(row?.n ?? 0);
}

export type Usage = { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
export function costMicros(u: Usage): number {
  const p = MODEL_PRICES[u.model];
  if (!p) throw new PlatformError(500, "MODEL_UNPRICED", "Modello senza prezzo di listino.");
  return Math.round(u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite);
}
/** Stima prudente per decidere se una chiamata sta nel budget (≈ 4 caratteri per token). */
export function estimateMicros(model: string, inputChars: number, maxOutputTokens: number) {
  return costMicros({ model, inputTokens: Math.ceil(inputChars / 3.5), outputTokens: maxOutputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 });
}

export type AiRequest = { model: string; effort: AiRules["effort"]; system: string; user: string; maxTokens: number };
export type AiResult<T> = { output: T | null; refused: boolean; truncated: boolean; usages: Usage[] };
/** Gli schemi di output usano zod/v4, richiesto dall'helper dell'SDK. */
type Transport = <T>(req: AiRequest, schema: z4.ZodType<T>) => Promise<AiResult<T>>;

/** Trasporto reale: SDK ufficiale, output strutturato validato, fallback lato server se il modello rifiuta. */
const sdkTransport: Transport = async (req, schema) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 2 });
  const response = await client.beta.messages.parse({
    model: req.model,
    max_tokens: req.maxTokens,
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: req.user }],
    output_config: { effort: req.effort, format: betaZodOutputFormat(schema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  const iterations = response.usage.iterations ?? [];
  const usages: Usage[] = iterations.length
    ? iterations.map((it) => ({ model: ("model" in it && it.model) || req.model, inputTokens: it.input_tokens, outputTokens: it.output_tokens, cacheReadTokens: it.cache_read_input_tokens ?? 0, cacheWriteTokens: it.cache_creation_input_tokens ?? 0 }))
    : [{ model: response.model || req.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0 }];
  return { output: (response.parsed_output as unknown) ?? null, refused: response.stop_reason === "refusal", truncated: response.stop_reason === "max_tokens", usages } as AiResult<never>;
};
let transport: Transport = sdkTransport;
/** Solo per i test: sostituisce il provider con una simulazione. */
export function setAiTransport(t: Transport | null) {
  transport = t ?? sdkTransport;
}

export type AiContext = { purpose: "editorial" | "client_revision" | "sales_assistant"; projectId?: string | null; jobId?: string | null; dealId?: string | null; actorId?: string | null };
/**
 * Una chiamata con costo registrato. Gli errori dell'API arrivano come
 * PlatformError con un codice: «retryable» se ripetere ha senso (limiti,
 * sovraccarico, rete), altrimenti definitivo.
 */
export async function callModel<T>(ctx: AiContext, req: AiRequest, schema: z4.ZodType<T>) {
  let result: AiResult<T>;
  try {
    result = await transport(req, schema);
  } catch (error) {
    await recordUsage(ctx, [{ model: req.model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }], "error");
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.APIConnectionTimeoutError)
      throw new PlatformError(503, "AI_RETRYABLE", error instanceof Anthropic.APIError ? `Servizio AI momentaneamente non disponibile (${error.status ?? "rete"}).` : "Servizio AI non raggiungibile.");
    if (error instanceof Anthropic.APIError) throw new PlatformError(502, "AI_FAILED", `Richiesta rifiutata dal servizio AI (${error.status}).`);
    if (error instanceof PlatformError) throw error;
    throw new PlatformError(503, "AI_RETRYABLE", "Errore temporaneo del servizio AI.");
  }
  const cost = await recordUsage(ctx, result.usages, result.refused ? "refused" : result.truncated ? "truncated" : result.output ? "ok" : "invalid");
  return { ...result, costMicros: cost };
}
async function recordUsage(ctx: AiContext, usages: Usage[], outcome: string) {
  let total = 0;
  for (const u of usages) {
    const cost = costMicros(u);
    total += cost;
    await getDb().insert(aiUsage).values({ purpose: ctx.purpose, projectId: ctx.projectId ?? null, jobId: ctx.jobId ?? null, dealId: ctx.dealId ?? null, actorId: ctx.actorId ?? null, model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens, cacheReadTokens: u.cacheReadTokens, costMicros: cost, priceVersion: PRICE_VERSION, outcome });
  }
  return total;
}
export async function projectAiMicros(projectId: string) {
  const [row] = await getDb().select({ n: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::bigint` }).from(aiUsage).where(and(eq(aiUsage.projectId, projectId)));
  return Number(row?.n ?? 0);
}
