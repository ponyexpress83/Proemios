"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Carosello con aggancio allo scorrimento, per i fogli su schermi stretti.
 * L'indicatore sotto dice dove si è; i suoi pulsanti portano al foglio e si
 * usano con le frecce. Sopra `lg` i figli stanno in griglia e il carosello non
 * esiste: è lo stesso DOM, cambia solo il CSS.
 */
export function Carosello({
  children,
  etichetta,
  classeGriglia,
}: {
  children: ReactNode[];
  /** Nome accessibile dell'elenco. */
  etichetta: string;
  /** Classi della griglia da `lg` in su. */
  classeGriglia: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [attivo, setAttivo] = useState(0);
  const n = children.length;

  useEffect(() => {
    const lista = ref.current;
    if (!lista || !("IntersectionObserver" in window)) return;
    const voci = Array.from(lista.children);
    const oss = new IntersectionObserver(
      (voci) => {
        const visibile = voci.filter((v) => v.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visibile) setAttivo(Number((visibile.target as HTMLElement).dataset.indice));
      },
      { root: lista, threshold: 0.6 },
    );
    voci.forEach((v) => oss.observe(v));
    return () => oss.disconnect();
  }, [n]);

  const vai = (i: number) => {
    const voce = ref.current?.children[i] as HTMLElement | undefined;
    voce?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setAttivo(i);
  };

  return (
    <div>
      <ul
        ref={ref}
        aria-label={etichetta}
        className={cn("carosello -mx-4 lg:mx-0 lg:grid lg:overflow-visible lg:p-0", classeGriglia)}
      >
        {children.map((c, i) => (
          <li key={i} data-indice={i} className="flex lg:!flex-auto">
            {c}
          </li>
        ))}
      </ul>
      <div
        role="group"
        aria-label={`Posizione nel carosello ${etichetta.toLowerCase()}`}
        className="mt-5 flex justify-center gap-2 lg:hidden"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") vai(Math.min(n - 1, attivo + 1));
          if (e.key === "ArrowLeft") vai(Math.max(0, attivo - 1));
          if (e.key === "Home") vai(0);
          if (e.key === "End") vai(n - 1);
        }}
      >
        {children.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Foglio ${i + 1} di ${n}`}
            aria-current={attivo === i ? "true" : undefined}
            onClick={() => vai(i)}
            className="flex size-11 items-center justify-center rounded-pillola"
          >
            <span
              className={cn(
                "block size-2.5 rounded-pillola transition-[background-color,transform] duration-200 ease-matita",
                attivo === i ? "scale-125 bg-rosso-matita" : "bg-filetto",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
