import type { Metadata } from "next";
import { ModuloAgenzia } from "@/components/moduli/modulo-agenzia";
import { Contenitore, Intestazione, Sezione } from "@/components/sito/sezione";
import { ElencoIncluso } from "@/components/sezioni/elenchi";
import { AGENZIE } from "@/config/copy";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Produzione editoriale per agenzie",
  descrizione:
    "Proemios come reparto produttivo esterno per agenzie di ghostwriting, comunicazione e personal branding: white label, NDA, referente dedicato, listino riservato.",
  path: "/per-agenzie",
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Per agenzie", path: "/per-agenzie" },
        ])}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="max-w-giustezza">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">{AGENZIE.titolo}</h1>
            <p className="mt-4 text-t-md text-grafite">{AGENZIE.occhiello}</p>
          </div>
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Intestazione titolo="Cosa comprende" className="mb-6" />
              <ElencoIncluso
                voci={[
                  "Editing, scrittura e produzione coordinati, a marchio vostro",
                  "Brief e consegne definiti per ogni progetto",
                  "Flusso di revisione e approvazione concordato con voi",
                  "Riservatezza e responsabilità per iscritto, prima di iniziare",
                  "Un referente dedicato e un listino riservato per il vostro volume",
                ]}
              />
              <p className="mt-6 text-t-sm text-grafite">
                Brand, accessi, scambio dei file e approvazioni vengono definiti nel progetto, non
                improvvisati al primo titolo.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-t-xl text-inchiostro">Raccontateci come lavorate</h2>
              <p className="mt-3 text-t-base text-grafite">
                Quali servizi volete proporre, chi gestisce il rapporto con il cliente, quanti
                titoli l&rsquo;anno. Vi rispondiamo con l&rsquo;accordo di riservatezza e il listino.
              </p>
              <div className="mt-6 rounded-foglio bg-bianco p-6 shadow-foglio">
                <ModuloAgenzia />
              </div>
            </div>
          </div>
        </Contenitore>
      </Sezione>
    </>
  );
}
