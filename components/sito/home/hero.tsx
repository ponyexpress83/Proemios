import Image from "next/image";
import { Collegamento } from "@/components/sito/collegamento";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Inserimento } from "@/components/sito/segni";
import { AZIONI } from "@/config/copy";

/**
 * L'hero. Il titolo è leggibile da subito: si anima solo il segno di
 * inserimento — un ⁁ rosso che si traccia in 700 ms sotto la parola «tua»,
 * che sale al suo posto appena il tratto è finito. Nel DOM la frase è
 * completa, «Dai forma alla tua storia»: lo screen reader la legge intera.
 *
 * Nessuna animazione sull'H1 o sull'immagine: sono l'LCP.
 */
const RASSICURAZIONI = [
  "I diritti restano tuoi",
  "Prezzi chiari prima di iniziare",
  "La stima non chiede dati personali",
];

export function Hero() {
  return (
    <div className="mx-auto grid w-full max-w-pagina gap-10 px-4 pt-10 pb-12 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:pt-16 lg:pb-20">
      <div className="max-w-giustezza">
        <h1 className="font-serif text-t-display text-balance text-inchiostro">
          Dai forma alla{" "}
          <span className="inserzione">
            <span className="inserzione-parola">tua</span>
            <Inserimento anima className="inserzione-segno" />
          </span>{" "}
          storia.
        </h1>
        <p className="mt-6 text-t-md text-grafite text-pretty">
          Editing, impaginazione, copertina e pubblicazione, con un editor che legge davvero il tuo
          testo e un prezzo chiaro prima di iniziare.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <PulsanteLink href="/preventivo" variante="primario">
            {AZIONI.preventivo}
          </PulsanteLink>
          <PulsanteLink href="/analisi-manoscritto" variante="secondario">
            Analizza il manoscritto gratis
          </PulsanteLink>
        </div>
        <p className="mt-4">
          <Collegamento href="/contatti">Parla con un editor</Collegamento>
        </p>

        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-filetto pt-5 text-t-sm text-grafite">
          {RASSICURAZIONI.map((r, i) => (
            <li key={r} className={i > 0 ? "border-l border-filetto pl-5" : undefined}>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto w-full max-w-[220px] lg:max-w-[460px]">
        <Image
          src="/images/editorial-hero.webp"
          width={850}
          height={850}
          sizes="(max-width: 1023px) 220px, 460px"
          priority
          fetchPriority="high"
          alt="Un libro rilegato, con il manoscritto che spunta dalle pagine"
        />
      </div>
    </div>
  );
}
