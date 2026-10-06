"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { services, articles } from "@/lib/editorial-content";
import { Header, Footer } from "./proemios";
import { FasciaDemo } from "@/components/layout/fascia-demo";

/**
 * Montato dal layout del route group `(sito)`: le aree riservate hanno i propri
 * layout e non passano da qui, quindi non serve più distinguere `/admin`.
 *
 * Le pagine portate nella nuova identità editoriale ricevono
 * `editorial-content`; quelle non ancora ridisegnate — note legali, strumenti —
 * restano su `legacy-content`, leggibili invece che mezze ristilizzate.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const modern =
    [
      "/",
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
      {/* Dentro il contenitore, non fuori: i suoi colori vengono dal tema
          rimappato e su fondo avorio il tema scuro era illeggibile. */}
      <FasciaDemo />
      <Header />
      <main id="contenuto">
        <div className={modern ? "editorial-content" : "legacy-content"}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
