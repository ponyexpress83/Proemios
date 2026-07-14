"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";
import { NAV_PRIMARY } from "@/config/site";
import { Wordmark } from "@/components/ui/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Chiudi il menu al cambio pagina (aggiustamento di stato in fase di render,
  // pattern consigliato da React invece di un effetto).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <header className="border-linea/70 bg-carta/85 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="container-editorial flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigazione principale">
          {NAV_PRIMARY.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={cn(
                  "text-inchiostro-60 hover:text-inchiostro text-sm font-medium transition-colors",
                  active && "text-inchiostro",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ButtonLink href="/analisi-manoscritto" variant="secondary" size="md">
            Analisi gratuita
          </ButtonLink>
          <ButtonLink href="/preventivo" variant="primary" size="md">
            Preventivo
          </ButtonLink>
        </div>

        <button
          type="button"
          className="border-linea grid size-10 place-items-center rounded-md border lg:hidden"
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3.5 w-5">
            <span
              className={cn(
                "bg-inchiostro absolute inset-x-0 top-0 h-0.5 transition-transform",
                open && "translate-y-[6px] rotate-45",
              )}
            />
            <span
              className={cn(
                "bg-inchiostro absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 transition-opacity",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "bg-inchiostro absolute inset-x-0 bottom-0 h-0.5 transition-transform",
                open && "-translate-y-[6px] -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-linea bg-carta border-t lg:hidden">
          <nav className="container-editorial flex flex-col py-4" aria-label="Navigazione mobile">
            {NAV_PRIMARY.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className="text-inchiostro-80 py-3 text-base font-medium"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-3">
              <ButtonLink href="/analisi-manoscritto" variant="secondary" size="lg">
                Analisi gratuita
              </ButtonLink>
              <ButtonLink href="/preventivo" variant="primary" size="lg">
                Configura un preventivo
              </ButtonLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
