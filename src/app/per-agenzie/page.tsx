import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ContactForm } from "@/components/forms/ContactForm";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Partner white label per agenzie",
  description:
    "Produzione editoriale in outsourcing per agenzie di ghostwriting, comunicazione e personal branding. A marchio tuo, riservato, con NDA. Prezzi riservati.",
  path: "/per-agenzie",
});

const VANTAGGI = [
  {
    titolo: "Sotto il tuo marchio",
    testo: "Ogni consegna è white label: i tuoi clienti vedono solo la tua agenzia.",
  },
  {
    titolo: "Riservatezza totale",
    testo: "Firmiamo un NDA e lavoriamo con clausole di riservatezza dedicate.",
  },
  {
    titolo: "Produzione completa",
    testo: "Ghostwriting, editing, impaginazione, copertine, EPUB, KDP: tutto in un unico partner.",
  },
  {
    titolo: "Prezzi per volumi",
    testo: "Listino riservato con condizioni dedicate, definite in base ai volumi.",
  },
];

const PROCESSO = [
  "Firmiamo NDA e definiamo condizioni, marchio e livelli di servizio.",
  "Impostiamo template, tono di voce e canali di lavoro condivisi.",
  "Produciamo i progetti a tuo nome: tu resti l'unico referente del cliente.",
  "Consegniamo, iteriamo e cresciamo sui volumi concordati.",
];

export default function PerAgenzie() {
  return (
    <>
      {/* Hero */}
      <section className="bg-carta">
        <Container className="py-16 sm:py-24">
          <p className="text-bronzo mb-4 text-xs font-semibold tracking-[0.2em] uppercase">
            B2B · White label
          </p>
          <h1 className="font-display text-inchiostro max-w-3xl text-4xl leading-[1.05] font-medium text-balance sm:text-5xl">
            La tua redazione editoriale in outsourcing.
          </h1>
          <p className="text-inchiostro-60 mt-6 max-w-xl text-lg leading-relaxed">
            I tuoi clienti chiedono libri, ma costruire una redazione interna è costoso e complesso.
            Noi produciamo per te — sotto il tuo marchio, con la massima riservatezza.
          </p>
        </Container>
      </section>

      {/* Vantaggi */}
      <Section tone="carta-2">
        <SectionHeading eyebrow="Perché noi" title="Un partner di produzione, non un concorrente" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {VANTAGGI.map((v) => (
            <Card key={v.titolo}>
              <h3 className="font-display text-inchiostro text-lg font-medium">{v.titolo}</h3>
              <p className="text-inchiostro-60 mt-2 text-sm leading-relaxed">{v.testo}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Processo */}
      <Section>
        <SectionHeading
          eyebrow="Come collaboriamo"
          title="Dall'accordo alla produzione ricorrente"
        />
        <ol className="mt-10 space-y-5">
          {PROCESSO.map((p, i) => (
            <li key={i} className="border-linea flex gap-5 border-b pb-5 last:border-0">
              <span className="font-display text-bronzo nums-tabular text-2xl font-medium">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-inchiostro-80 pt-1 leading-relaxed">{p}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Form NDA */}
      <Section tone="inchiostro" id="richiesta">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading
              tone="light"
              eyebrow="Prezzi riservati"
              title="Richiedi l'accesso partner"
              subtitle="Compila il modulo: ti invieremo l'NDA e il listino riservato, con condizioni dedicate in base ai volumi. Nessun prezzo pubblico."
            />
          </div>
          <div className="bg-carta rounded-lg p-6 sm:p-8">
            <ContactForm
              fonte="agenzie"
              messaggioLabel="La tua agenzia e i volumi previsti"
              messaggioPlaceholder="Nome agenzia, tipo di progetti, volumi indicativi al mese…"
              submitLabel="Richiedi accesso partner"
            />
          </div>
        </div>
      </Section>
    </>
  );
}
