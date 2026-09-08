import type { TonoBadge } from "@/components/ui/badge";
import type { StatoLead } from "@/lib/crm/pipeline";

export const ETICHETTA_STATO: Record<StatoLead, string> = {
  nuovo: "Nuovo",
  qualificato: "Qualificato",
  call: "Call",
  proposta: "Proposta",
  cliente: "Cliente",
  produzione: "In produzione",
  post_pubblicazione: "Post-pubblicazione",
  perso: "Perso",
};

export const TONO_STATO: Record<StatoLead, TonoBadge> = {
  nuovo: "neutro",
  qualificato: "informazione",
  call: "viola",
  proposta: "attenzione",
  cliente: "lime",
  produzione: "successo",
  post_pubblicazione: "successo",
  perso: "errore",
};

export const ETICHETTA_FONTE: Record<string, string> = {
  preventivo: "Preventivo",
  analisi: "Analisi manoscritto",
  contatto: "Contatto",
  agenzie: "Agenzie",
};

/**
 * Fascia di temperatura del lead. Le soglie sono le stesse usate dalla release
 * Ads Ready per decidere la CTA sul sito: un lead "caldo" lì deve essere caldo
 * anche qui, altrimenti il commerciale e il marketing parlano di cose diverse.
 */
export function temperatura(punteggio: number | null): {
  etichetta: string;
  tono: TonoBadge;
} {
  if (punteggio === null) return { etichetta: "Non valutato", tono: "neutro" };
  if (punteggio >= 75) return { etichetta: "Caldo", tono: "lime" };
  if (punteggio >= 45) return { etichetta: "Tiepido", tono: "attenzione" };
  return { etichetta: "Freddo", tono: "neutro" };
}
