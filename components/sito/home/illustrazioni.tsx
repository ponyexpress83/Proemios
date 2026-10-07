import { cn } from "@/lib/cn";

/**
 * Illustrazioni a tratto di matita per i fogli dei percorsi. Stesso tratto
 * dei segni di correzione: linee aperte, estremità tonde, nessun riempimento.
 * Decorative: il significato è nel titolo del foglio.
 */
function Tratto({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={cn("h-12 w-16 text-inchiostro", className)} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ILLUSTRAZIONI = {
  /** Una pila di fogli con la prima pagina scritta. */
  manoscritto: (
    <Tratto d="M14 10h30l8 8v24H14zM44 10v8h8M22 24h20M22 30h20M22 36h12M11 14v27a2 2 0 0 0 2 2h30" />
  ),
  /** Una lampadina appoggiata su un taccuino. */
  idea: (
    <Tratto d="M8 40h40M8 40V18h26M26 10a8 8 0 0 1 8 8c0 3-2 5-3 7h-10c-1-2-3-4-3-7a8 8 0 0 1 8-8zM23 30h6M24 34h4M44 14l4-4M48 22h5M46 8l2-5" />
  ),
  /** Una fotografia e una lettera, i materiali di una storia vera. */
  memoria: (
    <Tratto d="M10 12h26v22H10zM14 29l6-7 5 5 4-3 5 5M30 15a2 2 0 1 0 0 .1M40 18h14v22H40zM44 24h6M44 29h6M44 34h4" />
  ),
  /** Un libro in piedi, con il segnalibro: l'oggetto che rappresenta chi lo scrive. */
  professione: (
    <Tratto d="M18 8h22a3 3 0 0 1 3 3v29H21a3 3 0 0 1-3-3zM18 37a3 3 0 0 1 3-3h22M27 8v16l4-3 4 3V8M12 42h40" />
  ),
  /** Un libro aperto con la copertina: dal file alla cosa stampata. */
  pubblicazione: (
    <Tratto d="M6 12c8-2 14 0 20 4v26c-6-4-12-6-20-4zM58 12c-8-2-14 0-20 4v26c6-4 12-6 20-4zM32 16v26M11 20h9M11 26h9M44 20h9M44 26h9" />
  ),
} as const;

export type NomeIllustrazione = keyof typeof ILLUSTRAZIONI;
