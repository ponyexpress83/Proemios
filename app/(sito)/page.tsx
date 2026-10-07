import type { Metadata } from "next";
import { Hero } from "@/components/sito/home/hero";
import { PercorsiHome } from "@/components/sito/home/percorsi";
import dynamic from "next/dynamic";

// Lo slider è sotto la piega e porta con sé il suo JavaScript: lo si carica a
// parte, ma resta reso sul server, così l'HTML e il layout non cambiano.
const Confronto = dynamic(() => import("@/components/sito/home/confronto").then((m) => m.Confronto));
import { Tappe } from "@/components/sito/home/tappe";
import { AreaAutoreDemo } from "@/components/sito/home/area-autore";
import { IndiceServizi } from "@/components/sito/home/indice-servizi";
import { Collegamento } from "@/components/sito/collegamento";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Intestazione, Sezione } from "@/components/sito/sezione";
import { AZIONI } from "@/config/copy";
import { computeQuote } from "@/lib/pricing";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Dall'idea al libro pubblicato",
  descrizione:
    "Editing, impaginazione, copertina, pubblicazione su Amazon KDP e ISBN, con un editor che legge il tuo testo. Preventivo in sei domande, analisi gratuita del manoscritto.",
  path: "/",
});

/** I numeri dell'anteprima vengono dal listino, non da un segnaposto. */
const PAROLE_ESEMPIO = 50_000;
const esempio = computeQuote({
  projectType: "romanzo",
  textState: "finito-da-revisionare",
  wordCount: PAROLE_ESEMPIO,
});
const consigliato = esempio.packages.find((p) => p.recommended) ?? esempio.packages[1]!;

export default function Home() {
  return (
    <>
      <Hero />

      <Sezione filetto etichettatoDa="h-percorsi">
        <Contenitore>
          <Intestazione
            id="h-percorsi"
            titolo="Da dove parti?"
            lead="Non il servizio che vuoi comprare: il punto in cui sei. Scegli quello che ti somiglia."
          />
          <PercorsiHome />
        </Contenitore>
      </Sezione>

      <Sezione tono="ombra" etichettatoDa="h-cura">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-16">
            <div className="lg:order-2">
              <Intestazione
                id="h-cura"
                titolo="La cura si vede."
                lead="Un editor non riscrive: corregge dove serve, e lo spiega. Ogni intervento resta visibile, e lo approvi tu."
                className="mb-6"
              />
              <Collegamento href="/servizi/editing-stilistico">Il lavoro dietro ogni pagina</Collegamento>
            </div>
            <div className="lg:order-1">
              <Confronto />
            </div>
          </div>
        </Contenitore>
      </Sezione>

      <Sezione etichettatoDa="h-come">
        <Contenitore>
          <Intestazione
            id="h-come"
            titolo="Come funziona"
            lead="Cinque passaggi, nell'ordine in cui succedono. E tre cose che restano ferme dall'inizio alla fine."
          />
          <Tappe />
        </Contenitore>
      </Sezione>

      <Sezione tono="inchiostro" etichettatoDa="h-area">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
            <div>
              <Intestazione
                id="h-area"
                titolo="Il tuo libro, in un posto solo."
                lead="Fasi, revisioni, approvazioni, pagamenti e consegne: tutto nell'area autore, dalla prima lettura ai file finali."
                className="mb-6"
              />
              <PulsanteLink href="/accedi" variante="secondario" freccia>
                Prova l&rsquo;area autore
              </PulsanteLink>
            </div>
            <div>
              <AreaAutoreDemo
                parole={PAROLE_ESEMPIO}
                totale={consigliato.total}
                acconto={consigliato.deposit}
              />
              <p className="mt-3 text-t-xs text-grafite-su-inchiostro">
                Dati di esempio, calcolati dal listino per un romanzo di 50&nbsp;000 parole.
              </p>
            </div>
          </div>
        </Contenitore>
      </Sezione>

      <Sezione filetto etichettatoDa="h-servizi">
        <Contenitore>
          <Intestazione
            id="h-servizi"
            titolo="Servizi"
            lead="Ogni lavorazione si compra per conto suo. Dove c'è una tariffa la trovi scritta; dove dipende dal testo, c'è scritto perché."
            azione={<Collegamento href="/servizi">Tutti i servizi</Collegamento>}
          />
          <IndiceServizi />
        </Contenitore>
      </Sezione>

      <div className="border-y border-filetto bg-carta-ombra">
        <Contenitore className="flex flex-col gap-3 py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-t-base text-inchiostro">
            Agenzie e publisher: produzione a marchio vostro, referente dedicato, listino riservato.
          </p>
          <Collegamento href="/per-agenzie" className="shrink-0">
            Proemios per agenzie
          </Collegamento>
        </Contenitore>
      </div>

      <Sezione etichettatoDa="h-chiusura">
        <Contenitore stretto className="text-center">
          <h2 id="h-chiusura" className="font-serif text-t-xl text-balance text-inchiostro">
            Quanto costa il tuo libro?
          </h2>
          <p className="mt-4 text-t-md text-grafite">
            Sei domande. La stima compare mentre rispondi, senza lasciare dati personali.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PulsanteLink href="/preventivo" variante="primario">
              {AZIONI.preventivo}
            </PulsanteLink>
            <PulsanteLink href="/analisi-manoscritto" variante="secondario">
              {AZIONI.analisi}
            </PulsanteLink>
          </div>
        </Contenitore>
      </Sezione>
    </>
  );
}
