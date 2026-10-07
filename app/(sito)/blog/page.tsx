import type { Metadata } from "next";
import { Foglio } from "@/components/sito/foglio";
import { Contenitore, Sezione } from "@/components/sito/sezione";
import { FasciaCta } from "@/components/marketing/blocchi";
import { tuttiGliArticoli } from "@/lib/blog";
import { articles as guideEditoriali } from "@/lib/editorial-content";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Guide sull'autopubblicazione",
  descrizione:
    "Costi, ISBN, Amazon KDP, editing, EPUB, ghostwriting: guide pratiche per chi vuole pubblicare un libro senza dover indovinare.",
  path: "/blog",
});

export default function Page() {
  const articoli = tuttiGliArticoli().filter((a) => a.pubblicato);
  const voci = [
    ...articoli.map((a) => ({ slug: a.slug, titolo: a.titolo, sommario: a.descrizione, tag: a.categoria })),
    ...guideEditoriali.map((a) => ({ slug: a.slug, titolo: a.title, sommario: a.summary, tag: a.tag })),
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Guide", path: "/blog" },
        ])}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="mb-10 max-w-giustezza lg:mb-14">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">Guide</h1>
            <p className="mt-4 text-t-md text-grafite">
              Le domande che un autore si fa prima di spendere: costi, ISBN, Amazon KDP, editing o
              correzione, file finali. Risposte concrete, nell&rsquo;ordine in cui servono.
            </p>
          </div>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {voci.map((v) => (
              <Foglio key={v.slug} as="li" href={`/blog/${v.slug}`} className="flex flex-col" aria-label={v.titolo}>
                <p className="maiuscoletto text-t-sm text-grafite">{v.tag}</p>
                <h2 className="mt-2 font-serif text-t-md leading-snug text-inchiostro">{v.titolo}</h2>
                <p className="mt-2 flex-1 text-t-sm text-grafite">{v.sommario}</p>
              </Foglio>
            ))}
          </ul>
        </Contenitore>
      </Sezione>
      <FasciaCta />
    </>
  );
}
