import { Fraunces, Spectral, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

/**
 * Tre famiglie, tre ruoli distinti (DESIGN_PLAN §Tipografia).
 * Self-hosted da next/font: zero layout shift, nessuna richiesta a runtime.
 */

/** Display — titoli e versali di apertura. Serif old-style con voce, non Playfair. */
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
});

/** Lettura — corpo del testo lungo, composto come in un libro. */
export const spectral = Spectral({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lettura",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

/** Interfaccia — nav, bottoni, form. */
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
  weight: ["400", "500", "600"],
});

/** Apparato tecnico — prezzi, metriche, folî, etichette da scheda. */
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const fontVariables = [
  fraunces.variable,
  spectral.variable,
  plexSans.variable,
  plexMono.variable,
].join(" ");
