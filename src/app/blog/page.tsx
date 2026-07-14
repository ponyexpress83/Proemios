import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { CtaBand } from "@/components/sections/CtaBand";
import { BLOG_POSTS } from "@/config/blog";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Blog — guide su editoria, self-publishing e ghostwriting",
  description:
    "Guide pratiche su costi di pubblicazione, editing, Amazon KDP, ISBN, ghostwriting e memoir. Risposte chiare alle domande di chi vuole pubblicare un libro.",
  path: "/blog",
});

export default function BlogIndex() {
  // Raggruppa per categoria mantenendo l'ordine di definizione.
  const categorie = Array.from(new Set(BLOG_POSTS.map((p) => p.categoria)));

  return (
    <>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow="Blog"
          title="Guide chiare per pubblicare un libro"
          subtitle="Costi, strumenti e decisioni: tutto quello che serve sapere, spiegato senza giri di parole."
        />
        <div className="mt-14 space-y-14">
          {categorie.map((cat) => (
            <div key={cat}>
              <h2 className="text-bronzo mb-6 text-xs font-semibold tracking-[0.16em] uppercase">
                {cat}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {BLOG_POSTS.filter((p) => p.categoria === cat).map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}` as Route}
                    className="group border-linea bg-carta lift hover:border-bronzo flex flex-col rounded-lg border p-6 hover:-translate-y-0.5"
                  >
                    <h3 className="font-display text-inchiostro text-lg leading-snug font-medium">
                      {p.titolo}
                    </h3>
                    <p className="text-inchiostro-60 mt-2 flex-1 text-sm leading-relaxed">
                      {p.estratto}
                    </p>
                    <span className="text-bronzo mt-4 text-sm font-medium transition-transform group-hover:translate-x-0.5">
                      Leggi →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
