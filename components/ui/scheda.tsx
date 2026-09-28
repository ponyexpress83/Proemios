import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type VarianteScheda = "piana" | "sollevata" | "identita" | "tratteggiata";

const varianti: Record<VarianteScheda, string> = {
  piana: "bg-superficie border border-bordo",
  sollevata: "bg-superficie-alta border border-bordo shadow-sollevata",
  identita: "bg-superficie border border-bordo-viola shadow-viola",
  tratteggiata: "bg-transparent border border-dashed border-bordo-forte",
};

/**
 * Contenitore base di tutto il prodotto. `interattiva` aggiunge gli stati hover
 * solo quando la scheda è davvero cliccabile: una card decorativa che si
 * illumina al passaggio del mouse promette un'azione che non esiste.
 */
export function Scheda({
  variante = "piana",
  interattiva = false,
  className,
  children,
  ...resto
}: {
  variante?: VarianteScheda;
  interattiva?: boolean;
  className?: string;
  children: ReactNode;
} & ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "garbo rounded-lg",
        varianti[variante],
        interattiva && "hover:border-bordo-forte hover:bg-superficie-viva",
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  );
}

export function SchedaTestata({
  titolo,
  sotto,
  azione,
  className,
}: {
  titolo: ReactNode;
  sotto?: ReactNode;
  azione?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-4", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-base font-semibold text-testo">{titolo}</h3>
        {sotto ? <p className="text-sm text-testo-tenue">{sotto}</p> : null}
      </div>
      {azione ? <div className="shrink-0">{azione}</div> : null}
    </div>
  );
}

export function SchedaCorpo({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function SchedaPiede({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-t border-bordo px-5 py-4", className)}>
      {children}
    </div>
  );
}

/**
 * Riquadro metrica per le dashboard: un numero grande, leggibile a colpo
 * d'occhio, con variazione opzionale.
 */
export function SchedaMetrica({
  etichetta,
  valore,
  dettaglio,
  tono = "neutro",
  className,
}: {
  etichetta: string;
  valore: ReactNode;
  dettaglio?: ReactNode;
  tono?: "neutro" | "positivo" | "attenzione" | "critico";
  className?: string;
}) {
  const toni = {
    neutro: "text-testo",
    positivo: "text-lime",
    attenzione: "text-attenzione",
    critico: "text-errore",
  } as const;
  return (
    <Scheda className={cn("flex flex-col gap-2 p-5", className)}>
      <span className="etichetta text-testo-tenue">{etichetta}</span>
      <span className={cn("cifre text-3xl leading-none font-medium", toni[tono])}>{valore}</span>
      {dettaglio ? <span className="text-xs text-testo-tenue">{dettaglio}</span> : null}
    </Scheda>
  );
}
