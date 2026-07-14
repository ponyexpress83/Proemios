import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { FaqList } from "@/components/ui/Faq";
import { ProcessList } from "@/components/sections/ProcessList";
import { SERVICES, getService } from "@/config/services";
import { euro } from "@/lib/format";
import { pageMetadata, serviceJsonLd, faqJsonLd, JsonLd } from "@/lib/seo";
import { AI_DISCLAIMER } from "@/config/site";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return pageMetadata({
    title: service.nome,
    description: service.tagline,
    path: `/servizi/${service.slug}`,
  });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const prezzo = service.prezzo
    ? `${euro(service.prezzo.min)} – ${euro(service.prezzo.max)}${service.prezzo.suffix ?? ""}`
    : (service.prezzoLabel ?? "Su preventivo");

  const preventivoHref = (
    service.prefillProjectType
      ? `/preventivo?tipo=${service.prefillProjectType}&servizio=${service.slug}`
      : "/preventivo"
  ) as Route;

  const ctaSecondaria =
    service.slug === "partner-white-label" ? "/per-agenzie" : "/analisi-manoscritto";
  const ctaSecondariaLabel =
    service.slug === "partner-white-label" ? "Richiedi accesso partner" : "Analisi gratuita";

  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd({
            name: service.nome,
            description: service.tagline,
            slug: service.slug,
            price: service.prezzo,
          }),
          faqJsonLd(service.faq),
        ]}
      />

      {/* Hero */}
      <section className="bg-carta">
        <Container className="py-16 sm:py-20">
          <p className="text-bronzo mb-4 text-xs font-semibold tracking-[0.2em] uppercase">
            Servizio
          </p>
          <h1 className="font-display text-inchiostro max-w-3xl text-4xl leading-[1.08] font-medium text-balance sm:text-5xl">
            {service.nome}
          </h1>
          <p className="text-inchiostro-60 mt-5 max-w-2xl text-lg leading-relaxed">
            {service.tagline}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={preventivoHref} size="lg">
              Richiedi preventivo
            </ButtonLink>
            <ButtonLink href={ctaSecondaria as Route} variant="secondary" size="lg">
              {ctaSecondariaLabel}
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Problema */}
      <Section tone="carta-2">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionHeading eyebrow="Il problema" title="Da dove parti" />
          <p className="text-inchiostro-80 text-xl leading-relaxed">{service.problema}</p>
        </div>
      </Section>

      {/* Cosa include */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionHeading eyebrow="Cosa include" title="Cosa comprende il pacchetto" />
            <div className="border-linea bg-carta-2 mt-8 rounded-lg border p-6">
              <p className="text-bronzo text-xs font-semibold tracking-wider uppercase">
                Fascia di prezzo
              </p>
              <p className="font-display text-inchiostro nums-tabular mt-2 text-2xl font-medium">
                {prezzo}
              </p>
            </div>
          </div>
          <ul className="space-y-4">
            {service.cosaInclude.map((v, i) => (
              <li key={i} className="border-linea flex gap-3 border-b pb-4 last:border-0">
                <span className="text-bronzo mt-1" aria-hidden>
                  ✳
                </span>
                <span className="text-inchiostro-80 leading-relaxed">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Processo */}
      <Section tone="carta-2">
        <SectionHeading eyebrow="Come lavoriamo" title="Il processo, passo per passo" />
        <div className="mt-12">
          <ProcessList steps={service.processo} />
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <SectionHeading eyebrow="FAQ" title="Domande frequenti" />
          <FaqList items={service.faq} />
        </div>
        <p className="text-inchiostro-40 mt-12 max-w-prose text-sm leading-relaxed">
          {AI_DISCLAIMER}
        </p>
      </Section>

      {/* CTA doppia finale */}
      <Section tone="inchiostro">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeading
            tone="light"
            title="Facciamo nascere il tuo libro"
            subtitle="Richiedi un preventivo su misura o parti da un'analisi gratuita del tuo manoscritto."
          />
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <ButtonLink
              href={preventivoHref}
              size="lg"
              className="bg-carta text-inchiostro border-carta hover:bg-bronzo-chiaro hover:border-bronzo-chiaro"
            >
              Richiedi preventivo
            </ButtonLink>
            <ButtonLink
              href={ctaSecondaria as Route}
              variant="secondary"
              size="lg"
              className="border-carta/30 text-carta hover:border-bronzo-chiaro hover:text-bronzo-chiaro"
            >
              {ctaSecondariaLabel}
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
