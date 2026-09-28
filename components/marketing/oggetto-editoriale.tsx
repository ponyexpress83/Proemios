"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Oggetto editoriale astratto dell'hero: strati di pagina disposti nello
 * spazio, che si inclinano seguendo il puntatore.
 *
 * Vincoli rispettati:
 *  - nessuna libreria 3D: sono div con transform CSS, costo ~0 KB di JS oltre
 *    a questo file e nessun canvas da comporre;
 *  - l'animazione tocca solo `transform`, quindi resta sul compositor e non
 *    provoca layout né paint (nessun impatto su INP/CLS);
 *  - `prefers-reduced-motion`: l'oggetto resta fermo nella sua posa e il
 *    listener non viene nemmeno registrato;
 *  - senza JavaScript i div esistono comunque, nella posa di riposo.
 */
export function OggettoEditoriale({ className }: { className?: string }) {
  const contenitore = useRef<HTMLDivElement>(null);
  const [inclinazione, setInclinazione] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Su touch non esiste un puntatore che stazioni: inclinare al tocco
    // significherebbe muovere l'oggetto mentre l'utente scorre la pagina.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    function suMovimento(e: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = contenitore.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        // Limite stretto: oltre i 10° l'oggetto smette di sembrare solido.
        setInclinazione({
          x: Math.max(-1, Math.min(1, dy)) * -8,
          y: Math.max(-1, Math.min(1, dx)) * 10,
        });
      });
    }

    window.addEventListener("pointermove", suMovimento, { passive: true });
    return () => {
      window.removeEventListener("pointermove", suMovimento);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Gli strati sotto non sono solo più lontani: scalano verso l'alto a sinistra,
  // così i bordi sporgono dal foglio in cima e la pila si legge come pila.
  const strati = [
    { z: 0, x: 0, y: 0, opacita: 1 },
    { z: -30, x: -26, y: -20, opacita: 0.72 },
    { z: -60, x: -52, y: -40, opacita: 0.5 },
    { z: -90, x: -78, y: -60, opacita: 0.32 },
    { z: -120, x: -104, y: -80, opacita: 0.18 },
  ];

  return (
    <div
      ref={contenitore}
      aria-hidden
      className={cn("pointer-events-none relative select-none", className)}
      style={{ perspective: "1200px" }}
    >
      <span className="alone -top-16 -left-10 size-64 bg-viola/45" />
      <span className="alone -right-4 bottom-0 size-48 bg-lime/12" />

      <div
        className="relative transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${16 + inclinazione.x}deg) rotateY(${-22 + inclinazione.y}deg) rotateZ(-6deg)`,
        }}
      >
        {strati.map((s, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl border border-bordo-forte",
              i === 0
                ? "relative bg-superficie-alta shadow-fluttuante"
                : "absolute inset-0 bg-superficie",
            )}
            style={{
              transform: `translate3d(${s.x}px, ${s.y}px, ${s.z}px)`,
              opacity: s.opacita,
              aspectRatio: "3 / 4",
            }}
          >
            {i === 0 ? <FoglioInCima /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Il foglio in cima porta finte righe di testo con due "revisioni tracciate":
 * è la promessa del prodotto resa visibile senza una parola di copy.
 */
function FoglioInCima() {
  const righe = [
    { larghezza: "72%", tono: "normale" },
    { larghezza: "94%", tono: "normale" },
    { larghezza: "61%", tono: "cancellata" },
    { larghezza: "88%", tono: "inserita" },
    { larghezza: "79%", tono: "normale" },
    { larghezza: "45%", tono: "normale" },
    { larghezza: "91%", tono: "normale" },
    { larghezza: "68%", tono: "inserita" },
    { larghezza: "83%", tono: "normale" },
    { larghezza: "38%", tono: "normale" },
  ] as const;

  return (
    <div className="flex h-full flex-col gap-4 p-7">
      <div className="flex items-center justify-between">
        <span className="etichetta text-testo-tenue">P-184</span>
        <span className="etichetta text-lime">Revisione</span>
      </div>
      <div className="h-2.5 w-3/5 rounded-full bg-testo/25" />
      <div className="flex flex-1 flex-col gap-2.5 pt-2">
        {righe.map((r, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full",
              r.tono === "normale" && "bg-testo/12",
              r.tono === "cancellata" && "bg-errore/40",
              r.tono === "inserita" && "bg-lime/50",
            )}
            style={{ width: r.larghezza }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-bordo pt-4">
        <span className="size-1.5 rounded-full bg-lime" />
        <span className="etichetta text-testo-tenue">Approvato</span>
      </div>
    </div>
  );
}
