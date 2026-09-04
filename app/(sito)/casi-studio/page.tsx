import type { Route } from "next";
import Link from "next/link";
import type { Metadata } from "next";
import { Sezione, Apertura, Filetto } from "@/components/ui/primitivi";
import { Chiusa } from "@/components/sezioni/blocchi";
import { CASE_STUDIES } from "@/config/case-studies";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Casi studio",
  descrizione:
    "Progetti editoriali reali seguiti da Proemios: un memoir nato da trent'anni di diari, una pubblicazione KDP con ISBN proprio, un manuale professionale.",
  path: "/casi-studio",
});

export default function CasiStudioPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Casi studio", path: "/casi-studio" },
        ])}
      />
      <Sezione>
        <Apertura
          as="h1"
          folio="01"
          etichetta="Casi studio"
          titolo="Libri che sono usciti"
          glossa="Dove il cliente ha chiesto riservatezza, il caso è reso anonimo."
          occhiello={
            <p>
              Ogni progetto parte da un materiale diverso e finisce con un libro. Qui trovi da dove
              si è partiti, cosa abbiamo fatto e com&rsquo;è andata.
            </p>
          }
        />

        <div className="mt-14 space-y-6">
          {CASE_STUDIES.map((c) => (
            <Link
              key={c.slug}
              href={`/casi-studio/${c.slug}` as Route}
              className="garbo group rounded-lg border-bordo bg-superficie hover:border-viola grid gap-6 border p-6 sm:grid-cols-[1.6fr_1fr] sm:p-8"
            >
              <div>
                <p className="etichetta text-lime">{c.cliente}</p>
                <h2 className="text-testo mt-3 text-2xl leading-snug font-medium">
                  {c.titolo}
                </h2>
                <p className="prosa mt-3 max-w-xl">{c.sottotitolo}</p>
                <span className="garbo etichetta text-viola-chiaro mt-5 inline-block group-hover:translate-x-0.5">
                  Leggi il caso
                </span>
              </div>

              <dl className="border-bordo grid grid-cols-3 gap-4 self-center border-t pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
                {c.dati.map((d, i) => (
                  <div key={i}>
                    <dt className="cifre text-testo text-lg font-medium">{d.valore}</dt>
                    <dd className="text-testo-tenue mt-1 text-xs leading-tight">{d.etichetta}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>

        <Filetto className="mt-12" />
        <p className="editoriale text-testo-tenue mt-6 max-w-2xl">
          I casi contrassegnati come dimostrativi illustrano il metodo di lavoro e non corrispondono
          a una lavorazione conclusa.
        </p>
      </Sezione>
      <Chiusa />
    </>
  );
}
