import type { Metadata } from "next";
import { Contenitore, Sezione } from "@/components/sito/sezione";
import { FasciaCta, SchedaPercorso } from "@/components/marketing/blocchi";
import { PERCORSI } from "@/config/percorsi";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Percorsi",
  descrizione:
    "Otto percorsi editoriali completi: dal manoscritto finito al memoir, dalla pubblicazione alla promozione, fino al white label per agenzie.",
  path: "/percorsi",
});

export default function PaginaPercorsi() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Percorsi", path: "/percorsi" },
        ])}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="mb-10 max-w-giustezza lg:mb-14">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">Da dove parti?</h1>
            <p className="mt-4 text-t-md text-grafite">
              Il punto di partenza non è il servizio che vuoi comprare: è il punto in cui sei.
              Scegli quello che ti somiglia e vedi cosa comporta.
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PERCORSI.map((p) => (
              <li key={p.slug}>
                <SchedaPercorso percorso={p} />
              </li>
            ))}
          </ul>
        </Contenitore>
      </Sezione>
      <FasciaCta
        titolo="Nessuno dei percorsi ti somiglia?"
        testo="Succede, ed è il motivo per cui esiste la call. Raccontaci il caso e ti diciamo cosa serve davvero, anche se la risposta è «per ora niente»."
        ctaPrimaria={{ href: "/contatti", testo: "Parla con un editor" }}
        ctaSecondaria={{ href: "/servizi", testo: "Vedi i servizi singoli" }}
      />
    </>
  );
}
