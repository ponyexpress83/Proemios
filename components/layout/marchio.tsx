import Link from "next/link";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/cn";

/**
 * Marchio Proemios: puramente tipografico, senza logo pittorico. Il segno
 * distintivo è il punto lime dopo il nome — un carattere solo, riconoscibile
 * anche a 16px nella favicon.
 */
export function Marchio({
  className,
  misura = "media",
  comeLink = true,
}: {
  className?: string;
  misura?: "piccola" | "media";
  comeLink?: boolean;
}) {
  const contenuto = (
    <span
      className={cn(
        "font-semibold tracking-[-0.04em] text-testo",
        misura === "piccola" ? "text-lg" : "text-[1.35rem]",
      )}
    >
      {BRAND.name}
      <span className="text-lime" aria-hidden>
        .
      </span>
    </span>
  );

  if (!comeLink) return <span className={cn("inline-flex", className)}>{contenuto}</span>;

  return (
    <Link
      href="/"
      className={cn("garbo inline-flex items-center hover:opacity-80", className)}
      aria-label={`${BRAND.name} — vai alla home`}
    >
      {contenuto}
    </Link>
  );
}
