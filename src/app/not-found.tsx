import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <p className="font-display text-bronzo nums-tabular text-6xl font-medium">404</p>
        <SectionHeading
          align="center"
          title="Pagina non trovata"
          subtitle="La pagina che cerchi non esiste o è stata spostata."
          as="h1"
        />
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/" size="lg">
            Torna alla home
          </ButtonLink>
          <ButtonLink href="/servizi" variant="secondary" size="lg">
            Vedi i servizi
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
