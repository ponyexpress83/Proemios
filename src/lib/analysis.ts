import Anthropic from "@anthropic-ai/sdk";
import { reportSchema, type AIReport } from "@/lib/analysisSchema";

/**
 * Analisi manoscritto assistita dall'AI.
 * Il modello produce un report JSON strutturato che validiamo con Zod.
 *
 * Nota legale: il report è generato automaticamente e va poi verificato da un
 * professionista (vedi AI_ANALYSIS_DISCLAIMER).
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_WORDS = 8000;

let _client: Anthropic | null = null;
function client(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY non configurata.");
  if (!_client) _client = new Anthropic({ apiKey: key });
  return _client;
}

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `Sei un editor professionista italiano di Kalamos Studio. Analizzi un estratto di manoscritto e produci una valutazione editoriale onesta, competente e diretta, in italiano.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (nessun testo prima o dopo, nessun markdown), con questa struttura esatta:
{
  "sintesi": "2-3 frasi di sintesi complessiva del testo",
  "leggibilita": { "punteggio": <0-100>, "commento": "..." },
  "ritmo": { "punteggio": <0-100>, "commento": "..." },
  "coerenzaTempi": { "punteggio": <0-100>, "commento": "coerenza dei tempi verbali" },
  "ripetizioni": ["parole o tic stilistici ripetuti individuati"],
  "cliche": ["cliché o frasi fatte individuate"],
  "targetLettori": "descrizione del target di lettori stimato",
  "genere": "genere letterario stimato",
  "comparables": ["2-3 titoli o autori comparabili"],
  "puntiForza": ["esattamente 3 punti di forza"],
  "areeIntervento": ["esattamente 3 aree di intervento"],
  "livelloIntervento": "correzione" | "editing-leggero" | "editing-profondo"
}

Regole:
- I punteggi sono numeri interi da 0 a 100.
- Sii specifico e concreto, cita esempi quando utile, evita genericità.
- "livelloIntervento" riflette l'intervento editoriale complessivo consigliato.
- Rispondi solo con il JSON, senza spiegazioni aggiuntive.`;

/** Estrae le prime ~MAX_WORDS parole dal testo. */
export function primeParole(testo: string, max = MAX_WORDS): string {
  const parole = testo.trim().split(/\s+/);
  return parole.slice(0, max).join(" ");
}

/** Conta le parole di un testo. */
export function contaParole(testo: string): number {
  const t = testo.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** Estrae il primo blocco JSON da una risposta, tollerando eventuali fence. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw.trim();
}

/** Chiama l'AI e restituisce il report validato. */
export async function analizzaManoscritto(estratto: string): Promise<AIReport> {
  const testo = primeParole(estratto);
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analizza questo estratto di manoscritto e restituisci il report JSON.\n\n---\n${testo}\n---`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Risposta AI priva di contenuto testuale.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(textBlock.text));
  } catch {
    throw new Error("Risposta AI non in formato JSON valido.");
  }

  const result = reportSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Report AI non conforme allo schema atteso.");
  }
  return result.data;
}
