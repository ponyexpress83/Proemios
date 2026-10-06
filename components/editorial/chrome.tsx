"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "./link";
import { Logo } from "./brand";
import { services, paths } from "@/lib/editorial-content";
const nav: [string, string][] = [
  ["Servizi", "/servizi"],
  ["Percorsi", "/percorsi"],
  ["Come funziona", "/come-funziona"],
  ["Per professionisti", "/percorsi/libro-professionale"],
  ["Per agenzie", "/per-agenzie"],
  ["Guide", "/blog"],
];
export function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
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
              Area autori
            </Link>
            <Link className="button small" href="/preventivo">
              Richiedi preventivo <ArrowRight size={15} />
            </Link>
            <button
              ref={menuButton}
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
                <ArrowRight size={18} />
              </Link>
            ))}
            <Link href="/analisi-manoscritto" onClick={() => setOpen(false)}>
              Analisi del testo →
            </Link>
            <Link href="/preventivo" className="button" onClick={() => setOpen(false)}>
              Richiedi preventivo <ArrowRight size={18} />
            </Link>
            <Link href="/accedi" onClick={() => setOpen(false)}>
              Area autori
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
            <p className="footer-reassurance">
              Costi chiari. Scelte condivise. La tua voce, sempre.
            </p>
          </div>
          <Link href="/accedi" className="text-link">
            Prova l’area autori <ArrowRight size={18} />
          </Link>
        </div>
        <div className="footer-columns">
          {cols.map((c) => (
            <div key={c[0] as string}>
              <h2>{c[0] as string}</h2>
              {c.slice(1).map((l, i) => (
                <Link key={i} href={l[1] as string}>
                  {l[0]}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Proemios</span>
          <span>Una storia alla volta.</span>
          <span>Un servizio di Smart Content S.r.l.s.</span>
          <Link href="/preventivo">
            Iniziamo dal tuo progetto <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
