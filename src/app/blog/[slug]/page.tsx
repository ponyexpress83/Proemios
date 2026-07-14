import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { BLOG_POSTS, getPostOutline } from "@/config/blog";
import { pageMetadata, articleJsonLd, JsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostOutline(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.titolo,
    description: post.estratto,
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostOutline(slug);
  if (!post) notFound();

  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: post.titolo,
          description: post.estratto,
          slug: post.slug,
          section: post.categoria,
        })}
      />

      <section className="bg-carta">
        <Container className="py-16 sm:py-20">
          <Link href="/blog" className="text-inchiostro-40 hover:text-inchiostro text-sm">
            ← Tutte le guide
          </Link>
          <p className="text-bronzo mt-6 text-xs font-semibold tracking-[0.2em] uppercase">
            {post.categoria}
          </p>
          <h1 className="font-display text-inchiostro mt-3 max-w-3xl text-4xl leading-[1.08] font-medium text-balance sm:text-5xl">
            {post.titolo}
          </h1>
          <p className="text-inchiostro-60 mt-5 max-w-2xl text-lg leading-relaxed">
            {post.estratto}
          </p>
        </Container>
      </section>

      <Section>
        <div className="mx-auto max-w-prose">
          {/* Articolo in redazione: mostriamo l'outline previsto (Fase 1). */}
          <div className="border-linea bg-carta-2 text-inchiostro-60 rounded-lg border border-dashed p-5 text-sm">
            Guida in redazione. Di seguito la struttura dell{"'"}articolo.
          </div>
          <div className="mt-8 space-y-6">
            {post.outline.map((sezione, i) => (
              <section key={i}>
                <h2 className="font-display text-inchiostro text-2xl font-medium">{sezione}</h2>
                <p className="text-inchiostro-40 mt-3 leading-relaxed italic">
                  Contenuto in preparazione.
                </p>
              </section>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="carta-2">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading
            title="Hai una domanda specifica sul tuo libro?"
            subtitle="Configura un preventivo o richiedi un'analisi gratuita del manoscritto."
          />
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <ButtonLink href="/preventivo" size="lg">
              Richiedi preventivo
            </ButtonLink>
            <ButtonLink href="/analisi-manoscritto" variant="secondary" size="lg">
              Analisi gratuita
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
