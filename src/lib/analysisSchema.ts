import { z } from "zod";

/** Struttura del report prodotto dall'AI per l'analisi manoscritto. */
export const reportSchema = z.object({
  sintesi: z.string(),
  leggibilita: z.object({
    punteggio: z.number().min(0).max(100),
    commento: z.string(),
  }),
  ritmo: z.object({
    punteggio: z.number().min(0).max(100),
    commento: z.string(),
  }),
  coerenzaTempi: z.object({
    punteggio: z.number().min(0).max(100),
    commento: z.string(),
  }),
  ripetizioni: z.array(z.string()),
  cliche: z.array(z.string()),
  targetLettori: z.string(),
  genere: z.string(),
  comparables: z.array(z.string()),
  puntiForza: z.array(z.string()),
  areeIntervento: z.array(z.string()),
  livelloIntervento: z.enum(["correzione", "editing-leggero", "editing-profondo"]),
});

export type AIReport = z.infer<typeof reportSchema>;

/** Report completo salvato in DB e mostrato all'utente (AI + dati calcolati). */
export interface FullReport extends AIReport {
  wordCount: number;
  fasciaCosto: { min: number; max: number };
}
