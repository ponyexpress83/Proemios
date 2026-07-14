import { z } from "zod";

/**
 * Validazione centralizzata delle variabili d'ambiente server-side.
 * Le variabili sono lette lazy: importando questo modulo NON si forza la
 * validazione a build-time (utile per `next build` senza segreti reali).
 * Chiama `serverEnv()` dentro le route/azioni che ne hanno bisogno.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL mancante"),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default("Kalamos Studio <no-reply@kalamos.studio>"),
  EMAIL_INTERNAL_NOTIFY: z.string().email().default("finance@kalamos.studio"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ADMIN_USER: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1).default("changeme"),
  MANUSCRIPT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variabili d'ambiente non valide:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** URL pubblico del sito (client-safe). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/** URL Calendly per l'embed nella pagina contatti. */
export function calendlyUrl(): string {
  return process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://calendly.com/kalamos-studio/consulenza";
}
