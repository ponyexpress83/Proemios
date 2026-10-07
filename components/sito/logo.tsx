import Link from "next/link";
import type { Route } from "next";
import { BRAND } from "@/config/brand";
import { BRAND_MARK } from "@/lib/brand-mark";
import { cn } from "@/lib/cn";

/**
 * Marchio: il monogramma «P» (volume editoriale con l'angolo di pagina
 * ripiegato, `lib/brand-mark.ts`), nei colori nuovi. Il corpo prende il
 * colore del testo che lo circonda (inchiostro sulla carta, carta
 * sull'inchiostro); l'occhio della P è un foro, così mostra lo sfondo qualunque
 * sia; l'angolo ripiegato resta rosso matita.
 */
export function Simbolo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <path d={`${BRAND_MARK.body} ${BRAND_MARK.counter}`} fill="currentColor" fillRule="evenodd" />
      <path d={BRAND_MARK.fold} fill="var(--color-rosso-matita)" />
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
