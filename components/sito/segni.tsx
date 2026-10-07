import { cn } from "@/lib/cn";

/**
 * I segni di correzione delle bozze, a tratto di matita. Sono l'elemento
 * firma del sito: compaiono nell'H1 della home, nel confronto prima/dopo e
 * nelle note a margine. Da nessun'altra parte.
 *
 * Ogni tracciato ha `pathLength="100"`, così `stroke-dasharray: 100` vale
 * per tutti e `anima` li fa tracciare con `stroke-dashoffset` (700 ms). Con
 * `prefers-reduced-motion: reduce` il tratto è già completo.
 *
 * Sono decorativi: `aria-hidden` di default. Il significato va nel testo.
 */
type Props = {
  colore?: "rosso" | "blu";
  anima?: boolean;
  /** Ritardo dell'animazione, in ms. */
  ritardo?: number;
  className?: string;
  title?: string;
};

const colori = {
  rosso: "text-rosso-matita in-data-[tema=inchiostro]:text-rosso-su-inchiostro",
  blu: "text-blu-matita in-data-[tema=inchiostro]:text-carta-su-inchiostro",
};

function Segno({
  viewBox,
  d,
  colore = "rosso",
  anima = false,
  ritardo = 0,
  className,
  title,
  spessore = 2.2,
}: Props & { viewBox: string; d: string; spessore?: number }) {
  return (
    <svg
      viewBox={viewBox}
      className={cn("inline-block overflow-visible", colori[colore], className)}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      style={ritardo ? { animationDelay: `${ritardo}ms` } : undefined}
    >
      {title && <title>{title}</title>}
      <path
        d={d}
        pathLength={100}
        fill="none"
        stroke="currentColor"
        strokeWidth={spessore}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={anima ? "segno-traccia" : undefined}
        style={ritardo && anima ? { animationDelay: `${ritardo}ms` } : undefined}
      />
    </svg>
  );
}

/** ⁁ — inserimento: qui manca una parola. */
export function Inserimento(p: Props) {
  return <Segno {...p} viewBox="0 0 24 20" d="M2.5 18.5 11.4 3.2c.3-.5.9-.5 1.2 0L21.5 18.5" />;
}

/** Cancellatura: un tratto ondulato sulla parola. */
export function Cancellatura(p: Props) {
  return (
    <Segno
      {...p}
      viewBox="0 0 100 12"
      d="M1 7c6-4 11 2 17 0s11-4 17-1 11 4 17 1 11-4 17-1 11 4 17 1 9-3 13-1"
      spessore={2}
    />
  );
}

/** Sottolineatura leggermente curva. */
export function Sottolineatura(p: Props) {
  return <Segno {...p} viewBox="0 0 100 8" d="M1.5 5.5C20 2 45 1.5 70 3c12 .7 20 1.5 27 2.5" spessore={2} />;
}

/** Segno a margine: la barra con il piccolo gancio del correttore. */
export function SegnoMargine(p: Props) {
  return <Segno {...p} viewBox="0 0 14 40" d="M4 2.5c-.5 10-.5 24 .3 35M4 37.5c2-1.5 4-2 7-2.2" />;
}

/** Freccia di spostamento: «questo va lì». */
export function FrecciaSpostamento(p: Props) {
  return (
    <Segno
      {...p}
      viewBox="0 0 60 30"
      d="M3 25C14 8 30 4 54 12M46 5.5l8.5 6.3-9.6 4.2"
      spessore={2}
    />
  );
}
