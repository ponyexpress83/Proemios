import type { Route } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";

/** Fascia CTA doppia ricorrente: preventivo + analisi gratuita. */
export function CtaBand({
  title = "Pronto a dare forma al tuo libro?",
  subtitle = "Configura un preventivo in due minuti o parti da un'analisi gratuita del tuo manoscritto.",
  primaryHref = "/preventivo",
  primaryLabel = "Richiedi preventivo",
  secondaryHref = "/analisi-manoscritto",
  secondaryLabel = "Analisi gratuita",
}: {
  title?: string;
  subtitle?: string;
  primaryHref?: Route | string;
  primaryLabel?: string;
  secondaryHref?: Route | string;
  secondaryLabel?: string;
}) {
  return (
    <Section tone="inchiostro">
      <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading tone="light" eyebrow="Kalamos Studio" title={title} subtitle={subtitle} />
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <ButtonLink
            href={primaryHref}
            variant="primary"
            size="lg"
            className="bg-carta text-inchiostro border-carta hover:bg-bronzo-chiaro hover:border-bronzo-chiaro"
          >
            {primaryLabel}
          </ButtonLink>
          <ButtonLink
            href={secondaryHref}
            variant="secondary"
            size="lg"
            className="border-carta/30 text-carta hover:border-bronzo-chiaro hover:text-bronzo-chiaro"
          >
            {secondaryLabel}
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
