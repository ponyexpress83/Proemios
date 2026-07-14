import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { CtaBand } from "@/components/sections/CtaBand";
import { CASE_STUDIES } from "@/config/caseStudies";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Casi studio",
  description:
    "Progetti editoriali reali seguiti da Kalamos Studio: memoir da materiali grezzi, libri di posizionamento per professionisti, esordi narrativi.",
  path: "/casi-studio",
});

export default function CasiStudio() {
  return (
    <>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow="Casi studio"
          title="Libri che abbiamo fatto nascere"
          subtitle="Ogni progetto parte da un punto diverso. Ecco alcuni percorsi, dal materiale grezzo al libro pubblicato."
        />
        <div className="mt-12 grid gap-8">
          {CASE_STUDIES.map((c) => (
            <Link
              key={c.slug}
              href={`/casi-studio/${c.slug}` as Route}
              className="group border-linea bg-carta lift hover:border-bronzo grid gap-6 rounded-lg border p-6 sm:grid-cols-[1.5fr_1fr] sm:p-8"
            >
              <div>
                <p className="text-bronzo text-xs font-semibold tracking-wider uppercase">
                  {c.cliente}
                </p>
                <h2 className="font-display text-inchiostro mt-3 text-2xl leading-snug font-medium">
                  {c.titolo}
                </h2>
                <p className="text-inchiostro-60 mt-3 max-w-lg leading-relaxed">{c.sottotitolo}</p>
                <span className="text-bronzo mt-5 inline-block text-sm font-medium transition-transform group-hover:translate-x-0.5">
                  Leggi il caso →
                </span>
              </div>
              <dl className="border-linea grid grid-cols-3 gap-4 self-center border-t pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
                {c.metriche.map((m, i) => (
                  <div key={i}>
                    <dt className="font-display text-inchiostro nums-tabular text-2xl font-medium">
                      {m.valore}
                    </dt>
                    <dd className="text-inchiostro-40 mt-1 text-xs leading-tight">{m.etichetta}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
