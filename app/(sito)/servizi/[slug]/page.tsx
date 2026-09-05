import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Gabbia, Sezione, Titolo, Occhiello, Dato } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { Scheda } from "@/components/ui/scheda";
import { Apparizione } from "@/components/marketing/apparizione";
import { FasciaCta, IntestazioneSezione, SchedaServizio } from "@/components/marketing/blocchi";
import { Prezzo } from "@/components/marketing/prezzo";
import { ElencoEscluso, ElencoIncluso } from "@/components/sezioni/elenchi";
import { AREE, SLUG_SERVIZI, getServizio } from "@/config/catalogo";
import { PERCORSI } from "@/config/percorsi";
import { metadatiPagina, JsonLd, breadcrumbJsonLd, serviceJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return SLUG_SERVIZI.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const servizio = getServizio(slug);
  if (!servizio) return metadatiPagina({ titolo: "Servizio", descrizione: "", path: "/servizi" });
  return metadatiPagina({
    titolo: servizio.nome,
    descrizione: servizio.sommario,
    path: `/servizi/${servizio.slug}`,
  });
}

export default async function PaginaServizio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const servizio = getServizio(slug);
  if (!servizio) notFound();

  const correlati = (servizio.correlati ?? []).map(getServizio).filter((s) => s !== undefined);
  const percorsi = PERCORSI.filter((p) => p.servizi.includes(servizio.slug));
  const hrefPreventivo = servizio.prefillPreventivo
    ? `/preventivo?tipo=${servizio.prefillPreventivo}`
    : "/preventivo";

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Servizi", path: "/servizi" },
            { nome: servizio.nome, path: `/servizi/${servizio.slug}` },
          ]),
          serviceJsonLd({
            nome: servizio.nome,
            descrizione: servizio.sommario,
            slug: servizio.slug,
            prezzo:
              servizio.prezzo.tipo === "fascia"
                ? { min: servizio.prezzo.da, max: servizio.prezzo.a }
                : servizio.prezzo.tipo === "forfait"
                  ? { min: servizio.prezzo.importo, max: servizio.prezzo.importo }
                  : null,
          }),
        ]}
      />

      <section className="relative overflow-hidden border-b border-bordo">
        <span className="alone -top-24 left-1/4 size-80 bg-viola/20" />
        <Gabbia className="relative">
          <div className="grid gap-12 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-20">
            <div className="flex flex-col gap-6">
              <Occhiello>{AREE[servizio.area].nome}</Occhiello>
              <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{servizio.nome}</h1>
              <p className="max-w-2xl text-lg leading-relaxed text-testo-attenuato">
                {servizio.sommario}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <BottoneLink href={hrefPreventivo} variante="identita" misura="grande">
                  Calcola il prezzo
                  <ArrowRight className="size-4" aria-hidden />
                </BottoneLink>
                <BottoneLink href="/contatti" variante="fantasma" misura="grande">
                  Fai una domanda
                </BottoneLink>
              </div>
            </div>

            <Scheda variante="sollevata" className="flex h-fit flex-col gap-5 p-6">
              <div className="flex flex-col gap-1.5">
                <span className="etichetta text-testo-tenue">Prezzo</span>
                <Prezzo prezzo={servizio.prezzo} />
              </div>
              <div className="border-t border-bordo pt-5">
                <Dato etichetta="Cosa fa variare">{servizio.variabili}</Dato>
              </div>
              <div className="border-t border-bordo pt-5">
                <Dato etichetta="Per chi">{servizio.perChi}</Dato>
              </div>
            </Scheda>
          </div>
        </Gabbia>
      </section>

      <Sezione ampiezza="compatta">
          <Apparizione className="lettura flex flex-col gap-4">
            <Occhiello>Il problema</Occhiello>
            <p className="editoriale text-2xl leading-snug text-testo sm:text-3xl">
              {servizio.problema}
            </p>
          </Apparizione>
      </Sezione>

      <Sezione className="border-t border-bordo" ampiezza="compatta">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Apparizione className="flex flex-col gap-6">
              <Titolo livello={2} occhiello="Cosa comprende">
                Quello che ricevi.
              </Titolo>
              <ElencoIncluso voci={servizio.include} />
            </Apparizione>

            {servizio.esclude?.length ? (
              <Apparizione ritardo={0.1} className="flex flex-col gap-6">
                <Titolo livello={2} occhiello="Cosa non comprende">
                  Quello che non ricevi.
                </Titolo>
                <ElencoEscluso voci={servizio.esclude} />
                <p className="text-sm leading-relaxed text-testo-tenue">
                  Lo scriviamo prima perché è la fonte più comune di malintesi. Se ti serve anche
                  questo, si aggiunge al preventivo — non si scopre a lavoro finito.
                </p>
              </Apparizione>
            ) : null}
          </div>
      </Sezione>

      {percorsi.length ? (
        <Sezione className="border-t border-bordo" ampiezza="compatta">
            <IntestazioneSezione
              occhiello="Fa parte di"
              titolo="I percorsi che lo includono."
              sotto="Se ti serve più di questo servizio, un percorso lo mette in ordine con gli altri e in un solo preventivo."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {percorsi.map((p) => (
                <a
                  key={p.slug}
                  href={`/percorsi/${p.slug}`}
                  className="garbo flex flex-col gap-2 rounded-lg border border-bordo bg-superficie p-5 hover:border-bordo-forte hover:bg-superficie-viva"
                >
                  <span className="text-base font-medium text-testo">{p.nome}</span>
                  <span className="text-sm leading-relaxed text-testo-tenue">{p.claim}</span>
                </a>
              ))}
            </div>
        </Sezione>
      ) : null}

      {correlati.length ? (
        <Sezione className="border-t border-bordo" ampiezza="compatta">
            <IntestazioneSezione occhiello="Spesso insieme" titolo="Servizi correlati." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {correlati.map((s) => (
                <SchedaServizio key={s.slug} servizio={s} />
              ))}
            </div>
        </Sezione>
      ) : null}

      <FasciaCta ctaPrimaria={{ href: hrefPreventivo, testo: "Calcola il prezzo" }} />
    </>
  );
}
