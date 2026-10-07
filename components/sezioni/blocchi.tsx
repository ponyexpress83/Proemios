import type { ReactNode } from "react";
import { FasciaCta, Passi } from "@/components/marketing/blocchi";
import { AZIONI } from "@/config/copy";

/**
 * I passaggi arrivano da tre fonti con nomi di campo diversi (config/services.ts
 * in inglese, le pagine di contenuto in italiano). Normalizzarli qui evita di
 * riscrivere ogni sorgente e di avere tre componenti quasi identici.
 */
type Passo =
  | { title: string; desc: string }
  | { titolo: string; descrizione: string }
  | { titolo: string; testo: string };

function normalizzaPasso(p: Passo): { titolo: string; descrizione: string } {
  if ("title" in p) return { titolo: p.title, descrizione: p.desc };
  if ("descrizione" in p) return p;
  return { titolo: p.titolo, descrizione: p.testo };
}

export { ElencoIncluso, ElencoEscluso } from "./elenchi";

/** Processo in passaggi numerati, per le pagine di contenuto. */
export function Processo({ passi, className }: { passi: ReadonlyArray<Passo>; className?: string }) {
  return <Passi passi={passi.map(normalizzaPasso)} className={className} />;
}

/** Chiusura di pagina con doppia CTA: self service oppure una persona. */
export function Chiusa({
  titolo = "Da dove vuoi cominciare?",
  testo = "Puoi avere il prezzo in due minuti, oppure far leggere il testo e capire prima a che punto sei. Nessuna delle due strade ti impegna a nulla.",
  hrefPreventivo = "/preventivo",
  labelPrimaria = AZIONI.preventivo,
  hrefSecondario = "/analisi-manoscritto",
  labelSecondaria = AZIONI.analisi,
}: {
  titolo?: string;
  testo?: ReactNode;
  hrefPreventivo?: string;
  labelPrimaria?: string;
  hrefSecondario?: string;
  labelSecondaria?: string;
}) {
  return (
    <FasciaCta
      titolo={titolo}
      testo={typeof testo === "string" ? testo : undefined}
      ctaPrimaria={{ href: hrefPreventivo, testo: labelPrimaria }}
      ctaSecondaria={{ href: hrefSecondario, testo: labelSecondaria }}
    />
  );
}
