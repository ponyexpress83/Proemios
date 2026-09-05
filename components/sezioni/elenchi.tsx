import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/** Elenco di cose incluse. La spunta è decorativa: il senso è nel titolo sopra. */
export function ElencoIncluso({
  voci,
  className,
  colonne = 1,
}: {
  voci: readonly string[];
  className?: string;
  colonne?: 1 | 2;
}) {
  return (
    <ul className={cn("grid gap-3", colonne === 2 && "sm:grid-cols-2", className)}>
      {voci.map((v) => (
        <li key={v} className="flex items-start gap-3">
          <Check className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
          <span className="text-sm leading-relaxed text-testo-attenuato">{v}</span>
        </li>
      ))}
    </ul>
  );
}

/** Elenco di esclusioni. Dirle prima vale più di qualunque garanzia dopo. */
export function ElencoEscluso({ voci, className }: { voci: readonly string[]; className?: string }) {
  return (
    <ul className={cn("grid gap-3", className)}>
      {voci.map((v) => (
        <li key={v} className="flex items-start gap-3">
          <Minus className="mt-0.5 size-4 shrink-0 text-testo-tenue" aria-hidden />
          <span className="text-sm leading-relaxed text-testo-tenue">{v}</span>
        </li>
      ))}
    </ul>
  );
}
