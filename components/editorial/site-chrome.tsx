"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { services, articles } from "@/lib/editorial-content";

/**
 * TRANSITORIO — da eliminare con `editorial.css` quando l'ultima pagina
 * abbandona i componenti editoriali (passaggio C5 del redesign).
 *
 * Testata e colophon sono già quelli nuovi (`components/sito`); questo
 * involucro applica soltanto `.proemios-public` al corpo della pagina, così
 * le pagine non ancora rifatte restano stilate dal foglio editoriale.
 */
/** Pagine già rifatte con `components/sito`: nessun involucro editoriale. */
const RIFATTE = new Set(["/", "/preventivo", "/analisi-manoscritto", "/contatti"]);

export function CorpoTransitorio({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (RIFATTE.has(pathname)) return <>{children}</>;
  const modern =
    [
      "/servizi",
      "/percorsi",
      "/come-funziona",
      "/per-agenzie",
      "/chi-siamo",
      "/casi-studio",
      "/blog",
      "/preventivo",
      "/analisi-manoscritto",
      "/contatti",
    ].includes(pathname) ||
    pathname.startsWith("/percorsi/") ||
    services.some((s) => pathname === "/servizi/" + s.slug) ||
    articles.some((a) => pathname === "/blog/" + a.slug);
  return (
    <div className="proemios-public">
      <div className={modern ? "editorial-content" : "legacy-content"}>{children}</div>
    </div>
  );
}
