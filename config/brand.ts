/**
 * Costanti di brand — unica fonte di verità.
 * Cambiare il brand deve richiedere di toccare (quasi) solo questo file.
 */

export const BRAND = {
  name: "Proemios",
  // Proemios è il marchio; la società che eroga i servizi è Smart Content.
  // L'anagrafica completa (sede, P. IVA, REA, PEC) sta in config/legal.ts.
  legalName: "Smart Content S.r.l.s.",
  payoff: "Dalle idee alle opere",
  payoffEn: "From ideas to works",
  // Dominio principale. Il .com appartiene a terzi: non generare mai URL su proemios.com.
  domain: "proemios.it",
  url: "https://proemios.it",
  tagline:
    "Dall'idea al libro pubblicato. Servizi editoriali assistiti dalla tecnologia, verificati da professionisti.",
  description:
    "Proemios è il punto unico per autopubblicarsi: valutazione, editing, impaginazione, copertina, EPUB, pubblicazione Amazon KDP e ISBN. Preventivo esatto in due minuti, analisi del manoscritto gratuita.",
  email: {
    general: "ciao@proemios.it", // TODO confermare
    quotes: "preventivi@proemios.it",
    agencies: "agenzie@proemios.it",
    privacy: "privacy@proemios.it",
  },
  social: {
    instagram: "", // TODO
    linkedin: "",
    facebook: "",
  },
  // Formulazione vincolante sull'AI (vedi §3.9 del brief). Usare ovunque l'AI interviene.
  aiDisclaimer:
    "Processo editoriale assistito dalla tecnologia e sottoposto a controllo professionale: ogni consegna viene verificata e approvata da un professionista.",
  aiAnalysisNotice:
    "Questo report è generato automaticamente e va inteso come prima diagnosi. La valutazione professionale completa avviene su richiesta.",
} as const;

export type Brand = typeof BRAND;
