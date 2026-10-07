import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Contenitore: 12 colonne, 1200 px, gutter 24 (16 su mobile). */
export function Contenitore({
  className,
  children,
  stretto = false,
}: {
  className?: string;
  children: ReactNode;
  /** Misura di lettura: 60–72 caratteri. */
  stretto?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 md:px-6",
        stretto ? "max-w-giustezza" : "max-w-pagina",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Sezione: lo spazio verticale viene dai token (112 px desktop, 72 mobile).
 * `tono="inchiostro"` accende il tema scuro per tutto ciò che contiene — link,
 * pulsanti e anello di focus cambiano da soli.
 */
export function Sezione({
  tono = "carta",
  filetto = false,
  className,
  children,
  id,
  etichettatoDa,
}: {
  tono?: "carta" | "ombra" | "inchiostro";
  /** Filetto in testa, al posto di una card che separi. */
  filetto?: boolean;
  className?: string;
  children: ReactNode;
  id?: string;
  /** id del titolo che dà il nome alla sezione. */
  etichettatoDa?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={etichettatoDa}
      data-tema={tono === "inchiostro" ? "inchiostro" : undefined}
      className={cn(
        "py-sezione-mobile lg:py-sezione",
        tono === "ombra" && "bg-carta-ombra",
        tono === "inchiostro" && "bg-inchiostro text-carta-su-inchiostro",
        filetto && "border-t border-filetto",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * Etichetta di sezione: maiuscoletto vero in grafite, senza trattino, e solo
 * dove orienta davvero il lettore. Non è l'eyebrow sopra ogni titolo.
 */
export function Etichetta({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p
      className={cn(
        "maiuscoletto text-t-sm text-grafite in-data-[tema=inchiostro]:text-grafite-su-inchiostro",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Titolo di sezione con lead facoltativo, in misura di lettura. */
export function Intestazione({
  livello = 2,
  id,
  titolo,
  lead,
  className,
  azione,
}: {
  livello?: 1 | 2 | 3;
  id?: string;
  titolo: ReactNode;
  lead?: ReactNode;
  className?: string;
  /** Un link a destra del titolo, su schermi larghi. */
  azione?: ReactNode;
}) {
  const Tag = `h${livello}` as const;
  const misura = { 1: "text-t-display", 2: "text-t-xl", 3: "text-t-lg" }[livello];
  return (
    <div className={cn("mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-giustezza">
        <Tag id={id} className={cn("font-serif text-balance", misura)}>
          {titolo}
        </Tag>
        {lead && (
          <p className="mt-4 text-t-md text-grafite text-pretty in-data-[tema=inchiostro]:text-grafite-su-inchiostro">
            {lead}
          </p>
        )}
      </div>
      {azione && <div className="shrink-0">{azione}</div>}
    </div>
  );
}

/** Filetto orizzontale da 1 px. */
export function Filetto({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-filetto", className)} />;
}
