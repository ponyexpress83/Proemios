"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
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
 * componente, perché dipende dall'URL.
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
    <Accordion.Root
      type="single"
      collapsible
      defaultValue="faq-0"
      className={cn("border-t border-bordo", className)}
    >
      {domande.map((voce, i) => (
        <Accordion.Item key={i} value={`faq-${i}`} className="border-b border-bordo">
          <Accordion.Header>
            <Accordion.Trigger className="group garbo flex w-full items-start justify-between gap-6 py-5 text-left hover:text-testo">
              <span className="text-base font-medium text-testo sm:text-lg">{voce.domanda}</span>
              <span
                aria-hidden
                className="garbo mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-bordo-forte text-testo-tenue group-data-[state=open]:rotate-45 group-data-[state=open]:border-lime group-data-[state=open]:text-lime"
              >
                <Plus className="size-3" />
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-none">
            <p className="lettura pb-6 text-sm leading-relaxed text-testo-attenuato sm:text-base">
              {voce.risposta}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
