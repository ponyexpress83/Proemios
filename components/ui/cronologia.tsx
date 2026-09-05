import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatoTappa = "completata" | "corrente" | "attesa" | "bloccata";

/**
 * Timeline verticale delle fasi di un progetto. Lo stato è veicolato da forma
 * del pallino + testo, non dal solo colore.
 */
export function Cronologia({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ol className={cn("relative flex flex-col", className)}>{children}</ol>
  );
}

export function Tappa({
  titolo,
  stato,
  data,
  dettaglio,
  ultima = false,
  azione,
}: {
  titolo: string;
  stato: StatoTappa;
  data?: string;
  dettaglio?: ReactNode;
  ultima?: boolean;
  azione?: ReactNode;
}) {
  const stili: Record<StatoTappa, { punto: string; testo: string; nome: string }> = {
    completata: { punto: "bg-lime border-lime", testo: "text-testo", nome: "Completata" },
    corrente: {
      punto: "bg-viola border-viola ring-4 ring-viola/25",
      testo: "text-testo",
      nome: "In corso",
    },
    attesa: {
      punto: "bg-superficie border-bordo-forte",
      testo: "text-testo-tenue",
      nome: "Da fare",
    },
    bloccata: { punto: "bg-superficie border-errore", testo: "text-testo-tenue", nome: "Bloccata" },
  };
  const s = stili[stato];
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn("mt-1 size-3 shrink-0 rounded-full border-2", s.punto)}
        />
        {!ultima ? <span aria-hidden className="mt-1 w-px flex-1 bg-bordo" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pb-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className={cn("text-sm font-medium", s.testo)}>
            {titolo}
            <span className="sr-only"> — {s.nome}</span>
          </p>
          {data ? <span className="cifre text-xs text-testo-tenue">{data}</span> : null}
        </div>
        {dettaglio ? (
          <div className="text-sm leading-relaxed text-testo-tenue">{dettaglio}</div>
        ) : null}
        {azione ? <div className="mt-2">{azione}</div> : null}
      </div>
    </li>
  );
}
