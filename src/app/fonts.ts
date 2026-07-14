import { Fraunces, Inter } from "next/font/google";

/**
 * Tipografia editoriale. Font self-hosted da next/font (zero layout shift,
 * nessuna richiesta a runtime verso Google).
 *  - Fraunces: serif con carattere per titoli e display (optical sizing "soft").
 *  - Inter: sans pulita per il testo, con numeri old-style dove sensato.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
