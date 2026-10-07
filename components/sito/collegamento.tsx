import Link from "next/link";
import type { Route } from "next";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Link testuale: blu matita, con la sottolineatura che si traccia al
 * passaggio. Sulle sezioni scure diventa carta. L'area cliccabile è di almeno
 * 44 px in altezza su schermi touch (`py-2.5` con il margine negativo che
 * non sposta il testo).
 */
export function Collegamento({
  href,
  className,
  children,
  esterno = false,
  ...resto
}: {
  href: string;
  className?: string;
  children: ReactNode;
  /** Apre un altro sito: `rel` e `target` corretti e il segno ↗. */
  esterno?: boolean;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const classi = cn(
    "sottolinea-matita -my-2.5 inline-flex min-h-11 items-center gap-1 rounded-campo py-2.5 text-blu-matita",
    "in-data-[tema=inchiostro]:text-carta-su-inchiostro",
    className,
  );
  if (esterno)
    return (
      <a href={href} className={classi} rel="noopener noreferrer" target="_blank">
        {children}
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> (si apre in una nuova scheda)</span>
      </a>
    );
  return (
    <Link href={href as Route} className={classi} {...resto}>
      {children}
    </Link>
  );
}
