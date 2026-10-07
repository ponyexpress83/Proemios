import type { Route } from "next";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type VarianteBottone =
  | "primario"
  | "identita"
  | "secondario"
  | "fantasma"
  | "quieto"
  | "distruttivo";
export type MisuraBottone = "piccola" | "media" | "grande";

const base =
  "garbo relative inline-flex select-none items-center justify-center gap-2 rounded-md font-medium " +
  "whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 " +
  "active:translate-y-px";

/**
 * Ogni variante definisce fondo, testo e bordo insieme: passare solo un colore
 * di fondo via className lascerebbe il testo della variante precedente e
 * produce combinazioni illeggibili a seconda dell'ordine nel CSS generato.
 */
const varianti: Record<VarianteBottone, string> = {
  // Azione principale del prodotto.
  primario:
    "bg-viola text-white border border-viola hover:bg-viola-chiaro hover:border-viola-chiaro shadow-sollevata",
  // CTA commerciale: il lime resta raro e sempre su testo scurissimo.
  identita:
    "bg-lime text-fondo border border-lime font-semibold hover:bg-lime-scuro hover:border-lime-scuro",
  // Azione alternativa: presenza per bordo, non per colore.
  secondario:
    "bg-superficie text-testo border border-bordo-forte hover:bg-superficie-viva hover:border-viola",
  // Su fondali già carichi (hero, immagini).
  fantasma:
    "bg-transparent text-testo border border-bordo-forte hover:bg-superficie hover:border-bordo-forte",
  // Solo testo.
  quieto:
    "bg-transparent text-viola-chiaro border border-transparent underline-offset-4 hover:underline",
  distruttivo:
    "bg-transparent text-errore border border-errore/40 hover:bg-errore/10 hover:border-errore",
};

const misure: Record<MisuraBottone, string> = {
  piccola: "h-8 px-3 text-[0.8125rem]",
  media: "h-10 px-5 text-sm",
  grande: "h-12 px-7 text-base",
};

interface Comuni {
  variante?: VarianteBottone;
  misura?: MisuraBottone;
  className?: string;
  children: ReactNode;
}

export function Bottone({
  variante = "primario",
  misura = "media",
  className,
  asChild = false,
  children,
  ...resto
}: Comuni & { asChild?: boolean } & ComponentProps<"button">) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(base, varianti[variante], misure[misura], className)} {...resto}>
      {children}
    </Comp>
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
      className={cn(base, varianti[variante], misure[misura], className)}
      {...resto}
    >
      {children}
    </Link>
  );
}

/** Bottone quadrato per sole icone: richiede sempre un'etichetta accessibile. */
export function BottoneIcona({
  etichetta,
  misura = "media",
  variante = "secondario",
  className,
  children,
  ...resto
}: {
  etichetta: string;
  misura?: MisuraBottone;
  variante?: VarianteBottone;
  className?: string;
  children: ReactNode;
} & ComponentProps<"button">) {
  const quadrate: Record<MisuraBottone, string> = {
    piccola: "size-8",
    media: "size-10",
    grande: "size-12",
  };
  return (
    <button
      aria-label={etichetta}
      title={etichetta}
      className={cn(base, varianti[variante], quadrate[misura], "px-0", className)}
      {...resto}
    >
      {children}
    </button>
  );
}
