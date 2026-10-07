import { cn } from "@/lib/cn";

/** Elenco di cose incluse: un trattino a matita, non una spunta in bollino. */
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
          <span className="mt-3 h-0.5 w-3 shrink-0 rounded-pillola bg-rosso-matita" aria-hidden="true" />
          <span className="text-t-base text-inchiostro">{v}</span>
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
          <span className="mt-3 h-0.5 w-3 shrink-0 rounded-pillola bg-grafite" aria-hidden="true" />
          <span className="text-t-base text-grafite">{v}</span>
        </li>
      ))}
    </ul>
  );
}
