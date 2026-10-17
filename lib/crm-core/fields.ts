/** Campi personalizzati: definiti per entità, validati sul server, mai dal browser. */
import { z } from "zod";

export const FIELD_ENTITIES = ["contact", "deal", "lead", "company"] as const;
export type FieldEntity = (typeof FIELD_ENTITIES)[number];
export const fieldDefinitionSchema = z
  .object({
    entity: z.enum(FIELD_ENTITIES),
    key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
    label: z.string().trim().min(2).max(80),
    type: z.enum(["text", "number", "date", "select", "boolean"]),
    options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    required: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .strict();
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export function validateCustomFields(definitions: FieldDefinition[], values: Record<string, unknown>, options: { partial?: boolean } = {}): { values: Record<string, string | number | boolean | null>; errors: Record<string, string> } {
  const out: Record<string, string | number | boolean | null> = {}, errors: Record<string, string> = {};
  const known = new Map(definitions.filter((d) => d.active).map((d) => [d.key, d]));
  for (const key of Object.keys(values)) if (!known.has(key)) errors[key] = "Campo non definito.";
  for (const def of known.values()) {
    const raw = values[def.key];
    if (raw === undefined || raw === null || raw === "") {
      if (def.required && !options.partial) errors[def.key] = "Campo obbligatorio.";
      if (raw === null || raw === "") out[def.key] = null;
      continue;
    }
    if (def.type === "text" && typeof raw === "string" && raw.length <= 1000) out[def.key] = raw.trim();
    else if (def.type === "number" && typeof raw === "number" && Number.isFinite(raw)) out[def.key] = raw;
    else if (def.type === "boolean" && typeof raw === "boolean") out[def.key] = raw;
    else if (def.type === "date" && typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) out[def.key] = raw;
    else if (def.type === "select" && typeof raw === "string" && def.options.includes(raw)) out[def.key] = raw;
    else errors[def.key] = "Valore non valido.";
  }
  return { values: out, errors };
}
