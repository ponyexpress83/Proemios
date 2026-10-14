import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import type { MetricheTesto } from "./metrics";

/**
 * Analisi editoriale del manoscritto: il report gratuito della landing.
 *
 * Il modello riceve un estratto e restituisce SOLO JSON, validato con Zod
 * prima di toccare il resto del sistema. Le metriche numeriche non arrivano
 * da qui: sono calcolate in `lib/metrics.ts` (vedi brief §3.4.4).
 *
 * È un carico diverso dal motore editoriale (`lib/produzione`). Lì lavora il
 * modello migliore ammesso dal router, perché tocca il testo del cliente; qui
 * basta un modello economico, perché il report orienta l'autore e non modifica
 * nulla. Provider e modello sono configurazione (`ANALISI_PROVIDER`,
 * `ANALISI_MODEL`), così il costo per lead si governa senza un rilascio.
 *
 * Il cancello privacy vale anche qui: la rotta controlla `provider_policies`
 * per il provider scelto prima di inviare una riga di testo.
 */

export type ProviderAnalisi = "anthropic" | "openai";

const MODELLO_PREDEFINITO: Record<ProviderAnalisi, string> = {
  anthropic: "claude-haiku-5-5",
  openai: "gpt-4.1-mini",
};
const PAROLE_INVIATE = 8000;
const TIMEOUT_MS = 55_000;
// Il report sta in circa 1.500 token. Il resto è margine per il ragionamento
// del modello, che sui modelli recenti conta nello stesso limite: un tetto
// stretto tronca la risposta prima del JSON.
const MAX_TOKEN_RISPOSTA = 6_000;

/** Quale fornitore esegue l'analisi gratuita. Anthropic se non dichiarato. */
export function providerAnalisi(): ProviderAnalisi {
  return process.env.ANALISI_PROVIDER === "openai" ? "openai" : "anthropic";
}

/** Il modello dell'analisi gratuita: `ANALISI_MODEL`, o il predefinito del provider. */
export function modelloAnalisi(): string {
  const scelto = process.env.ANALISI_MODEL?.trim();
  return scelto || MODELLO_PREDEFINITO[providerAnalisi()];
}

export function aiConfigurata(): boolean {
  return providerAnalisi() === "openai"
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

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

let clientAnthropic: Anthropic | null = null;
let clientOpenAi: OpenAI | null = null;

function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY non configurata.");
  clientAnthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS });
  return clientAnthropic;
}

function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY non configurata.");
  clientOpenAi ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: TIMEOUT_MS });
  return clientOpenAi;
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

/**
 * Niente `temperature` né altri parametri di campionamento: i modelli Claude
 * recenti li rifiutano con un 400, e il formato della risposta lo garantiscono
 * il prompt e la validazione, non il campionamento.
 */
async function chiediAnthropic(richiesta: string): Promise<string> {
  const risposta = await anthropic().messages.create({
    model: modelloAnalisi(),
    max_tokens: MAX_TOKEN_RISPOSTA,
    system: SYSTEM,
    messages: [{ role: "user", content: richiesta }],
  });
  const blocco = risposta.content.find((b) => b.type === "text");
  if (!blocco || blocco.type !== "text") {
    throw new AiError("api", "Risposta priva di contenuto testuale.");
  }
  return blocco.text;
}

async function chiediOpenAi(richiesta: string): Promise<string> {
  const risposta = await openai().chat.completions.create({
    model: modelloAnalisi(),
    max_completion_tokens: MAX_TOKEN_RISPOSTA,
    // Il formato JSON è imposto dal fornitore, non solo chiesto nel prompt.
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: richiesta },
    ],
  });
  const testo = risposta.choices[0]?.message?.content;
  if (!testo) throw new AiError("api", "Risposta priva di contenuto testuale.");
  return testo;
}

/** Chiama il modello configurato e restituisce il giudizio validato. */
export async function analizza(testo: string): Promise<ReportAi> {
  const brano = estratto(testo);
  const richiesta = `Estratto del manoscritto da valutare:\n\n---\n${brano}\n---`;
  const provider = providerAnalisi();
  try {
    const grezzo =
      provider === "openai" ? await chiediOpenAi(richiesta) : await chiediAnthropic(richiesta);
    return parseReport(grezzo);
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError) {
      // Lo stato e il messaggio del fornitore non contengono il testo inviato.
      console.error(
        JSON.stringify({ evt: "ai.errore", provider, status: err.status, msg: err.message }),
      );
      throw new AiError("api", "Il servizio di analisi non ha risposto.");
    }
    throw new AiError("timeout", "L'analisi ha impiegato troppo tempo.");
  }
}
