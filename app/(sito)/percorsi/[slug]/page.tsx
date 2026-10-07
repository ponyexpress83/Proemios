import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Foglio } from "@/components/sito/foglio";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Intestazione, Sezione } from "@/components/sito/sezione";
import { SchedaPercorsoEditoriale } from "@/components/sito/contenuti-editoriali";
import { FasciaCta, Passi, SchedaServizio } from "@/components/marketing/blocchi";
import { Prezzo } from "@/components/marketing/prezzo";
import { Faq } from "@/components/sezioni/faq";
import { PERCORSI, SLUG_PERCORSI, getPercorso } from "@/config/percorsi";
import { getServizio } from "@/config/catalogo";
import { paths as percorsiEditoriali } from "@/lib/editorial-content";
import { metadatiPagina, JsonLd, breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from "@/lib/seo";

/**
 * Due insiemi di slug convivono: gli otto percorsi del catalogo
 * (`config/percorsi.ts`, con prezzi) e le quattro pagine di atterraggio dei
 * contenuti editoriali, che restano servite perché nessun URL deve smettere
 * di rispondere.
 */
export function generateStaticParams() {
  return Array.from(new Set([...SLUG_PERCORSI, ...percorsiEditoriali.map((p) => p.slug)])).map(
    (slug) => ({ slug }),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const editoriale = percorsiEditoriali.find((p) => p.slug === slug);
  if (editoriale)
    return metadatiPagina({
      titolo: editoriale.title,
      descrizione: editoriale.description,
      path: `/percorsi/${slug}`,
    });
  const percorso = getPercorso(slug);
  if (!percorso) return metadatiPagina({ titolo: "Percorso", descrizione: "", path: "/percorsi" });
  return metadatiPagina({
    titolo: percorso.nome,
    descrizione: percorso.claim,
    path: `/percorsi/${percorso.slug}`,
  });
}

export default async function PaginaPercorso({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (percorsiEditoriali.some((p) => p.slug === slug)) return <SchedaPercorsoEditoriale slug={slug} />;
  const percorso = getPercorso(slug);
  if (!percorso) notFound();

  const servizi = percorso.servizi.map(getServizio).filter((s) => s !== undefined);
  const altri = PERCORSI.filter((p) => p.slug !== percorso.slug).slice(0, 3);
  const hrefPreventivo = percorso.prefillPreventivo
    ? `/preventivo?tipo=${percorso.prefillPreventivo}`
    : "/preventivo";

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Percorsi", path: "/percorsi" },
            { nome: percorso.nome, path: `/percorsi/${percorso.slug}` },
          ]),
          serviceJsonLd({ nome: percorso.nome, descrizione: percorso.claim, slug: percorso.slug }),
          faqJsonLd(percorso.faq.map((f) => ({ q: f.domanda, a: f.risposta }))),
        ]}
      />

      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
            <div>
              <p className="maiuscoletto text-t-sm text-grafite">Percorso</p>
              <h1 className="mt-2 font-serif text-t-display text-balance text-inchiostro">{percorso.nome}</h1>
              <p className="mt-4 max-w-giustezza text-t-md text-grafite">{percorso.claim}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PulsanteLink href={hrefPreventivo} variante="primario">
                  Calcola il preventivo
                </PulsanteLink>
                <PulsanteLink href="/contatti" variante="secondario">
                  Parla con un editor
                </PulsanteLink>
              </div>
            </div>

            <Foglio as="div" className="h-fit">
              <dl className="space-y-5">
                <div>
                  <dt className="maiuscoletto text-t-sm text-grafite">Per chi</dt>
                  <dd className="mt-1 text-t-sm text-inchiostro">{percorso.perChi}</dd>
                </div>
                <div className="border-t border-filetto pt-5">
                  <dt className="maiuscoletto text-t-sm text-grafite">Prezzo</dt>
                  <dd className="mt-1">
                    <Prezzo prezzo={percorso.prezzo} />
                  </dd>
                </div>
                <div className="border-t border-filetto pt-5">
                  <dt className="maiuscoletto text-t-sm text-grafite">Servizi coinvolti</dt>
                  <dd className="tabellare mt-1 text-t-sm text-inchiostro">{servizi.length}</dd>
                </div>
              </dl>
            </Foglio>
          </div>
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore stretto>
          <p className="maiuscoletto text-t-sm text-grafite">Il punto</p>
          <p className="mt-3 font-serif text-t-lg text-inchiostro">{percorso.problema}</p>
        </Contenitore>
      </Sezione>

      <Sezione>
        <Contenitore>
          <Intestazione
            titolo="Le tappe del percorso"
            lead="Ogni tappa si chiude con una tua approvazione: si procede solo quando hai detto sì."
          />
          <Passi passi={percorso.tappe} />
        </Contenitore>
      </Sezione>

      <Sezione filetto>
        <Contenitore>
          <Intestazione
            titolo="I servizi di questo percorso"
            lead="Sono tutti acquistabili anche singolarmente: il percorso li mette in ordine e in un solo preventivo."
            azione={<PulsanteLink href="/servizi" variante="testuale">Catalogo completo</PulsanteLink>}
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servizi.map((s) => (
              <li key={s.slug}>
                <SchedaServizio servizio={s} />
              </li>
            ))}
          </ul>
        </Contenitore>
      </Sezione>

      <Sezione filetto>
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <h2 className="font-serif text-t-xl text-inchiostro">Domande su questo percorso</h2>
            <Faq voci={percorso.faq} />
          </div>
        </Contenitore>
      </Sezione>

      <Sezione filetto>
        <Contenitore>
          <Intestazione titolo="Non è il tuo caso?" />
          <ul className="grid gap-4 sm:grid-cols-3">
            {altri.map((p) => (
              <Foglio key={p.slug} as="li" href={`/percorsi/${p.slug}`} className="flex flex-col" aria-label={p.nome}>
                <h3 className="font-serif text-t-md text-inchiostro">{p.nome}</h3>
                <p className="mt-2 text-t-sm text-grafite">{p.claim}</p>
              </Foglio>
            ))}
          </ul>
        </Contenitore>
      </Sezione>

      <FasciaCta ctaPrimaria={{ href: hrefPreventivo, testo: "Calcola il preventivo" }} />
    </>
  );
}
