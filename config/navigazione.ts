import { PERCORSI } from "./percorsi";
import { SERVIZI_PER_AREA } from "./catalogo";

/**
 * Struttura di navigazione del sito pubblico. Generata dal catalogo così che
 * aggiungere un servizio non richieda di ricordarsi del menu.
 */
export const NAV_PERCORSI = PERCORSI.map((p) => ({
  href: `/percorsi/${p.slug}`,
  titolo: p.nome,
  sommario: p.claim,
}));

export const NAV_SERVIZI = SERVIZI_PER_AREA.filter((a) => a.servizi.length > 0).map((a) => ({
  area: a.area,
  titolo: a.nome,
  sommario: a.sommario,
  voci: a.servizi.map((s) => ({
    href: `/servizi/${s.slug}`,
    titolo: s.nome,
    sommario: s.sommario,
  })),
}));

/** Voci semplici della barra, oltre ai due menu a tendina. */
export const NAV_PRINCIPALE = [
  { href: "/come-funziona", titolo: "Come funziona" },
  { href: "/casi-studio", titolo: "Casi studio" },
  { href: "/chi-siamo", titolo: "Chi siamo" },
  { href: "/blog", titolo: "Note" },
] as const;

export const NAV_COLOPHON = {
  offerta: [
    { href: "/percorsi", titolo: "Percorsi" },
    { href: "/servizi", titolo: "Tutti i servizi" },
    { href: "/preventivo", titolo: "Preventivo" },
    { href: "/analisi-manoscritto", titolo: "Analisi del manoscritto" },
  ],
  studio: [
    { href: "/come-funziona", titolo: "Come funziona" },
    { href: "/chi-siamo", titolo: "Chi siamo" },
    { href: "/casi-studio", titolo: "Casi studio" },
    { href: "/blog", titolo: "Note" },
    { href: "/per-agenzie", titolo: "Per agenzie" },
  ],
  legale: [
    { href: "/privacy", titolo: "Privacy" },
    { href: "/cookie", titolo: "Cookie" },
    { href: "/termini", titolo: "Termini" },
  ],
} as const;
