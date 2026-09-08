import type { Metadata } from "next";
import {
  Gabbia,
  Sezione,
  Impaginato,
  Folio,
  NotaMargine,
  Filetto,
  Titolo,
  Scheda,
} from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { PianiAi } from "@/components/moduli/piani-ai";
import { Faq } from "@/components/sezioni/faq";
import { STRUMENTI_AI, AZIONI } from "@/config/copy";
import { BRAND } from "@/config/brand";
import { metadatiPagina, JsonLd, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Strumenti AI per il self-publishing",
  descrizione:
    "Analisi del manoscritto, assistente editoriale, ottimizzazione della scheda Amazon: gli strumenti di Proemios in abbonamento mensile o annuale. Lista d'attesa aperta.",
  path: "/strumenti-ai",
});

const DISPONIBILI = [
  {
    titolo: "Analisi del manoscritto",
    testo:
      "Leggibilità misurata con l'indice Gulpease, ritmo, ripetizioni, cliché, coerenza dei tempi verbali, lettore-tipo e livello di intervento consigliato.",
    stato: "Disponibile ora, gratis",
    href: "/analisi-manoscritto",
  },
  {
    titolo: "Configuratore di preventivo",
    testo:
      "Tre percorsi con prezzo calcolato sulle tariffe reali, non su una forbice generica. Con dentro e fuori dichiarati.",
    stato: "Disponibile ora, gratis",
    href: "/preventivo",
  },
];

const IN_ARRIVO = [
  "Assistente editoriale specializzato in self-publishing",
  "Ottimizzatore della scheda Amazon: titolo, sottotitolo, keyword, categorie",
  "Generatore di quarta di copertina e descrizione commerciale",
  "Suggerimenti su Kindle Unlimited e strategia di lancio",
  "Concept preliminari di copertina, da rifinire con il grafico",
  "Archivio dei manoscritti e delle versioni",
];

const FAQ = [
  {
    q: "L'abbonamento sostituisce il lavoro editoriale?",
    a: "No, e non deve. Gli strumenti accelerano diagnosi e preparazione: la decisione editoriale e la lavorazione restano in mano a chi le sa fare. Chi cerca un libro finito compra un servizio, non un abbonamento.",
  },
  {
    q: "Quanto costa e quando apre?",
    a: "I prezzi sono quelli indicati in questa pagina, mensili o annuali. L'apertura è prevista dopo la fase di validazione: chi è in lista viene avvisato per primo e mantiene le condizioni di lancio.",
  },
  {
    q: "Iscriversi alla lista impegna a qualcosa?",
    a: "No. Non chiediamo metodo di pagamento e puoi cancellarti quando vuoi. Serve a capire quali strumenti costruire per primi.",
  },
  {
    q: "Cosa posso usare già adesso?",
    a: "L'analisi del manoscritto e il configuratore di preventivo sono attivi, gratuiti e non richiedono registrazione.",
  },
];

export default function StrumentiAiPage() {
  return (
    <>
      <JsonLd
        data={[
          faqJsonLd(FAQ),
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Strumenti AI", path: "/strumenti-ai" },
          ]),
        ]}
      />

      <section className="bg-fondo pt-14 pb-12 sm:pt-20">
        <Gabbia>
          <Impaginato
            margine={
              <>
                <Folio n="00" etichetta="Strumenti" />
                <NotaMargine>
                  La tecnologia accelera il processo. Le decisioni editoriali restano umane.
                </NotaMargine>
              </>
            }
          >
            <h1 className="text-[2.4rem] leading-[1.06] font-medium sm:text-[3.2rem]">
              {STRUMENTI_AI.titolo}
            </h1>
            <Filetto className="mt-6" />
            <p className="text-lg leading-relaxed text-testo-attenuato lettura mt-6">{STRUMENTI_AI.occhiello}</p>
          </Impaginato>
        </Gabbia>
      </section>

      {/* Già disponibili */}
      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={1} etichetta="Attivi" />}>
          <Titolo as="h2">Quello che puoi usare oggi</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {DISPONIBILI.map((d) => (
              <Scheda key={d.titolo} className="flex flex-col">
                <p className="etichetta text-viola-chiaro">{d.stato}</p>
                <h3 className="mt-3 text-xl font-medium">{d.titolo}</h3>
                <p className="prosa mt-2 flex-1 text-[0.95rem]">{d.testo}</p>
                <Filetto className="my-4" />
                <div>
                  <BottoneLink href={d.href} variante="secondario">
                    Provalo
                  </BottoneLink>
                </div>
              </Scheda>
            ))}
          </div>
        </Impaginato>
      </Sezione>

      {/* Piani, sul lato notte: è software */}
      <section className="bg-fondo-alto text-testo  py-16 sm:py-24">
        <Gabbia>
          <div className="mb-10">
            <p className="etichetta text-lime">§ 02 · Abbonamento</p>
            <Titolo as="h2" className="mt-5">
              I piani
            </Titolo>
            <Filetto className="mt-5" />
            <p className="text-lg leading-relaxed text-testo-attenuato text-testo-attenuato mt-6 max-w-2xl">
              Tre livelli: uno gratuito che resta gratuito, uno per chi pubblica sul serio, uno per
              chi gestisce più libri. Mensile o annuale, senza vincoli di durata.
            </p>
          </div>
          <PianiAi />
        </Gabbia>
      </section>

      {/* In arrivo */}
      <Sezione>
        <Impaginato margine={<Folio n={3} etichetta="In lavorazione" />}>
          <Titolo as="h2">Cosa stiamo costruendo</Titolo>
          <Filetto className="mt-5" />
          <p className="lettura text-base leading-relaxed text-testo-attenuato mt-6">
            L&rsquo;ordine di uscita lo decide chi è in lista: costruiamo prima quello che serve di
            più.
          </p>
          <ul className="mt-8 grid gap-x-10 gap-y-1 sm:grid-cols-2">
            {IN_ARRIVO.map((v) => (
              <li key={v} className="border-bordo flex items-baseline gap-3 border-b py-3">
                <span className="cifre text-lime text-xs" aria-hidden>
                  ○
                </span>
                <span className="prosa text-[1rem]">{v}</span>
              </li>
            ))}
          </ul>
        </Impaginato>
      </Sezione>

      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={4} etichetta="Domande" />}>
          <Titolo as="h2">Domande ricorrenti</Titolo>
          <div className="mt-8">
            <Faq voci={FAQ} />
          </div>
          <p className="editoriale text-testo-tenue mt-10 max-w-2xl">{BRAND.aiDisclaimer}</p>
        </Impaginato>
      </Sezione>

      <Sezione>
        <Impaginato margine={<Folio n={5} etichetta="Servizi" />}>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Titolo as="h2">Ti serve il libro, non lo strumento?</Titolo>
              <p className="prosa mt-3 max-w-xl">
                Gli abbonamenti servono a chi lavora da sé. Se vuoi che il libro lo facciamo noi, il
                percorso è un altro.
              </p>
            </div>
            <BottoneLink href="/preventivo" misura="grande" className="shrink-0">
              {AZIONI.preventivo}
            </BottoneLink>
          </div>
        </Impaginato>
      </Sezione>
    </>
  );
}
