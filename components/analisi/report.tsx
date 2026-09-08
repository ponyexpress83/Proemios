"use client";

import Link from "next/link";
import type { Route } from "next";
import { Filetto, Etichetta, cn } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { euro, numero } from "@/lib/format";
import { etichettaGulpease } from "@/lib/metrics";
import { ANALISI } from "@/config/copy";
import { BRAND } from "@/config/brand";
import type { ReportCompleto } from "@/lib/ai";

const LIVELLO: Record<ReportCompleto["livelloIntervento"], string> = {
  "correzione-bozze": "Correzione di bozze",
  "editing-leggero": "Editing leggero",
  "editing-profondo": "Editing profondo",
};

/** Metrica in registro da etichetta: numero grande, etichetta piccola, filetto. */
function Metrica({
  etichetta,
  valore,
  nota,
  barra,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  barra?: number;
}) {
  return (
    <div className="rounded-lg border-bordo bg-superficie border p-5">
      <p className="etichetta text-testo-tenue">{etichetta}</p>
      <p className="cifre text-testo mt-2 text-3xl font-medium">{valore}</p>
      {barra !== undefined && (
        <div className="bg-filetto-notte mt-3 h-px w-full">
          <div
            className={cn(
              "h-px",
              barra >= 60 ? "bg-successo" : barra >= 40 ? "bg-lime" : "bg-errore",
            )}
            style={{ width: `${Math.max(2, Math.min(100, barra))}%` }}
          />
        </div>
      )}
      {nota && <p className="text-testo-tenue mt-3 text-sm leading-relaxed">{nota}</p>}
    </div>
  );
}

