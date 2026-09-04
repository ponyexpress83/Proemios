import { cn } from "@/lib/cn";

/**
 * Barra di avanzamento. `role="progressbar"` con i valori aria: uno screen
 * reader deve poter leggere la percentuale, non solo vedere la barra.
 */
export function Progresso({
  valore,
  etichetta,
  mostraValore = true,
  tono = "viola",
  className,
}: {
  valore: number;
  etichetta: string;
  mostraValore?: boolean;
  tono?: "viola" | "lime" | "attenzione";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(valore)));
  const toni = { viola: "bg-viola", lime: "bg-lime", attenzione: "bg-attenzione" } as const;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="etichetta text-testo-tenue">{etichetta}</span>
        {mostraValore ? <span className="cifre text-sm text-testo">{pct}%</span> : null}
      </div>
      <div
        role="progressbar"
        aria-label={etichetta}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-superficie-viva"
      >
        <div
          className={cn("garbo h-full rounded-full", toni[tono])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Anello di avanzamento compatto per le schede progetto. */
export function AnelloProgresso({
  valore,
  etichetta,
  misura = 64,
  className,
}: {
  valore: number;
  etichetta: string;
  misura?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(valore)));
  const r = (misura - 6) / 2;
  const circonferenza = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      role="progressbar"
      aria-label={etichetta}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ width: misura, height: misura }}
    >
      <svg width={misura} height={misura} className="-rotate-90" aria-hidden>
        <circle
          cx={misura / 2}
          cy={misura / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          className="stroke-superficie-viva"
        />
        <circle
          cx={misura / 2}
          cy={misura / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circonferenza}
          strokeDashoffset={circonferenza * (1 - pct / 100)}
          className="stroke-viola transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="cifre absolute text-xs font-medium text-testo">{pct}%</span>
    </div>
  );
}
