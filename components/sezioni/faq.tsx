"use client";

import { useState } from "react";
import { Filetto, cx } from "@/components/ui/primitivi";
import type { ServiceFaq } from "@/config/services";

/**
 * FAQ come apparato di note: filetti, niente riquadri.
 * Il JSON-LD FAQPage è renderizzato a parte dalla pagina.
 */
export function Faq({ voci }: { voci: readonly ServiceFaq[] }) {
  const [aperta, setAperta] = useState<number | null>(0);

  return (
    <div>
      <Filetto />
      {voci.map((voce, i) => {
        const isAperta = aperta === i;
        return (
          <div key={i}>
            <h3>
              <button
                type="button"
                onClick={() => setAperta(isAperta ? null : i)}
                aria-expanded={isAperta}
                className="flex w-full items-start justify-between gap-6 py-5 text-left"
              >
                <span className="font-display text-inchiostro text-lg font-medium">{voce.q}</span>
                <span
                  className={cx(
                    "garbo mt-1 grid size-6 shrink-0 place-items-center rounded-full border",
                    isAperta
                      ? "border-alloro text-alloro rotate-45"
                      : "border-filetto-forte text-stampa",
                  )}
                  aria-hidden
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M6 1v10M1 6h10"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              className={cx(
                "grid overflow-hidden transition-all duration-300",
                isAperta ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0">
                <p className="prosa specchio">{voce.a}</p>
              </div>
            </div>
            <Filetto />
          </div>
        );
      })}
    </div>
  );
}
