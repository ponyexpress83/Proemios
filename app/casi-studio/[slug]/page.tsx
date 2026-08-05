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
import { getService } from "@/config/services";
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
  const servizio = getService(caso.servizio);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Casi studio", path: "/casi-studio" },
          { nome: caso.titolo, path: `/casi-studio/${caso.slug}` },
        ])}
      />

      <section className="bg-notte text-carta su-notte py-14 sm:py-20">
        <Gabbia>
          <Link href={"/casi-studio" as Route} className="apparato text-carta/50 hover:text-carta">
            ← Tutti i casi
          </Link>
          <p className="apparato text-ottone mt-8">{caso.cliente}</p>
          <h1 className="font-display mt-3 max-w-3xl text-[2.3rem] leading-[1.08] font-medium sm:text-[3.1rem]">
            {caso.titolo}
          </h1>
          <p className="prosa-grande text-carta/75 mt-5 max-w-2xl">{caso.sottotitolo}</p>

          {!caso.autorizzato && (
            <div className="mt-6">
              <Etichetta tono="ottone">Caso dimostrativo</Etichetta>
            </div>
          )}

          <dl className="border-filetto-notte mt-10 grid max-w-2xl grid-cols-3 gap-6 border-t pt-8">
            {caso.dati.map((d, i) => (
              <div key={i}>
                <dt className="cifre text-carta text-xl font-medium">{d.valore}</dt>
                <dd className="text-carta/55 mt-1 text-xs leading-tight">{d.etichetta}</dd>
              </div>
            ))}
          </dl>
        </Gabbia>
      </section>

      <Sezione>
        <Impaginato margine={<Folio n={1} etichetta="Il caso" />}>
          <div className="specchio space-y-10">
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
              <figure className="border-ottone border-l-2 pl-6">
                <blockquote className="font-display text-inchiostro text-xl leading-snug font-normal italic sm:text-2xl">
                  &ldquo;{caso.citazione.testo}&rdquo;
                </blockquote>
                <figcaption className="apparato text-stampa mt-4">
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
                  Percorso: {servizio.name}
                </Titolo>
                <p className="prosa mt-3 max-w-xl">{servizio.claim}</p>
              </div>
              <Link
                href={`/servizi/${servizio.slug}` as Route}
                className="apparato text-alloro shrink-0 hover:underline"
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
