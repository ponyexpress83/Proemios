import Link from "next/link";
import type { Route } from "next";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { CtaBand } from "@/components/sections/CtaBand";
import { servicesOrdered } from "@/config/services";
import { CASE_STUDIES } from "@/config/caseStudies";
import { SITE, AI_DISCLAIMER } from "@/config/site";

const LINEE = [
  {
    titolo: "Clienti diretti",
    testo:
      "Autori, self-publisher e professionisti che vogliono un libro fatto bene: dal manoscritto alla pubblicazione su Amazon.",
    href: "/servizi" as const,
    cta: "Vedi i servizi",
  },
  {
    titolo: "Partner white label",
    testo:
      "Agenzie di ghostwriting, comunicazione e personal branding che esternalizzano la produzione editoriale, sotto il proprio marchio.",
    href: "/per-agenzie" as const,
    cta: "Diventa partner",
  },
  {
    titolo: "Strumenti editoriali",
    testo:
      "Un configuratore di preventivo con prezzo istantaneo e un'analisi del manoscritto assistita dalla tecnologia, verificata da un professionista.",
    href: "/analisi-manoscritto" as const,
    cta: "Prova l'analisi",
  },
];

export default function Home() {
  const services = servicesOrdered();
  const caseStudies = CASE_STUDIES.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="bg-carta relative overflow-hidden">
        <div
          className="rule-bronze pointer-events-none absolute inset-x-0 top-0 h-px"
          aria-hidden
        />
        <Container className="py-20 sm:py-28 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-bronzo mb-5 text-xs font-semibold tracking-[0.2em] uppercase">
              Service editoriale · {SITE.citta}
            </p>
            <h1 className="font-display text-inchiostro text-4xl leading-[1.05] font-medium text-balance sm:text-5xl lg:text-6xl">
              Diamo forma di libro alle tue parole.
            </h1>
            <p className="text-inchiostro-60 mt-6 max-w-xl text-lg leading-relaxed">
              Editing, ghostwriting, impaginazione e pubblicazione su Amazon KDP. Trasformiamo
              manoscritti, diari e appunti in libri pubblicati — con metodo editoriale e tecnologia
              contemporanea.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/preventivo" size="lg">
                Configura un preventivo
              </ButtonLink>
              <ButtonLink href="/analisi-manoscritto" variant="secondary" size="lg">
                Analisi gratuita del manoscritto
              </ButtonLink>
            </div>
            <p className="text-inchiostro-40 mt-6 text-sm">
              Prezzo istantaneo · Nessun impegno · Acconto solo quando decidi di partire
            </p>
          </div>
        </Container>
      </section>

      {/* Tre linee commerciali */}
      <Section tone="carta-2">
        <SectionHeading
          eyebrow="Per chi lavoriamo"
          title="Tre modi di lavorare con noi"
          subtitle="Un unico studio editoriale, tre percorsi pensati per esigenze diverse."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {LINEE.map((l) => (
            <Card key={l.titolo} className="flex flex-col">
              <h3 className="font-display text-inchiostro text-xl font-medium">{l.titolo}</h3>
              <p className="text-inchiostro-60 mt-3 flex-1 text-sm leading-relaxed">{l.testo}</p>
              <Link
                href={l.href as Route}
                className="text-bronzo hover:text-bronzo-scuro mt-5 text-sm font-medium"
              >
                {l.cta} →
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      {/* Servizi */}
      <Section>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="I sei pacchetti"
            title="Servizi editoriali completi"
            subtitle="Dalla valutazione del manoscritto alla pubblicazione, con la possibilità di scegliere solo ciò che ti serve."
          />
          <ButtonLink href="/servizi" variant="ghost" className="shrink-0">
            Tutti i servizi →
          </ButtonLink>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
      </Section>

      {/* Offerta signature */}
      <Section tone="inchiostro">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-bronzo-chiaro mb-4 text-xs font-semibold tracking-[0.2em] uppercase">
              Il nostro servizio signature
            </p>
            <h2 className="font-display text-carta text-3xl leading-tight font-medium text-balance sm:text-4xl">
              Dal diario al libro
            </h2>
            <p className="text-carta/75 mt-5 max-w-lg text-lg leading-relaxed">
              Hai una storia da raccontare — la tua o quella di una persona cara. Diari,
              registrazioni vocali, lettere, ricordi sparsi. Noi li trasformiamo in un libro
              scritto, coerente e da leggere, mantenendo la tua voce.
            </p>
            <div className="mt-8">
              <ButtonLink
                href="/dal-diario-al-libro"
                size="lg"
                className="bg-carta text-inchiostro border-carta hover:bg-bronzo-chiaro hover:border-bronzo-chiaro"
              >
                Scopri come funziona
              </ButtonLink>
            </div>
          </div>
          <figure className="border-bronzo border-l-2 pl-6">
            <blockquote className="font-display text-carta text-2xl leading-snug font-normal italic sm:text-3xl">
              “Ho ritrovato la voce di mio padre in ogni pagina. Non pensavo fosse possibile.”
            </blockquote>
            <figcaption className="text-carta/60 mt-4 text-sm">
              — Cliente, memoir familiare
            </figcaption>
          </figure>
        </div>
      </Section>

      {/* Casi studio */}
      <Section tone="carta-2">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Casi studio"
            title="Libri che abbiamo fatto nascere"
            subtitle="Progetti reali, dal materiale grezzo al libro pubblicato."
          />
          <ButtonLink href="/casi-studio" variant="ghost" className="shrink-0">
            Tutti i casi →
          </ButtonLink>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {caseStudies.map((c) => (
            <Link
              key={c.slug}
              href={`/casi-studio/${c.slug}` as Route}
              className="group border-linea bg-carta lift hover:border-bronzo flex flex-col rounded-lg border p-6 hover:-translate-y-0.5 sm:p-7"
            >
              <p className="text-bronzo text-xs font-semibold tracking-wider uppercase">
                {c.cliente}
              </p>
              <h3 className="font-display text-inchiostro mt-3 flex-1 text-lg leading-snug font-medium">
                {c.titolo}
              </h3>
              <span className="text-bronzo mt-5 text-sm font-medium transition-transform group-hover:translate-x-0.5">
                Leggi il caso →
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Lead magnet analisi */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeading
              eyebrow="Strumento gratuito"
              title="Analisi del manoscritto in pochi minuti"
              subtitle="Carica il tuo testo e ricevi un report su leggibilità, ritmo, tic stilistici, target di lettori e livello di intervento consigliato — con una stima di costo."
            />
            <ul className="text-inchiostro-60 mt-6 space-y-2 text-sm">
              <li>· Punti di forza e aree di intervento</li>
              <li>· Genere, comparables e target di lettori stimato</li>
              <li>· Fascia di costo calcolata sul conteggio parole reale</li>
            </ul>
            <div className="mt-8">
              <ButtonLink href="/analisi-manoscritto" size="lg">
                Analizza il mio manoscritto
              </ButtonLink>
            </div>
          </div>
          <Card className="bg-carta-2">
            <p className="text-inchiostro-60 text-sm leading-relaxed">{AI_DISCLAIMER}</p>
          </Card>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
