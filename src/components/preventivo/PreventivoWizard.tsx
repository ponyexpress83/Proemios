"use client";

import { useMemo, useState } from "react";
import type { ProjectType } from "@/config/services";
import type { Servizio } from "@/config/pricing";
import { calcolaPreventivo, type QuoteResult, type TextState } from "@/lib/pricing";
import { euro } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { QuoteResults } from "./QuoteResults";
import {
  PROJECT_OPTIONS,
  TEXT_STATE_OPTIONS,
  WORD_PRESETS,
  SERVIZIO_OPTIONS,
  TEMPISTICA_OPTIONS,
  defaultTextStateFor,
} from "./options";

interface WizardState {
  projectType: ProjectType | null;
  statoTesto: TextState | null;
  parole: number;
  pagineStimate: number;
  servizi: Servizio[];
  tempistica: "standard" | "prioritaria";
  nome: string;
  email: string;
  telefono: string;
  note: string;
}

const STEP_TITLES = [
  "Tipo di progetto",
  "Stato del testo",
  "Lunghezza",
  "Servizi",
  "Tempistiche",
  "I tuoi dati",
];

export function PreventivoWizard({
  prefill,
}: {
  prefill?: { projectType?: ProjectType; servizi?: Servizio[] };
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<{ quote: QuoteResult; quoteId: string } | null>(null);

  const [state, setState] = useState<WizardState>({
    projectType: prefill?.projectType ?? null,
    statoTesto: prefill?.projectType ? defaultTextStateFor(prefill.projectType) : null,
    parole: 50000,
    pagineStimate: 180,
    servizi: prefill?.servizi ?? [],
    tempistica: "standard",
    nome: "",
    email: "",
    telefono: "",
    note: "",
  });

  const isSoloMateriali = state.statoTesto === "solo-materiali";
  const isGrafica = state.projectType === "grafica";

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function toggleServizio(s: Servizio) {
    setState((prev) => ({
      ...prev,
      servizi: prev.servizi.includes(s)
        ? prev.servizi.filter((x) => x !== s)
        : [...prev.servizi, s],
    }));
  }

  // Anteprima live del preventivo (motore puro, lato client).
  const preview: QuoteResult | null = useMemo(() => {
    if (!state.projectType || !state.statoTesto) return null;
    return calcolaPreventivo({
      projectType: state.projectType,
      statoTesto: state.statoTesto,
      parole: state.parole,
      pagineStimate: state.pagineStimate,
      servizi: state.servizi,
      tempistica: state.tempistica,
    });
  }, [state]);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return state.projectType !== null;
      case 1:
        return state.statoTesto !== null;
      case 2:
        return isSoloMateriali ? state.pagineStimate > 0 : state.parole > 0;
      case 3:
        return true; // i servizi sono opzionali; i pacchetti si adattano comunque
      case 4:
        return true;
      case 5:
        return state.nome.trim().length >= 2 && /.+@.+\..+/.test(state.email);
      default:
        return false;
    }
  }, [step, state, isSoloMateriali]);

  const totalSteps = STEP_TITLES.length;

  async function submit() {
    if (!state.projectType || !state.statoTesto) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/preventivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            projectType: state.projectType,
            statoTesto: state.statoTesto,
            parole: state.parole,
            pagineStimate: state.pagineStimate,
            servizi: state.servizi,
            tempistica: state.tempistica,
          },
          contatto: {
            nome: state.nome,
            email: state.email,
            telefono: state.telefono,
            note: state.note,
          },
        }),
      });
      const data = (await res.json()) as {
        quoteId?: string;
        pacchetti?: QuoteResult;
        error?: string;
      };
      if (!res.ok || !data.quoteId || !data.pacchetti) {
        throw new Error(data.error ?? "Impossibile salvare il preventivo.");
      }
      setResult({ quote: data.pacchetti, quoteId: data.quoteId });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Schermata risultati ────────────────────────────────────────────────
  if (result) {
    return (
      <div>
        <div className="mb-10 text-center">
          <p className="text-bronzo text-xs font-semibold tracking-[0.2em] uppercase">
            Il tuo preventivo
          </p>
          <h2 className="font-display text-inchiostro mt-3 text-3xl font-medium sm:text-4xl">
            Tre percorsi per il tuo libro
          </h2>
          <p className="text-inchiostro-60 mx-auto mt-3 max-w-xl">
            Ti abbiamo inviato il riepilogo via email. Scegli il pacchetto e blocca la data con un
            acconto; salderai il resto durante la lavorazione.
          </p>
        </div>
        <QuoteResults result={result.quote} quoteId={result.quoteId} />
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <div>
        {/* Progress */}
        <div className="mb-8">
          <div className="text-inchiostro-40 flex items-center justify-between text-xs">
            <span className="text-bronzo font-semibold tracking-wider uppercase">
              Passo {step + 1} di {totalSteps}
            </span>
            <span>{STEP_TITLES[step]}</span>
          </div>
          <div className="bg-carta-3 mt-2 h-1 overflow-hidden rounded-full">
            <div
              className="bg-bronzo h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 0 && (
            <StepGrid>
              {PROJECT_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  selected={state.projectType === o.value}
                  label={o.label}
                  nota={o.nota}
                  onClick={() => {
                    update("projectType", o.value);
                    if (state.statoTesto === null)
                      update("statoTesto", defaultTextStateFor(o.value));
                    if (o.value === "memoir") update("statoTesto", "solo-materiali");
                  }}
                />
              ))}
            </StepGrid>
          )}

          {step === 1 && (
            <StepGrid>
              {TEXT_STATE_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  selected={state.statoTesto === o.value}
                  label={o.label}
                  nota={o.nota}
                  onClick={() => update("statoTesto", o.value)}
                />
              ))}
            </StepGrid>
          )}

          {step === 2 && (
            <div>
              {isSoloMateriali ? (
                <label className="block">
                  <span className="font-display text-inchiostro mb-2 block text-lg">
                    Quante pagine stimi per il libro finale?
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={state.pagineStimate || ""}
                    onChange={(e) => update("pagineStimate", Number(e.target.value))}
                    className="border-linea bg-carta nums-tabular focus:border-bronzo w-full max-w-xs rounded-md border px-4 py-3 text-lg"
                  />
                  <span className="text-inchiostro-40 mt-2 block text-sm">
                    Stima approssimativa: la definiremo insieme sui materiali.
                  </span>
                </label>
              ) : (
                <div>
                  <span className="font-display text-inchiostro mb-2 block text-lg">
                    Quante parole ha il testo?
                  </span>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {WORD_PRESETS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => update("parole", w)}
                        className={cn(
                          "lift nums-tabular rounded-full border px-4 py-2 text-sm",
                          state.parole === w
                            ? "border-bronzo bg-bronzo/10 text-bronzo-scuro"
                            : "border-linea text-inchiostro-60 hover:border-bronzo",
                        )}
                      >
                        {w.toLocaleString("it-IT")}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={state.parole || ""}
                    onChange={(e) => update("parole", Number(e.target.value))}
                    className="border-linea bg-carta nums-tabular focus:border-bronzo w-full max-w-xs rounded-md border px-4 py-3 text-lg"
                  />
                  <span className="text-inchiostro-40 mt-2 block text-sm">
                    ~{Math.max(1, Math.ceil(state.parole / 300)).toLocaleString("it-IT")} pagine
                    stimate
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-inchiostro-60 mb-4 text-sm">
                {isGrafica
                  ? "Per i progetti di sola grafica consideriamo copertina, impaginazione ed EPUB."
                  : "Seleziona i servizi che ti interessano. I pacchetti si adattano di conseguenza."}
              </p>
              <StepGrid>
                {SERVIZIO_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={state.servizi.includes(o.value)}
                    label={o.label}
                    checkbox
                    onClick={() => toggleServizio(o.value)}
                  />
                ))}
              </StepGrid>
            </div>
          )}

          {step === 4 && (
            <StepGrid>
              {TEMPISTICA_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  selected={state.tempistica === o.value}
                  label={o.label}
                  nota={o.nota}
                  onClick={() => update("tempistica", o.value)}
                />
              ))}
            </StepGrid>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nome *">
                  <input
                    value={state.nome}
                    onChange={(e) => update("nome", e.target.value)}
                    className="border-linea bg-carta focus:border-bronzo w-full rounded-md border px-4 py-3"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email *">
                  <input
                    type="email"
                    value={state.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="border-linea bg-carta focus:border-bronzo w-full rounded-md border px-4 py-3"
                    autoComplete="email"
                  />
                </Field>
              </div>
              <Field label="Telefono (opzionale)">
                <input
                  value={state.telefono}
                  onChange={(e) => update("telefono", e.target.value)}
                  className="border-linea bg-carta focus:border-bronzo w-full rounded-md border px-4 py-3"
                  autoComplete="tel"
                />
              </Field>
              <Field label="Note (opzionale)">
                <textarea
                  value={state.note}
                  onChange={(e) => update("note", e.target.value)}
                  rows={3}
                  className="border-linea bg-carta focus:border-bronzo w-full resize-y rounded-md border px-4 py-3"
                  placeholder="Raccontaci qualcosa in più sul progetto…"
                />
              </Field>
              {submitError && (
                <p className="text-errore text-sm" role="alert">
                  {submitError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="border-linea mt-10 flex items-center justify-between border-t pt-6">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
          >
            ← Indietro
          </Button>
          {step < totalSteps - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continua →
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canNext || submitting} size="lg">
              {submitting ? "Calcolo in corso…" : "Ricevi il preventivo"}
            </Button>
          )}
        </div>
      </div>

      {/* Riepilogo live */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border-linea bg-carta-2 rounded-lg border p-6">
          <p className="text-bronzo text-xs font-semibold tracking-wider uppercase">Anteprima</p>
          {preview ? (
            <div className="mt-4 space-y-3">
              {preview.pacchetti.map((p) => (
                <div
                  key={p.key}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2.5 text-sm",
                    p.inEvidenza ? "bg-bronzo/10" : "bg-carta",
                  )}
                >
                  <span
                    className={cn(
                      p.inEvidenza ? "text-inchiostro font-medium" : "text-inchiostro-60",
                    )}
                  >
                    {p.nome}
                  </span>
                  <span className="text-inchiostro nums-tabular font-medium">{euro(p.totale)}</span>
                </div>
              ))}
              <p className="text-inchiostro-40 pt-2 text-xs">
                Stima indicativa aggiornata in tempo reale. Il preventivo definitivo arriva anche
                via email.
              </p>
            </div>
          ) : (
            <p className="text-inchiostro-40 mt-4 text-sm">
              Compila i primi passi per vedere una stima immediata dei tre pacchetti.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Sotto-componenti ──────────────────────────────────────────────────────

function StepGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function OptionCard({
  selected,
  label,
  nota,
  onClick,
  checkbox = false,
}: {
  selected: boolean;
  label: string;
  nota?: string;
  onClick: () => void;
  checkbox?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "lift flex items-start gap-3 rounded-lg border p-4 text-left",
        selected ? "border-bronzo bg-bronzo/5" : "border-linea bg-carta hover:border-bronzo/50",
      )}
    >
      <span
        className={cn(
          "text-carta mt-0.5 grid size-5 shrink-0 place-items-center border",
          checkbox ? "rounded" : "rounded-full",
          selected ? "border-bronzo bg-bronzo" : "border-linea bg-carta",
        )}
        aria-hidden
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.5 5 9l4.5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>
        <span className="text-inchiostro block font-medium">{label}</span>
        {nota && <span className="text-inchiostro-40 mt-0.5 block text-sm">{nota}</span>}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-inchiostro-80 mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
