"use client";

import { useRef, useState } from "react";
import { Pulsante } from "@/components/sito/pulsante";
import { AreaTesto, Campo } from "@/components/sito/campo";
import { useDictation } from "@/components/voice/use-dictation";
import { briefFromText } from "@/lib/quote-assistant";
import type { PricingInput } from "@/lib/pricing";
import { TIPI_PROGETTO, STATI_TESTO, SERVIZI } from "./opzioni";

/**
 * Il brief in parole proprie, scritto o dettato: `briefFromText` ne ricava
 * tipo, stato, lunghezza e servizi, e la persona li conferma nel
 * configuratore. La dettatura usa l'API del browser, solo su richiesta; il
 * testo si rilegge e si corregge prima di applicarlo. Logica identica a quella
 * della base: qui cambia solo il vestito.
 */
export function VoiceBrief({
  onApply,
  initialText = "",
}: {
  onApply: (input: Partial<PricingInput>, text: string) => void;
  initialText?: string;
}) {
  const [testo, setTesto] = useState(initialText);
  const [applicato, setApplicato] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const voce = useDictation((trascrizione) => {
    setTesto(trascrizione.slice(0, 3000));
    setApplicato(false);
    campo.current?.focus();
  });
  const input = briefFromText(testo);
  const dettagli = [
    TIPI_PROGETTO.find((o) => o.valore === input.projectType)?.label,
    STATI_TESTO.find((o) => o.valore === input.textState)?.label,
    input.wordCount ? `${input.wordCount.toLocaleString("it-IT")} parole` : undefined,
    ...(input.requestedServices || []).map((s) => SERVIZI.find((o) => o.valore === s)?.label),
  ].filter((d): d is string => Boolean(d));

  return (
    <section
      aria-labelledby="brief-titolo"
      className="mb-8 rounded-foglio border border-filetto bg-carta-ombra p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="brief-titolo" className="font-serif text-t-md text-inchiostro">
            Raccontaci il tuo libro
          </h2>
          <p className="mt-1 text-t-sm text-grafite">
            A voce o per iscritto: le risposte qui sotto si precompilano da quello che scrivi.
          </p>
        </div>
        <Pulsante
          variante="secondario"
          aria-pressed={voce.listening}
          onClick={voce.toggle}
          className="shrink-0"
        >
          <IconaMicrofono spenta={voce.listening} />
          {voce.listening ? "Ferma la dettatura" : "Detta il progetto"}
        </Pulsante>
      </div>

      <Campo id="brief-testo" label="Il tuo progetto, in due righe" className="mt-5">
        {(p) => (
          <AreaTesto
            {...p}
            ref={campo}
            rows={2}
            maxLength={3000}
            value={testo}
            onChange={(e) => {
              voce.stop();
              voce.clearError();
              setTesto(e.target.value);
              setApplicato(false);
            }}
            placeholder="Ho finito un romanzo di 50.000 parole. Vorrei editing e copertina."
          />
        )}
      </Campo>

      {dettagli.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Dettagli riconosciuti">
          {dettagli.map((d) => (
            <li
              key={d}
              className="rounded-pillola border border-filetto bg-bianco px-3 py-1 text-t-xs text-inchiostro"
            >
              {d}
            </li>
          ))}
        </ul>
      )}

      {testo.trim() && (
        <div className="mt-4">
          <Pulsante
            variante="primario"
            disabled={voce.listening}
            onClick={() => {
              voce.stop();
              onApply(input, testo.trim());
              setApplicato(true);
            }}
          >
            {applicato ? "Risposte precompilate" : "Usa queste informazioni"}
          </Pulsante>
        </div>
      )}
      {applicato && (
        <p role="status" className="mt-3 text-t-sm text-grafite">
          Controlla le scelte qui sotto: puoi cambiarle in ogni momento.
        </p>
      )}
      {voce.error && (
        <p role="alert" className="mt-3 text-t-sm text-rosso-matita">
          {voce.error}
        </p>
      )}
      <p role="status" className="mt-3 text-t-xs text-grafite">
        {voce.listening
          ? "Microfono attivo. Il testo compare qui: rileggilo prima di confermare."
          : voce.supported
            ? "La dettatura la fa il browser, che può usare il servizio vocale del suo fornitore. Il microfono si accende solo se lo chiedi."
            : "La dettatura non è disponibile in questo browser: puoi scrivere il progetto."}
      </p>
    </section>
  );
}

function IconaMicrofono({ spenta }: { spenta: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="7" y="2.5" width="6" height="9" rx="3" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5M7.5 17.5h5" />
      {spenta && <path d="M3 3l14 14" stroke="var(--color-rosso-matita)" />}
    </svg>
  );
}
