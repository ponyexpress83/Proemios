import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/forms/ContactForm";
import { SITE } from "@/config/site";
import { calendlyUrl } from "@/lib/env";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contatti",
  description:
    "Scrivici o prenota una consulenza gratuita con Kalamos Studio. Parliamo del tuo progetto editoriale, senza impegno.",
  path: "/contatti",
});

export default function Contatti() {
  const calendly = calendlyUrl();
  return (
    <>
      <section className="bg-carta">
        <Container className="py-16 sm:py-20">
          <p className="text-bronzo mb-4 text-xs font-semibold tracking-[0.2em] uppercase">
            Contatti
          </p>
          <h1 className="font-display text-inchiostro max-w-2xl text-4xl leading-[1.08] font-medium text-balance sm:text-5xl">
            Parliamo del tuo libro
          </h1>
          <p className="text-inchiostro-60 mt-5 max-w-xl text-lg leading-relaxed">
            Scrivici due righe o prenota direttamente una consulenza gratuita. Rispondiamo entro un
            giorno lavorativo.
          </p>
        </Container>
      </section>

      <Section tone="carta-2">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Form */}
          <div>
            <SectionHeading eyebrow="Scrivici" title="Mandaci un messaggio" />
            <div className="bg-carta mt-8 rounded-lg p-6 sm:p-8">
              <ContactForm />
            </div>
            <p className="text-inchiostro-60 mt-6 text-sm">
              Oppure via email:{" "}
              <a
                href={`mailto:${SITE.email}`}
                className="text-bronzo hover:text-bronzo-scuro font-medium"
              >
                {SITE.email}
              </a>
            </p>
          </div>

          {/* Calendly */}
          <div>
            <SectionHeading eyebrow="Prenota" title="Una consulenza gratuita" />
            <p className="text-inchiostro-60 mt-4 max-w-md text-sm leading-relaxed">
              Scegli un orario che ti è comodo: 30 minuti per capire insieme come dare forma al tuo
              progetto.
            </p>
            <div className="border-linea bg-carta mt-8 overflow-hidden rounded-lg border">
              <iframe
                src={calendly}
                title="Prenota una consulenza — Calendly"
                className="h-[640px] w-full"
                loading="lazy"
              />
            </div>
            <p className="text-inchiostro-40 mt-3 text-xs">
              Se il calendario non si carica,{" "}
              <a href={calendly} target="_blank" rel="noopener noreferrer" className="underline">
                aprilo in una nuova scheda
              </a>
              .
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
