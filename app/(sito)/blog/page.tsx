import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Sezione, Apertura, Filetto, Etichetta } from "@/components/ui/primitivi";
import { Chiusa } from "@/components/sezioni/blocchi";
import { tuttiGliArticoli, categorie } from "@/lib/blog";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Guide sull'autopubblicazione",
  descrizione:
    "Costi, ISBN, Amazon KDP, editing, EPUB, ghostwriting: guide pratiche per chi vuole pubblicare un libro senza dover indovinare.",
  path: "/blog",
});

export default function BlogPage() {
  const articoli = tuttiGliArticoli();
  const cats = categorie(articoli);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Blog", path: "/blog" },
        ])}
      />
      <Sezione>
        <Apertura
          as="h1"
          folio="01"
          etichetta="Guide"
          titolo="Quello che nessuno spiega"
          glossa="Se una guida ti risparmia una call, ha fatto il suo lavoro."
          occhiello={
            <p>
              Costi reali, procedure vere, differenze che contano. Scritte per chi deve decidere,
              non per posizionarsi su una parola chiave.
            </p>
          }
        />

        {articoli.length === 0 ? (
          <p className="prosa mt-12">Nessuna guida disponibile al momento.</p>
        ) : (
          <div className="mt-14 space-y-14">
            {cats.map((cat) => (
              <div key={cat}>
                <h2 className="etichetta text-lime">{cat}</h2>
                <Filetto className="mt-3" />
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {articoli
                    .filter((a) => a.categoria === cat)
                    .map((a) => (
                      <Link
                        key={a.slug}
                        href={`/blog/${a.slug}` as Route}
                        className="garbo group rounded-lg border-bordo bg-superficie hover:border-viola flex flex-col border p-6 hover:-translate-y-0.5"
                      >
                        <h3 className="text-testo text-lg leading-snug font-medium">
                          {a.titolo}
                        </h3>
                        <p className="prosa mt-2 flex-1 text-[0.95rem]">{a.descrizione}</p>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          {!a.pubblicato && <Etichetta>In redazione</Etichetta>}
                          <span className="garbo etichetta text-viola-chiaro ml-auto group-hover:translate-x-0.5">
                            Apri
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Sezione>
      <Chiusa />
    </>
  );
}
