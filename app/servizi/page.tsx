import type { Metadata } from "next";
import { Sezione, Apertura } from "@/components/ui/primitivi";
import { SchedaServizio, Chiusa } from "@/components/sezioni/blocchi";
import { SERVICES } from "@/config/services";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Servizi editoriali",
  descrizione:
    "I sei percorsi di Proemios: valutazione editoriale, revisione e pubblicazione, ghostwriting da diari, libro per professionisti, copertina e impaginazione, produzione white label per agenzie.",
  path: "/servizi",
});

export default function ServiziPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Servizi", path: "/servizi" },
        ])}
      />
      <Sezione>
        <Apertura
          as="h1"
          folio="01"
          etichetta="Servizi"
          titolo="Sei percorsi editoriali"
          glossa="Non serve prenderli tutti: si comincia dal punto in cui sei."
          occhiello={
            <p>
              Ogni percorso parte da una situazione diversa: un testo finito, una bozza, dei
              quaderni, o solo la copertina che manca. Trova il tuo e vedi cosa comprende, come
              procede e quanto costa.
            </p>
          }
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <SchedaServizio key={s.slug} servizio={s} />
          ))}
        </div>
      </Sezione>
      <Chiusa />
    </>
  );
}
