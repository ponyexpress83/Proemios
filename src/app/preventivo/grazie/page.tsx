import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Grazie — acconto ricevuto",
  description: "Conferma dell'acconto per il tuo progetto editoriale con Kalamos Studio.",
  path: "/preventivo/grazie",
  noindex: true,
});

export default function GraziePage() {
  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <div className="border-bronzo text-bronzo mx-auto mb-6 grid size-14 place-items-center rounded-full border">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
            <path
              d="M6 13.5 11 18l9-10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <SectionHeading
          align="center"
          eyebrow="Ordine confermato"
          title="Grazie, la tua data è bloccata"
          subtitle="Abbiamo ricevuto il tuo acconto. Ti abbiamo inviato una email di conferma e ti contatteremo a breve per avviare la lavorazione."
          as="h1"
        />
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/" variant="secondary" size="lg">
            Torna alla home
          </ButtonLink>
          <ButtonLink href="/contatti" size="lg">
            Contattaci
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
