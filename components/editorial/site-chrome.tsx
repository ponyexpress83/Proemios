"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { services, articles } from "@/lib/editorial-content";
import { Header, Footer } from "./chrome";
import { Testata } from "@/components/layout/testata";
import { Colophon } from "@/components/layout/colophon";
export function SiteChrome({ children, analysisReady = false }: { children: ReactNode; analysisReady?: boolean }) {
  const pathname = usePathname();
  if (["/area-autore","/area-team","/spazio","/admin"].some(p=>pathname.startsWith(p))) return <div className="proemios-public">{children}</div>;
  if (pathname.startsWith("/admin"))
    return (
      <>
        <Testata />
        <main id="contenuto" className="flex-1">
          {children}
        </main>
        <Colophon />
      </>
    );
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
      "/accedi",
    ].includes(pathname) ||
    pathname.startsWith("/percorsi/") ||
    services.some((s) => pathname === "/servizi/" + s.slug) ||
    articles.some((a) => pathname === "/blog/" + a.slug);
  return (
    <div className="proemios-public">
      <Header analysisReady={analysisReady} />
      <main id="contenuto">
        <div className={modern ? "editorial-content" : "legacy-content"}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
