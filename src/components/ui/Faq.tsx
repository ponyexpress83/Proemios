"use client";

import { useState } from "react";
import type { Faq } from "@/config/services";
import { cn } from "@/lib/cn";

/** Accordion FAQ con micro-interazione sobria. Il JSON-LD FAQPage è renderizzato a parte. */
export function FaqList({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-linea border-y border-linea">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-6 py-5 text-left"
            >
              <span className="font-display text-lg font-medium text-inchiostro">
                {item.domanda}
              </span>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border border-linea text-bronzo lift",
                  isOpen && "rotate-45 border-bronzo",
                )}
                aria-hidden
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div
              className={cn(
                "grid overflow-hidden transition-all duration-300",
                isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0">
                <p className="max-w-prose leading-relaxed text-inchiostro-60">{item.risposta}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
