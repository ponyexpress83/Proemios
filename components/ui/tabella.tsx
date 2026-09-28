import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tabella densa per il back-office. Il wrapper scorre in orizzontale da solo:
 * una tabella larga non deve mai far scorrere la pagina.
 */
export function Tabella({
  intestazioni,
  children,
  className,
  didascalia,
}: {
  intestazioni: ReadonlyArray<{ chiave: string; testo: string; numerica?: boolean }>;
  children: ReactNode;
  className?: string;
  didascalia?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-bordo bg-superficie", className)}>
      <table className="w-full min-w-max border-collapse text-sm">
        {didascalia ? <caption className="sr-only">{didascalia}</caption> : null}
        <thead>
          <tr className="border-b border-bordo">
            {intestazioni.map((i) => (
              <th
                key={i.chiave}
                scope="col"
                className={cn(
                  "etichetta px-4 py-3 text-left font-medium text-testo-tenue",
                  i.numerica && "text-right",
                )}
              >
                {i.testo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bordo">{children}</tbody>
      </table>
    </div>
  );
}

export function Riga({
  children,
  className,
  ...resto
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("garbo hover:bg-superficie-viva", className)} {...resto}>
      {children}
    </tr>
  );
}

export function Cella({
  children,
  numerica = false,
  className,
  intestazione = false,
}: {
  children: ReactNode;
  numerica?: boolean;
  className?: string;
  intestazione?: boolean;
}) {
  const Tag = intestazione ? "th" : "td";
  return (
    <Tag
      scope={intestazione ? "row" : undefined}
      className={cn(
        "px-4 py-3 align-middle text-testo-attenuato",
        intestazione && "text-left font-medium text-testo",
        numerica && "cifre text-right text-testo",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
