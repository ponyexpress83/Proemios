import Link from "next/link";
import type { Route } from "next";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * I tre pulsanti del sito pubblico. Altezza minima 48 px, 24 px ai lati.
 *
 * - primario: fondo rosso matita, testo bianco. Una sola azione primaria per vista.
 * - secondario: bordo inchiostro. Sulle sezioni scure il bordo diventa carta.
 * - testuale: un link blu con la sottolineatura a matita.
 *
 * L'etichetta è un verbo che dice cosa succede. La freccia → compare solo
 * quando il pulsante porta a un'altra pagina (`freccia`), mai ↗, che vuol
 * dire «link esterno».
 */
export type VariantePulsante = "primario" | "secondario" | "testuale";

const base =
  "inline-flex items-center justify-center gap-2 rounded-campo font-sans font-bold text-t-base " +
  "transition-[background-color,color,border-color,transform,filter] duration-200 ease-matita " +
  "disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px";

const varianti: Record<VariantePulsante, string> = {
  primario:
    "min-h-12 px-6 bg-rosso-matita text-bianco hover:brightness-90 " +
    "in-data-[tema=inchiostro]:bg-rosso-matita",
  secondario:
    "min-h-12 px-6 border border-inchiostro text-inchiostro bg-transparent hover:bg-carta-ombra " +
    "in-data-[tema=inchiostro]:border-carta-su-inchiostro in-data-[tema=inchiostro]:text-carta-su-inchiostro " +
    "in-data-[tema=inchiostro]:hover:bg-bianco/10",
  testuale:
    "min-h-11 px-1 font-normal text-blu-matita sottolinea-matita " +
    "in-data-[tema=inchiostro]:text-carta-su-inchiostro",
};

function Freccia() {
  return (
    <svg viewBox="0 0 20 20" className="size-4.5 shrink-0" aria-hidden="true">
      <path
        d="M3 10h13m-5-5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Comuni {
  variante?: VariantePulsante;
  /** Mostra → : solo se l'azione porta a un'altra pagina. */
  freccia?: boolean;
  className?: string;
  children: ReactNode;
}

export function Pulsante({
  variante = "primario",
  freccia = false,
  className,
  children,
  ...resto
}: Comuni & ComponentProps<"button">) {
  return (
    <button className={cn(base, varianti[variante], className)} {...resto}>
      {children}
      {freccia && <Freccia />}
    </button>
  );
}

export function PulsanteLink({
  href,
  variante = "primario",
  freccia = false,
  className,
  children,
  ...resto
}: Comuni & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href as Route} className={cn(base, varianti[variante], className)} {...resto}>
      {children}
      {freccia && <Freccia />}
    </Link>
  );
}
