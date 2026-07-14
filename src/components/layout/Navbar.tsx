"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Route } from "next";
import { NAV_PRIMARY } from "@/config/site";
import { Wordmark } from "@/components/ui/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Chiudi il menu al cambio pagina.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-linea/70 bg-carta/85 backdrop-blur-md">
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
                  "text-sm font-medium text-inchiostro-60 transition-colors hover:text-inchiostro",
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
          className="grid size-10 place-items-center rounded-md border border-linea lg:hidden"
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3.5 w-5">
            <span
              className={cn(
                "absolute inset-x-0 top-0 h-0.5 bg-inchiostro transition-transform",
                open && "translate-y-[6px] rotate-45",
              )}
            />
            <span
              className={cn(
                "absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-inchiostro transition-opacity",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 bg-inchiostro transition-transform",
                open && "-translate-y-[6px] -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-linea bg-carta lg:hidden">
          <nav className="container-editorial flex flex-col py-4" aria-label="Navigazione mobile">
            {NAV_PRIMARY.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className="py-3 text-base font-medium text-inchiostro-80"
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
