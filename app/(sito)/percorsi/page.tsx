import type { Metadata } from "next";
import { Sezione, Titolo } from "@/components/ui/primitivi";
import { Apparizione } from "@/components/marketing/apparizione";
import { FasciaCta, SchedaPercorso } from "@/components/marketing/blocchi";
import { PERCORSI } from "@/config/percorsi";
import { metadatiPagina } from "@/lib/seo";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo";

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
      <Sezione ampiezza="compatta">
          <Titolo
            livello={1}
            occhiello="Percorsi"
            sotto="Il punto di partenza non è il servizio che vuoi comprare: è il punto in cui sei. Scegli quello che ti somiglia e vedi cosa comporta."
            className="max-w-3xl"
          >
            Da dove parti?
          </Titolo>
      </Sezione>

      <Sezione ampiezza="compatta" className="pt-0 md:pt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERCORSI.map((p, i) => (
              <Apparizione key={p.slug} ritardo={(i % 3) * 0.06}>
                <SchedaPercorso percorso={p} />
              </Apparizione>
            ))}
          </div>
      </Sezione>

      <FasciaCta
        titolo="Nessuno dei percorsi ti somiglia?"
        testo="Succede, ed è il motivo per cui esiste la call. Raccontaci il caso e ti diciamo cosa serve davvero — anche se la risposta è «per ora niente»."
        ctaPrimaria={{ href: "/contatti", testo: "Parla con noi" }}
        ctaSecondaria={{ href: "/servizi", testo: "Vedi i servizi singoli" }}
      />
    </>
  );
}
