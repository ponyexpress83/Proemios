import type { ReactNode } from "react";

/** Concatena classi condizionali senza dipendenze. */
export function cx(...parti: Array<string | false | null | undefined>): string {
  return parti.filter(Boolean).join(" ");
}

/* ── Gabbia ─────────────────────────────────────────────────────────────── */

export function Gabbia({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "main" | "article";
}) {
  return <As className={cx("gabbia", className)}>{children}</As>;
}

/**
 * Impaginato: la griglia asimmetrica del brief — colonna margine (apparato)
 * + specchio di stampa. Su mobile la colonna margine collassa e diventa un
 * riferimento inline sopra il contenuto.
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
    <div className={cx("grid gap-x-10 gap-y-4 lg:grid-cols-[11rem_minmax(0,1fr)]", className)}>
      <div className="lg:pt-1 lg:text-right">{margine}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ── Folio (numero di sezione) ──────────────────────────────────────────── */

export function Folio({ n, etichetta }: { n: number | string; etichetta?: string }) {
  const numero = typeof n === "number" ? String(n).padStart(2, "0") : n;
  return (
    <p className="apparato text-ottone">
      <span aria-hidden>§&nbsp;</span>
      {numero}
      {etichetta && <span className="text-stampa"> · {etichetta}</span>}
    </p>
  );
}

/* ── Nota a margine (glossa) ────────────────────────────────────────────── */

export function NotaMargine({ children }: { children: ReactNode }) {
  return <p className="glossa mt-3 hidden lg:block">{children}</p>;
}

/* ── Filetto ────────────────────────────────────────────────────────────── */

export function Filetto({
  className,
  tono = "carta",
}: {
  className?: string;
  tono?: "carta" | "notte" | "forte";
}) {
  const colore =
    tono === "notte" ? "bg-filetto-notte" : tono === "forte" ? "bg-filetto-forte" : "bg-filetto";
  return <hr className={cx("h-px border-0", colore, className)} />;
}

/* ── Versale (capolettera di apertura sezione) ──────────────────────────── */

/**
 * Il gesto "proemio": la prima lettera del titolo composta oversize, con il
 * resto che le si appoggia. Qui si concentra l'audacia del progetto.
 */
export function Versale({
  children,
  as: As = "h2",
  className,
  tono = "carta",
}: {
  children: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  tono?: "carta" | "notte";
}) {
  const testo = children.trim();
  const prima = testo.charAt(0);
  const resto = testo.slice(1);
  const colore = tono === "notte" ? "text-carta" : "text-inchiostro";

  return (
    <As
      className={cx(
        "font-display text-[2rem] leading-[1.08] font-medium sm:text-[2.6rem]",
        As === "h1" && "sm:text-[3.25rem]",
        colore,
        className,
      )}
    >
      <span
        className={cx(
          "float-left mr-[0.06em] -ml-[0.03em] font-medium",
          "first-letter:normal text-[2.1em] leading-[0.78]",
          tono === "notte" ? "text-ottone" : "text-alloro",
        )}
        aria-hidden
      >
        {prima}
      </span>
      <span className="sr-only">{testo}</span>
      <span aria-hidden>{resto}</span>
    </As>
  );
}

/* ── Titolo di sezione (senza versale, per gerarchie minori) ────────────── */

export function Titolo({
  children,
  as: As = "h2",
  className,
  tono = "carta",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3" | "h4";
  className?: string;
  tono?: "carta" | "notte";
}) {
  return (
    <As
      className={cx(
        "font-display font-medium",
        As === "h1"
          ? "text-[2.4rem] leading-[1.06] sm:text-[3.25rem]"
          : As === "h2"
            ? "text-[1.9rem] leading-[1.12] sm:text-[2.4rem]"
            : As === "h3"
              ? "text-[1.35rem] leading-[1.2]"
              : "text-[1.1rem] leading-[1.3]",
        tono === "notte" ? "text-carta" : "text-inchiostro",
        className,
      )}
    >
      {children}
    </As>
  );
}

/* ── Sezione ────────────────────────────────────────────────────────────── */

export function Sezione({
  children,
  className,
  fondo = "carta",
  id,
}: {
  children: ReactNode;
  className?: string;
  fondo?: "carta" | "bassa" | "notte";
  id?: string;
}) {
  const fondi = {
    carta: "bg-carta text-inchiostro",
    bassa: "bg-carta-bassa text-inchiostro",
    notte: "bg-notte text-carta su-notte",
  } as const;

  return (
    <section id={id} className={cx("py-16 sm:py-24", fondi[fondo], className)}>
      <Gabbia>{children}</Gabbia>
    </section>
  );
}

/**
 * Apertura di sezione: folio + versale + filetto. Il ritmo ricorrente
 * che rende la pagina "un libro composto".
 */
export function Apertura({
  folio,
  etichetta,
  titolo,
  occhiello,
  glossa,
  tono = "carta",
  as = "h2",
}: {
  folio?: number | string;
  etichetta?: string;
  titolo: string;
  occhiello?: ReactNode;
  glossa?: ReactNode;
  tono?: "carta" | "notte";
  as?: "h1" | "h2";
}) {
  return (
    <Impaginato
      margine={
        <>
          {folio !== undefined && <Folio n={folio} etichetta={etichetta} />}
          {glossa && <NotaMargine>{glossa}</NotaMargine>}
        </>
      }
    >
      <Versale as={as} tono={tono}>
        {titolo}
      </Versale>
      <Filetto className="mt-6" tono={tono === "notte" ? "notte" : "carta"} />
      {occhiello && (
        <div className={cx("specchio prosa-grande mt-6", tono === "notte" && "text-carta/75")}>
          {occhiello}
        </div>
      )}
    </Impaginato>
  );
}

/* ── Scheda ─────────────────────────────────────────────────────────────── */

export function Scheda({
  children,
  className,
  rilievo = false,
  tono = "carta",
}: {
  children: ReactNode;
  className?: string;
  rilievo?: boolean;
  tono?: "carta" | "notte";
}) {
  const base =
    tono === "notte"
      ? cx("bg-notte-alta", rilievo ? "border-ottone/60" : "border-filetto-notte")
      : cx("bg-carta-alta", rilievo ? "border-alloro/50" : "border-filetto");

  return (
    <div
      className={cx(
        "rounded-scheda border p-6",
        base,
        rilievo && (tono === "notte" ? "ring-ottone/25 ring-1" : "ring-alloro/15 ring-1"),
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Etichetta di apparato (chip) ───────────────────────────────────────── */

export function Etichetta({
  children,
  tono = "alloro",
}: {
  children: ReactNode;
  tono?: "alloro" | "ottone" | "stampa";
}) {
  const toni = {
    alloro: "border-alloro/30 text-alloro",
    ottone: "border-ottone/40 text-ottone",
    stampa: "border-filetto text-stampa",
  } as const;
  return (
    <span
      className={cx(
        "apparato inline-flex items-center rounded-full border px-2.5 py-1",
        toni[tono],
      )}
    >
      {children}
    </span>
  );
}
