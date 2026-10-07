import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Collegamento } from "@/components/sito/collegamento";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Filetto, Sezione } from "@/components/sito/sezione";
import { ArticoloEditoriale } from "@/components/sito/contenuti-editoriali";
import { getArticolo, slugArticoli } from "@/lib/blog";
import { articles as guideEditoriali } from "@/lib/editorial-content";
import { getServizio } from "@/config/catalogo";
import { AZIONI } from "@/config/copy";
import { metadatiPagina, JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return Array.from(new Set([...slugArticoli(), ...guideEditoriali.map((a) => a.slug)])).map(
    (slug) => ({ slug }),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guida = guideEditoriali.find((a) => a.slug === slug);
  if (guida)
    return metadatiPagina({ titolo: guida.title, descrizione: guida.summary, path: `/blog/${slug}`, tipo: "article" });
  const a = getArticolo(slug);
  if (!a) return {};
  return metadatiPagina({
    titolo: a.titolo,
    descrizione: a.descrizione,
    path: `/blog/${a.slug}`,
    tipo: "article",
    // Finché è una traccia di lavoro non va indicizzata.
    noindex: !a.pubblicato,
  });
}

/** Componenti MDX composti come una pagina di libro: serif per il corpo, sans per l'apparato. */
const componenti = {
  h2: (p: React.ComponentProps<"h2">) => <h2 {...p} className="mt-10 font-serif text-t-lg text-inchiostro" />,
  h3: (p: React.ComponentProps<"h3">) => <h3 {...p} className="mt-8 font-serif text-t-md text-inchiostro" />,
  p: (p: React.ComponentProps<"p">) => <p {...p} className="mt-4 font-serif text-t-base text-inchiostro" />,
  ul: (p: React.ComponentProps<"ul">) => <ul {...p} className="mt-4 list-disc pl-5 font-serif text-t-base text-inchiostro" />,
  ol: (p: React.ComponentProps<"ol">) => <ol {...p} className="mt-4 list-decimal pl-5 font-serif text-t-base text-inchiostro" />,
  li: (p: React.ComponentProps<"li">) => <li {...p} className="mt-1.5" />,
  a: (p: React.ComponentProps<"a">) => <a {...p} className="sottolinea-matita text-blu-matita" />,
  hr: () => <Filetto className="my-8" />,
  blockquote: (p: React.ComponentProps<"blockquote">) => (
    <blockquote {...p} className="mt-6 border-l-2 border-rosso-matita pl-5 font-serif italic text-inchiostro" />
  ),
};

export default async function ArticoloPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (guideEditoriali.some((a) => a.slug === slug)) return <ArticoloEditoriale slug={slug} />;
  const articolo = getArticolo(slug);
  if (!articolo) notFound();

  const servizio = articolo.servizioCollegato ? getServizio(articolo.servizioCollegato) : undefined;

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd({
            titolo: articolo.titolo,
            descrizione: articolo.descrizione,
            slug: articolo.slug,
            sezione: articolo.categoria,
            data: articolo.dataPubblicazione ?? undefined,
          }),
          breadcrumbJsonLd([
            { nome: "Home", path: "/" },
            { nome: "Guide", path: "/blog" },
            { nome: articolo.titolo, path: `/blog/${articolo.slug}` },
          ]),
        ]}
      />

      <Sezione className="pt-10 lg:pt-14">
        <Contenitore stretto>
          <Collegamento href="/blog" className="text-t-sm">
            ← Tutte le guide
          </Collegamento>
          <p className="maiuscoletto mt-8 text-t-sm text-grafite">
            {articolo.categoria}
            {!articolo.pubblicato && ", in redazione"}
          </p>
          <h1 className="mt-2 font-serif text-t-display text-balance text-inchiostro">{articolo.titolo}</h1>
          <p className="mt-4 text-t-md text-grafite">{articolo.descrizione}</p>
          {!articolo.pubblicato && (
            <p className="mt-4 rounded-foglio border border-dashed border-grafite bg-carta-ombra p-4 text-t-sm text-grafite">
              Traccia di lavoro: la guida è in redazione e non ancora pubblicata.
            </p>
          )}
          <Filetto className="my-8" />
          <article>
            <MDXRemote source={articolo.corpo} components={componenti} />
          </article>
        </Contenitore>
      </Sezione>

      <Sezione filetto tono="ombra">
        <Contenitore className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-giustezza">
            <h2 className="font-serif text-t-xl text-inchiostro">
              {servizio ? servizio.nome : "Vuoi il prezzo per il tuo libro?"}
            </h2>
            <p className="mt-3 text-t-base text-grafite">
              {servizio ? servizio.sommario : "Sei domande e hai tre percorsi con il prezzo."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <PulsanteLink href="/preventivo" variante="primario">
              {AZIONI.preventivo}
            </PulsanteLink>
            {servizio && (
              <PulsanteLink href={`/servizi/${servizio.slug}`} variante="secondario">
                Vedi il servizio
              </PulsanteLink>
            )}
          </div>
        </Contenitore>
      </Sezione>
    </>
  );
}
