"use client";
import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  editorialStages,
  editorialScene,
  initialJourney,
  journeyReducer,
} from "@/lib/editorial-journey";

export function BookPath({
  hovered,
  onStageChange,
}: {
  hovered: boolean;
  onStageChange: (stage: number) => void;
}) {
  const [journey, dispatch] = useReducer(journeyReducer, initialJourney);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    const visibility = () => setPageVisible(!document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.25 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    onStageChange(journey.phase);
  }, [journey.phase, onStageChange]);
  useEffect(() => {
    if (reduced || journey.mode !== "playing" || hovered || !visible || !pageVisible) return;
    // 780 ms to compose the paper, then more than five seconds to read it.
    const timer = window.setTimeout(() => dispatch({ type: "tick" }), 6000);
    return () => window.clearTimeout(timer);
  }, [journey, reduced, hovered, visible, pageVisible]);
  const stage = editorialStages[journey.phase]!;
  const scene = editorialScene(journey.phase);
  return (
    <div
      ref={ref}
      className="editorial-story"
      data-motion={reduced ? "reduced" : "full"}
      data-playback={journey.mode}
    >
      <div className="studio-story-heading">
        <span>UN LIBRO PRENDE FORMA</span>
        {!reduced && (
          <button
            type="button"
            className="studio-playback"
            onClick={() => dispatch({ type: journey.mode === "finished" ? "replay" : "toggle" })}
          >
            {journey.mode === "finished" ? (
              <RotateCcw size={16} />
            ) : journey.mode === "paused" ? (
              <Play size={16} />
            ) : (
              <Pause size={16} />
            )}
            {journey.mode === "finished"
              ? "Rivedi il percorso"
              : journey.mode === "paused"
                ? "Riprendi"
                : "Pausa"}
          </button>
        )}
        {reduced && <span className="studio-static-note">Scegli una fase</span>}
      </div>
      <div className="studio-paper-panel" aria-hidden="true">
        <div className="studio-paper-tiles" key={journey.phase}>
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              style={
                {
                  backgroundImage: `url("${scene}")`,
                  backgroundPosition: `${((i % 4) * 100) / 3}% ${(Math.floor(i / 4) * 100) / 3}%`,
                  "--tile-delay": `${((i % 4) + Math.floor(i / 4)) * 30}ms`,
                  "--tile-x": `${((i % 4) - 1.5) * 9}px`,
                  "--tile-y": `${(Math.floor(i / 4) - 1.5) * 9}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <div
        className="studio-story-slide"
        aria-live={journey.mode === "playing" && !reduced ? "off" : "polite"}
      >
        <span className="studio-slide-step">
          0{journey.phase + 1} / 06 · {stage.label}
        </span>
        <h2>{stage.title}</h2>
        <p>{stage.detail}</p>
      </div>
      <div
        className="studio-story-steps"
        role="group"
        aria-label="Scegli una fase del percorso editoriale"
      >
        {editorialStages.map((item, i) => (
          <button
            type="button"
            key={item.label}
            aria-label={item.label + ": " + item.detail}
            aria-pressed={journey.phase === i}
            className={journey.phase === i ? "active" : ""}
            onClick={() => dispatch({ type: "select", phase: i })}
          >
            <span>0{i + 1}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
