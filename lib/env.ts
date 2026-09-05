/**
 * Validazione delle variabili d'ambiente con Zod (§2: Zod su ogni confine).
 * Le variabili server-only non devono mai finire in bundle client.
 */
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_INTERNAL: z.string().email().optional(),
  MANUSCRIPT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  /**
   * Forza la modalità demo ("on") o la esclude ("off"). Senza valore decide
   * `lib/demo.ts`: demo attiva quando manca DATABASE_URL.
   *
   * La stringa vuota vale come "non impostata": in `.env.example` la variabile
   * compare vuota, e copiare quel file non deve far fallire l'avvio.
   */
  DEMO_MODE: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["on", "off"]).optional()),

  /**
   * Chiave di firma delle sessioni Auth.js. Obbligatoria in produzione: senza,
   * i cookie di sessione non sono verificabili. In sviluppo Auth.js ne genera
   * una effimera, che invalida le sessioni a ogni riavvio.
   */
  AUTH_SECRET: z.string().min(32).optional(),
  /** URL canonico usato da Auth.js per costruire i link dei magic link. */
  AUTH_URL: z.string().url().optional(),
  /** Mittente dei magic link. Deve essere un dominio verificato su Resend. */
  AUTH_EMAIL_FROM: z.string().optional(),
  /** Durata della sessione in giorni. */
  AUTH_SESSION_DAYS: z.coerce.number().int().positive().max(90).default(30),

  /** Storage dei file. In produzione dev'essere "s3". */
  STORAGE_DRIVER: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["s3", "filesystem"]).optional(),
  ),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  STORAGE_ROOT: z.string().optional(),
  STORAGE_SIGNING_SECRET: z.string().optional(),

  /** Coda dei lavori durevole. */
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().min(1).optional(),

  /**
   * Fatturazione. Senza queste il provider è `manuale`: la riga resta
   * `da_emettere` e nessuno finge di aver emesso una fattura.
   */
  FATTURE_IN_CLOUD_TOKEN: z.string().optional(),
  FATTURE_IN_CLOUD_AZIENDA_ID: z.string().optional(),

  /** WhatsApp Cloud API. Senza queste il provider è spento. */
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_NUMERO_ID: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://proemios.it"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_CALENDAR_URL: z.string().url().optional(),
  NEXT_PUBLIC_ANALYTICS_DOMAIN: z.string().optional(),
  /** Numero per i link wa.me. Nessun invio: apre WhatsApp su chi clicca. */
  NEXT_PUBLIC_WHATSAPP_NUMERO: z.string().optional(),
});

/** Env server-side. Non importare da componenti client. */
export const env = serverSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_INTERNAL: process.env.EMAIL_INTERNAL,
  MANUSCRIPT_RETENTION_DAYS: process.env.MANUSCRIPT_RETENTION_DAYS,
  DEMO_MODE: process.env.DEMO_MODE,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
  AUTH_SESSION_DAYS: process.env.AUTH_SESSION_DAYS,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  STORAGE_ROOT: process.env.STORAGE_ROOT,
  STORAGE_SIGNING_SECRET: process.env.STORAGE_SIGNING_SECRET,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  FATTURE_IN_CLOUD_TOKEN: process.env.FATTURE_IN_CLOUD_TOKEN,
  FATTURE_IN_CLOUD_AZIENDA_ID: process.env.FATTURE_IN_CLOUD_AZIENDA_ID,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  WHATSAPP_NUMERO_ID: process.env.WHATSAPP_NUMERO_ID,
});

/** Env pubbliche (safe per il client). */
export const publicEnv = clientSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CALENDAR_URL: process.env.NEXT_PUBLIC_CALENDAR_URL,
  NEXT_PUBLIC_ANALYTICS_DOMAIN: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN,
  NEXT_PUBLIC_WHATSAPP_NUMERO: process.env.NEXT_PUBLIC_WHATSAPP_NUMERO,
});
