import type { Route } from "next";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Gabbia,
  Sezione,
  Impaginato,
  Folio,
  Filetto,
  Titolo,
  Etichetta,
} from "@/components/ui/primitivi";
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

      <section className="bg-fondo-alto text-testo  py-14 sm:py-20">
        <Gabbia>
          <Link href={"/casi-studio" as Route} className="etichetta text-testo-tenue hover:text-testo">
            ← Tutti i casi
          </Link>
          <p className="etichetta text-lime mt-8">{caso.cliente}</p>
          <h1 className="mt-3 max-w-3xl text-[2.3rem] leading-[1.08] font-medium sm:text-[3.1rem]">
            {caso.titolo}
          </h1>
          <p className="text-lg leading-relaxed text-testo-attenuato text-testo-attenuato mt-5 max-w-2xl">{caso.sottotitolo}</p>

          {!caso.autorizzato && (
            <div className="mt-6">
              <Etichetta>Caso dimostrativo</Etichetta>
            </div>
          )}

          <dl className="border-bordo mt-10 grid max-w-2xl grid-cols-3 gap-6 border-t pt-8">
            {caso.dati.map((d, i) => (
              <div key={i}>
                <dt className="cifre text-testo text-xl font-medium">{d.valore}</dt>
                <dd className="text-testo-tenue mt-1 text-xs leading-tight">{d.etichetta}</dd>
              </div>
            ))}
          </dl>
        </Gabbia>
      </section>

      <Sezione>
        <Impaginato margine={<Folio n={1} etichetta="Il caso" />}>
          <div className="lettura space-y-10">
            <div>
              <Titolo as="h2" className="text-[1.5rem]">
                Il punto di partenza
              </Titolo>
              <Filetto className="mt-4" />
              <p className="prosa mt-5">{caso.puntoDiPartenza}</p>
            </div>
            <div>
              <Titolo as="h2" className="text-[1.5rem]">
                La lavorazione
              </Titolo>
              <Filetto className="mt-4" />
              <p className="prosa mt-5">{caso.lavorazione}</p>
            </div>
            <div>
              <Titolo as="h2" className="text-[1.5rem]">
                L&rsquo;esito
              </Titolo>
              <Filetto className="mt-4" />
              <p className="prosa mt-5">{caso.esito}</p>
            </div>

            {caso.citazione && (
              <figure className="border-lime border-l-2 pl-6">
                <blockquote className="text-testo text-xl leading-snug font-normal italic sm:text-2xl">
                  &ldquo;{caso.citazione.testo}&rdquo;
                </blockquote>
                <figcaption className="etichetta text-testo-tenue mt-4">
                  {caso.citazione.fonte}
                </figcaption>
              </figure>
            )}
          </div>
        </Impaginato>
      </Sezione>

      {servizio && (
        <Sezione fondo="bassa">
          <Impaginato margine={<Folio n={2} etichetta="Servizio" />}>
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Titolo as="h2" className="text-[1.6rem]">
                  Percorso: {servizio.nome}
                </Titolo>
                <p className="prosa mt-3 max-w-xl">{servizio.sommario}</p>
              </div>
              <Link
                href={`/servizi/${servizio.slug}` as Route}
                className="etichetta text-viola-chiaro shrink-0 hover:underline"
              >
                Vedi il servizio →
              </Link>
            </div>
          </Impaginato>
        </Sezione>
      )}

      <Chiusa />
    </>
  );
}
