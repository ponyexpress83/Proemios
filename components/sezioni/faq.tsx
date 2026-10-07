"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { cn } from "@/lib/cn";

export type VoceFaq = { domanda: string; risposta: string };
/** Forma storica usata da config/services.ts. Normalizzata qui, non nelle pagine. */
export type VoceFaqBreve = { q: string; a: string };

function normalizza(v: VoceFaq | VoceFaqBreve): VoceFaq {
  return "q" in v ? { domanda: v.q, risposta: v.a } : v;
}

/**
 * FAQ su Radix Accordion: gestisce da solo aria-expanded, aria-controls e la
 * navigazione da tastiera. Il JSON-LD FAQPage lo emette la pagina, non questo
 * componente, perché dipende dall'URL. Aprire e chiudere dura 200 ms.
 */
export function Faq({
  voci,
  className,
}: {
  voci: ReadonlyArray<VoceFaq | VoceFaqBreve>;
  className?: string;
}) {
  const domande = voci.map(normalizza);
  return (
    <Accordion.Root type="single" collapsible defaultValue="faq-0" className={cn("border-t border-filetto", className)}>
      {domande.map((voce, i) => (
        <Accordion.Item key={i} value={`faq-${i}`} className="border-b border-filetto">
          <Accordion.Header>
            <Accordion.Trigger className="group flex min-h-14 w-full items-start justify-between gap-6 rounded-campo py-4 text-left">
              <span className="font-serif text-t-md text-inchiostro">{voce.domanda}</span>
              <span
                aria-hidden="true"
                className="mt-1 grid size-7 shrink-0 place-items-center rounded-pillola border border-filetto text-inchiostro transition-transform duration-200 ease-matita group-data-[state=open]:rotate-45 group-data-[state=open]:border-rosso-matita group-data-[state=open]:text-rosso-matita"
              >
                <svg viewBox="0 0 12 12" className="size-3">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden">
            <p className="max-w-giustezza pb-6 text-t-base text-grafite">{voce.risposta}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
