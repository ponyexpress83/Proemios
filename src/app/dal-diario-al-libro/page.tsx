import type { Metadata } from "next";
import type { Route } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FaqList } from "@/components/ui/Faq";
import { ProcessList } from "@/components/sections/ProcessList";
import { getService } from "@/config/services";
import { pageMetadata, faqJsonLd, serviceJsonLd, JsonLd } from "@/lib/seo";
import { AI_DISCLAIMER } from "@/config/site";

const service = getService("dal-diario-al-libro")!;

export const metadata: Metadata = pageMetadata({
  title: "Dal diario al libro — ghostwriting da diari e memorie",
  description:
    "Trasformiamo diari, registrazioni vocali, lettere e appunti in un libro pubblicato. Il servizio signature di Kalamos Studio per memoir e storie di vita.",
  path: "/dal-diario-al-libro",
});

const MATERIALI = [
  { titolo: "Diari e quaderni", nota: "Anche frammentari o scritti a mano" },
  { titolo: "Registrazioni vocali", nota: "Ore di racconti, trascritti e ordinati" },
  { titolo: "Lettere e documenti", nota: "Corrispondenza, foto, ritagli" },
  { titolo: "Ricordi e interviste", nota: "Raccolti con interviste dedicate" },
];

export default function DalDiarioAlLibro() {
  const preventivoHref = "/preventivo?tipo=memoir&servizio=dal-diario-al-libro" as Route;

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
      <section className="bg-inchiostro text-carta">
        <Container className="py-20 sm:py-28">
          <p className="text-bronzo-chiaro mb-5 text-xs font-semibold tracking-[0.2em] uppercase">
            Servizio signature · Memoir e ghostwriting
          </p>
          <h1 className="font-display max-w-3xl text-4xl leading-[1.05] font-medium text-balance sm:text-5xl lg:text-6xl">
            La tua storia merita di diventare un libro.
          </h1>
          <p className="text-carta/75 mt-6 max-w-xl text-lg leading-relaxed">
            Hai vissuto qualcosa che vale la pena raccontare — o vuoi custodire la storia di una
            persona cara. Noi partiamo dai tuoi materiali grezzi e scriviamo il libro con la tua
            voce.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink
              href={preventivoHref}
              size="lg"
              className="bg-carta text-inchiostro border-carta hover:bg-bronzo-chiaro hover:border-bronzo-chiaro"
            >
              Richiedi un preventivo
            </ButtonLink>
            <ButtonLink
              href="/contatti"
              variant="secondary"
              size="lg"
              className="border-carta/30 text-carta hover:border-bronzo-chiaro hover:text-bronzo-chiaro"
            >
              Parliamone
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Da cosa partiamo */}
      <Section>
        <SectionHeading
          eyebrow="Da dove partiamo"
          title="Qualsiasi materiale è un buon inizio"
          subtitle="Non serve aver già scritto nulla. Serve solo avere qualcosa da raccontare."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MATERIALI.map((m) => (
            <Card key={m.titolo}>
              <h3 className="font-display text-inchiostro text-lg font-medium">{m.titolo}</h3>
              <p className="text-inchiostro-60 mt-2 text-sm leading-relaxed">{m.nota}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Processo */}
      <Section tone="carta-2">
        <SectionHeading eyebrow="Come funziona" title="Dal materiale al libro finito" />
        <div className="mt-12">
          <ProcessList steps={service.processo} />
        </div>
      </Section>

      {/* Citazione */}
      <Section tone="inchiostro">
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="font-display text-carta text-3xl leading-snug font-normal italic sm:text-4xl">
            “Ho ritrovato la voce di mio padre in ogni pagina. Non pensavo fosse possibile.”
          </blockquote>
          <figcaption className="text-carta/60 mt-6 text-sm">
            — Cliente, memoir familiare
          </figcaption>
        </figure>
      </Section>

      {/* FAQ */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <SectionHeading eyebrow="FAQ" title="Le domande che ci fanno più spesso" />
          <FaqList items={service.faq} />
        </div>
        <p className="text-inchiostro-40 mt-12 max-w-prose text-sm leading-relaxed">
          {AI_DISCLAIMER}
        </p>
      </Section>

      {/* CTA */}
      <Section tone="carta-2">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeading
            title="Iniziamo dalla tua storia"
            subtitle="Configura un preventivo o scrivici: la prima conversazione è senza impegno e riservata."
          />
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <ButtonLink href={preventivoHref} size="lg">
              Richiedi preventivo
            </ButtonLink>
            <ButtonLink href="/contatti" variant="secondary" size="lg">
              Prenota una call
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
