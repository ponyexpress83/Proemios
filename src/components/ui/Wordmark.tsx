import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Logotipo Kalamos Studio: mark a pennino/canna (kalamos) + wordmark serif.
 */
export function Wordmark({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const color = tone === "light" ? "text-carta" : "text-inchiostro";
  const accent = tone === "light" ? "text-bronzo-chiaro" : "text-bronzo";
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", color, className)} aria-label="Kalamos Studio — home">
      <svg
        width="22"
        height="26"
        viewBox="0 0 22 26"
        fill="none"
        className={cn("shrink-0", accent)}
        aria-hidden
      >
        {/* Canna/pennino stilizzato */}
        <path
          d="M11 1C7 6 5 11 5 16c0 4 2.7 7 6 7s6-3 6-7c0-5-2-10-6-15Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M11 9v14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M11 25.2 8.6 23h4.8L11 25.2Z" fill="currentColor" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">
        Kalamos <span className="font-normal italic">Studio</span>
      </span>
    </Link>
  );
}
