import type { ReactNode } from "react";
import { Testata } from "./testata";
import { Colophon } from "./colophon";
import { FasciaDemo } from "@/components/layout/fascia-demo";

/**
 * Guscio del sito pubblico. `data-tema="carta"` accende il tema chiaro e i
 * token della matita per tutto ciò che contiene; le aree riservate stanno
 * fuori e restano scure.
 *
 * `<main id="contenuto">` è la destinazione del «Vai al contenuto» del layout
 * radice.
 */
export function GuscioSito({ children }: { children: ReactNode }) {
  return (
    <div data-tema="carta" className="flex min-h-dvh flex-col bg-carta text-inchiostro">
      <FasciaDemo />
      <Testata />
      <main id="contenuto" className="flex-1">
        {children}
      </main>
      <Colophon />
    </div>
  );
}
