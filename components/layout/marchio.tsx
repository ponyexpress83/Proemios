import Link from "next/link";
import { BRAND } from "@/config/brand";
import { cx } from "@/components/ui/primitivi";

/**
 * Marchio Proemios: il nome composto in display con la P capitale trattata
 * come un versale, più un filetto che richiama la riga di stampa.
 * Nessun logo pittorico: il brand è tipografico.
 */
export function Marchio({
  tono = "carta",
  className,
}: {
  tono?: "carta" | "notte";
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cx("group inline-flex flex-col", className)}
      aria-label={`${BRAND.name} — vai alla home`}
    >
      <span
        className={cx(
          "font-display text-[1.45rem] leading-none font-medium tracking-[-0.02em]",
          tono === "notte" ? "text-carta" : "text-inchiostro",
        )}
      >
        <span className={tono === "notte" ? "text-ottone" : "text-alloro"}>P</span>
        roemios
      </span>
      <span
        className={cx(
          "garbo mt-1 h-px w-full origin-left scale-x-100 group-hover:scale-x-0",
          tono === "notte" ? "bg-filetto-notte" : "bg-filetto-forte",
        )}
        aria-hidden
      />
    </Link>
  );
}
