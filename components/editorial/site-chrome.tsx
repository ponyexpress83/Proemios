"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { services, articles } from "@/lib/editorial-content";
import { Header, Footer } from "./proemios";
import { Testata } from "@/components/layout/testata";
import { Colophon } from "@/components/layout/colophon";
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
      <Header />
      <main id="contenuto">
        <div className={modern ? "editorial-content" : "legacy-content"}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
