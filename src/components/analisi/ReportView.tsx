import type { FullReport } from "@/lib/analysisSchema";
import type { Route } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { euro } from "@/lib/format";
import { AI_ANALYSIS_DISCLAIMER } from "@/config/site";
import { cn } from "@/lib/cn";

const LIVELLO_LABEL: Record<FullReport["livelloIntervento"], string> = {
  correzione: "Correzione bozze",
  "editing-leggero": "Editing leggero",
  "editing-profondo": "Editing profondo",
};

function scoreColor(score: number): string {
  if (score >= 75) return "text-successo";
  if (score >= 50) return "text-bronzo";
  return "text-errore";
}

function ScoreCard({ label, score, comment }: { label: string; score: number; comment: string }) {
  return (
    <div className="border-linea bg-carta rounded-lg border p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-inchiostro-60 text-sm font-medium">{label}</span>
        <span className={cn("font-display nums-tabular text-2xl font-medium", scoreColor(score))}>
          {score}
          <span className="text-inchiostro-40 text-sm">/100</span>
        </span>
      </div>
      <div className="bg-carta-3 mt-3 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full",
            score >= 75 ? "bg-successo" : score >= 50 ? "bg-bronzo" : "bg-errore",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-inchiostro-60 mt-3 text-sm leading-relaxed">{comment}</p>
    </div>
  );
}

function ListCard({
  titolo,
  items,
  tone = "neutro",
}: {
  titolo: string;
  items: string[];
  tone?: "forza" | "intervento" | "neutro";
}) {
  const marker =
    tone === "forza"
      ? "text-successo"
      : tone === "intervento"
        ? "text-bronzo"
        : "text-inchiostro-40";
  return (
    <div className="border-linea bg-carta rounded-lg border p-6">
      <h3 className="font-display text-inchiostro mb-4 text-lg font-medium">{titolo}</h3>
      {items.length === 0 ? (
        <p className="text-inchiostro-40 text-sm">Nessun elemento rilevante individuato.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="text-inchiostro-80 flex gap-2.5 text-sm leading-relaxed">
              <span className={cn("mt-1 shrink-0", marker)} aria-hidden>
                ▪
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportView({ report }: { report: FullReport }) {
  const preventivoHref = `/preventivo?tipo=romanzo&parole=${report.wordCount}` as Route;

  return (
    <div className="space-y-8">
      {/* Sintesi + verdetto */}
      <div className="border-bronzo/40 bg-carta-2 rounded-lg border p-6 sm:p-8">
        <p className="text-bronzo text-xs font-semibold tracking-[0.18em] uppercase">
          Sintesi dell{"'"}analisi
        </p>
        <p className="text-inchiostro-80 mt-3 text-lg leading-relaxed">{report.sintesi}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="bg-carta rounded-md p-4">
            <p className="text-inchiostro-40 text-xs">Parole analizzate</p>
            <p className="font-display nums-tabular mt-1 text-xl font-medium">
              {report.wordCount.toLocaleString("it-IT")}
            </p>
          </div>
          <div className="bg-carta rounded-md p-4">
            <p className="text-inchiostro-40 text-xs">Intervento consigliato</p>
            <p className="font-display mt-1 text-xl font-medium">
              {LIVELLO_LABEL[report.livelloIntervento]}
            </p>
          </div>
          <div className="bg-carta rounded-md p-4">
            <p className="text-inchiostro-40 text-xs">Fascia di costo indicativa</p>
            <p className="font-display nums-tabular mt-1 text-xl font-medium">
              {euro(report.fasciaCosto.min)}–{euro(report.fasciaCosto.max)}
            </p>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ScoreCard
          label="Leggibilità"
          score={report.leggibilita.punteggio}
          comment={report.leggibilita.commento}
        />
        <ScoreCard label="Ritmo" score={report.ritmo.punteggio} comment={report.ritmo.commento} />
        <ScoreCard
          label="Coerenza dei tempi"
          score={report.coerenzaTempi.punteggio}
          comment={report.coerenzaTempi.commento}
        />
      </div>

      {/* Forza / intervento */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard titolo="Punti di forza" items={report.puntiForza} tone="forza" />
        <ListCard titolo="Aree di intervento" items={report.areeIntervento} tone="intervento" />
      </div>

      {/* Stile */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard titolo="Ripetizioni e tic stilistici" items={report.ripetizioni} />
        <ListCard titolo="Cliché rilevati" items={report.cliche} />
      </div>

      {/* Inquadramento */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border-linea bg-carta rounded-lg border p-6">
          <h3 className="text-inchiostro-60 mb-2 text-sm font-medium">Genere stimato</h3>
          <p className="font-display text-inchiostro text-lg">{report.genere}</p>
        </div>
        <div className="border-linea bg-carta rounded-lg border p-6">
          <h3 className="text-inchiostro-60 mb-2 text-sm font-medium">Target di lettori</h3>
          <p className="text-inchiostro-80 leading-relaxed">{report.targetLettori}</p>
        </div>
        <div className="border-linea bg-carta rounded-lg border p-6">
          <h3 className="text-inchiostro-60 mb-2 text-sm font-medium">Comparables</h3>
          <ul className="text-inchiostro-80 space-y-1 text-sm">
            {report.comparables.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Disclaimer + CTA */}
      <div className="border-linea bg-carta-2 text-inchiostro-60 rounded-lg border border-dashed p-5 text-sm leading-relaxed">
        {AI_ANALYSIS_DISCLAIMER}
      </div>

      <div className="bg-inchiostro text-carta flex flex-col items-start gap-4 rounded-lg p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-medium">Vuoi il preventivo esatto?</h3>
          <p className="text-carta/70 mt-2">
            Passa dai numeri stimati a un preventivo su misura, con i tuoi dati già noti.
          </p>
        </div>
        <ButtonLink
          href={preventivoHref}
          size="lg"
          className="bg-carta text-inchiostro border-carta hover:bg-bronzo-chiaro hover:border-bronzo-chiaro shrink-0"
        >
          Configura il preventivo
        </ButtonLink>
      </div>
    </div>
  );
}
