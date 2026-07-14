import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { CASE_STUDIES, getCaseStudy } from "@/config/caseStudies";
import { getService } from "@/config/services";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) return {};
  return pageMetadata({
    title: cs.titolo,
    description: cs.sottotitolo,
    path: `/casi-studio/${cs.slug}`,
  });
}

export default async function CaseStudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) notFound();
  const service = getService(cs.servizio);

  return (
    <>
      <section className="bg-inchiostro text-carta">
        <Container className="py-16 sm:py-20">
          <Link href="/casi-studio" className="text-carta/60 hover:text-carta text-sm">
            ← Tutti i casi studio
          </Link>
          <p className="text-bronzo-chiaro mt-6 text-xs font-semibold tracking-[0.2em] uppercase">
            {cs.cliente}
          </p>
          <h1 className="font-display mt-3 max-w-3xl text-4xl leading-[1.08] font-medium text-balance sm:text-5xl">
            {cs.titolo}
          </h1>
          <p className="text-carta/75 mt-5 max-w-2xl text-lg leading-relaxed">{cs.sottotitolo}</p>
          <dl className="border-carta/15 mt-10 grid max-w-2xl grid-cols-3 gap-6 border-t pt-8">
            {cs.metriche.map((m, i) => (
              <div key={i}>
                <dt className="font-display text-carta nums-tabular text-3xl font-medium">
                  {m.valore}
                </dt>
                <dd className="text-carta/55 mt-1 text-xs leading-tight">{m.etichetta}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <Section>
        <div className="mx-auto grid max-w-4xl gap-10">
          <div>
            <SectionHeading eyebrow="La sfida" title="Il punto di partenza" as="h2" />
            <p className="text-inchiostro-80 mt-5 text-lg leading-relaxed">{cs.sfida}</p>
          </div>
          <div>
            <SectionHeading eyebrow="La soluzione" title="Cosa abbiamo fatto" as="h2" />
            <p className="text-inchiostro-80 mt-5 text-lg leading-relaxed">{cs.soluzione}</p>
          </div>
          <div>
            <SectionHeading eyebrow="Il risultato" title="Come è andata" as="h2" />
            <p className="text-inchiostro-80 mt-5 text-lg leading-relaxed">{cs.risultato}</p>
          </div>

          {cs.citazione && (
            <figure className="border-bronzo border-l-2 pl-6">
              <blockquote className="font-display text-inchiostro text-2xl leading-snug font-normal italic">
                “{cs.citazione.testo}”
              </blockquote>
              <figcaption className="text-inchiostro-60 mt-3 text-sm">
                — {cs.citazione.autore}
              </figcaption>
            </figure>
          )}
        </div>
      </Section>

      <Section tone="carta-2">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading
            title={service ? `Servizio collegato: ${service.nome}` : "Vuoi un percorso simile?"}
            subtitle="Configura un preventivo o parti da un'analisi gratuita del tuo manoscritto."
          />
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <ButtonLink
              href={(service ? `/servizi/${service.slug}` : "/servizi") as Route}
              variant="secondary"
              size="lg"
            >
              {service ? "Scopri il servizio" : "Vedi i servizi"}
            </ButtonLink>
            <ButtonLink href="/preventivo" size="lg">
              Richiedi preventivo
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
