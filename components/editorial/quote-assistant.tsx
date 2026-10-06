"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { ArrowRight, Mic, MicOff, X, RotateCcw, Check, Send } from "lucide-react";
import Link from "./link";
import { BrandMark } from "./brand";
import { computeQuote, type PricingInput, type ServiceKey } from "@/lib/pricing";
import {
  TIPI_PROGETTO,
  STATI_TESTO,
  PRESET_PAROLE,
  SERVIZI,
} from "@/components/preventivo/opzioni";
import {
  projectFromText,
  stateFromText,
  wordsFromText,
  quoteWizardUrl,
} from "@/lib/quote-assistant";
import { euro } from "@/lib/format";
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((event: { results: { isFinal: boolean; [key: number]: { transcript: string } }[] }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const questions = [
  "Che tipo di libro vuoi realizzare?",
  "A che punto è il testo?",
  "Quante parole ha, o quante ne immagini?",
  "Quali servizi vuoi includere?",
  "Hai una scadenza particolare?",
];
export default function QuoteAssistant({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<Partial<PricingInput>>({
    materialAmount: "parziale",
    requestedServices: [],
    urgency: "standard",
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const w = window as SpeechWindow;
    setVoice(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recognition.current?.stop();
  }, []);
  useEffect(() => {
    if (!open) recognition.current?.stop();
  }, [open]);
  function advance(value: Partial<PricingInput>, answer: string) {
    recognition.current?.stop();
    setInput((p) => ({ ...p, ...value }));
    setHistory((h) => [...h.slice(0, step), answer]);
    setStep((s) => s + 1);
    setDraft("");
    setError("");
  }
  function send() {
    if (step === 0) {
      const type = projectFromText(draft);
      if (type) return advance({ projectType: type }, draft);
    }
    if (step === 1) {
      const state = stateFromText(draft);
      if (state) return advance({ textState: state }, draft);
    }
    if (step === 2) {
      const words = wordsFromText(draft);
      if (words) return advance({ wordCount: words }, words.toLocaleString("it-IT") + " parole");
    }
    if (step === 4) {
      if (/urgent|veloce|priorit|presto/i.test(draft))
        return advance({ urgency: "prioritaria" }, "Prioritaria");
      if (/standard|nessun|non ho|normale/i.test(draft))
        return advance({ urgency: "standard" }, "Standard");
    }
    setError(
      "Per una stima corretta, scegli una delle risposte qui sopra" +
        (step === 2
          ? " oppure scrivi il numero di parole."
          : ". Puoi modificare le scelte tornando indietro."),
    );
  }
  function dictation() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const w = window as SpeechWindow;
    const API = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!API) {
      setError(
        "La dettatura non è disponibile in questo browser. Puoi scrivere o scegliere una risposta.",
      );
      return;
    }
    const r = new API();
    r.lang = "it-IT";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      setDraft(
        Array.from(e.results)
          .map((result) => result[0]?.transcript || "")
          .join(" "),
      );
      field.current?.focus();
    };
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Il microfono non è autorizzato. Puoi continuare scrivendo."
          : "Non ho ricevuto una dettatura. Riprova o scrivi il testo.",
      );
      setListening(false);
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    setError("");
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Il microfono non è disponibile. Continua con la tastiera.");
    }
  }
  const complete = step === 5 && input.projectType && input.textState && input.wordCount;
  const result = complete ? computeQuote(input as PricingInput) : null;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="assistant-overlay" />
        <Dialog.Content
          className="proemios-public quote-dialog"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            field.current?.focus();
          }}
        >
          <div className="assistant-header">
            <BrandMark />
            <div>
              <Dialog.Title>Parliamo del tuo libro.</Dialog.Title>
              <Dialog.Description>
                Assistente guidato · nessun dato di contatto richiesto
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Chiudi assistente">
              <X size={22} />
            </Dialog.Close>
          </div>
          <div className="assistant-body">
            <div className="assistant-intro">
              Tu racconti il punto di partenza. Io ti aiuto a trovare un percorso, con una stima
              basata sui nostri listini reali.
            </div>
            <div className="assistant-history" aria-label="Le tue risposte">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setStep(i);
                    setHistory((v) => v.slice(0, i));
                    setError("");
                  }}
                  title="Modifica questa risposta"
                >
                  <Check size={13} />
                  {h}
                </button>
              ))}
            </div>
            {!result ? (
              <>
                <div className="assistant-question" aria-live="polite">
                  <span>PASSO {step + 1} DI 5</span>
                  <h2>{questions[step]}</h2>
                </div>
                <div className="assistant-choices">
                  {step === 0 &&
                    TIPI_PROGETTO.map((o) => (
                      <button
                        key={o.valore}
                        onClick={() => advance({ projectType: o.valore }, o.label)}
                      >
                        {o.label}
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  {step === 1 &&
                    STATI_TESTO.map((o) => (
                      <button
                        key={o.valore}
                        onClick={() => advance({ textState: o.valore }, o.label)}
                      >
                        {o.label}
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  {step === 2 &&
                    PRESET_PAROLE.map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          advance({ wordCount: n }, n.toLocaleString("it-IT") + " parole")
                        }
                      >
                        {n.toLocaleString("it-IT")} parole
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  {step === 3 &&
                    SERVIZI.map((o) => (
                      <button
                        key={o.valore}
                        aria-pressed={input.requestedServices?.includes(o.valore) || false}
                        onClick={() =>
                          setInput((p) => ({
                            ...p,
                            requestedServices: p.requestedServices?.includes(o.valore)
                              ? p.requestedServices.filter((s) => s !== o.valore)
                              : [...(p.requestedServices || []), o.valore as ServiceKey],
                          }))
                        }
                      >
                        {o.label}
                        {input.requestedServices?.includes(o.valore) ? (
                          <Check size={16} />
                        ) : (
                          <span>+</span>
                        )}
                      </button>
                    ))}
                  {step === 4 &&
                    ["standard", "prioritaria"].map((u) => (
                      <button
                        key={u}
                        onClick={() =>
                          advance(
                            { urgency: u as "standard" | "prioritaria" },
                            u === "standard" ? "Tempi standard" : "Tempi prioritari",
                          )
                        }
                      >
                        {u === "standard"
                          ? "Tempi standard"
                          : "Tempi prioritari · con maggiorazione"}
                        <ArrowRight size={16} />
                      </button>
                    ))}
                </div>
                {step === 3 && (
                  <button
                    className="button"
                    onClick={() =>
                      advance(
                        {},
                        input.requestedServices?.length
                          ? `${input.requestedServices.length} servizi selezionati`
                          : "Composizione proposta dal percorso",
                      )
                    }
                  >
                    Conferma i servizi <ArrowRight size={18} />
                  </button>
                )}
                {step === 2 && (
                  <p className="assistant-note">
                    Non hai ancora un testo? Scegli una lunghezza stimata. Per la scrittura useremo
                    la quantità di materiali “discreta”, da verificare con un editor.
                  </p>
                )}
                {step !== 3 && (
                  <form
                    className="assistant-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <label className="sr-only" htmlFor="assistant-input">
                      La tua risposta
                    </label>
                    <input
                      ref={field}
                      id="assistant-input"
                      value={draft}
                      maxLength={800}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={
                        step === 2
                          ? "Ad esempio: 50.000 parole"
                          : "Scrivi oppure detta la tua risposta…"
                      }
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={listening ? "Ferma dettatura" : "Detta la risposta"}
                      aria-pressed={listening}
                      onClick={dictation}
                      disabled={!voice}
                    >
                      {listening ? <MicOff /> : <Mic />}
                    </button>
                    <button
                      className="icon-button"
                      type="submit"
                      aria-label="Conferma risposta"
                      disabled={!draft.trim()}
                    >
                      <Send size={19} />
                    </button>
                  </form>
                )}
                <p className="assistant-note" role="status">
                  {listening
                    ? "Microfono attivo: parla, poi controlla il testo prima di inviarlo."
                    : voice
                      ? "La dettatura è gestita dal browser e può usare il suo servizio vocale. Si attiva solo quando premi il microfono."
                      : "Dettatura non disponibile qui: tutte le funzioni restano accessibili da tastiera."}
                </p>
              </>
            ) : (
              <div className="assistant-result">
                <span className="eyebrow">IL TUO PUNTO DI PARTENZA</span>
                <h2>Tre percorsi, una storia.</h2>
                <p>
                  Stima indicativa per {input.wordCount?.toLocaleString("it-IT")} parole. I servizi
                  richiesti sono inclusi in ogni proposta.
                </p>
                <div className="assistant-packages">
                  {result.packages.map((p) => (
                    <div key={p.tier} className={p.recommended ? "recommended" : ""}>
                      <span>{p.name}</span>
                      <strong>{euro(p.total)}</strong>
                      <small>{p.includes.join(" · ")}</small>
                    </div>
                  ))}
                </div>
                <p className="assistant-note">
                  {result.disclaimer} Nessun preventivo è stato inviato, nessuna email è partita.
                </p>
                <Link
                  className="button"
                  href={quoteWizardUrl(input as PricingInput)}
                  onClick={() => onOpenChange(false)}
                >
                  Rivedi e completa il preventivo <ArrowRight size={18} />
                </Link>
                <Link
                  className="text-link"
                  href="/contatti?motivo=editor"
                  onClick={() => onOpenChange(false)}
                >
                  Preferisco parlarne con un editor →
                </Link>
              </div>
            )}
            {error && (
              <p className="assistant-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="text-link assistant-reset"
              onClick={() => {
                recognition.current?.stop();
                setStep(0);
                setInput({
                  materialAmount: "parziale",
                  requestedServices: [],
                  urgency: "standard",
                });
                setHistory([]);
                setError("");
                setDraft("");
              }}
            >
              <RotateCcw size={14} /> Ricomincia
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
