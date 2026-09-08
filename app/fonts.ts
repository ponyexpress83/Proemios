import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

/**
 * Tre famiglie, tre ruoli. Self-hosted da next/font: nessuna richiesta a
 * runtime, nessun layout shift.
 */

/** Interfaccia e titoli. Sans contemporanea, numerali eccellenti. */
export const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

/** Apparato tecnico: prezzi, conteggi, codici progetto, etichette di stato. */
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

/** Accento editoriale: citazioni e occhielli. Mai per l'interfaccia. */
export const serifEditoriale = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif-editoriale",
});

export const fontVariables = [geist.variable, geistMono.variable, serifEditoriale.variable].join(
  " ",
);
