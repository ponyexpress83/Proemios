import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * L'unica card del sito: un foglio bianco appoggiato sulla carta. Le varianti
 * sono di gerarchia, non di colore. Con `href` l'intero foglio è un link — uno
 * solo, non un link più un «Scopri» — e il suo nome accessibile è tutto il
 * testo del foglio: un `aria-label` più corto violerebbe «etichetta nel nome».
 */
export function Foglio({
  href,
  className,
  children,
  rilievo = "normale",
  as: Tag = "div",
  ...resto
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  /** `piatto`: solo il filetto, senza ombra. */
  rilievo?: "normale" | "piatto";
  as?: "div" | "article" | "li";
}) {
  const classi = cn(
    "block rounded-foglio bg-bianco p-6",
    rilievo === "normale" ? "shadow-foglio" : "border border-filetto",
    href &&
      "transition-[box-shadow,transform] duration-200 ease-matita hover:-translate-y-0.5 hover:shadow-sollevata-sito focus-visible:-translate-y-0.5",
    className,
  );
  if (href) {
    const link = (
      <Link href={href as Route} className={cn(classi, Tag !== "div" && "w-full")} {...resto}>
        {children}
      </Link>
    );
    // Dentro un <ul> il foglio-link deve restare un <li>: il link ne riempie la cella.
    return Tag === "div" ? link : <Tag className="flex">{link}</Tag>;
  }
  return (
    <Tag className={classi} {...resto}>
      {children}
    </Tag>
  );
}
