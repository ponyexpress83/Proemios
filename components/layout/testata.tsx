"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Marchio } from "./marchio";
import { BottoneLink } from "@/components/ui/bottone";
import { cx } from "@/components/ui/primitivi";
import { NAV_PRINCIPALE, AZIONI, UI } from "@/config/copy";

/**
 * Testata corrente: come la riga di testatina di un libro, resta in alto
 * e dice dove sei. Filetto di chiusura invece di ombra.
 */
export function Testata() {
  const pathname = usePathname();
  const [aperto, setAperto] = useState(false);
  const [ultimoPath, setUltimoPath] = useState(pathname);

  // Chiude il menu al cambio pagina (aggiustamento di stato in render).
  if (pathname !== ultimoPath) {
    setUltimoPath(pathname);
    setAperto(false);
  }

  return (
    <header className="border-filetto bg-carta/90 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="gabbia flex h-16 items-center justify-between gap-6">
        <Marchio />

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigazione principale">
          {NAV_PRINCIPALE.map((voce) => {
            const attiva = pathname === voce.href || pathname.startsWith(voce.href + "/");
            return (
              <Link
                key={voce.href}
                href={voce.href as Route}
                aria-current={attiva ? "page" : undefined}
                className={cx(
                  "garbo font-ui text-sm",
                  attiva ? "text-inchiostro" : "text-stampa hover:text-inchiostro",
                )}
              >
                {voce.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <BottoneLink href="/analisi-manoscritto" variante="secondario">
            {AZIONI.analisiBreve}
          </BottoneLink>
          <BottoneLink href="/preventivo">{AZIONI.preventivo}</BottoneLink>
        </div>

        <button
          type="button"
          className="rounded-campo border-filetto-forte grid size-10 place-items-center border lg:hidden"
          aria-label={aperto ? UI.menuChiudi : UI.menuApri}
          aria-expanded={aperto}
          onClick={() => setAperto((v) => !v)}
        >
          <span className="relative block h-3 w-5" aria-hidden>
            <span
              className={cx(
                "bg-inchiostro absolute inset-x-0 top-0 h-px transition-transform",
                aperto && "translate-y-[6px] rotate-45",
              )}
            />
            <span
              className={cx(
                "bg-inchiostro absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-opacity",
                aperto && "opacity-0",
              )}
            />
            <span
              className={cx(
                "bg-inchiostro absolute inset-x-0 bottom-0 h-px transition-transform",
                aperto && "-translate-y-[6px] -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      {aperto && (
        <div className="border-filetto bg-carta border-t lg:hidden">
          <nav className="gabbia flex flex-col py-4" aria-label="Navigazione mobile">
            {NAV_PRINCIPALE.map((voce) => (
              <Link
                key={voce.href}
                href={voce.href as Route}
                className="border-filetto font-ui text-inchiostro border-b py-3 text-base last:border-0"
              >
                {voce.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3">
              <BottoneLink href="/analisi-manoscritto" variante="secondario" misura="grande">
                {AZIONI.analisi}
              </BottoneLink>
              <BottoneLink href="/preventivo" misura="grande">
                {AZIONI.preventivo}
              </BottoneLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
