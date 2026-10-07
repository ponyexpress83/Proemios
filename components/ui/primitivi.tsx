import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export { cn };
export { Scheda, SchedaMetrica } from "./scheda";
export { Badge, BadgeStato } from "./badge";

/** Contenitore principale: stessa gabbia per sito pubblico e dashboard. */
export function Gabbia({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "main" | "nav";
}) {
  return <Tag className={cn("gabbia", className)}>{children}</Tag>;
}

/** Sezione verticale con ritmo di spaziatura coerente in tutto il sito. */
export function Sezione({
  children,
  className,
  ampiezza = "media",
  fondo,
  senzaGabbia = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  ampiezza?: "compatta" | "media" | "ampia";
  /** Alterna il fondale fra pagina e superficie sollevata. */
  fondo?: "piana" | "bassa";
  /**
   * Toglie la gabbia interna, per le sezioni a tutta larghezza (fasce, hero con
   * bagliori che devono debordare). Il caso normale è con la gabbia: così una
   * pagina non deve annidare <Gabbia> a ogni sezione e non può dimenticarsene.
   */
  senzaGabbia?: boolean;
  id?: string;
}) {
  const spazi = {
    compatta: "py-12 md:py-16",
    media: "py-16 md:py-24",
    ampia: "py-24 md:py-32",
  } as const;
  const fondi = { piana: "bg-fondo", bassa: "border-y border-bordo bg-fondo-alto" } as const;

  const contenuto = senzaGabbia ? children : <Gabbia>{children}</Gabbia>;
  return (
    <section
      id={id}
      className={cn(spazi[ampiezza], fondo ? fondi[fondo] : undefined, className)}
    >
      {contenuto}
    </section>
  );
}

/**
 * Occhiello: la riga tecnica sopra il titolo. Il punto lime è decorativo e
 * marcato aria-hidden perché non porta informazione.
 */
export function Occhiello({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("etichetta flex items-center gap-2 text-testo-tenue", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-lime" />
      {children}
    </p>
  );
}

/** Titolo di sezione con occhiello e sottotitolo opzionali. */
export function Titolo({
  occhiello,
  children,
  sotto,
  livello,
  as,
  className,
  allineamento = "sinistra",
}: {
  occhiello?: string;
  children: ReactNode;
  sotto?: ReactNode;
  livello?: 1 | 2 | 3 | 4;
  /** Alias testuale di `livello`, più leggibile nel markup delle pagine. */
  as?: "h1" | "h2" | "h3" | "h4";
  className?: string;
  allineamento?: "sinistra" | "centro";
}) {
  const effettivo = livello ?? (as ? (Number(as.slice(1)) as 1 | 2 | 3 | 4) : 2);
  const H = `h${effettivo}` as "h1" | "h2" | "h3" | "h4";
  const misure = {
    1: "text-4xl sm:text-5xl lg:text-6xl",
    2: "text-3xl sm:text-4xl lg:text-[2.75rem]",
    3: "text-2xl sm:text-3xl",
    4: "text-xl sm:text-2xl",
  } as const;
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        allineamento === "centro" && "items-center text-center",
        className,
      )}
    >
      {occhiello ? <Occhiello>{occhiello}</Occhiello> : null}
      <H className={cn(misure[effettivo], "text-testo")}>{children}</H>
      {sotto ? (
        <p className={cn("lettura text-base leading-relaxed text-testo-attenuato sm:text-lg")}>
          {sotto}
        </p>
      ) : null}
    </div>
  );
}

/** Separatore orizzontale. */
export function Filetto({ className }: { className?: string }) {
  return <hr className={cn("h-px border-0 bg-bordo", className)} />;
}

/** Etichetta tecnica inline (codice progetto, conteggio, meta). */
export function Etichetta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("etichetta text-testo-tenue", className)}>{children}</span>;
}

/** Nota a margine: testo secondario di supporto. */
export function Nota({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm leading-relaxed text-testo-tenue", className)}>{children}</p>;
}

/**
 * Coppia etichetta/valore usata ovunque nelle dashboard (dettaglio progetto,
 * riepiloghi, schede lead). Il valore usa cifre tabellari quando è numerico.
 */
export function Dato({
  etichetta,
  children,
  numerico = false,
  className,
}: {
  etichetta: string;
  children: ReactNode;
  numerico?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Etichetta>{etichetta}</Etichetta>
      <div className={cn("text-sm text-testo", numerico && "cifre text-base")}>{children}</div>
    </div>
  );
}

/**
 * Griglia asimmetrica da pagina di contenuto: una colonna di apparato a
 * sinistra (numero di sezione, note) e il testo a destra. Su mobile la colonna
 * di apparato collassa sopra il contenuto.
 */
export function Impaginato({
  margine,
  children,
  className,
}: {
  margine?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-x-10 gap-y-4 lg:grid-cols-[11rem_minmax(0,1fr)]", className)}>
      <div className="lg:pt-1">{margine}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Numero di sezione con etichetta facoltativa. */
export function Folio({ n, etichetta }: { n: number | string; etichetta?: string }) {
  const numero = typeof n === "number" ? String(n).padStart(2, "0") : n;
  return (
    <p className="etichetta text-viola-chiaro">
      {numero}
      {etichetta ? <span className="text-testo-tenue"> · {etichetta}</span> : null}
    </p>
  );
}

/** Nota di apparato nella colonna a margine. Nascosta sotto lg per non spezzare la lettura. */
export function NotaMargine({ children }: { children: ReactNode }) {
  return <p className="mt-3 hidden text-sm leading-relaxed text-testo-tenue lg:block">{children}</p>;
}

/**
 * Apertura di sezione: numero, titolo e occhiello, con la griglia asimmetrica.
 * È il ritmo ricorrente delle pagine di contenuto.
 */
export function Apertura({
  folio,
  etichetta,
  titolo,
  occhiello,
  glossa,
  as = "h2",
}: {
  folio?: number | string;
  etichetta?: string;
  titolo: string;
  occhiello?: ReactNode;
  glossa?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <Impaginato
      margine={
        <>
          {folio !== undefined ? <Folio n={folio} etichetta={etichetta} /> : null}
          {glossa ? <NotaMargine>{glossa}</NotaMargine> : null}
        </>
      }
    >
      <Titolo as={as}>{titolo}</Titolo>
      {occhiello ? (
        <div className="lettura mt-6 text-lg leading-relaxed text-testo-attenuato">{occhiello}</div>
      ) : null}
    </Impaginato>
  );
}