function Elenco({
  titolo,
  voci,
  vuoto,
  tono = "neutro",
}: {
  titolo: string;
  voci: string[];
  vuoto: string;
  tono?: "forza" | "intervento" | "neutro";
}) {
  const segno =
    tono === "forza" ? "bg-successo" : tono === "intervento" ? "bg-lime" : "bg-fondo/30";
  return (
    <div className="rounded-lg border-bordo bg-superficie border p-6">
      <h3 className="text-testo text-lg font-medium">{titolo}</h3>
      <Filetto className="my-4" />
      {voci.length === 0 ? (
        <p className="text-testo-tenue text-sm">{vuoto}</p>
      ) : (
        <ul className="space-y-3">
          {voci.map((v, i) => (
            <li key={i} className="flex gap-3">
              <span className={cn("mt-2.5 h-px w-3 shrink-0", segno)} aria-hidden />
              <span className="text-testo/85 text-sm leading-relaxed">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Report({ report, demo = false }: { report: ReportCompleto; demo?: boolean }) {
  const m = report.metriche;

  const hrefPreventivo =
    `/preventivo?parole=${m.parole}${report.livelloIntervento === "correzione-bozze" ? "" : ""}` as Route;

  return (
    <div className="space-y-6">
      {demo && (
        <div className="rounded-lg border-lime/50 bg-superficie border border-dashed p-5">
          <p className="etichetta text-lime">Report dimostrativo</p>
          <p className="text-testo-attenuato mt-2 text-sm leading-relaxed">
            Le misure qui sotto — parole, pagine, leggibilità, periodare — sono calcolate davvero
            sul file che hai caricato. Le osservazioni editoriali, invece, sono di esempio: in
            questa versione il giudizio non viene prodotto, si vede solo come si presenta.
          </p>
        </div>
      )}

      {/* Sintesi */}
      <div className="rounded-lg border-lime/50 bg-superficie border p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Etichetta>Prima diagnosi</Etichetta>
          <span className="etichetta text-testo-tenue">
            {numero(m.parole)} parole · {numero(m.pagineStimate)} pagine stimate
          </span>
        </div>
        <p className="text-lg leading-relaxed text-testo-attenuato text-testo/85 mt-5">{report.sintesi}</p>

        <Filetto className="my-6" />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="etichetta text-testo-tenue">Intervento consigliato</p>
            <p className="text-testo mt-2 text-xl font-medium">
              {LIVELLO[report.livelloIntervento]}
            </p>
          </div>
          <div>
            <p className="etichetta text-testo-tenue">Fascia di costo indicativa</p>
            <p className="cifre text-testo mt-2 text-xl font-medium">
              {euro(report.fasciaCosto.min)} – {euro(report.fasciaCosto.max)}
            </p>
          </div>
        </div>
      </div>

      {/* Metriche misurate */}
      <div>
        <p className="etichetta text-lime mb-3">Misurato sul file</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metrica
            etichetta="Leggibilità (Gulpease)"
            valore={String(m.gulpease)}
            barra={m.gulpease}
            nota={etichettaGulpease(m.gulpease)}
          />
          <Metrica
            etichetta="Parole per frase"
            valore={String(m.parolePerFrase)}
            nota={
              m.parolePerFrase > 28
                ? "Periodare lungo: la lettura richiede attenzione."
                : "Lunghezza nella norma per la narrativa italiana."
            }
          />
          <Metrica
            etichetta="Frasi oltre 35 parole"
            valore={`${m.quotaFrasiLunghe}%`}
            barra={100 - m.quotaFrasiLunghe}
            nota={
              m.quotaFrasiLunghe > 20
                ? "Una quota alta: valuta di spezzare i periodi più lunghi."
                : "Distribuzione equilibrata."
            }
          />
        </div>
        <p className="editoriale text-testo-tenue mt-3">
          Queste metriche sono calcolate direttamente sul testo, non stimate.
        </p>
      </div>

      {/* Giudizio editoriale */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Elenco
          titolo="Punti di forza"
          voci={report.puntiForza}
          vuoto="Nessuno rilevato nell'estratto."
          tono="forza"
        />
        <Elenco
          titolo="Aree di intervento"
          voci={report.areeIntervento}
          vuoto="Nessuna priorità evidente."
          tono="intervento"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Elenco
          titolo="Ripetizioni e tic ricorrenti"
          voci={report.ripetizioni}
          vuoto="Nessuna ripetizione significativa nell'estratto."
        />
        <Elenco
          titolo="Cliché rilevati"
          voci={report.cliche}
          vuoto="Nessun cliché evidente. Buon segno."
        />
      </div>

      {/* Inquadramento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border-bordo bg-superficie border p-5">
          <p className="etichetta text-testo-tenue">Ritmo</p>
          <p className="text-testo-attenuato mt-2 text-sm leading-relaxed">
            {report.ritmo.giudizio}
          </p>
        </div>
        <div className="rounded-lg border-bordo bg-superficie border p-5">
          <p className="etichetta text-testo-tenue">Tempi verbali</p>
          <p className="text-testo-attenuato mt-2 text-sm leading-relaxed">
            {report.coerenza.tempiVerbali}
          </p>
        </div>
        <div className="rounded-lg border-bordo bg-superficie border p-5">
          <p className="etichetta text-testo-tenue">Punto di vista</p>
          <p className="text-testo-attenuato mt-2 text-sm leading-relaxed">
            {report.coerenza.puntoDiVista}
          </p>
        </div>
        <div className="rounded-lg border-bordo bg-superficie border p-5">
          <p className="etichetta text-testo-tenue">Genere e lettore</p>
          <p className="text-testo mt-2 text-base">{report.genere}</p>
          <p className="text-testo-attenuato mt-1 text-sm leading-relaxed">
            {report.lettoreTipo}
          </p>
        </div>
      </div>

      {/* Nota legale */}
      <div className="rounded-lg border-bordo border border-dashed p-5">
        <p className="text-testo-tenue text-sm leading-relaxed">
          {BRAND.aiAnalysisNotice} {BRAND.aiDisclaimer}
        </p>
      </div>

      {/* CTA */}
      <div className="rounded-lg bg-fondo text-testo flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-medium">{ANALISI.ctaPreventivo}</h3>
          <p className="prosa mt-2 max-w-md">{ANALISI.ctaPreventivoTesto}</p>
        </div>
        <BottoneLink href={hrefPreventivo} misura="grande" className="shrink-0">
          Calcola il preventivo
        </BottoneLink>
      </div>

      <p className="text-center">
        <Link href={"/contatti" as Route} className="etichetta text-testo-tenue hover:text-lime">
          Preferisci parlarne con una persona? →
        </Link>
      </p>
    </div>
  );
}
