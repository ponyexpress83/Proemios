import type { ProjectType, Service } from "@/config/services";
import type { TextState } from "@/lib/pricing";
import type { Servizio } from "@/config/pricing";
import { SERVIZIO_LABELS } from "@/config/pricing";

export const PROJECT_OPTIONS: { value: ProjectType; label: string; nota: string }[] = [
  { value: "romanzo", label: "Romanzo", nota: "Narrativa, fiction" },
  { value: "saggio", label: "Saggio", nota: "Non-fiction, divulgazione" },
  { value: "memoir", label: "Memoir da materiali grezzi", nota: "Diari, vocali, appunti" },
  { value: "professionale", label: "Libro professionale", nota: "Autorevolezza, business" },
  { value: "grafica", label: "Solo grafica", nota: "Copertina e impaginazione" },
];

export const TEXT_STATE_OPTIONS: { value: TextState; label: string; nota: string }[] = [
  { value: "scritto-revisionato", label: "Già scritto e revisionato", nota: "Pronto o quasi" },
  { value: "scritto-da-revisionare", label: "Già scritto, da revisionare", nota: "Serve editing" },
  { value: "bozza-incompleta", label: "Bozza incompleta", nota: "Da completare e curare" },
  { value: "solo-materiali", label: "Solo materiali", nota: "Diario, appunti, vocali" },
];

export const WORD_PRESETS = [20000, 50000, 80000, 120000] as const;

export const SERVIZIO_OPTIONS: { value: Servizio; label: string }[] = (
  Object.keys(SERVIZIO_LABELS) as Servizio[]
).map((s) => ({ value: s, label: SERVIZIO_LABELS[s] }));

export const TEMPISTICA_OPTIONS: {
  value: "standard" | "prioritaria";
  label: string;
  nota: string;
}[] = [
  { value: "standard", label: "Standard", nota: "Tempi ordinari di lavorazione" },
  { value: "prioritaria", label: "Prioritaria", nota: "Corsia veloce (+25%)" },
];

/** Mappa il tipo di progetto in eventuale stato del testo di default. */
export function defaultTextStateFor(pt: ProjectType): TextState {
  if (pt === "memoir") return "solo-materiali";
  if (pt === "grafica") return "scritto-revisionato";
  return "scritto-da-revisionare";
}

/** Precompila i servizi consigliati a partire da un pacchetto di servizio. */
export function prefillServiziForService(service: Service | undefined): Servizio[] {
  if (!service) return [];
  switch (service.slug) {
    case "revisione-e-pubblicazione":
      return ["editing", "impaginazioneCartacea", "epub", "copertina", "pubblicazioneKdp"];
    case "copertina-e-impaginazione":
      return ["copertina", "impaginazioneCartacea", "epub"];
    case "dal-diario-al-libro":
    case "libro-per-professionisti":
      return ["impaginazioneCartacea", "epub", "copertina", "pubblicazioneKdp"];
    default:
      return [];
  }
}
