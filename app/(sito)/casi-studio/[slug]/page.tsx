import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Collegamento } from "@/components/sito/collegamento";
import { Contenitore, Filetto, Sezione } from "@/components/sito/sezione";
import { Citazione } from "@/components/marketing/blocchi";
import { Chiusa } from "@/components/sezioni/blocchi";
import { CASE_STUDIES, getCaseStudy } from "@/config/case-studies";
import { getServizio } from "@/config/catalogo";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const caso = getCaseStudy(slug);
  if (!caso) return {};
  return metadatiPagina({
    titolo: caso.titolo,
    descrizione: caso.sottotitolo,
    path: `/casi-studio/${caso.slug}`,
  });
}

export default async function CasoStudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caso = getCaseStudy(slug);
  if (!caso) notFound();
  const servizio = getServizio(caso.servizio);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Casi studio", path: "/casi-studio" },
          { nome: caso.titolo, path: `/casi-studio/${caso.slug}` },
        ])}
      />

      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <Collegamento href="/casi-studio" className="text-t-sm">
            ← Tutti i casi
          </Collegamento>
          <p className="maiuscoletto mt-8 text-t-sm text-grafite">
            {caso.cliente}
            {!caso.autorizzato && ", caso dimostrativo"}
          </p>
          <h1 className="mt-2 max-w-giustezza font-serif text-t-display text-balance text-inchiostro">{caso.titolo}</h1>
          <p className="mt-4 max-w-giustezza text-t-md text-grafite">{caso.sottotitolo}</p>

          <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-6 border-t border-filetto pt-8">
            {caso.dati.map((d, i) => (
              <div key={i}>
                <dt className="tabellare font-serif text-t-lg text-inchiostro">{d.valore}</dt>
                <dd className="mt-1 text-t-xs text-grafite">{d.etichetta}</dd>
              </div>
            ))}
          </dl>
        </Contenitore>
      </Sezione>

      <Sezione filetto>
        <Contenitore stretto className="space-y-10">
          {[
            ["Il punto di partenza", caso.puntoDiPartenza],
            ["La lavorazione", caso.lavorazione],
            ["L’esito", caso.esito],
          ].map(([titolo, testo]) => (
            <div key={titolo}>
              <h2 className="font-serif text-t-xl text-inchiostro">{titolo}</h2>
              <Filetto className="mt-4" />
              <p className="mt-5 font-serif text-t-base text-inchiostro">{testo}</p>
            </div>
          ))}
          {caso.citazione && <Citazione fonte={caso.citazione.fonte}>{caso.citazione.testo}</Citazione>}
        </Contenitore>
      </Sezione>

      {servizio && (
        <Sezione filetto tono="ombra">
          <Contenitore className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-giustezza">
              <h2 className="font-serif text-t-xl text-inchiostro">Il servizio: {servizio.nome}</h2>
              <p className="mt-3 text-t-base text-grafite">{servizio.sommario}</p>
            </div>
            <Collegamento href={`/servizi/${servizio.slug}`} className="shrink-0">
              Vedi il servizio
            </Collegamento>
          </Contenitore>
        </Sezione>
      )}

      <Chiusa />
    </>
  );
}
