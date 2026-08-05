import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "./env";
import type { MetricheTesto } from "./metrics";

/**
 * Analisi editoriale del manoscritto.
 *
 * Il modello riceve un estratto e restituisce SOLO JSON, validato con Zod
 * prima di toccare il resto del sistema. Le metriche numeriche non arrivano
 * da qui: sono calcolate in `lib/metrics.ts` (vedi brief §3.4.4).
 */

const MODELLO = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const PAROLE_INVIATE = 8000;
const TIMEOUT_MS = 55_000;

// ── Schema del report ──────────────────────────────────────────────────────

export const livelloInterventoSchema = z.enum([
  "correzione-bozze",
  "editing-leggero",
  "editing-profondo",
]);
export type LivelloIntervento = z.infer<typeof livelloInterventoSchema>;

export const reportAiSchema = z.object({
  sintesi: z.string().min(20).max(1200),
  ritmo: z.object({
    giudizio: z.string().min(10).max(600),
    periodareLungo: z.boolean(),
  }),
  ripetizioni: z.array(z.string().max(200)).max(8),
  cliche: z.array(z.string().max(200)).max(8),
  coerenza: z.object({
    tempiVerbali: z.string().min(5).max(500),
    puntoDiVista: z.string().min(5).max(500),
  }),
  genere: z.string().min(2).max(120),
  lettoreTipo: z.string().min(5).max(400),
  puntiForza: z.array(z.string().min(5).max(300)).min(1).max(3),
  areeIntervento: z.array(z.string().min(5).max(300)).min(1).max(3),
  livelloIntervento: livelloInterventoSchema,
});
export type ReportAi = z.infer<typeof reportAiSchema>;

/** Report completo salvato e mostrato: giudizio AI + metriche locali + costo. */
export interface ReportCompleto extends ReportAi {
  metriche: MetricheTesto;
  fasciaCosto: { min: number; max: number };
  generatoIl: string;
}

// ── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM = `Sei un editor professionista italiano. Leggi un estratto di manoscritto e produci una valutazione editoriale onesta e concreta, in italiano.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido. Nessun testo prima o dopo, nessun blocco markdown.

Struttura esatta:
{
  "sintesi": "2-4 frasi: che testo è e a che punto è",
  "ritmo": { "giudizio": "come procede la lettura, con esempi concreti", "periodareLungo": true|false },
  "ripetizioni": ["parole o costrutti che tornano troppo spesso"],
  "cliche": ["frasi fatte e immagini di seconda mano che hai trovato"],
  "coerenza": { "tempiVerbali": "...", "puntoDiVista": "..." },
  "genere": "genere e collocazione editoriale",
  "lettoreTipo": "chi è il lettore di questo libro",
  "puntiForza": ["esattamente 3 punti di forza, specifici"],
  "areeIntervento": ["esattamente 3 aree su cui intervenire, in ordine di priorità"],
  "livelloIntervento": "correzione-bozze" | "editing-leggero" | "editing-profondo"
}

Regole:
- Cita esempi dal testo quando aiutano: le osservazioni generiche non servono a nessuno.
- Non dare punteggi numerici: le metriche sono calcolate altrove.
- Non lodare per compiacere e non stroncare per sembrare severo. Di' cosa c'è.
- "livelloIntervento" è il lavoro che serve davvero, non quello che l'autore spera.`;

// ── Client ─────────────────────────────────────────────────────────────────

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY non configurata.");
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS });
  return client;
}

export function aiConfigurata(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Prime N parole del testo: è quanto basta per una prima diagnosi. */
export function estratto(testo: string, max = PAROLE_INVIATE): string {
  return testo.trim().split(/\s+/).slice(0, max).join(" ");
}

/**
 * Isola il JSON da una risposta, tollerando fence o testo accidentale.
 * Esportata per essere testata: è un confine fragile e va coperto.
 */
export function isolaJson(grezzo: string): string {
  const conFence = grezzo.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (conFence?.[1]) return conFence[1].trim();
  const apre = grezzo.indexOf("{");
  const chiude = grezzo.lastIndexOf("}");
  if (apre !== -1 && chiude > apre) return grezzo.slice(apre, chiude + 1);
  return grezzo.trim();
}

/** Parsing + validazione della risposta. Esportata per i test. */
export function parseReport(grezzo: string): ReportAi {
  let dati: unknown;
  try {
    dati = JSON.parse(isolaJson(grezzo));
  } catch {
    throw new AiError("risposta-non-json", "Il modello non ha restituito JSON valido.");
  }
  const esito = reportAiSchema.safeParse(dati);
  if (!esito.success) {
    throw new AiError("schema-non-conforme", "Il report non rispetta lo schema atteso.");
  }
  return esito.data;
}

export class AiError extends Error {
  constructor(
    readonly codice: "risposta-non-json" | "schema-non-conforme" | "timeout" | "api",
    messaggio: string,
  ) {
    super(messaggio);
    this.name = "AiError";
  }
}

/** Chiama il modello e restituisce il giudizio validato. */
export async function analizza(testo: string): Promise<ReportAi> {
  const brano = estratto(testo);
  try {
    const risposta = await anthropic().messages.create({
      model: MODELLO,
      max_tokens: 3000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Estratto del manoscritto da valutare:\n\n---\n${brano}\n---`,
        },
      ],
    });

    const blocco = risposta.content.find((b) => b.type === "text");
    if (!blocco || blocco.type !== "text") {
      throw new AiError("api", "Risposta priva di contenuto testuale.");
    }
    return parseReport(blocco.text);
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.APIError) {
      console.error(JSON.stringify({ evt: "ai.errore", status: err.status, msg: err.message }));
      throw new AiError("api", "Il servizio di analisi non ha risposto.");
    }
    throw new AiError("timeout", "L'analisi ha impiegato troppo tempo.");
  }
}
