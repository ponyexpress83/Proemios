"use client";

import type { Route } from "next";
import { Collegamento } from "@/components/sito/collegamento";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Filetto } from "@/components/sito/sezione";
import { cn } from "@/lib/cn";
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

/** Metrica: numero grande, etichetta in maiuscoletto, filetto che misura. */
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
    <div className="rounded-foglio bg-bianco p-5 shadow-foglio">
      <p className="maiuscoletto text-t-sm text-grafite">{etichetta}</p>
      <p className="tabellare mt-2 font-serif text-t-xl text-inchiostro">{valore}</p>
      {barra !== undefined && (
        <div className="mt-3 h-1 w-full rounded-pillola bg-filetto" aria-hidden="true">
          <div
            className={cn(
              "h-1 rounded-pillola",
              barra >= 60 ? "bg-esito-ok" : barra >= 40 ? "bg-grafite" : "bg-rosso-matita",
            )}
            style={{ width: `${Math.max(2, Math.min(100, barra))}%` }}
          />
        </div>
      )}
      {nota && <p className="mt-3 text-t-sm text-grafite">{nota}</p>}
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
  const segno = tono === "forza" ? "bg-esito-ok" : tono === "intervento" ? "bg-rosso-matita" : "bg-grafite";
  return (
    <div className="rounded-foglio bg-bianco p-6 shadow-foglio">
      <h3 className="font-serif text-t-md text-inchiostro">{titolo}</h3>
      <Filetto className="my-4" />
      {voci.length === 0 ? (
        <p className="text-t-sm text-grafite">{vuoto}</p>
      ) : (
        <ul className="space-y-3">
          {voci.map((v, i) => (
            <li key={i} className="flex gap-3">
              <span className={cn("mt-2.5 h-0.5 w-3 shrink-0 rounded-pillola", segno)} aria-hidden="true" />
              <span className="text-t-sm text-inchiostro">{v}</span>
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
    <div className="space-y-6" aria-live="polite">
      {demo && (
        <div className="rounded-foglio border border-dashed border-grafite bg-carta-ombra p-5">
          <p className="maiuscoletto text-t-sm text-rosso-matita">Report dimostrativo</p>
          <p className="mt-2 text-t-sm text-grafite">
            Le misure qui sotto — parole, pagine, leggibilità, periodare — sono calcolate davvero
            sul file che hai caricato. Le osservazioni editoriali, invece, sono di esempio: in
            questa versione il giudizio non viene prodotto, si vede solo come si presenta.
          </p>
        </div>
      )}

      {/* Sintesi */}
      <div className="rounded-foglio border-t-4 border-rosso-matita bg-bianco p-6 shadow-foglio sm:p-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="font-serif text-t-lg text-inchiostro">Prima diagnosi</h2>
          <span className="tabellare text-t-sm text-grafite">
            {numero(m.parole)} parole, {numero(m.pagineStimate)} pagine stimate
          </span>
        </div>
        <p className="mt-5 max-w-giustezza font-serif text-t-md text-inchiostro">{report.sintesi}</p>

        <Filetto className="my-6" />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="maiuscoletto text-t-sm text-grafite">Intervento consigliato</p>
            <p className="mt-1 text-t-md text-inchiostro">{LIVELLO[report.livelloIntervento]}</p>
          </div>
          <div>
            <p className="maiuscoletto text-t-sm text-grafite">Fascia di costo indicativa</p>
            <p className="tabellare mt-1 text-t-md text-inchiostro">
              {euro(report.fasciaCosto.min)} – {euro(report.fasciaCosto.max)}
            </p>
          </div>
        </div>
      </div>

      {/* Metriche misurate */}
      <div>
        <p className="maiuscoletto mb-3 text-t-sm text-grafite">Misurato sul file</p>
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
            valore={`${m.quotaFrasiLunghe} %`}
            barra={100 - m.quotaFrasiLunghe}
            nota={
              m.quotaFrasiLunghe > 20
                ? "Una quota alta: valuta di spezzare i periodi più lunghi."
                : "Distribuzione equilibrata."
            }
          />
        </div>
        <p className="mt-3 text-t-xs text-grafite">
          Queste metriche sono calcolate direttamente sul testo, non stimate.
        </p>
      </div>

      {/* Giudizio editoriale */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Elenco titolo="Punti di forza" voci={report.puntiForza} vuoto="Nessuno rilevato nell'estratto." tono="forza" />
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
        <Elenco titolo="Cliché rilevati" voci={report.cliche} vuoto="Nessun cliché evidente. Buon segno." />
      </div>

      {/* Inquadramento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ritmo", report.ritmo.giudizio],
          ["Tempi verbali", report.coerenza.tempiVerbali],
          ["Punto di vista", report.coerenza.puntoDiVista],
        ].map(([titolo, testo]) => (
          <div key={titolo} className="rounded-foglio bg-bianco p-5 shadow-foglio">
            <p className="maiuscoletto text-t-sm text-grafite">{titolo}</p>
            <p className="mt-2 text-t-sm text-inchiostro">{testo}</p>
          </div>
        ))}
        <div className="rounded-foglio bg-bianco p-5 shadow-foglio">
          <p className="maiuscoletto text-t-sm text-grafite">Genere e lettore</p>
          <p className="mt-2 text-t-base text-inchiostro">{report.genere}</p>
          <p className="mt-1 text-t-sm text-grafite">{report.lettoreTipo}</p>
        </div>
      </div>

      {/* Nota legale */}
      <div className="rounded-foglio border border-dashed border-grafite p-5">
        <p className="text-t-sm text-grafite">
          {BRAND.aiAnalysisNotice} {BRAND.aiDisclaimer}
        </p>
      </div>

      {/* Passo successivo */}
      <div
        data-tema="inchiostro"
        className="flex flex-col items-start gap-5 rounded-foglio bg-inchiostro p-8 text-carta-su-inchiostro sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h3 className="font-serif text-t-lg">{ANALISI.ctaPreventivo}</h3>
          <p className="mt-2 max-w-md text-t-sm text-grafite-su-inchiostro">{ANALISI.ctaPreventivoTesto}</p>
        </div>
        <PulsanteLink href={hrefPreventivo} variante="primario" freccia className="shrink-0">
          Calcola il preventivo
        </PulsanteLink>
      </div>

      <p className="text-center">
        <Collegamento href="/contatti">Preferisci parlarne con una persona?</Collegamento>
      </p>
    </div>
  );
}
