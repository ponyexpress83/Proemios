import { Foglio } from "@/components/sito/foglio";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Collegamento } from "@/components/sito/collegamento";
import { Contenitore, Intestazione } from "@/components/sito/sezione";
import { PrezzoRiga } from "./prezzo";
import type { Percorso, Servizio } from "@/config/catalogo";
import { cn } from "@/lib/cn";

/** Scheda di un percorso: un foglio, intero cliccabile, un solo link. */
export function SchedaPercorso({ percorso }: { percorso: Percorso }) {
  return (
    <Foglio href={`/percorsi/${percorso.slug}`} className="flex h-full flex-col">
      <h3 className="font-serif text-t-md leading-snug text-inchiostro">{percorso.nome}</h3>
      <p className="mt-2 flex-1 text-t-sm text-grafite">{percorso.claim}</p>
    </Foglio>
  );
}

/** Scheda di un singolo servizio: titolo, una riga, la tariffa. */
export function SchedaServizio({ servizio }: { servizio: Servizio }) {
  return (
    <Foglio href={`/servizi/${servizio.slug}`} className="flex h-full flex-col">
      <h3 className="font-serif text-t-md leading-snug text-inchiostro">{servizio.nome}</h3>
      <p className="mt-2 flex-1 text-t-sm text-grafite">{servizio.sommario}</p>
      <div className="mt-4 border-t border-filetto pt-3">
        <PrezzoRiga prezzo={servizio.prezzo} />
      </div>
    </Foglio>
  );
}

/** Passaggi numerati: qui i numeri hanno senso, è una sequenza. */
export function Passi({
  passi,
  className,
}: {
  passi: ReadonlyArray<{ titolo: string; descrizione: string }>;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {passi.map((p, i) => (
        <li key={p.titolo} className="flex gap-4 lg:block">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-pillola border border-inchiostro font-serif text-t-base text-inchiostro lg:mb-4">
            {i + 1}
          </span>
          <div>
            <h3 className="font-serif text-t-md text-inchiostro">{p.titolo}</h3>
            <p className="mt-1 text-t-sm text-grafite">{p.descrizione}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Chiusura di pagina: una domanda, una riga, due pulsanti. */
export function FasciaCta({
  titolo = "Quanto costa il tuo libro?",
  testo = "Sei domande per un preventivo con i numeri, o venti minuti per parlarne con una persona. In nessun caso ti vendiamo qualcosa che non ti serve.",
  ctaPrimaria = { href: "/preventivo", testo: "Calcola il preventivo" },
  ctaSecondaria = { href: "/contatti", testo: "Parla con un editor" },
}: {
  titolo?: string;
  testo?: string;
  ctaPrimaria?: { href: string; testo: string };
  ctaSecondaria?: { href: string; testo: string };
}) {
  return (
    <section className="border-t border-filetto py-sezione-mobile lg:py-sezione" aria-label={titolo}>
      <Contenitore stretto className="text-center">
        <h2 className="font-serif text-t-xl text-balance text-inchiostro">{titolo}</h2>
        <p className="mt-4 text-t-md text-grafite">{testo}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <PulsanteLink href={ctaPrimaria.href} variante="primario">
            {ctaPrimaria.testo}
          </PulsanteLink>
          <PulsanteLink href={ctaSecondaria.href} variante="secondario">
            {ctaSecondaria.testo}
          </PulsanteLink>
        </div>
      </Contenitore>
    </section>
  );
}

/** Citazione: l'unico posto, oltre ai titoli di opere, dove il corsivo è di casa. */
export function Citazione({ children, fonte }: { children: string; fonte?: string }) {
  return (
    <figure className="border-l-2 border-rosso-matita pl-6">
      <blockquote className="font-serif text-t-md italic text-inchiostro">«{children}»</blockquote>
      {fonte ? <figcaption className="mt-3 text-t-sm text-grafite">{fonte}</figcaption> : null}
    </figure>
  );
}

/** Intestazione di sezione riutilizzabile. `occhiello` resta per compatibilità e non si mostra. */
export function IntestazioneSezione({
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
    <Intestazione
      titolo={titolo}
      lead={sotto}
      azione={azione ? <Collegamento href={azione.href}>{azione.testo}</Collegamento> : undefined}
    />
  );
}
