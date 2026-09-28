import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Stato vuoto: dice cosa manca e offre l'azione per riempirlo. */
export function StatoVuoto({
  icona,
  titolo,
  descrizione,
  azione,
  className,
}: {
  icona?: ReactNode;
  titolo: string;
  descrizione?: string;
  azione?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-bordo-forte px-6 py-14 text-center",
        className,
      )}
    >
      {icona ? (
        <div
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-superficie-viva text-testo-tenue"
        >
          {icona}
        </div>
      ) : null}
      <p className="text-base font-medium text-testo">{titolo}</p>
      {descrizione ? (
        <p className="lettura text-sm leading-relaxed text-testo-tenue">{descrizione}</p>
      ) : null}
      {azione ? <div className="mt-2">{azione}</div> : null}
    </div>
  );
}

/**
 * Segnaposto di caricamento. `aria-hidden` più un testo alternativo a carico
 * del contenitore: uno screen reader non deve leggere rettangoli grigi.
 */
export function Scheletro({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-md bg-superficie-viva", className)}
    />
  );
}

export function ScheletroTesto({ righe = 3, className }: { righe?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: righe }).map((_, i) => (
        <Scheletro key={i} className={cn("h-3", i === righe - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export type TonoAvviso = "informazione" | "successo" | "attenzione" | "errore";

/**
 * Avviso inline. Gli avvisi di errore hanno role="alert" così vengono
 * annunciati appena compaiono; gli altri restano nel flusso di lettura.
 */
export function Avviso({
  tono = "informazione",
  titolo,
  children,
  className,
}: {
  tono?: TonoAvviso;
  titolo?: string;
  children?: ReactNode;
  className?: string;
}) {
  const toni: Record<TonoAvviso, string> = {
    informazione: "border-informazione/35 bg-informazione/10 text-testo",
    successo: "border-successo/35 bg-successo/10 text-testo",
    attenzione: "border-attenzione/35 bg-attenzione/10 text-testo",
    errore: "border-errore/40 bg-errore/10 text-testo",
  };
  const marcatori: Record<TonoAvviso, string> = {
    informazione: "bg-informazione",
    successo: "bg-successo",
    attenzione: "bg-attenzione",
    errore: "bg-errore",
  };
  return (
    <div
      role={tono === "errore" ? "alert" : undefined}
      className={cn(
        "flex gap-3 rounded-md border p-4 text-sm leading-relaxed",
        toni[tono],
        className,
      )}
    >
      <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", marcatori[tono])} />
      <div className="flex min-w-0 flex-col gap-1">
        {titolo ? <p className="font-medium text-testo">{titolo}</p> : null}
        {children ? <div className="text-testo-attenuato">{children}</div> : null}
      </div>
    </div>
  );
}
