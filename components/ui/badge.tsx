import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TonoBadge =
  | "neutro"
  | "viola"
  | "lime"
  | "successo"
  | "attenzione"
  | "errore"
  | "informazione";

const toni: Record<TonoBadge, string> = {
  neutro: "bg-superficie-viva text-testo-attenuato border-bordo",
  viola: "bg-viola/15 text-viola-chiaro border-viola/35",
  lime: "bg-lime/12 text-lime border-lime/35",
  successo: "bg-successo/12 text-successo border-successo/35",
  attenzione: "bg-attenzione/12 text-attenzione border-attenzione/35",
  errore: "bg-errore/12 text-errore border-errore/35",
  informazione: "bg-informazione/12 text-informazione border-informazione/35",
};

export function Badge({
  tono = "neutro",
  className,
  children,
}: {
  tono?: TonoBadge;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "etichetta inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 leading-none",
        toni[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Badge di stato con pallino. Il pallino è ridondante rispetto al colore:
 * serve a distinguere gli stati anche a chi non percepisce le differenze
 * cromatiche, insieme al testo (WCAG 1.4.1 — il colore non è mai l'unico
 * veicolo dell'informazione).
 */
export function BadgeStato({
  tono = "neutro",
  pulsante = false,
  className,
  children,
}: {
  tono?: TonoBadge;
  pulsante?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pallini: Record<TonoBadge, string> = {
    neutro: "bg-testo-tenue",
    viola: "bg-viola-chiaro",
    lime: "bg-lime",
    successo: "bg-successo",
    attenzione: "bg-attenzione",
    errore: "bg-errore",
    informazione: "bg-informazione",
  };
  return (
    <Badge className={className}>
      <span className="relative flex size-1.5" aria-hidden>
        {pulsante ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              pallini[tono],
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex size-1.5 rounded-full", pallini[tono])} />
      </span>
      {children}
    </Badge>
  );
}
