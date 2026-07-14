import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { CtaBand } from "@/components/sections/CtaBand";
import { servicesOrdered } from "@/config/services";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Servizi editoriali",
  description:
    "I sei pacchetti di Kalamos Studio: valutazione editoriale, revisione e pubblicazione, ghostwriting da diari, libro per professionisti, copertina e impaginazione, partner white label.",
  path: "/servizi",
});

export default function ServiziPage() {
  const services = servicesOrdered();
  return (
    <>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow="Servizi"
          title="Tutto ciò che serve per fare un libro"
          subtitle="Sei pacchetti che coprono l'intero percorso editoriale. Scegli il servizio completo o solo la parte che ti manca."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
