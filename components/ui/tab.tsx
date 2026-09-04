"use client";

import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Schede({
  valorePredefinito,
  voci,
  className,
}: {
  valorePredefinito: string;
  voci: ReadonlyArray<{ valore: string; titolo: string; contenuto: ReactNode; conteggio?: number }>;
  className?: string;
}) {
  return (
    <Tabs.Root defaultValue={valorePredefinito} className={cn("flex flex-col gap-6", className)}>
      <Tabs.List className="flex gap-1 overflow-x-auto border-b border-bordo">
        {voci.map((v) => (
          <Tabs.Trigger
            key={v.valore}
            value={v.valore}
            className={cn(
              "garbo -mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-testo-tenue",
              "hover:text-testo data-[state=active]:border-viola data-[state=active]:text-testo",
            )}
          >
            {v.titolo}
            {typeof v.conteggio === "number" ? (
              <span className="cifre rounded-full bg-superficie-viva px-1.5 py-0.5 text-[0.6875rem] text-testo-attenuato">
                {v.conteggio}
              </span>
            ) : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {voci.map((v) => (
        <Tabs.Content key={v.valore} value={v.valore} className="focus-visible:outline-none">
          {v.contenuto}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
