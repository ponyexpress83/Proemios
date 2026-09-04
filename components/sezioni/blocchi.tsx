import type { ReactNode } from "react";
import { Gabbia } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { AZIONI } from "@/config/copy";
import { cn } from "@/lib/cn";

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
export function Processo({
  passi,
  className,
}: {
  passi: ReadonlyArray<Passo>;
  className?: string;
}) {
  const normalizzati = passi.map(normalizzaPasso);
  return (
    <ol
      className={cn(
        "grid gap-px overflow-hidden rounded-lg bg-bordo sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {normalizzati.map((p, i) => (
        <li key={p.titolo} className="flex flex-col gap-3 bg-superficie p-6">
          <span className="cifre text-sm text-viola-chiaro">{String(i + 1).padStart(2, "0")}</span>
          <h3 className="text-base font-medium text-testo">{p.titolo}</h3>
          <p className="text-sm leading-relaxed text-testo-tenue">{p.descrizione}</p>
        </li>
      ))}
    </ol>
  );
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
    <section className="border-y border-bordo bg-fondo-alto">
      <Gabbia className="relative overflow-hidden py-20">
        <span className="alone top-1/2 -left-24 size-72 -translate-y-1/2 bg-viola/30" />
        <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl flex-col gap-4">
            <h2 className="text-3xl font-semibold text-testo sm:text-4xl">{titolo}</h2>
            <div className="text-base leading-relaxed text-testo-attenuato">{testo}</div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <BottoneLink href={hrefPreventivo} variante="identita" misura="grande">
              {labelPrimaria}
            </BottoneLink>
            <BottoneLink href={hrefSecondario} variante="secondario" misura="grande">
              {labelSecondaria}
            </BottoneLink>
          </div>
        </div>
      </Gabbia>
    </section>
  );
}
