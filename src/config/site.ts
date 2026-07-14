/**
 * Configurazione globale del sito e stringhe condivise.
 * Centralizzare qui i testi rende l'i18n aggiungibile senza refactor:
 * basterà sostituire questo modulo con un dizionario per lingua.
 */

export const SITE = {
  nome: "Kalamos Studio",
  /** κάλαμος — la canna per scrivere degli antichi. */
  etimologia: "dal greco κάλαμος, la canna con cui gli antichi scrivevano",
  tagline: "Service editoriale assistito dalla tecnologia, verificato da professionisti.",
  descrizione:
    "Editing, ghostwriting, impaginazione e pubblicazione su Amazon KDP. Trasformiamo manoscritti, diari e appunti in libri pubblicati.",
  email: "ciao@kalamos.studio",
  emailFinance: "finance@kalamos.studio",
  citta: "Italia",
} as const;

/**
 * Formula legale sull'AI (vincolo non negoziabile).
 * Da usare nel footer e in ogni pagina in cui l'AI è coinvolta.
 * Mai dichiarare processi "interamente manuali".
 */
export const AI_DISCLAIMER =
  "Processo editoriale assistito dalla tecnologia e sottoposto a controllo professionale: ogni consegna viene verificata e approvata da un professionista.";

export const AI_ANALYSIS_DISCLAIMER =
  "Questo report è generato automaticamente ed è una stima preliminare. Viene poi verificato da un professionista. Il file caricato non è usato per altri scopi e viene cancellato dopo il periodo di conservazione indicato.";

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_PRIMARY: NavItem[] = [
  { label: "Servizi", href: "/servizi" },
  { label: "Dal diario al libro", href: "/dal-diario-al-libro" },
  { label: "Per agenzie", href: "/per-agenzie" },
  { label: "Casi studio", href: "/casi-studio" },
  { label: "Blog", href: "/blog" },
  { label: "Contatti", href: "/contatti" },
];

export const NAV_FOOTER: { titolo: string; voci: NavItem[] }[] = [
  {
    titolo: "Servizi",
    voci: [
      { label: "Valutazione editoriale", href: "/servizi/valutazione-editoriale" },
      { label: "Revisione e pubblicazione", href: "/servizi/revisione-e-pubblicazione" },
      { label: "Dal diario al libro", href: "/servizi/dal-diario-al-libro" },
      { label: "Libro per professionisti", href: "/servizi/libro-per-professionisti" },
      { label: "Copertina e impaginazione", href: "/servizi/copertina-e-impaginazione" },
      { label: "Partner white label", href: "/servizi/partner-white-label" },
    ],
  },
  {
    titolo: "Strumenti",
    voci: [
      { label: "Configura un preventivo", href: "/preventivo" },
      { label: "Analisi manoscritto gratuita", href: "/analisi-manoscritto" },
    ],
  },
  {
    titolo: "Studio",
    voci: [
      { label: "Casi studio", href: "/casi-studio" },
      { label: "Blog", href: "/blog" },
      { label: "Per agenzie", href: "/per-agenzie" },
      { label: "Contatti", href: "/contatti" },
    ],
  },
  {
    titolo: "Legale",
    voci: [
      { label: "Privacy", href: "/privacy" },
      { label: "Termini", href: "/termini" },
    ],
  },
];
