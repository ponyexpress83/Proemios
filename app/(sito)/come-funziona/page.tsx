import type { Metadata } from "next";
import { Tappe } from "@/components/sito/home/tappe";
import { Contenitore, Intestazione, Sezione } from "@/components/sito/sezione";
import { ElencoIncluso } from "@/components/sezioni/elenchi";
import { Faq } from "@/components/sezioni/faq";
import { FasciaCta } from "@/components/marketing/blocchi";
import { metadatiPagina, JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Come funziona",
  descrizione:
    "Il processo di Proemios dall'inizio alla pubblicazione: come si arriva al preventivo, come si lavora sul testo, chi approva cosa e come esce il libro.",
  path: "/come-funziona",
});

const FAQ = [
  {
    q: "Quando inizia il lavoro?",
    a: "Dopo l'accettazione della proposta e il versamento dell'acconto, con i materiali e le condizioni concordate. La data è scritta nel piano di lavoro.",
  },
  {
    q: "Quanto dura un progetto?",
    a: "Dipende da lunghezza, interventi richiesti e tempi di feedback. Il calendario viene condiviso nel piano di lavoro e aggiornato nell'area autore.",
  },
  {
    q: "Posso cambiare il lavoro concordato dopo l'inizio?",
    a: "Sì. Valutiamo insieme l'effetto della modifica su tempi e costi prima di procedere, e lo mettiamo per iscritto.",
  },
  {
    q: "Chi decide sulle correzioni?",
    a: "Tu. Ogni intervento resta visibile e lo approvi o lo rifiuti; niente passa al libro senza il tuo sì.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Come funziona", path: "/come-funziona" },
          ]),
          faqJsonLd(FAQ),
        ]}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="mb-10 max-w-giustezza lg:mb-14">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">Come funziona</h1>
            <p className="mt-4 text-t-md text-grafite">
              Definiamo il lavoro, condividiamo le tappe e rendiamo visibile ogni passaggio. Sai
              cosa sta succedendo, chi se ne occupa e cosa devi approvare.
            </p>
          </div>
          <Tappe qui="/come-funziona" />
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Intestazione titolo="Il tuo ruolo" lead="Carichi i materiali nell'area autore, commenti le revisioni e approvi le consegne. Le versioni precedenti restano, così segui il lavoro senza perdere il filo." className="mb-6" />
              <ElencoIncluso
                voci={[
                  "Feedback raccolto per fase, non a fine lavoro",
                  "Consegne definite nel piano di lavoro",
                  "Approvazioni prima del passaggio successivo",
                  "File finali nei formati concordati",
                ]}
              />
            </div>
            <div>
              <h2 className="mb-6 font-serif text-t-xl text-inchiostro">Domande frequenti</h2>
              <Faq voci={FAQ} />
            </div>
          </div>
        </Contenitore>
      </Sezione>

      <FasciaCta />
    </>
  );
}
