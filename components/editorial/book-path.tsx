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
  RotateCcw,
} from "lucide-react";

const stages = [
  { label: "Manoscritto", detail: "La tua voce", icon: FileText },
  { label: "Editing", detail: "Struttura e stile", icon: PenLine },
  { label: "Revisione", detail: "Ogni parola al suo posto", icon: Check },
  { label: "Copertina", detail: "Un’identità al libro", icon: Palette },
  { label: "Impaginazione", detail: "La forma delle pagine", icon: LayoutTemplate },
  { label: "Pubblicazione", detail: "Pronto per i lettori", icon: BookOpen },
];

export function BookPath({ hovered }: { hovered: boolean }) {
  const [active, setActive] = useState(0);
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
            threshold: 0.35,
          })
        : null;
    if (!observer) setVisible(true);
    if (ref.current) observer?.observe(ref.current);
    return () => {
      media.removeEventListener("change", update);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (reduced || paused || hovered || !visible || !pageVisible || active === stages.length - 1)
      return;
    const timer = window.setTimeout(() => setActive((step) => step + 1), 4500);
    return () => window.clearTimeout(timer);
  }, [active, reduced, paused, hovered, visible, pageVisible]);
  const start = Math.min(Math.max(active - 1, 0), stages.length - 3);
  const complete = active === stages.length - 1;
  return (
    <div ref={ref} className="book-path">
      <div className="book-path-heading">
        <span>DALL’IDEA AL LIBRO</span>
        <button
          type="button"
          className="path-playback"
          aria-label={
            complete
              ? "Rivedi il percorso editoriale"
              : reduced
                ? "Avanza di una fase"
                : paused
                  ? "Riprendi il percorso"
                  : "Metti in pausa il percorso"
          }
          onClick={() => {
            if (complete) {
              setActive(0);
              setPaused(false);
            } else if (reduced) {
              setActive((s) => Math.min(s + 1, stages.length - 1));
            } else setPaused((p) => !p);
          }}
        >
          {complete ? (
            <RotateCcw size={17} />
          ) : paused || reduced ? (
            <Play size={17} />
          ) : (
            <Pause size={17} />
          )}
          <span>{complete ? "Rivedi" : reduced ? "Avanti" : paused ? "Riprendi" : "Pausa"}</span>
        </button>
      </div>
      <div className="book-path-window" role="group" aria-label="Le fasi del percorso editoriale">
        <div
          className="book-path-track"
          style={{ transform: `translateY(calc(${start} * var(--path-stride) * -1))` }}
        >
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const inView = i >= start && i < start + 3;
            return (
              <div
                key={stage.label}
                className={
                  "book-path-node " +
                  (i < active ? "is-done" : i === active ? "is-current" : "is-next")
                }
                aria-hidden={!inView}
              >
                {i > 0 && (
                  <span className="book-path-connector" aria-hidden="true">
                    <i />
                  </span>
                )}
                <button
                  type="button"
                  tabIndex={inView ? 0 : -1}
                  aria-current={i === active ? "step" : undefined}
                  aria-label={stage.label + ": " + stage.detail}
                  onClick={() => {
                    setActive(i);
                    setPaused(true);
                  }}
                >
                  <span className="path-stage-icon">
                    {i < active ? <Check size={20} /> : <Icon size={20} />}
                  </span>
                  <span>
                    <strong>{stage.label}</strong>
                    <small>{stage.detail}</small>
                  </span>
                  <span className="path-stage-number">{String(i + 1).padStart(2, "0")}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="book-path-caption" aria-live="off">
        <span>{String(active + 1).padStart(2, "0")} / 06</span>
        <strong>{complete ? "Il libro prende forma." : stages[active]!.label}</strong>
      </div>
    </div>
  );
}
