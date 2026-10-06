"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, Check } from "lucide-react";
import { useDictation } from "@/components/voice/use-dictation";
import { briefFromText } from "@/lib/quote-assistant";
import type { PricingInput } from "@/lib/pricing";
import { TIPI_PROGETTO, STATI_TESTO, SERVIZI } from "./opzioni";

export function VoiceBrief({
  onApply,
  initialText = "",
}: {
  onApply: (input: Partial<PricingInput>, text: string) => void;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const [applied, setApplied] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const voice = useDictation((transcript) => {
    setText(transcript.slice(0, 3000));
    setApplied(false);
    field.current?.focus();
  });
  const input = briefFromText(text);
  const details = [
    TIPI_PROGETTO.find((o) => o.valore === input.projectType)?.label,
    STATI_TESTO.find((o) => o.valore === input.textState)?.label,
    input.wordCount ? input.wordCount.toLocaleString("it-IT") + " parole" : undefined,
    ...(input.requestedServices || []).map((s) => SERVIZI.find((o) => o.valore === s)?.label),
  ].filter(Boolean);
  return (
    <section className="voice-brief" aria-labelledby="voice-brief-title">
      <div className="voice-brief-heading">
        <div>
          <h2 id="voice-brief-title">Raccontaci il tuo libro.</h2>
          <p>A voce o per iscritto: partiamo da quello che sai già.</p>
        </div>
        <button
          type="button"
          className="voice-record"
          aria-pressed={voice.listening}
          aria-label={voice.listening ? "Ferma dettatura del progetto" : "Detta il progetto"}
          onClick={voice.toggle}
        >
          {voice.listening ? <MicOff size={23} /> : <Mic size={23} />}
          <span>{voice.listening ? "Ferma" : "Detta il progetto"}</span>
        </button>
      </div>
      <label className="sr-only" htmlFor="voice-project">
        Descrivi il tuo progetto
      </label>
      <textarea
        ref={field}
        id="voice-project"
        rows={2}
        maxLength={3000}
        value={text}
        onChange={(e) => {
          voice.stop();
          voice.clearError();
          setText(e.target.value);
          setApplied(false);
        }}
        placeholder="Ho finito un romanzo di 50.000 parole. Vorrei editing e copertina."
      />
      {details.length > 0 && (
        <div className="voice-brief-details" aria-label="Dettagli riconosciuti">
          {details.map((detail) => (
            <span key={detail}>
              <Check size={15} />
              {detail}
            </span>
          ))}
        </div>
      )}
      {text.trim() && (
        <button
          type="button"
          className="button voice-apply"
          disabled={voice.listening}
          onClick={() => {
            voice.stop();
            onApply(input, text.trim());
            setApplied(true);
          }}
        >
          {applied ? (
            <>
              <Check size={19} /> Risposte precompilate
            </>
          ) : (
            "Usa queste informazioni"
          )}
        </button>
      )}
      {applied && (
        <p role="status">Controlla le scelte qui sotto: puoi modificarle in ogni momento.</p>
      )}
      {voice.error && (
        <p className="voice-error" role="alert">
          {voice.error}
        </p>
      )}
      <p className="voice-privacy" role="status">
        {voice.listening
          ? "Microfono attivo. Il testo apparirà qui: controllalo prima di confermare."
          : voice.supported
            ? "Il browser gestisce la dettatura e può usare il suo servizio vocale. Il microfono si attiva solo su tua richiesta."
            : "Puoi scrivere il progetto. La dettatura non è disponibile in questo browser."}
      </p>
    </section>
  );
}
