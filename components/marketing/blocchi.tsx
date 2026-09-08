import type { Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Gabbia, Titolo } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { PrezzoRiga } from "./prezzo";
import { Apparizione } from "./apparizione";
import type { Percorso, Servizio } from "@/config/catalogo";
import { cn } from "@/lib/cn";

/** Scheda di un percorso nelle griglie di catalogo e in home. */
export function SchedaPercorso({ percorso }: { percorso: Percorso }) {
  return (
    <Link
      href={`/percorsi/${percorso.slug}` as Route}
      className="garbo group flex h-full flex-col gap-3 rounded-lg border border-bordo bg-superficie p-6 hover:border-bordo-forte hover:bg-superficie-viva"
    >
      <h3 className="text-lg font-semibold text-testo">{percorso.nome}</h3>
      <p className="flex-1 text-sm leading-relaxed text-testo-attenuato">{percorso.claim}</p>
      <span className="etichetta garbo flex items-center gap-1.5 text-viola-chiaro group-hover:gap-2.5">
        Vedi il percorso
        <ArrowRight className="size-3" aria-hidden />
      </span>
    </Link>
  );
}

/** Scheda di un singolo servizio. */
export function SchedaServizio({ servizio }: { servizio: Servizio }) {
  return (
    <Link
      href={`/servizi/${servizio.slug}` as Route}
      className="garbo group flex h-full flex-col gap-2 rounded-lg border border-bordo bg-superficie p-5 hover:border-bordo-forte hover:bg-superficie-viva"
    >
      <h3 className="text-base font-medium text-testo">{servizio.nome}</h3>
      <p className="flex-1 text-sm leading-relaxed text-testo-tenue">{servizio.sommario}</p>
      <div className="mt-2 flex items-center justify-between border-t border-bordo pt-3">
        <PrezzoRiga prezzo={servizio.prezzo} />
        <ArrowRight
          aria-hidden
          className="garbo size-3.5 text-testo-tenue group-hover:translate-x-0.5 group-hover:text-viola-chiaro"
        />
      </div>
    </Link>
  );
}

/** Elenco numerato di passaggi: usato per i processi e i percorsi. */
export function Passi({
  passi,
  className,
}: {
  passi: ReadonlyArray<{ titolo: string; descrizione: string }>;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-px overflow-hidden rounded-lg bg-bordo sm:grid-cols-2 lg:grid-cols-4", className)}>
      {passi.map((p, i) => (
        <li key={p.titolo} className="flex flex-col gap-3 bg-superficie p-6">
          <span className="cifre text-sm text-viola-chiaro">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="text-base font-medium text-testo">{p.titolo}</h3>
          <p className="text-sm leading-relaxed text-testo-tenue">{p.descrizione}</p>
        </li>
      ))}
    </ol>
  );
}

/** Fascia di chiusura con la doppia CTA: preventivo (self service) o call (umano). */
export function FasciaCta({
  titolo = "Dicci cosa hai in mano.",
  testo = "Due minuti per un preventivo con i numeri, o venti per parlarne con una persona. In entrambi i casi non ti vendiamo niente che non ti serva.",
  ctaPrimaria = { href: "/preventivo", testo: "Fai il preventivo" },
  ctaSecondaria = { href: "/contatti", testo: "Parla con noi" },
}: {
  titolo?: string;
  testo?: string;
  ctaPrimaria?: { href: string; testo: string };
  ctaSecondaria?: { href: string; testo: string };
}) {
  return (
    <section className="border-y border-bordo bg-fondo-alto">
      <Gabbia className="relative overflow-hidden py-20">
        <span className="alone top-1/2 -left-24 size-72 -translate-y-1/2 bg-viola/30" />
        <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl flex-col gap-4">
            <h2 className="text-3xl font-semibold text-testo sm:text-4xl">{titolo}</h2>
            <p className="text-base leading-relaxed text-testo-attenuato">{testo}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <BottoneLink href={ctaPrimaria.href} variante="identita" misura="grande">
              {ctaPrimaria.testo}
            </BottoneLink>
            <BottoneLink href={ctaSecondaria.href} variante="secondario" misura="grande">
              {ctaSecondaria.testo}
            </BottoneLink>
          </div>
        </div>
      </Gabbia>
    </section>
  );
}

/** Citazione editoriale: l'unico punto in cui compare la serif. */
export function Citazione({ children, fonte }: { children: string; fonte?: string }) {
  return (
    <figure className="flex flex-col gap-4">
      <blockquote className="editoriale text-2xl leading-snug text-testo sm:text-3xl">
        “{children}”
      </blockquote>
      {fonte ? (
        <figcaption className="etichetta text-testo-tenue">{fonte}</figcaption>
      ) : null}
    </figure>
  );
}

/** Intestazione di sezione riutilizzabile, con comparsa allo scorrimento. */
export function IntestazioneSezione({
  occhiello,
  titolo,
  sotto,
  azione,
}: {
  occhiello?: string;
  titolo: string;
  sotto?: string;
  azione?: { href: string; testo: string };
}) {
  return (
    <Apparizione className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <Titolo occhiello={occhiello} sotto={sotto} className="max-w-2xl">
        {titolo}
      </Titolo>
      {azione ? (
        <BottoneLink href={azione.href} variante="secondario" className="shrink-0">
          {azione.testo}
        </BottoneLink>
      ) : null}
    </Apparizione>
  );
}
