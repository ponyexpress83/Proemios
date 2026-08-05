import type { ProjectType, TextState, ServiceKey } from "@/lib/pricing";
import type { MaterialAmount } from "@/config/pricing";

/** Opzioni del configuratore. Testi qui, non nei componenti. */

export const TIPI_PROGETTO: { valore: ProjectType; label: string; nota: string }[] = [
  { valore: "romanzo", label: "Romanzo", nota: "Narrativa, racconti" },
  { valore: "saggio", label: "Saggio o manuale", nota: "Non-fiction, divulgazione" },
  { valore: "memoir", label: "Memoir", nota: "Storia di vita, autobiografia" },
  {
    valore: "libro-professionale",
    label: "Libro professionale",
    nota: "Posizionamento, autorevolezza",
  },
  { valore: "solo-grafica", label: "Solo grafica", nota: "Copertina e impaginazione" },
];

export const STATI_TESTO: { valore: TextState; label: string; nota: string }[] = [
  {
    valore: "finito-revisionato",
    label: "Finito e già revisionato",
    nota: "Serve poco o niente sul testo",
  },
  {
    valore: "finito-da-revisionare",
    label: "Finito, da revisionare",
    nota: "Scritto tutto, mai editato",
  },
  { valore: "bozza-incompleta", label: "Bozza incompleta", nota: "Manca ancora una parte" },
  { valore: "solo-materiali", label: "Solo materiali", nota: "Diari, appunti, registrazioni" },
];

export const QUANTITA_MATERIALE: { valore: MaterialAmount; label: string; nota: string }[] = [
  { valore: "scarso", label: "Poco", nota: "Qualche appunto, molti ricordi da raccogliere" },
  { valore: "parziale", label: "Discreto", nota: "Materiale sparso ma consistente" },
  { valore: "abbondante", label: "Molto", nota: "Diari o registrazioni ordinate e complete" },
];

export const PRESET_PAROLE = [20_000, 50_000, 80_000, 120_000] as const;

export const SERVIZI: { valore: ServiceKey; label: string; nota: string }[] = [
  { valore: "editing", label: "Editing", nota: "Intervento su struttura, stile, voce" },
  { valore: "proofreading", label: "Correzione bozze", nota: "Refusi, ortografia, punteggiatura" },
  { valore: "layout", label: "Impaginazione cartacea", nota: "Interni pronti per la stampa" },
  { valore: "epub", label: "Conversione EPUB", nota: "Ebook validato" },
  { valore: "cover", label: "Copertina", nota: "Fronte, retro e dorso" },
  { valore: "kdp", label: "Pubblicazione KDP", nota: "Caricamento su Amazon" },
  { valore: "isbn", label: "ISBN esterno", nota: "Assistenza per un ISBN tuo" },
  { valore: "amazonListing", label: "Scheda Amazon", nota: "Descrizione, keyword, categorie" },
];

export const TEMPI: { valore: "standard" | "prioritaria"; label: string; nota: string }[] = [
  { valore: "standard", label: "Standard", nota: "Entra nel normale piano di lavorazione" },
  { valore: "prioritaria", label: "Prioritaria", nota: "Corsia veloce, con maggiorazione" },
];

/** Servizi consigliati quando si arriva da una pagina servizio. */
export function serviziPrecompilati(slugServizio?: string): ServiceKey[] {
  switch (slugServizio) {
    case "revisione-e-pubblicazione":
      return ["editing", "layout", "epub", "cover", "kdp"];
    case "copertina-e-impaginazione":
      return ["cover", "layout", "epub"];
    case "dal-diario-al-libro":
    case "libro-per-professionisti":
      return ["layout", "epub", "cover", "kdp"];
    default:
      return [];
  }
}
