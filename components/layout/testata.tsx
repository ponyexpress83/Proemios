"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Marchio } from "./marchio";
import { BottoneLink } from "@/components/ui/bottone";
import { NAV_PERCORSI, NAV_PRINCIPALE, NAV_SERVIZI } from "@/config/navigazione";
import { cn } from "@/lib/cn";

type MenuAperto = "percorsi" | "servizi" | null;

/**
 * Barra di navigazione. I due menu a tendina si aprono al click (non
 * all'hover): l'hover esclude chi naviga da tastiera o da touch e apre pannelli
 * per sbaglio mentre si scorre la pagina.
 */
export function Testata() {
  const percorso = usePathname();
  const [menu, setMenu] = useState<MenuAperto>(null);
  const [mobileAperto, setMobileAperto] = useState(false);
  const [scorso, setScorso] = useState(false);
  const barra = useRef<HTMLElement>(null);

  // Il menu si chiude cambiando pagina: altrimenti resta aperto sopra la nuova.
  useEffect(() => {
    setMenu(null);
    setMobileAperto(false);
  }, [percorso]);

  useEffect(() => {
    function suTasto(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(null);
        setMobileAperto(false);
      }
    }
    function suClick(e: MouseEvent) {
      if (barra.current && !barra.current.contains(e.target as Node)) setMenu(null);
    }
    document.addEventListener("keydown", suTasto);
    document.addEventListener("mousedown", suClick);
    return () => {
      document.removeEventListener("keydown", suTasto);
      document.removeEventListener("mousedown", suClick);
    };
  }, []);

  useEffect(() => {
    function suScroll() {
      setScorso(window.scrollY > 8);
    }
    suScroll();
    window.addEventListener("scroll", suScroll, { passive: true });
    return () => window.removeEventListener("scroll", suScroll);
  }, []);

  const attivo = (href: string) => percorso === href || percorso.startsWith(`${href}/`);

  return (
    <header
      ref={barra}
      className={cn(
        "garbo sticky top-0 z-50 border-b",
        scorso || menu
          ? "border-bordo bg-fondo/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="gabbia flex h-16 items-center justify-between gap-6">
        <Marchio />

        <nav aria-label="Principale" className="hidden items-center gap-1 lg:flex">
          <BottoneMenu
            titolo="Percorsi"
            aperto={menu === "percorsi"}
            onToggle={() => setMenu(menu === "percorsi" ? null : "percorsi")}
            attivo={attivo("/percorsi")}
          />
          <BottoneMenu
            titolo="Servizi"
            aperto={menu === "servizi"}
            onToggle={() => setMenu(menu === "servizi" ? null : "servizi")}
            attivo={attivo("/servizi")}
          />
          {NAV_PRINCIPALE.map((v) => (
            <Link
              key={v.href}
              href={v.href as Route}
              className={cn(
                "garbo rounded-md px-3 py-2 text-sm",
                attivo(v.href) ? "text-testo" : "text-testo-attenuato hover:text-testo",
              )}
              aria-current={attivo(v.href) ? "page" : undefined}
            >
              {v.titolo}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {/* L'accesso all'area riservata compare quando l'autenticazione è
              attiva (Fase 2): un link a una pagina che non esiste vale meno
              di nessun link. */}
          <BottoneLink href="/preventivo" variante="identita" misura="piccola">
            Preventivo
          </BottoneLink>
        </div>

        <button
          type="button"
          className="garbo -mr-2 rounded-md p-2 text-testo lg:hidden"
          aria-expanded={mobileAperto}
          aria-controls="menu-mobile"
          aria-label={mobileAperto ? "Chiudi il menu" : "Apri il menu"}
          onClick={() => setMobileAperto((v) => !v)}
        >
          {mobileAperto ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {menu === "percorsi" ? <PannelloPercorsi /> : null}
      {menu === "servizi" ? <PannelloServizi /> : null}

      {mobileAperto ? <MenuMobile /> : null}
    </header>
  );
}

function BottoneMenu({
  titolo,
  aperto,
  onToggle,
  attivo,
}: {
  titolo: string;
  aperto: boolean;
  onToggle: () => void;
  attivo: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={aperto}
      className={cn(
        "garbo flex items-center gap-1 rounded-md px-3 py-2 text-sm",
        aperto || attivo ? "text-testo" : "text-testo-attenuato hover:text-testo",
      )}
    >
      {titolo}
      <ChevronDown
        aria-hidden
        className={cn("garbo size-3.5", aperto && "rotate-180")}
      />
    </button>
  );
}

function PannelloPercorsi() {
  return (
    <div className="hidden border-t border-bordo bg-fondo-alto lg:block">
      <div className="gabbia grid grid-cols-3 gap-x-8 gap-y-1 py-8">
        {NAV_PERCORSI.map((p) => (
          <Link
            key={p.href}
            href={p.href as Route}
            className="garbo group rounded-md p-3 hover:bg-superficie"
          >
            <span className="block text-sm font-medium text-testo">{p.titolo}</span>
            <span className="mt-1 block text-xs leading-relaxed text-testo-tenue">{p.sommario}</span>
          </Link>
        ))}
        <Link
          href="/percorsi"
          className="garbo flex items-center rounded-md p-3 text-sm font-medium text-viola-chiaro hover:bg-superficie"
        >
          Vedi tutti i percorsi →
        </Link>
      </div>
    </div>
  );
}

function PannelloServizi() {
  return (
    <div className="hidden max-h-[70vh] overflow-y-auto border-t border-bordo bg-fondo-alto lg:block">
      <div className="gabbia grid grid-cols-4 gap-x-8 gap-y-8 py-8">
        {NAV_SERVIZI.map((gruppo) => (
          <div key={gruppo.area} className="flex flex-col gap-2">
            <p className="etichetta text-testo-tenue">{gruppo.titolo}</p>
            <ul className="flex flex-col">
              {gruppo.voci.map((v) => (
                <li key={v.href}>
                  <Link
                    href={v.href as Route}
                    className="garbo -mx-2 block rounded-md px-2 py-1.5 text-sm text-testo-attenuato hover:bg-superficie hover:text-testo"
                  >
                    {v.titolo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-bordo">
        <div className="gabbia flex items-center justify-between py-4">
          <p className="text-sm text-testo-tenue">
            Non sai da quale servizio partire? Il preventivo lo stabilisce in due minuti.
          </p>
          <BottoneLink href="/servizi" variante="secondario" misura="piccola">
            Tutti i servizi
          </BottoneLink>
        </div>
      </div>
    </div>
  );
}

function MenuMobile() {
  return (
    <div
      id="menu-mobile"
      className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-bordo bg-fondo-alto lg:hidden"
    >
      <div className="gabbia flex flex-col gap-6 py-6">
        <div className="flex flex-col gap-2">
          <p className="etichetta text-testo-tenue">Percorsi</p>
          {NAV_PERCORSI.map((p) => (
            <Link
              key={p.href}
              href={p.href as Route}
              className="garbo -mx-2 rounded-md px-2 py-2.5 text-sm text-testo-attenuato hover:bg-superficie hover:text-testo"
            >
              {p.titolo}
            </Link>
          ))}
        </div>

        {NAV_SERVIZI.map((gruppo) => (
          <div key={gruppo.area} className="flex flex-col gap-2">
            <p className="etichetta text-testo-tenue">{gruppo.titolo}</p>
            {gruppo.voci.map((v) => (
              <Link
                key={v.href}
                href={v.href as Route}
                className="garbo -mx-2 rounded-md px-2 py-2.5 text-sm text-testo-attenuato hover:bg-superficie hover:text-testo"
              >
                {v.titolo}
              </Link>
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-2 border-t border-bordo pt-6">
          {NAV_PRINCIPALE.map((v) => (
            <Link
              key={v.href}
              href={v.href as Route}
              className="garbo -mx-2 rounded-md px-2 py-2.5 text-sm text-testo-attenuato hover:bg-superficie hover:text-testo"
            >
              {v.titolo}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <BottoneLink href="/preventivo" variante="identita" misura="grande">
            Fai un preventivo
          </BottoneLink>
          <BottoneLink href="/contatti" variante="secondario" misura="grande">
            Parla con noi
          </BottoneLink>
        </div>
      </div>
    </div>
  );
}
