import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  Gabbia,
  Sezione,
  Impaginato,
  Folio,
  NotaMargine,
  Filetto,
  Titolo,
  Etichetta,
} from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { getArticolo, slugArticoli } from "@/lib/blog";
import { getService } from "@/config/services";
import { AZIONI } from "@/config/copy";
import { metadatiPagina, JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return slugArticoli().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
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

/** Componenti MDX composti come una pagina di libro. */
const componenti = {
  h2: (p: React.ComponentProps<"h2">) => (
    <h2 {...p} className="font-display text-inchiostro mt-10 text-2xl font-medium" />
  ),
  h3: (p: React.ComponentProps<"h3">) => (
    <h3 {...p} className="font-display text-inchiostro mt-8 text-xl font-medium" />
  ),
  p: (p: React.ComponentProps<"p">) => <p {...p} className="prosa mt-4" />,
  ul: (p: React.ComponentProps<"ul">) => <ul {...p} className="prosa mt-4 list-disc pl-5" />,
  ol: (p: React.ComponentProps<"ol">) => <ol {...p} className="prosa mt-4 list-decimal pl-5" />,
  li: (p: React.ComponentProps<"li">) => <li {...p} className="mt-1.5" />,
  a: (p: React.ComponentProps<"a">) => (
    <a {...p} className="text-alloro hover:text-ottone underline underline-offset-2" />
  ),
  hr: () => <Filetto className="my-8" />,
  blockquote: (p: React.ComponentProps<"blockquote">) => (
    <blockquote {...p} className="border-ottone font-lettura mt-6 border-l-2 pl-5 italic" />
  ),
};

export default async function ArticoloPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articolo = getArticolo(slug);
  if (!articolo) notFound();

  const servizio = articolo.servizioCollegato ? getService(articolo.servizioCollegato) : undefined;

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
            { nome: "Blog", path: "/blog" },
            { nome: articolo.titolo, path: `/blog/${articolo.slug}` },
          ]),
        ]}
      />

      <section className="bg-carta pt-12 pb-8 sm:pt-16">
        <Gabbia>
          <Link href={"/blog" as Route} className="apparato text-stampa hover:text-inchiostro">
            ← Tutte le guide
          </Link>
          <Impaginato
            className="mt-8"
            margine={
              <>
                <Folio n="§" etichetta={articolo.categoria} />
                {!articolo.pubblicato && (
                  <NotaMargine>
                    Traccia di lavoro: la guida è in redazione e non ancora pubblicata.
                  </NotaMargine>
                )}
              </>
            }
          >
            <h1 className="font-display text-[2.2rem] leading-[1.1] font-medium sm:text-[2.9rem]">
              {articolo.titolo}
            </h1>
            <Filetto className="mt-6" />
            <p className="prosa-grande specchio mt-6">{articolo.descrizione}</p>
            {!articolo.pubblicato && (
              <div className="mt-6">
                <Etichetta tono="stampa">In redazione</Etichetta>
              </div>
            )}
          </Impaginato>
        </Gabbia>
      </section>

      <Sezione>
        <Impaginato margine={<Folio n="↳" etichetta="Testo" />}>
          <article className="specchio">
            <MDXRemote source={articolo.corpo} components={componenti} />
          </article>
        </Impaginato>
      </Sezione>

      {/* CTA contestuale al servizio pertinente */}
      <Sezione fondo="bassa">
        <Impaginato margine={<Folio n="→" etichetta="Servizio" />}>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Titolo as="h2" className="text-[1.6rem]">
                {servizio ? servizio.name : "Vuoi il prezzo per il tuo libro?"}
              </Titolo>
              <p className="prosa mt-3 max-w-xl">
                {servizio ? servizio.claim : "Sei domande e hai tre percorsi con il prezzo."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <BottoneLink href="/preventivo" misura="grande">
                {AZIONI.preventivo}
              </BottoneLink>
              {servizio && (
                <BottoneLink
                  href={`/servizi/${servizio.slug}`}
                  variante="secondario"
                  misura="grande"
                >
                  Vedi il servizio
                </BottoneLink>
              )}
            </div>
          </div>
        </Impaginato>
      </Sezione>
    </>
  );
}
