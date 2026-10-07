import type { Metadata } from "next";
import { FlussoAnalisi } from "@/components/analisi/flusso";
import { Contenitore, Sezione } from "@/components/sito/sezione";
import { env } from "@/lib/env";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Analisi gratuita del manoscritto",
  descrizione:
    "Carica il tuo testo e ricevi una prima diagnosi editoriale: leggibilità misurata, ritmo, ripetizioni, coerenza dei tempi verbali, lettore-tipo e fascia di costo.",
  path: "/analisi-manoscritto",
});

export default function AnalisiPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Analisi del manoscritto", path: "/analisi-manoscritto" },
        ])}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="mx-auto mb-8 max-w-2xl lg:mb-12">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">
              Analizza il manoscritto
            </h1>
            <p className="mt-4 text-t-md text-grafite">
              Carica il testo e ricevi una prima diagnosi: leggibilità, ritmo, tic ricorrenti, tempi
              verbali, lettore-tipo e una fascia di costo calcolata sul conteggio reale delle parole.
              Gratis, in meno di un minuto.
            </p>
          </div>
          <FlussoAnalisi giorniConservazione={env.MANUSCRIPT_RETENTION_DAYS} />
        </Contenitore>
      </Sezione>
    </>
  );
}
