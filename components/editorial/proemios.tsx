"use client";
import { BRAND } from "@/config/brand";
import { useState, useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "@/components/editorial/link";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  X,
  BookOpen,
  FileText,
  Bookmark,
  PenLine,
  MessageSquare,
  Folder,
  CheckCircle2,
  CreditCard,
  Package,
  ShieldCheck,
  Layers,
  Circle,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/editorial/accordion";
import { Slider } from "@/components/editorial/slider";
import { services, paths, workflow } from "@/lib/editorial-content";
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Proemios, homepage">
      <svg viewBox="0 0 40 34" aria-hidden="true">
        <path
          d="M3 4c7 0 13 4 17 11C24 8 30 4 37 4v24c-7-1-13 1-17 5-4-4-10-6-17-5Z"
          fill="currentColor"
        />
        <path d="M20 15v18" stroke="#FAF8F5" strokeWidth="1.6" />
        <path d="M3 4c7 0 13 4 17 11V23C15 14 9 10 3 11Z" fill="#fff" opacity=".28" />
      </svg>
      <span>
        Proemios<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
const nav: [string, string][] = [
  ["Servizi", "/servizi"],
  ["Percorsi", "/percorsi"],
  ["Come funziona", "/come-funziona"],
  ["Per professionisti", "/percorsi/libro-professionale"],
  ["Per agenzie", "/per-agenzie"],
  ["Risorse", "/blog"],
];
export function Header() {
  const [open, setOpen] = useState(false);
  const [scroll, setScroll] = useState(false);
  useEffect(() => {
    const fn = () => setScroll(window.scrollY > 12);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <>
      <a href="#contenuto" className="skip">
        Salta al contenuto
      </a>
      <header className={"header " + (scroll ? "scrolled" : "")}>
        <div className="nav-wrap">
          <Logo />
          <nav aria-label="Navigazione principale" className="desktop-nav">
            {nav.map(([n, h]) => (
              <Link key={h} href={h}>
                {n}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <Link href="/accedi" className="login-link">
              Accedi
            </Link>
            <Link className="button small" href="/preventivo">
              Richiedi preventivo <ArrowUpRight size={15} />
            </Link>
            <button
              className="menu-toggle"
              aria-label={open ? "Chiudi menu" : "Apri menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" className="mobile-nav" aria-label="Menu mobile">
            {nav.map(([n, h]) => (
              <Link key={h} href={h} onClick={() => setOpen(false)}>
                {n}
                <ArrowUpRight size={18} />
              </Link>
            ))}
            <Link href="/accedi" onClick={() => setOpen(false)}>
              Area riservata
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
export function Footer() {
  const cols = [
    ["Servizi", ...services.map((s) => [s.title, "/servizi/" + s.slug])],
    ["Percorsi", ...paths.map((p) => [p.title, "/percorsi/" + p.slug])],
    [
      "Azienda",
      ["Chi siamo", "/chi-siamo"],
      ["Per agenzie", "/per-agenzie"],
      ["Contatti", "/contatti"],
    ],
    [
      "Risorse",
      ["Come funziona", "/come-funziona"],
      ["Guide editoriali", "/blog"],
      ["Casi studio", "/casi-studio"],
      ["Analisi manoscritto", "/analisi-manoscritto"],
    ],
    ["Legale", ["Privacy", "/privacy"], ["Termini", "/termini"], ["Cookie", "/cookie"]],
  ];
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Logo />
            <p>Dalle idee alle opere.</p>
          </div>
          <Link href="/accedi" className="text-link">
            Entra nel tuo spazio <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="footer-columns">
          {cols.map((c) => (
            <div key={c[0] as string}>
              <h3>{c[0] as string}</h3>
              {c.slice(1).map((l, i) => (
                <Link key={i} href={l[1] as string}>
                  {l[0]}
                </Link>
              ))}
            </div>
          ))}
        </div>
        {/* Formulazione vincolante sull'AI: prima stava nel colophon, che il sito
            pubblico non usa più. Qui copre ogni pagina pubblica come prima. */}
        <p className="footer-ai">{BRAND.aiDisclaimer}</p>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Proemios</span>
          <span>Una storia alla volta.</span>
          <Link href="/preventivo">
            Iniziamo dal tuo progetto <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
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
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow">
      <span />
      {children}
    </p>
  );
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
            Calcola il preventivo <ArrowUpRight size={20} />
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
export function Dashboard({ hero = false, white = false }: { hero?: boolean; white?: boolean }) {
  return (
    <div
      className={
        "dashboard-wrap " + (hero ? "hero-dashboard" : "") + (white ? " white-dashboard" : "")
      }
    >
      <div className="dashboard-back back-one" />
      <div className="dashboard-back back-two" />
      <div className="dashboard-browser">
        <div className="browser-bar">
          <i />
          <i />
          <i />
          <span>{white ? "Il tuo spazio editoriale" : "proemios / il tuo spazio"}</span>
        </div>
        {white && (
          <div className="white-brand">
            IL TUO BRAND <span>Il progetto del tuo cliente</span>
          </div>
        )}
        <Image
          src="/images/dashboard.webp"
          alt="Dashboard Proemios di riferimento: sidebar corallo, grafico attività, elenco progetti e profilo editor"
          width={937}
          height={593}
          sizes={hero ? "(max-width: 768px) 65vw, 35vw" : "(max-width: 768px) 100vw, 55vw"}
          loading={hero ? "eager" : "lazy"}
        />
      </div>
    </div>
  );
}
function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
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
      className="hero-scene"
      onPointerMove={move}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--rx", "0deg");
        ref.current?.style.setProperty("--ry", "0deg");
      }}
    >
      <div className="scene-halo" />
      <div className="hero-scene-inner">
        <Dashboard hero />
        <Image
          className="hero-book"
          src="/images/editorial-hero.webp"
          width={850}
          height={850}
          sizes="(max-width: 768px) 100vw, 52vw"
          priority
          alt="Libro corallo in prospettiva, con copertina La forma delle storie e manoscritto a pagine aperte"
          fetchPriority="high"
        />
        <div className="status-card status-edit">
          <span className="status-icon sage">
            <Check size={17} />
          </span>
          <div>
            <strong>Editing</strong>
            <small>Completato</small>
          </div>
          <Check size={14} />
        </div>
        <div className="status-card status-review">
          <span className="status-icon lavender">
            <PenLine size={17} />
          </span>
          <div>
            <strong>Revisione</strong>
            <small>In corso</small>
          </div>
          <span className="state-dot" />
        </div>
        <div className="status-card status-final">
          <div>
            <Circle size={13} /> Impaginazione
          </div>
          <small>Da iniziare</small>
          <div>
            <Circle size={13} /> Pubblicazione
          </div>
          <small>Da iniziare</small>
        </div>
      </div>
      <div className="scene-caption">
        <span>UNA STORIA. UN PERCORSO.</span>
        <span>Il prossimo libro potrebbe essere il tuo.</span>
      </div>
    </div>
  );
}
export function PathCards() {
  const icons = [BookOpen, FileText, Bookmark, PenLine];
  return (
    <div className="path-grid">
      {paths.map((p, i) => {
        const Icon = icons[i] ?? BookOpen;
        return (
          <Link className={"path-card " + p.color} href={"/percorsi/" + p.slug} key={p.slug}>
            <span className="card-number">0{i + 1}</span>
            <div className="path-object">
              <Icon strokeWidth={1.1} />
              <span />
            </div>
            <h3>{p.title}</h3>
            <p>{p.short}</p>
            <span className="card-arrow">
              <ArrowUpRight size={22} />
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
            <em>
              Tutto sotto
              <br />
              controllo.
            </em>
          </h2>
          <p>
            Segui ogni fase, parla con il team, approva le revisioni e trova tutti i file in un
            unico spazio.
          </p>
          <div className="platform-features">
            {features.map(([name, Icon]) => (
              <span key={name}>
                <Icon size={18} />
                {name}
              </span>
            ))}
          </div>
          <Link href="/come-funziona" className="text-link">
            Scopri come lavoriamo <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="platform-visual">
          <Dashboard />
          <p className="mockup-note">Interfaccia di riferimento · progetti e dati dimostrativi</p>
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
              <ArrowUpRight size={16} />
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
    <>
      <div className="service-grid desktop-services">
        {groups.map((g, i) => (
          <article className={"service-area service-" + i} key={g}>
            <div className="service-area-title">
              <span>0{i + 1}</span>
              <h3>{g}</h3>
              <ArrowUpRight size={21} />
            </div>
            {body(g, i)}
          </article>
        ))}
      </div>
      <Accordion type="single" collapsible defaultValue="Revisione" className="mobile-services">
        {groups.map((g, i) => (
          <AccordionItem value={g} className={"service-area service-" + i} key={g}>
            <AccordionTrigger className="mobile-service-trigger">
              <span>0{i + 1}</span>
              <span>{g}</span>
            </AccordionTrigger>
            <AccordionContent>{body(g, i)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
export function BeforeAfter() {
  const [v, setV] = useState(50);
  return (
    <section className="section before-section">
      <div className="before-grid container">
        <div className="manuscript">
          <div className="paper-base">
            <span className="paper-label">ORIGINALE</span>
            <p className="paper-chapter">CAPITOLO PRIMO</p>
            <h3>Il ritorno</h3>
            <p>
              Quando tornò al paese, lui si accorse che tutto era cambiato, ma anche tutto era
              rimasto uguale.
            </p>
            <p>
              Le case erano sempre li. E la piazza era sempre quella piazza che lui conosceva così
              bene.
            </p>
            <p>
              Si fermò per un momento. Pensava che forse non avrebbe dovuto tornare, ma era tornato.
            </p>
            <small>Testo dimostrativo, creato per questo confronto.</small>
          </div>
          <div className="paper-revised" style={{ clipPath: `inset(0 0 0 ${v}%)` }}>
            <span className="paper-label">REVISIONATO</span>
            <p className="paper-chapter">CAPITOLO PRIMO</p>
            <h3>Il ritorno</h3>
            <p>
              Quando tornò al paese,{" "}
              <mark>gli sembrò che tutto fosse diverso. Eppure riconosceva ogni angolo.</mark>
            </p>
            <p>
              Le case erano ancora <mark>lì</mark>. La piazza conservava{" "}
              <mark>le voci e le ombre che ricordava.</mark>
            </p>
            <p>
              Si fermò.{" "}
              <mark>Aveva esitato a lungo, prima di tornare. Adesso era di nuovo a casa.</mark>
            </p>
            <small>Una possibile revisione, da discutere con l’autore.</small>
          </div>
          <div className="comparison-line" style={{ left: v + "%" }}>
            <span>↔</span>
          </div>
          <Slider
            className="comparison-slider"
            value={[v]}
            onValueChange={(x) => setV(x[0] ?? 50)}
            min={5}
            max={95}
            step={1}
            aria-label="Posizione del confronto originale e revisionato"
          />
          <p className="slider-hint">
            Trascina per confrontare <span>← →</span>
          </p>
        </div>
        <div>
          <Eyebrow>LA CURA SI VEDE</Eyebrow>
          <h2>
            Dal manoscritto
            <br />
            alla versione
            <br />
            <em>pronta.</em>
          </h2>
          <div className="quality-tags">
            {["Correzione", "Stile", "Coerenza", "Chiarezza"].map((x) => (
              <span key={x}>
                <Check size={14} />
                {x}
              </span>
            ))}
          </div>
          <p>
            Tecnologia editoriale e supervisione professionale lavorano insieme. La decisione finale
            resta sempre umana.
          </p>
          <Link href="/servizi/editing" className="text-link">
            Il lavoro dietro ogni pagina <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </section>
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
            Conosci il nostro approccio <ArrowUpRight size={18} />
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
                <span className={"role-avatar role-" + i}>{["Ed", "Pm", "Gr", "Ps"][i]}</span>
                <div>
                  <h3>{r}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
            <small>
              Le schede personali del team saranno pubblicate con profili e foto verificati.
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}
export function Testimonials() {
  return (
    <section className="section stories-section">
      <div className="container">
        <div className="section-heading">
          <div>
            <Eyebrow>OGNI OPERA HA UN PERCORSO</Eyebrow>
            <h2>
              Storie che sono
              <br />
              diventate <em>libri.</em>
            </h2>
          </div>
          <p>
            Spazio dedicato alle esperienze degli autori.
            <br />
            Pubblicheremo solo testimonianze verificate.
          </p>
        </div>
        <div className="testimonial-grid">
          {[
            "Un romanzo, dalla prima revisione",
            "Una vita da raccontare",
            "Un metodo da condividere",
          ].map((t, i) => (
            <article className="testimonial" key={t}>
              <span className="placeholder-badge">Testimonianza da inserire</span>
              <div className="testimonial-header">
                <span className={"testimonial-cover cover-" + i}>
                  <BookOpen size={22} />
                </span>
                <h3>{t}</h3>
              </div>
              <p>
                Qui troverai il racconto dell’autore, il libro realizzato e il lavoro svolto
                insieme.
              </p>
              <div className="testimonial-person">
                <span>—</span>
                <div>
                  Profilo autore da verificare
                  <small>
                    {["Editing e produzione", "Memoir e ghostwriting", "Libro professionale"][i]}
                  </small>
                </div>
              </div>
            </article>
          ))}
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
            Scopri Proemios per agenzie <ArrowUpRight size={18} />
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
              <Link href="/preventivo" className="button">
                Richiedi un preventivo <ArrowUpRight size={20} />
              </Link>
              <Link href="/contatti?motivo=editor" className="button secondary">
                Parla con un editor
              </Link>
            </div>
            <ul className="trust">
              <li>
                <Check />
                Professionisti editoriali
              </li>
              <li>
                <Check />
                Processo trasparente
              </li>
              <li>
                <Check />
                Un unico interlocutore
              </li>
            </ul>
          </div>
          <HeroScene />
        </div>
        <div className="hero-bottom container">
          <span>Tu racconti la storia. Noi ti aiutiamo a darle forma.</span>
          <a href="#da-dove-parti">
            Scopri il tuo percorso <ChevronDown size={17} />
          </a>
        </div>
      </section>
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
              Tutte le fasi, senza sorprese <ArrowUpRight size={18} />
            </Link>
          </div>
          <Timeline />
        </div>
      </section>
      <Platform />
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
              Esplora tutti i servizi <ArrowUpRight size={18} />
            </Link>
          </div>
          <ServicesGrid />
        </div>
      </section>
      <BeforeAfter />
      <Team />
      <Testimonials />
      <Orbit />
      <Agency />
      <CTA />
    </Shell>
  );
}
