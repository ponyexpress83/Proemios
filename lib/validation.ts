import { z } from "zod";

/**
 * Zod su ogni confine (brief §2): form, API route, webhook, risposte AI.
 * I messaggi d'errore sono in italiano e dicono cosa fare, non cosa è rotto.
 */

export const emailSchema = z
  .string()
  .min(1, "Serve un indirizzo email.")
  .email("Controlla l'indirizzo email: manca qualcosa.");

export const nomeSchema = z.string().min(2, "Scrivi il tuo nome.").max(200, "Nome troppo lungo.");

export const consensoSchema = z.literal(true, {
  errorMap: () => ({ message: "Serve il consenso al trattamento per proseguire." }),
});

// ── Configuratore di preventivo ────────────────────────────────────────────

export const projectTypeSchema = z.enum([
  "romanzo",
  "saggio",
  "memoir",
  "libro-professionale",
  "solo-grafica",
]);

export const textStateSchema = z.enum([
  "finito-revisionato",
  "finito-da-revisionare",
  "bozza-incompleta",
  "solo-materiali",
]);

export const serviceKeySchema = z.enum([
  "editing",
  "proofreading",
  "layout",
  "epub",
  "cover",
  "kdp",
  "isbn",
  "amazonListing",
]);

export const materialAmountSchema = z.enum(["scarso", "parziale", "abbondante"]);

export const pricingInputSchema = z.object({
  projectType: projectTypeSchema,
  textState: textStateSchema,
  wordCount: z.coerce
    .number()
    .int()
    .min(1, "Indica quante parole ha il testo.")
    .max(2_000_000, "Oltre due milioni di parole conviene che ne parliamo a voce."),
  materialAmount: materialAmountSchema.optional(),
  requestedServices: z.array(serviceKeySchema).default([]),
  urgency: z.enum(["standard", "prioritaria"]).default("standard"),
});
export type PricingInputDto = z.infer<typeof pricingInputSchema>;

export const contattoPreventivoSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  telefono: z.string().max(40).optional().or(z.literal("")),
  note: z.string().max(3000).optional().or(z.literal("")),
  consensoPrivacy: consensoSchema,
  consensoMarketing: z.boolean().default(false),
});

export const preventivoSchema = z.object({
  input: pricingInputSchema,
  contatto: contattoPreventivoSchema,
  // Honeypot: se compilato è un bot.
  sito: z.string().max(0).optional(),
});

export const checkoutSchema = z.object({
  quoteId: z.string().uuid("Preventivo non valido."),
  pacchetto: z.enum(["essenziale", "consigliato", "signature"]),
});

/**
 * Variante usata solo in modalità demo, dove il preventivo non sta su un
 * database e il suo identificativo non è un UUID ma un riferimento di sessione
 * (`demo-prev-0001`). Il controllo sul pacchetto resta identico: è quello che
 * conta, perché è l'unico valore che il client può scegliere.
 */
export const checkoutDemoSchema = z.object({
  quoteId: z
    .string()
    .regex(/^demo-[a-z]+-\d+$/, "Preventivo non valido.")
    .max(64),
  pacchetto: z.enum(["essenziale", "consigliato", "signature"]),
});

// ── Analisi manoscritto ────────────────────────────────────────────────────

export const gateAnalisiSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  consensoPrivacy: consensoSchema,
  consensoMarketing: z.boolean().default(false),
});

// ── Contatto ───────────────────────────────────────────────────────────────

export const contattoSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  telefono: z.string().max(40).optional().or(z.literal("")),
  messaggio: z
    .string()
    .min(10, "Scrivi qualche riga in più: bastano due frasi sul progetto.")
    .max(4000),
  consensoPrivacy: consensoSchema,
  consensoMarketing: z.boolean().default(false),
  sito: z.string().max(0).optional(),
});

// ── Agenzie (white label) ──────────────────────────────────────────────────

export const agenziaSchema = z.object({
  nomeAgenzia: z.string().min(2, "Indica il nome dell'agenzia.").max(200),
  referente: nomeSchema,
  email: emailSchema,
  telefono: z.string().max(40).optional().or(z.literal("")),
  sito: z.string().max(320).optional().or(z.literal("")),
  serviziEsternalizzati: z.string().max(1000).optional().or(z.literal("")),
  volumeStimato: z.string().max(120).optional().or(z.literal("")),
  consensoPrivacy: consensoSchema,
  // Honeypot (nome diverso dal campo "sito" reale di questo form).
  website: z.string().max(0).optional(),
});

// ── Lista d'attesa Strumenti AI ────────────────────────────────────────────

export const waitlistSchema = z.object({
  email: emailSchema,
  piano: z.enum(["free", "pro", "premium"]),
  periodo: z.enum(["monthly", "annual"]).default("monthly"),
  consensoPrivacy: consensoSchema,
  sito: z.string().max(0).optional(),
});

/** Primo messaggio d'errore leggibile da un esito Zod fallito. */
export function primoErrore(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Dati non validi.";
}
