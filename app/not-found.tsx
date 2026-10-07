import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore } from "@/components/sito/sezione";
import { Cancellatura } from "@/components/sito/segni";

/**
 * 404. Il titolo arriva dal layout radice; `<title>` e la description qui
 * dentro vengono sollevati nell'`<head>` da React, perché `not-found.tsx` non
 * può esportare `metadata`. Due vie d'uscita: la home e il preventivo.
 */
export default function NonTrovata() {
  return (
    <div data-tema="carta" className="flex min-h-dvh flex-col bg-carta text-inchiostro">
      <title>Pagina non trovata · Proemios</title>
      <meta
        name="description"
        content="Questa pagina non esiste o è stata spostata. Torna alla home o calcola il preventivo per il tuo libro."
      />
      <main id="contenuto" className="flex flex-1 items-center">
        <Contenitore stretto className="py-sezione-mobile lg:py-sezione">
          <p className="maiuscoletto text-t-sm text-grafite">Errore 404</p>
          <h1 className="mt-3 font-serif text-t-display text-balance text-inchiostro">
            Questa pagina{" "}
            <span className="relative inline-block whitespace-nowrap">
              non c&rsquo;è.
              <Cancellatura className="absolute inset-x-0 top-1/2 h-[0.3em] w-full -translate-y-1/2" />
            </span>
          </h1>
          <p className="mt-6 text-t-md text-grafite">
            Il link è sbagliato oppure la pagina è stata spostata. Da qui puoi tornare indietro senza
            perdere niente.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PulsanteLink href="/" variante="primario">
              Torna alla home
            </PulsanteLink>
            <PulsanteLink href="/preventivo" variante="secondario">
              Calcola il preventivo
            </PulsanteLink>
          </div>
        </Contenitore>
      </main>
    </div>
  );
}
