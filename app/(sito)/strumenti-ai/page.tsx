import type { Metadata } from "next";
import { Foglio } from "@/components/sito/foglio";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Intestazione, Sezione } from "@/components/sito/sezione";
import { PianiAi } from "@/components/moduli/piani-ai";
import { Faq } from "@/components/sezioni/faq";
import { FasciaCta } from "@/components/marketing/blocchi";
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
    azione: "Analizza il manoscritto",
  },
  {
    titolo: "Configuratore di preventivo",
    testo:
      "Tre percorsi con prezzo calcolato sulle tariffe reali, non su una forbice generica. Con dentro e fuori dichiarati.",
    stato: "Disponibile ora, gratis",
    href: "/preventivo",
    azione: "Calcola il preventivo",
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

      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="max-w-giustezza">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">{STRUMENTI_AI.titolo}</h1>
            <p className="mt-4 text-t-md text-grafite">{STRUMENTI_AI.occhiello}</p>
            <p className="mt-4 text-t-sm text-grafite">
              La tecnologia accelera il processo. Le decisioni editoriali restano umane.
            </p>
          </div>
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore>
          <Intestazione titolo="Quello che puoi usare oggi" />
          <ul className="grid gap-5 sm:grid-cols-2">
            {DISPONIBILI.map((d) => (
              <Foglio key={d.titolo} as="li" className="flex flex-col">
                <p className="maiuscoletto text-t-sm text-esito-ok">{d.stato}</p>
                <h3 className="mt-2 font-serif text-t-md text-inchiostro">{d.titolo}</h3>
                <p className="mt-2 flex-1 text-t-sm text-grafite">{d.testo}</p>
                <div className="mt-5">
                  <PulsanteLink href={d.href} variante="secondario" freccia>
                    {d.azione}
                  </PulsanteLink>
                </div>
              </Foglio>
            ))}
          </ul>
        </Contenitore>
      </Sezione>

      <Sezione>
        <Contenitore>
          <Intestazione
            titolo="I piani"
            lead="Tre livelli: uno gratuito che resta gratuito, uno per chi pubblica sul serio, uno per chi gestisce più libri. Mensile o annuale, senza vincoli di durata."
          />
          <PianiAi />
        </Contenitore>
      </Sezione>

      <Sezione filetto>
        <Contenitore>
          <Intestazione
            titolo="Cosa stiamo costruendo"
            lead="L'ordine di uscita lo decide chi è in lista: costruiamo prima quello che serve di più."
          />
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {IN_ARRIVO.map((v) => (
              <li key={v} className="border-b border-filetto py-3 text-t-base text-inchiostro">
                {v}
              </li>
            ))}
          </ul>
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <h2 className="font-serif text-t-xl text-inchiostro">Domande ricorrenti</h2>
            <div>
              <Faq voci={FAQ} />
              <p className="mt-8 text-t-sm text-grafite">{BRAND.aiDisclaimer}</p>
            </div>
          </div>
        </Contenitore>
      </Sezione>

      <FasciaCta
        titolo="Ti serve il libro, non lo strumento?"
        testo="Gli abbonamenti servono a chi lavora da sé. Se vuoi che il libro lo facciamo noi, il percorso è un altro."
        ctaPrimaria={{ href: "/preventivo", testo: AZIONI.preventivo }}
        ctaSecondaria={{ href: "/contatti", testo: "Parla con un editor" }}
      />
    </>
  );
}
