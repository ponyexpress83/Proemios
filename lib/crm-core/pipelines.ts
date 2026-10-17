/** Pipeline configurabili: fasi aperte, vinte o perse. «Vinta» non si imposta mai a mano. */
import { z } from "zod";

export const pipelineStageSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
    label: z.string().trim().min(2).max(80),
    kind: z.enum(["open", "won", "lost"]),
    /** Fase impostabile a mano (spostando la scheda). Le fasi derivate dai fatti non lo sono. */
    manual: z.boolean().default(true),
  })
  .strict();
export const pipelineSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/),
    name: z.string().trim().min(2).max(80),
    stages: z.array(pipelineStageSchema).min(2).max(30),
  })
  .strict()
  .refine((p) => new Set(p.stages.map((s) => s.key)).size === p.stages.length, { message: "Fasi duplicate." })
  .refine((p) => p.stages.some((s) => s.kind === "won") && p.stages.some((s) => s.kind === "lost"), { message: "Servono una fase vinta e una persa." });
export type Pipeline = z.infer<typeof pipelineSchema>;
export type PipelineStage = z.infer<typeof pipelineStageSchema>;
export function stageMove(pipeline: Pipeline, to: string): { ok: true; stage: PipelineStage } | { ok: false; code: "UNKNOWN_STAGE" | "DERIVED_STAGE" | "WON_BY_PAYMENT" } {
  const stage = pipeline.stages.find((s) => s.key === to);
  if (!stage) return { ok: false, code: "UNKNOWN_STAGE" };
  if (stage.kind === "won") return { ok: false, code: "WON_BY_PAYMENT" };
  if (!stage.manual) return { ok: false, code: "DERIVED_STAGE" };
  return { ok: true, stage };
}
