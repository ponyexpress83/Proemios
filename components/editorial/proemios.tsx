"use client";
import { useState, useEffect, useRef, type ReactNode, type MouseEvent } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Eyebrow, Dashboard } from "./elements";
export { Eyebrow, Dashboard } from "./elements";
import { Book } from "./book";
import { BookPath } from "./book-path";
const QuoteAssistant = dynamic(() => import("./quote-assistant"), { ssr: false });
import Link from "@/components/editorial/link";
import {
  ArrowRight,
  Check,
  PenLine,
  MessageSquare,
  Folder,
  CheckCircle2,
  CreditCard,
  Package,
  ShieldCheck,
  Layers,
  MousePointer2,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/editorial/accordion";
import { BeforeAfter } from "./before-after";
export { BeforeAfter } from "./before-after";
import { services, paths, workflow } from "@/lib/editorial-content";
export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("scroll-reveal");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    document
      .querySelectorAll(".section-heading,.team-grid,.timeline-step")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return <>{children}</>;
}
export function CTA() {
  return (
    <section className="quote-section">
      <div className="quote-inner container">
        <div>
          <Eyebrow>IL PROSSIMO CAPITOLO</Eyebrow>
          <h2>
            Quanto costa
            <br />
            il tuo <em>progetto?</em>
          </h2>
          <p>
            Raccontaci dove sei arrivato e scopri
            <br className="desktop-break" /> quale percorso può servirti.
          </p>
        </div>
        <div className="quote-actions">
          <Link href="/preventivo" className="button">
            Calcola il preventivo <ArrowRight size={20} />
          </Link>
          <Link href="/contatti" className="text-link">
            Parla con noi <ArrowRight size={18} />
          </Link>
          <small>Un percorso su misura, con costi chiari.</small>
        </div>
      </div>
    </section>
  );
}
function HeroScene({
  assistantOpen,
  onOpen,
}: {
  assistantOpen: boolean;
  onOpen: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sceneHovered, setSceneHovered] = useState(false);
  const [sceneFocused, setSceneFocused] = useState(false);
  const [stage, setStage] = useState(0);
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const b = e.currentTarget.getBoundingClientRect();
    ref.current?.style.setProperty("--rx", ((e.clientX - b.left) / b.width - 0.5) * 9 + "deg");
    ref.current?.style.setProperty("--ry", ((e.clientY - b.top) / b.height - 0.5) * -7 + "deg");
  }
  return (
    <div
      ref={ref}
      className="hero-scene hero-scene-studio"
      onPointerMove={move}
      onPointerEnter={() => setSceneHovered(true)}
      onFocusCapture={() => setSceneFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setSceneFocused(false);
      }}
      onPointerLeave={() => {
        setSceneHovered(false);
        ref.current?.style.setProperty("--rx", "0deg");
        ref.current?.style.setProperty("--ry", "0deg");
      }}
    >
      <div className="studio-stage-surface" aria-hidden="true" />
      <div className="hero-scene-inner">
        <BookPath
          hovered={sceneHovered || sceneFocused || assistantOpen}
          onStageChange={setStage}
        />
        <button
          type="button"
          className="hero-book-trigger"
          aria-label="Apri l’assistente per il preventivo del tuo libro"
          onClick={onOpen}
        >
          <Book phase={stage} />
          <span className="studio-book-cue">
            <MousePointer2 size={18} />
            <span className="cue-desktop">Clicca sul libro per il preventivo</span>
            <span className="cue-touch">Tocca il libro per il preventivo</span>
          </span>
        </button>
      </div>
    </div>
  );
}
export function PathCards() {
  return (
    <div className="path-grid">
      {paths.map((p, i) => {
        return (
          <Link className={"path-card " + p.color} href={"/percorsi/" + p.slug} key={p.slug}>
            <span className="path-card-top">
              <span className="card-number">0{i + 1}</span>
              <span className="path-category">
                {["MANOSCRITTO", "IDEA", "VITA VISSUTA", "COMPETENZE", "IMPRESA"][i]}
              </span>
            </span>
            <div className={"path-object path-object-" + i} aria-hidden="true">
              <span className="path-paper">
                <b>
                  {
                    ["Capitolo uno", "Un’idea", "I miei ricordi", "Il metodo", "La nostra storia"][
                      i
                    ]
                  }
                </b>
                <i />
                <i />
                <i />
              </span>
              {i === 0 && <span className="path-edit-mark">¶</span>}
              {i === 1 && <span className="path-pencil" />}
              {i === 2 && <span className="path-photo">1968</span>}
              {i === 3 && <span className="path-index">01 · 02 · 03</span>}
              {i === 4 && <span className="path-timeline">1990 — OGGI</span>}
            </div>
            <h3>{p.title}</h3>
            <p>{p.short}</p>
            <span className="path-card-cta">Esplora il percorso</span>
            <span className="card-arrow">
              <ArrowRight size={22} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
export function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const p = Math.min(
        1,
        Math.max(0, (window.innerHeight * 0.8 - r.top) / (r.height + window.innerHeight * 0.25)),
      );
      ref.current.style.setProperty("--progress", String(p));
    };
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <div className="timeline" ref={ref}>
      <div className="timeline-track">
        <span />
      </div>
      {workflow.map(([title, desc], i) => (
        <div className="timeline-step" key={title}>
          <div className="step-circle">0{i + 1}</div>
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>
      ))}
    </div>
  );
}
export function Platform() {
  const features = [
    ["Stato progetto", Layers],
    ["Messaggi", MessageSquare],
    ["File", Folder],
    ["Approvazioni", CheckCircle2],
    ["Pagamenti", CreditCard],
    ["Consegne", Package],
  ] as const;
  return (
    <section className="platform-section">
      <div className="platform-grid container">
        <div>
          <Eyebrow>IL TUO SPAZIO PROEMIOS</Eyebrow>
          <h2>
            Il tuo libro.
            <br />
            <em>Tutto sotto controllo.</em>
          </h2>
          <p>
            Revisioni, messaggi, approvazioni, pagamenti e consegne. Il progetto non si perde tra
            email e allegati: sai sempre dove sei e cosa succede dopo.
          </p>
          <div className="platform-features">
            {features.map(([name, Icon]) => (
              <span key={name}>
                <Icon size={18} />
                {name}
              </span>
            ))}
          </div>
          <Link href="/accedi" className="text-link">
            Prova l’area autore <ArrowRight size={18} />
          </Link>
        </div>
        <div className="platform-visual">
          <Dashboard />
          <p className="mockup-note">
            Anteprima interattiva con dati di esempio · scegli una voce per esplorare
          </p>
          <div className="platform-note">
            <ShieldCheck size={20} />
            <span>
              Ogni scelta, condivisa.
              <br />
              <strong>Ogni fase, visibile.</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
export function ServicesGrid() {
  const groups = ["Revisione", "Scrittura", "Design e produzione", "Pubblicazione", "Promozione"];
  const body = (g: string, i: number) => (
    <>
      <p>
        {
          [
            "Più chiarezza. La stessa voce.",
            "Le parole che danno forma all’idea.",
            "Dalla pagina alla copertina.",
            "Tutti i passaggi verso i lettori.",
            "Un’uscita pensata, non improvvisata.",
          ][i]
        }
      </p>
      <div className="service-links">
        {services
          .filter((s) => s.group === g)
          .map((s) => (
            <Link href={"/servizi/" + s.slug} key={s.slug}>
              {s.title}
              <ArrowRight size={16} />
            </Link>
          ))}
        {i === 0 && <span>Revisione linguistica</span>}
        {i === 1 && <span>Co-writing</span>}
        {i === 2 && <span>EPUB</span>}
        {i === 3 && <span>Amazon KDP · ISBN · Metadati</span>}
      </div>
    </>
  );
  return (
    <Accordion
      type="multiple"
      defaultValue={[
        "Revisione",
        "Scrittura",
        "Design e produzione",
        "Pubblicazione",
        "Promozione",
      ]}
      className="service-grid unified-services"
    >
      {groups.map((g, i) => (
        <AccordionItem value={g} className={"service-area service-" + i} key={g}>
          <AccordionTrigger className="unified-service-trigger">
            <span>0{i + 1}</span>
            <span>{g}</span>
          </AccordionTrigger>
          <AccordionContent>{body(g, i)}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function Team() {
  return (
    <section className="team-section section">
      <div className="container">
        <div className="section-heading">
          <div>
            <Eyebrow>IL VALORE DEL CONFRONTO</Eyebrow>
            <h2>
              Non lavori con una piattaforma.
              <br />
              Lavori con <em>persone.</em>
            </h2>
          </div>
          <Link href="/chi-siamo" className="text-link">
            Conosci il nostro approccio <ArrowRight size={18} />
          </Link>
        </div>
        <div className="team-grid">
          <div className="team-image">
            <Image
              src="/images/editor-desk.webp"
              alt="Un tavolo di lavoro editoriale, con manoscritto annotato, matita e libro"
              width={1000}
              height={667}
              sizes="(max-width: 768px) 100vw, 50vw"
              loading="lazy"
            />
            <span>La cura, anche nei dettagli.</span>
          </div>
          <div className="team-roles">
            {[
              ["Editor", "Legge in profondità. Lavora con la tua voce."],
              ["Project manager", "Tiene insieme tempi, persone e consegne."],
              ["Grafico editoriale", "Dà al libro una forma coerente."],
              ["Publishing specialist", "Ti accompagna nei passaggi di pubblicazione."],
            ].map(([r, d], i) => (
              <div key={r}>
                <span className={"role-avatar role-" + i}>
                  <PenLine size={23} />
                </span>
                <div>
                  <h3>{r}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
            <div><div><h3>Valerio Gestri</h3><p>Responsabile di Proemios. Coordina il percorso e il confronto con le persone che lavorano al tuo libro.</p></div></div><small>Competenze che entrano nel percorso quando servono al tuo libro.</small>
          </div>
        </div>
      </div>
    </section>
  );
}
export function Testimonials() {
  return null;
}
function TrustDetails() {
  return (
    <section className="trust-section section">
      <div className="container">
        <div className="section-heading">
          <div>
            <Eyebrow>PRIMA DI INIZIARE</Eyebrow>
            <h2>
              La tua storia.
              <br />
              <em>Scelte sicure.</em>
            </h2>
          </div>
          <p>
            Le cose importanti si chiariscono prima:
            <br />
            cosa facciamo, quanto costa e chi decide.
          </p>
        </div>
        <div className="trust-detail-grid">
          <article>
            <ShieldCheck />
            <h3>Diritti e riservatezza spiegati</h3>
            <p>
              Condividere il testo non trasferisce a Proemios i tuoi diritti. Nei lavori di
              scrittura, attribuzione e diritti sono concordati nel contratto.
            </p>
            <Link href="/termini" className="text-link">
              Leggi le condizioni <ArrowRight size={16} />
            </Link>
            <Link href="/privacy" className="text-link">
              Come trattiamo i dati →
            </Link>
          </article>
          <article>
            <CreditCard />
            <h3>Costi chiari prima di iniziare</h3>
            <p>
              La prima stima è indicativa. Servizi inclusi, revisioni, costi esterni e maggiorazioni
              sono esplicitati; il perimetro definitivo si concorda con il team.
            </p>
            <Link href="/preventivo" className="text-link">
              Esplora il preventivo <ArrowRight size={16} />
            </Link>
            <Link href="/termini" className="text-link">
              Inclusioni, revisioni e costi esterni →
            </Link>
          </article>
          <article>
            <CheckCircle2 />
            <h3>Ogni fase passa dalla tua approvazione</h3>
            <p>
              Revisioni, copertina e file finali passano dal tuo confronto con il team. Trovi scelte
              e consegne nel tuo spazio autore.
            </p>
            <Link href="/accedi" className="text-link">
              Prova l’area autore <ArrowRight size={16} />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
export function Orbit() {
  const [active, setActive] = useState(0);
  const stages = [
    "Manoscritto",
    "Editing",
    "Revisione",
    "Copertina",
    "Impaginazione",
    "Pubblicazione",
  ];
  return (
    <section className="orbit-section">
      <div className="orbit-grid container">
        <div>
          <Eyebrow>IL PROGETTO PRENDE FORMA</Eyebrow>
          <h2>
            Una pagina alla volta.
            <br />
            <em>Un passo più vicino.</em>
          </h2>
          <p>
            Dal primo file al libro pronto, ogni fase ha il suo spazio. Scegli una tappa per
            esplorare il percorso.
          </p>
          <div className="stage-description" aria-live="polite">
            <span>0{active + 1} / 06</span>
            <h3>{stages[active]}</h3>
            <p>
              {
                [
                  "Il punto di partenza: la tua idea, i tuoi materiali, la tua voce.",
                  "Struttura, ritmo e chiarezza, con il confronto dell’editor.",
                  "Rileggi le modifiche e approvi la versione successiva.",
                  "Una direzione visiva che racconta il tuo libro.",
                  "Pagine equilibrate, leggibili e pronte per il formato scelto.",
                  "I file approvati e le impostazioni per il canale concordato.",
                ][active]
              }
            </p>
          </div>
        </div>
        <div className="orbit-visual">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <Image
            src="/images/editorial-hero.webp"
            width={500}
            height={500}
            sizes="(max-width: 768px) 90vw, 40vw"
            alt="Il libro al centro del percorso editoriale"
            loading="lazy"
          />
          {stages.map((s, i) => (
            <button
              className={"orbit-label orbit-" + i + (active === i ? " active" : "")}
              onClick={() => setActive(i)}
              key={s}
              aria-pressed={active === i}
            >
              <span>{i < active ? <Check size={13} /> : i + 1}</span>
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Agency() {
  return (
    <section className="section agency-section">
      <div className="agency-card container">
        <div>
          <Eyebrow>PROEMIOS PER AGENZIE</Eyebrow>
          <h2>
            Il tuo cliente.
            <br />
            Il tuo brand.
            <br />
            <em>La nostra infrastruttura.</em>
          </h2>
          <p>
            White-label per agenzie, publisher e partner. Un percorso editoriale coordinato, dietro
            la tua identità.
          </p>
          <Link href="/per-agenzie" className="button secondary">
            Scopri Proemios per agenzie <ArrowRight size={18} />
          </Link>
        </div>
        <div className="agency-visual">
          <Dashboard />
          <Dashboard white />
          <small>Anteprima illustrativa del modello white-label</small>
        </div>
      </div>
    </section>
  );
}
export function HomePage() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMounted, setAssistantMounted] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  function openAssistant(e: MouseEvent<HTMLButtonElement>) {
    opener.current = e.currentTarget;
    setAssistantMounted(true);
    setAssistantOpen(true);
  }
  return (
    <Shell>
      <section className="hero">
        <div className="hero-grid container">
          <div className="hero-copy">
            <Eyebrow>DALL’IDEA AL LIBRO PUBBLICATO</Eyebrow>
            <h1>
              Dai forma
              <br />
              alla tua <em>storia.</em>
            </h1>
            <p>
              Proemios riunisce editing, scrittura, produzione e pubblicazione in un unico percorso.
              Un team editoriale, una piattaforma, tutto il tuo progetto sotto controllo.
            </p>
            <div className="hero-actions">
              <button type="button" className="button" onClick={openAssistant}>
                Calcola il preventivo <ArrowRight size={20} />
              </button>
              <Link href="/contatti?motivo=editor" className="button secondary">
                Parla con un editor
              </Link>
            </div>
            <ul className="trust">
              <li>
                <ShieldCheck />I diritti restano tuoi
              </li>
              <li>
                <Check />
                Costi e fasi chiari
              </li>
              <li>
                <CreditCard />
                Stima senza dati personali
              </li>
            </ul>
          </div>
          <HeroScene assistantOpen={assistantOpen} onOpen={openAssistant} />
        </div>
      </section>
      {assistantMounted && (
        <QuoteAssistant
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          returnFocusRef={opener}
        />
      )}
      <noscript>
        <a href="/preventivo">Calcola il preventivo completo</a>
      </noscript>
      <section className="section paths-section" id="da-dove-parti">
        <div className="container">
          <div className="section-heading">
            <div>
              <Eyebrow>DA DOVE PARTI?</Eyebrow>
              <h2>
                Ogni libro parte
                <br />
                da un punto <em>diverso.</em>
              </h2>
            </div>
            <p>
              Un manoscritto nel cassetto. Un’idea che insiste.
              <br />
              Partiamo da dove sei, insieme.
            </p>
          </div>
          <PathCards />
        </div>
      </section>
      <Platform />
      <section className="section workflow-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <Eyebrow>COME FUNZIONA</Eyebrow>
              <h2>
                Dall’idea al libro.
                <br />
                Un percorso <em>chiaro.</em>
              </h2>
            </div>
            <Link href="/come-funziona" className="text-link">
              Tutte le fasi, senza sorprese <ArrowRight size={18} />
            </Link>
          </div>
          <Timeline />
        </div>
      </section>
      <TrustDetails />
      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <Eyebrow>IL LAVORO EDITORIALE</Eyebrow>
              <h2>
                Tutto ciò che serve
                <br />a un libro <em>fatto bene.</em>
              </h2>
            </div>
            <Link href="/servizi" className="text-link">
              Esplora tutti i servizi <ArrowRight size={18} />
            </Link>
          </div>
          <ServicesGrid />
        </div>
      </section>
      <BeforeAfter />
      <section className="partner-strip container">
        <div>
          <Eyebrow>PER AGENZIE E PUBLISHER</Eyebrow>
          <h2>Il tuo brand. La nostra cura editoriale.</h2>
          <p>Un percorso white-label per accompagnare i progetti dei tuoi clienti.</p>
        </div>
        <Link href="/per-agenzie" className="button secondary">
          Parliamo di collaborazione <ArrowRight size={18} />
        </Link>
      </section>
      <CTA />
    </Shell>
  );
}
