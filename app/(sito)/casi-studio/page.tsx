import type { Metadata } from "next";
import { Foglio } from "@/components/sito/foglio";
import { Contenitore, Sezione } from "@/components/sito/sezione";
import { FasciaCta } from "@/components/marketing/blocchi";
import { CASE_STUDIES } from "@/config/case-studies";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Casi studio",
  descrizione:
    "Progetti editoriali reali seguiti da Proemios: un memoir nato da trent'anni di diari, una pubblicazione KDP con ISBN proprio, un manuale professionale.",
  path: "/casi-studio",
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Casi studio", path: "/casi-studio" },
        ])}
      />
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="mb-10 max-w-giustezza lg:mb-14">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">Casi studio</h1>
            <p className="mt-4 text-t-md text-grafite">
              Progetti raccontati per intero: il punto di partenza, il lavoro, l&rsquo;esito. Resi
              anonimi dove serve, pubblicati solo con l&rsquo;autorizzazione di chi li ha vissuti.
            </p>
          </div>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {CASE_STUDIES.map((c) => (
              <Foglio key={c.slug} as="li" href={`/casi-studio/${c.slug}`} className="flex flex-col">
                <p className="maiuscoletto text-t-sm text-grafite">{c.cliente}</p>
                <h2 className="mt-2 font-serif text-t-md leading-snug text-inchiostro">{c.titolo}</h2>
                <p className="mt-2 flex-1 text-t-sm text-grafite">{c.sottotitolo}</p>
                {!c.autorizzato && <p className="mt-4 text-t-xs text-grafite">Caso dimostrativo</p>}
              </Foglio>
            ))}
          </ul>
        </Contenitore>
      </Sezione>
      <FasciaCta />
    </>
  );
}
