"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { PulsanteLink } from "./pulsante";
import { AZIONI, UI } from "@/config/copy";
import { cn } from "@/lib/cn";

/**
 * Testata del sito pubblico: logo, cinque voci, «Area autori» e il pulsante
 * primario. Il menu a scomparsa compare sotto i 1024 px; dentro, il pulsante
 * primario sta in fondo, fisso. Si chiude con Esc e tiene il fuoco dentro.
 */
const VOCI: { nome: string; href: string }[] = [
  { nome: "Servizi", href: "/servizi" },
  { nome: "Percorsi", href: "/percorsi" },
  { nome: "Come funziona", href: "/come-funziona" },
  { nome: "Per agenzie", href: "/per-agenzie" },
  { nome: "Guide", href: "/blog" },
];

export function Testata() {
  const [aperto, setAperto] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Cambiare pagina chiude il menu.
  useEffect(() => {
    setAperto(false);
  }, [pathname]);

  // Esc chiude; Tab resta dentro; lo scroll della pagina si ferma.
  useEffect(() => {
    if (!aperto) return;
    const menu = menuRef.current;
    const primo = menu?.querySelector<HTMLElement>("nav a");
    primo?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAperto(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !menu) return;
      const focusabili = Array.from(
        menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
      );
      if (focusabili.length === 0) return;
      const primo = focusabili[0]!;
      const ultimo = focusabili[focusabili.length - 1]!;
      if (e.shiftKey && document.activeElement === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aperto]);

  const attiva = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-filetto bg-carta">
      <div className="mx-auto flex h-16 w-full max-w-pagina items-center justify-between gap-4 px-4 md:px-6">
        <Logo />

        <nav aria-label="Navigazione principale" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {VOCI.map((v) => (
              <li key={v.href}>
                <Link
                  href={v.href as Route}
                  aria-current={attiva(v.href) ? "page" : undefined}
                  className={cn(
                    "sottolinea-matita inline-flex min-h-11 items-center rounded-campo px-3 text-t-sm text-inchiostro",
                    attiva(v.href) && "sottolinea-matita-attiva",
                  )}
                >
                  {v.nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href={"/accedi" as Route}
            className="sottolinea-matita inline-flex min-h-11 items-center rounded-campo px-3 text-t-sm text-inchiostro"
          >
            Area autori
          </Link>
          <PulsanteLink href="/preventivo" variante="primario" className="min-h-11 px-5 text-t-sm">
            {AZIONI.preventivo}
          </PulsanteLink>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-campo text-inchiostro lg:hidden"
          aria-expanded={aperto}
          aria-controls={menuId}
          aria-label={aperto ? UI.menuChiudi : UI.menuApri}
          onClick={() => setAperto((a) => !a)}
        >
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
            <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {aperto && (
        <div
          id={menuId}
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-carta lg:hidden"
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-filetto px-4">
            <Logo />
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-campo text-inchiostro"
              aria-label={UI.menuChiudi}
              onClick={() => {
                setAperto(false);
                toggleRef.current?.focus();
              }}
            >
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Navigazione principale" className="flex-1 overflow-y-auto px-4 py-2">
            <ul className="flex flex-col">
              {VOCI.map((v) => (
                <li key={v.href} className="border-b border-filetto">
                  <Link
                    href={v.href as Route}
                    aria-current={attiva(v.href) ? "page" : undefined}
                    className="flex min-h-14 items-center font-serif text-t-md text-inchiostro"
                  >
                    {v.nome}
                  </Link>
                </li>
              ))}
              <li className="border-b border-filetto">
                <Link
                  href={"/accedi" as Route}
                  className="flex min-h-14 items-center text-t-base text-inchiostro"
                >
                  Area autori
                </Link>
              </li>
            </ul>
          </nav>
          <div className="shrink-0 border-t border-filetto bg-carta p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <PulsanteLink href="/preventivo" variante="primario" className="w-full">
              {AZIONI.preventivo}
            </PulsanteLink>
          </div>
        </div>
      )}
    </header>
  );
}
