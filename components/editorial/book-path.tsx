"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  PenLine,
  Check,
  Palette,
  LayoutTemplate,
  BookOpen,
  Pause,
  Play,
} from "lucide-react";

const stages = [
  {
    label: "Manoscritto",
    title: "Tutto comincia con la tua voce.",
    detail: "Un’idea, una bozza, una storia da raccontare. Partiamo da qui.",
    icon: FileText,
    output: "Il punto di partenza",
  },
  {
    label: "Editing",
    title: "La storia trova il suo ritmo.",
    detail: "L’editor lavora su struttura e stile, insieme a te.",
    icon: PenLine,
    output: "Struttura e voce",
  },
  {
    label: "Revisione",
    title: "Ogni parola, al suo posto.",
    detail: "Rileggi, commenti e approvi le modifiche al tuo testo.",
    icon: Check,
    output: "Il testo approvato",
  },
  {
    label: "Copertina",
    title: "La prima impressione conta.",
    detail: "Una direzione visiva che parla del libro e ai suoi lettori.",
    icon: Palette,
    output: "L’identità del libro",
  },
  {
    label: "Impaginazione",
    title: "Le parole diventano pagine.",
    detail: "Tipografia, spazi e formati: la lettura prende forma.",
    icon: LayoutTemplate,
    output: "Carta e digitale",
  },
  {
    label: "Pubblicazione",
    title: "Pronto per il prossimo capitolo.",
    detail: "I file approvati sono pronti per il canale che hai scelto.",
    icon: BookOpen,
    output: "Il tuo libro, pronto",
  },
];

export function BookPath({
  hovered,
  active,
  onStageChange,
}: {
  hovered: boolean;
  active: number;
  onStageChange: (stage: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
            threshold: 0.25,
          })
        : null;
    if (!observer) setVisible(true);
    if (ref.current) observer?.observe(ref.current);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer?.disconnect();
    };
  }, []);
  useEffect(() => {
    if (reduced || paused || hovered || !visible || !pageVisible) return;
    const timer = window.setTimeout(() => onStageChange((active + 1) % stages.length), 6000);
    return () => window.clearTimeout(timer);
  }, [active, reduced, paused, hovered, visible, pageVisible, onStageChange]);
  const stage = stages[active]!;
  const Icon = stage.icon;
  return (
    <div ref={ref} className="editorial-story">
      <div className="studio-story-heading">
        <span>UN LIBRO PRENDE FORMA</span>
        <button
          type="button"
          className="studio-playback"
          aria-label={
            reduced
              ? "Avanza di una fase"
              : paused
                ? "Riprendi il percorso"
                : "Metti in pausa il percorso"
          }
          onClick={() =>
            reduced ? onStageChange((active + 1) % stages.length) : setPaused((p) => !p)
          }
        >
          {paused || reduced ? <Play size={16} /> : <Pause size={16} />}
          <span>{reduced ? "Avanti" : paused ? "Riprendi" : "Pausa"}</span>
        </button>
      </div>
      <div
        className="studio-story-slide"
        key={active}
        aria-live={paused || reduced ? "polite" : "off"}
      >
        <span className="studio-slide-icon">
          <Icon size={24} strokeWidth={1.5} />
        </span>
        <span className="studio-slide-step">
          0{active + 1} / 06 · {stage.label}
        </span>
        <h2>{stage.title}</h2>
        <p>{stage.detail}</p>
        <span className="studio-slide-output">
          <Check size={14} /> {stage.output}
        </span>
      </div>
      <div
        className="studio-story-steps"
        role="group"
        aria-label="Scegli una fase del percorso editoriale"
      >
        {stages.map((item, i) => (
          <button
            type="button"
            key={item.label}
            aria-label={item.label + ": " + item.detail}
            aria-pressed={active === i}
            className={active === i ? "active" : ""}
            onClick={() => {
              onStageChange(i);
              setPaused(true);
            }}
          >
            <span>0{i + 1}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
