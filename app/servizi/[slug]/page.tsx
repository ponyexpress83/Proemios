import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Gabbia,
  Sezione,
  Impaginato,
  Folio,
  NotaMargine,
  Filetto,
  Titolo,
  Scheda,
} from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { Processo, ElencoIncluso, Chiusa } from "@/components/sezioni/blocchi";
import { Faq } from "@/components/sezioni/faq";
import { SERVICES, getService } from "@/config/services";
import { BRAND } from "@/config/brand";
import { AZIONI } from "@/config/copy";
import { fascia } from "@/lib/format";
import { metadatiPagina, JsonLd, serviceJsonLd, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const servizio = getService(slug);
  if (!servizio) return {};
  return metadatiPagina({
    titolo: servizio.name,
    descrizione: servizio.claim,
    path: `/servizi/${servizio.slug}`,
  });
}

export default async function ServizioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const servizio = getService(slug);
  if (!servizio) notFound();

  const isWhiteLabel = servizio.priceRange === null;
  const prezzo = servizio.priceRange
    ? fascia(servizio.priceRange.min, servizio.priceRange.max)
    : "Listino riservato";

  const hrefPreventivo = isWhiteLabel
    ? "/per-agenzie"
    : servizio.quotePrefill
      ? `/preventivo?tipo=${servizio.quotePrefill}&servizio=${servizio.slug}`
      : "/preventivo";

  const labelPrimaria = isWhiteLabel ? AZIONI.agenzie : AZIONI.preventivo;
  const hrefSecondario = isWhiteLabel ? "/contatti" : "/analisi-manoscritto";
  const labelSecondaria = isWhiteLabel ? AZIONI.consulenza : AZIONI.analisi;

  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd({
            nome: servizio.name,
            descrizione: servizio.claim,
            slug: servizio.slug,
            prezzo: servizio.priceRange,
          }),
          faqJsonLd(servizio.faq),
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Servizi", path: "/servizi" },
            { nome: servizio.name, path: `/servizi/${servizio.slug}` },
          ]),
        ]}
      />

      {/* Apertura */}
      <section className="bg-carta pt-14 pb-12 sm:pt-20">
        <Gabbia>
          <Impaginato
            margine={
              <>
                <Folio n="§" etichetta="Servizio" />
                <NotaMargine>{servizio.priceDrivers}</NotaMargine>
              </>
            }
          >
            <h1 className="font-display text-[2.4rem] leading-[1.06] font-medium sm:text-[3.2rem]">
              {servizio.name}
            </h1>
            <Filetto className="mt-6" />
            <p className="prosa-grande specchio mt-6">{servizio.claim}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BottoneLink href={hrefPreventivo} misura="grande">
                {labelPrimaria}
              </BottoneLink>
              <BottoneLink href={hrefSecondario} variante="secondario" misura="grande">
                {labelSecondaria}
              </BottoneLink>
            </div>
          </Impaginato>
        </Gabbia>
      </section>

      {/* Il problema */}
      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={1} etichetta="Da dove parti" />}>
          <Titolo as="h2">Il punto di partenza</Titolo>
          <Filetto className="mt-5" />
          <p className="prosa-grande specchio mt-6">{servizio.problem}</p>
        </Impaginato>
      </Sezione>

      {/* Cosa include */}
      <Sezione>
        <Impaginato margine={<Folio n={2} etichetta="Contenuto" />}>
          <Titolo as="h2">Cosa comprende</Titolo>
          <Filetto className="mt-5" />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <ElencoIncluso voci={servizio.includes} />

            <Scheda className="h-fit">
              <p className="apparato text-ottone">
                {isWhiteLabel ? "Condizioni" : "Fascia di prezzo"}
              </p>
              <p className="cifre text-inchiostro mt-3 text-2xl font-medium">{prezzo}</p>
              <Filetto className="my-4" />
              <p className="prosa text-[0.95rem]">{servizio.priceDrivers}</p>
              {!isWhiteLabel && (
                <>
                  <Filetto className="my-4" />
                  <BottoneLink href={hrefPreventivo} variante="secondario" className="w-full">
                    Calcola il tuo
                  </BottoneLink>
                </>
              )}
            </Scheda>
          </div>
        </Impaginato>
      </Sezione>

      {/* Processo */}
      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n={3} etichetta="Metodo" />}>
          <Titolo as="h2">Come procede</Titolo>
          <div className="mt-8">
            <Processo passi={servizio.process.map((p) => ({ titolo: p.title, testo: p.desc }))} />
          </div>
        </Impaginato>
      </Sezione>

      {/* FAQ */}
      <Sezione>
        <Impaginato margine={<Folio n={4} etichetta="Domande" />}>
          <Titolo as="h2">Domande ricorrenti</Titolo>
          <div className="mt-8">
            <Faq voci={servizio.faq} />
          </div>
          <p className="glossa mt-10 max-w-2xl">{BRAND.aiDisclaimer}</p>
        </Impaginato>
      </Sezione>

      <Chiusa
        hrefPreventivo={hrefPreventivo}
        labelPrimaria={labelPrimaria}
        hrefSecondario={hrefSecondario}
        labelSecondaria={labelSecondaria}
      />
    </>
  );
}
