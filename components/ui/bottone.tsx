import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./primitivi";

type Variante = "primario" | "secondario" | "secondarioNotte" | "quieto" | "quietoNotte" | "chiaro";
type Misura = "media" | "grande";

const base =
  "garbo inline-flex select-none items-center justify-center gap-2 font-ui font-medium " +
  "rounded-campo disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Le varianti "…Notte" esistono come varianti proprie e non come override via
 * className: sovrascrivere `text-inchiostro` con `text-carta` dipende
 * dall'ordine nel CSS generato, non da quello nella stringa, e produce testo
 * illeggibile in modo intermittente.
 */
const varianti: Record<Variante, string> = {
  // Verde bottiglia pieno: l'azione principale.
  primario:
    "bg-alloro text-carta border border-alloro hover:bg-alloro-chiaro hover:border-alloro-chiaro",
  // Filetto: presenza tipografica, non peso cromatico.
  secondario:
    "bg-transparent text-inchiostro border border-filetto-forte hover:border-alloro hover:text-alloro",
  // Come sopra, ma su fondo notte.
  secondarioNotte:
    "bg-transparent text-carta border border-carta/30 hover:border-ottone hover:text-ottone",
  // Solo testo, con filetto di sottolineatura all'hover.
  quieto: "bg-transparent text-alloro underline-offset-4 hover:underline border border-transparent",
  quietoNotte:
    "bg-transparent text-ottone underline-offset-4 hover:underline border border-transparent",
  // Riempito, su fondo notte.
  chiaro: "bg-carta text-notte border border-carta hover:bg-ottone hover:border-ottone",
};

const misure: Record<Misura, string> = {
  media: "px-5 py-2.5 text-sm",
  grande: "px-7 py-3.5 text-base",
};

interface Comuni {
  variante?: Variante;
  misura?: Misura;
  className?: string;
  children: ReactNode;
}

export function Bottone({
  variante = "primario",
  misura = "media",
  className,
  children,
  ...resto
}: Comuni & ComponentProps<"button">) {
  return (
    <button className={cx(base, varianti[variante], misure[misura], className)} {...resto}>
      {children}
    </button>
  );
}

export function BottoneLink({
  href,
  variante = "primario",
  misura = "media",
  className,
  children,
  ...resto
}: Comuni & { href: string } & Omit<
    ComponentProps<typeof Link>,
    "href" | "className" | "children"
  >) {
  return (
    <Link
      href={href as Route}
      className={cx(base, varianti[variante], misure[misura], className)}
      {...resto}
    >
      {children}
    </Link>
  );
}
