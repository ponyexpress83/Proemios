import Link from "next/link";
import type { Route } from "next";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/cn";

/**
 * Marchio: il libro aperto che c'era, nei colori nuovi. Il simbolo prende il
 * colore del testo che lo circonda (inchiostro sulla carta, carta
 * sull'inchiostro), il tratto centrale resta rosso matita.
 */
export function Simbolo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <path
        d="M5 7c5 0 8 3 11 7 3-4 6-7 11-7v17c-5 0-8 1-11 4-3-3-6-4-11-4Z"
        fill="currentColor"
      />
      <path
        d="M16 14v14"
        stroke="var(--color-rosso-matita)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className, comeLink = true }: { className?: string; comeLink?: boolean }) {
  const contenuto = (
    <>
      <Simbolo />
      <span className="font-serif text-t-md leading-none tracking-tight">{BRAND.name}</span>
    </>
  );
  if (!comeLink)
    return <span className={cn("inline-flex items-center gap-2", className)}>{contenuto}</span>;
  return (
    <Link
      href={"/" as Route}
      className={cn("inline-flex min-h-11 items-center gap-2 rounded-campo", className)}
      aria-label={`${BRAND.name}, pagina iniziale`}
    >
      {contenuto}
    </Link>
  );
}
