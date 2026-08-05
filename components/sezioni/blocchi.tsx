import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Filetto, Titolo, Gabbia, cx } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { AZIONI } from "@/config/copy";
import { fascia } from "@/lib/format";
import type { ServicePackage } from "@/config/services";

/* ── Processo: passaggi numerati come una sequenza di segnature ─────────── */

export function Processo({
  passi,
  tono = "carta",
}: {
  passi: readonly { titolo: string; testo: string }[] | readonly string[];
  tono?: "carta" | "notte";
}) {
  const normalizzati = passi.map((p) => (typeof p === "string" ? { titolo: p, testo: "" } : p));

  return (
    <ol className="mt-2">
      {normalizzati.map((passo, i) => (
        <li key={i}>
          <Filetto tono={tono === "notte" ? "notte" : "carta"} />
          <div className="grid gap-x-8 gap-y-2 py-7 sm:grid-cols-[4rem_minmax(0,1fr)]">
            <p
              className={cx(
                "cifre text-2xl font-medium",
                tono === "notte" ? "text-ottone" : "text-alloro",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </p>
            <div>
              <h3
                className={cx(
                  "font-display text-xl font-medium",
                  tono === "notte" ? "text-carta" : "text-inchiostro",
                )}
              >
                {passo.titolo}
              </h3>
              {passo.testo && (
                <p className={cx("prosa specchio mt-2", tono === "notte" && "text-carta/70")}>
                  {passo.testo}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
      <Filetto tono={tono === "notte" ? "notte" : "carta"} />
    </ol>
  );
}

/* ── Elenco di cose incluse ─────────────────────────────────────────────── */

export function ElencoIncluso({
  voci,
  tono = "carta",
}: {
  voci: readonly string[];
  tono?: "carta" | "notte";
}) {
  return (
    <ul className="space-y-3">
      {voci.map((v, i) => (
        <li key={i} className="flex gap-3">
          <span
            className={cx("mt-2 h-px w-4 shrink-0", tono === "notte" ? "bg-ottone" : "bg-alloro")}
            aria-hidden
          />
          <span className={cx("prosa", tono === "notte" && "text-carta/80")}>{v}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Scheda di servizio (griglia /servizi) ──────────────────────────────── */

export function SchedaServizio({ servizio }: { servizio: ServicePackage }) {
  const prezzo = servizio.priceRange
    ? fascia(servizio.priceRange.min, servizio.priceRange.max)
    : "Listino riservato";

  return (
    <Link
      href={`/servizi/${servizio.slug}` as Route}
      className="garbo group rounded-scheda border-filetto bg-carta-alta hover:border-alloro flex flex-col border p-6 hover:-translate-y-0.5"
    >
      <h3 className="font-display text-inchiostro text-xl font-medium">{servizio.name}</h3>
      <p className="prosa mt-2 flex-1 text-[1rem]">{servizio.claim}</p>
      <Filetto className="mt-5" />
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <span className="cifre text-inchiostro text-sm">{prezzo}</span>
        <span className="garbo apparato text-alloro group-hover:translate-x-0.5">Apri</span>
      </div>
    </Link>
  );
}

/* ── Chiusa: la doppia CTA ricorrente ───────────────────────────────────── */

export function Chiusa({
  titolo = "Da dove vuoi cominciare?",
  testo = "Puoi avere il prezzo in due minuti, oppure far leggere il testo e capire prima a che punto sei. Nessuna delle due strade ti impegna a nulla.",
  hrefPreventivo = "/preventivo",
  labelPrimaria = AZIONI.preventivo,
  hrefSecondario = "/analisi-manoscritto",
  labelSecondaria = AZIONI.analisi,
}: {
  titolo?: string;
  testo?: ReactNode;
  hrefPreventivo?: string;
  labelPrimaria?: string;
  hrefSecondario?: string;
  labelSecondaria?: string;
}) {
  return (
    <section className="bg-notte text-carta su-notte py-16 sm:py-20">
      <Gabbia>
        <div className="grid items-end gap-8 lg:grid-cols-[1.4fr_auto]">
          <div>
            <Titolo as="h2" tono="notte">
              {titolo}
            </Titolo>
            <p className="prosa text-carta/70 mt-4 max-w-xl">{testo}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <BottoneLink href={hrefPreventivo} variante="chiaro" misura="grande">
              {labelPrimaria}
            </BottoneLink>
            <BottoneLink href={hrefSecondario} misura="grande" variante="secondarioNotte">
              {labelSecondaria}
            </BottoneLink>
          </div>
        </div>
      </Gabbia>
    </section>
  );
}
