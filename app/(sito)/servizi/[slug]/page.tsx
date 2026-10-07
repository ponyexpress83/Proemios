import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Foglio } from "@/components/sito/foglio";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Intestazione, Sezione } from "@/components/sito/sezione";
import { SchedaServizioEditoriale } from "@/components/sito/contenuti-editoriali";
import { FasciaCta, SchedaServizio } from "@/components/marketing/blocchi";
import { Prezzo } from "@/components/marketing/prezzo";
import { ElencoEscluso, ElencoIncluso } from "@/components/sezioni/elenchi";
import { AREE, SLUG_SERVIZI, getServizio } from "@/config/catalogo";
import { PERCORSI } from "@/config/percorsi";
import { services as serviziEditoriali } from "@/lib/editorial-content";
import { metadatiPagina, JsonLd, breadcrumbJsonLd, serviceJsonLd } from "@/lib/seo";

/**
 * Il catalogo (`config/catalogo.ts`) è la sorgente canonica: ha le tariffe ed
 * è il bersaglio dei 301 di `next.config.mjs`. Tre slug in più — `editing`,
 * `pubblicazione`, `promozione` — vengono dai contenuti editoriali e restano
 * serviti, perché nessun URL deve smettere di rispondere. Dove i due insiemi
 * si sovrappongono vince il catalogo: ha il prezzo.
 */
const SLUG_SOLO_EDITORIALI = serviziEditoriali
  .map((s) => s.slug)
  .filter((slug) => !SLUG_SERVIZI.includes(slug));

export function generateStaticParams() {
  return [...SLUG_SERVIZI, ...SLUG_SOLO_EDITORIALI].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const editoriale = SLUG_SOLO_EDITORIALI.includes(slug)
    ? serviziEditoriali.find((x) => x.slug === slug)
    : undefined;
  if (editoriale)
    return metadatiPagina({
      titolo: editoriale.title,
      descrizione: editoriale.description,
      path: `/servizi/${slug}`,
    });
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
  if (SLUG_SOLO_EDITORIALI.includes(slug)) return <SchedaServizioEditoriale slug={slug} />;
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

      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
            <div>
              <p className="maiuscoletto text-t-sm text-grafite">{AREE[servizio.area].nome}</p>
              <h1 className="mt-2 font-serif text-t-display text-balance text-inchiostro">{servizio.nome}</h1>
              <p className="mt-4 max-w-giustezza text-t-md text-grafite">{servizio.sommario}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PulsanteLink href={hrefPreventivo} variante="primario">
                  Calcola il prezzo
                </PulsanteLink>
                <PulsanteLink href="/contatti" variante="secondario">
                  Fai una domanda
                </PulsanteLink>
              </div>
            </div>

            <Foglio as="div" className="h-fit">
              <dl className="space-y-5">
                <div>
                  <dt className="maiuscoletto text-t-sm text-grafite">Prezzo</dt>
                  <dd className="mt-1">
                    <Prezzo prezzo={servizio.prezzo} />
                  </dd>
                </div>
                <div className="border-t border-filetto pt-5">
                  <dt className="maiuscoletto text-t-sm text-grafite">Cosa fa variare</dt>
                  <dd className="mt-1 text-t-sm text-inchiostro">{servizio.variabili}</dd>
                </div>
                <div className="border-t border-filetto pt-5">
                  <dt className="maiuscoletto text-t-sm text-grafite">Per chi</dt>
                  <dd className="mt-1 text-t-sm text-inchiostro">{servizio.perChi}</dd>
                </div>
              </dl>
            </Foglio>
          </div>
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore stretto>
          <p className="maiuscoletto text-t-sm text-grafite">Il problema</p>
          <p className="mt-3 font-serif text-t-lg text-inchiostro">{servizio.problema}</p>
        </Contenitore>
      </Sezione>

      <Sezione>
        <Contenitore>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="font-serif text-t-xl text-inchiostro">Quello che ricevi</h2>
              <ElencoIncluso voci={servizio.include} className="mt-6" />
            </div>
            {servizio.esclude?.length ? (
              <div>
                <h2 className="font-serif text-t-xl text-inchiostro">Quello che non ricevi</h2>
                <ElencoEscluso voci={servizio.esclude} className="mt-6" />
                <p className="mt-6 text-t-sm text-grafite">
                  Lo scriviamo prima perché è la fonte più comune di malintesi. Se ti serve anche
                  questo, si aggiunge al preventivo, non si scopre a lavoro finito.
                </p>
              </div>
            ) : null}
          </div>
        </Contenitore>
      </Sezione>

      {percorsi.length ? (
        <Sezione filetto>
          <Contenitore>
            <Intestazione
              titolo="I percorsi che lo includono"
              lead="Se ti serve più di questo servizio, un percorso lo mette in ordine con gli altri, in un solo preventivo."
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {percorsi.map((p) => (
                <Foglio key={p.slug} as="li" href={`/percorsi/${p.slug}`} className="flex flex-col">
                  <h3 className="font-serif text-t-md text-inchiostro">{p.nome}</h3>
                  <p className="mt-2 text-t-sm text-grafite">{p.claim}</p>
                </Foglio>
              ))}
            </ul>
          </Contenitore>
        </Sezione>
      ) : null}

      {correlati.length ? (
        <Sezione filetto>
          <Contenitore>
            <Intestazione titolo="Spesso insieme" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {correlati.map((s) => (
                <li key={s.slug}>
                  <SchedaServizio servizio={s} />
                </li>
              ))}
            </ul>
          </Contenitore>
        </Sezione>
      ) : null}

      <FasciaCta ctaPrimaria={{ href: hrefPreventivo, testo: "Calcola il prezzo" }} />
    </>
  );
}
