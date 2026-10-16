"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
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
  briefFromText,
  projectFromText,
  stateFromText,
  wordsFromText,
  quoteWizardUrl,
} from "@/lib/quote-assistant";
import { euro } from "@/lib/format";
import { useDictation } from "@/components/voice/use-dictation";
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
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [step, setStep] = useState(-1);
  const [input, setInput] = useState<Partial<PricingInput>>({
    materialAmount: "parziale",
    requestedServices: [],
    urgency: "standard",
  });
  const [draft, setDraft] = useState("");
  const [soloServizio, setSoloServizio] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const {
    supported: voice,
    listening,
    error: voiceError,
    toggle: dictation,
    stop,
    clearError,
  } = useDictation((text) => {
    setDraft(text.slice(0, 800));
    field.current?.focus();
  });
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);
  function advance(value: Partial<PricingInput>, answer: string) {
    stop();
    clearError();
    setInput((p) => ({ ...p, ...value }));
    setHistory((h) => [...h.slice(0, step), answer]);
    setStep((s) => s + 1);
    setDraft("");
    setError("");
  }
  function send() {
    if (step === -1) {
      const parsed = briefFromText(draft);
      const next = { ...input, ...parsed };
      stop(); clearError();setInput(next);setDraft("");setError("");
      if(next.projectType && next.textState && next.wordCount) {
        setHistory(["Brief completo: puoi rivedere i dettagli prima di inviare"]);setStep(5);
      } else {
        setHistory([]);setStep(!next.projectType ? 0 : !next.textState ? 1 : 2);
      }
      return;
    }
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
  const complete = step === 5 && input.projectType && input.textState && input.wordCount;
  const singleService = soloServizio && input.requestedServices?.length === 1 ? input.requestedServices[0] : undefined;
  const pricingInput: PricingInput | null = complete
    ? { ...(input as PricingInput), singleService, requestedServices: singleService ? [] : input.requestedServices }
    : null;
  const result = pricingInput ? computeQuote(pricingInput) : null;
  const shownPackages = result ? (singleService ? [result.packages[0]] : result.packages) : [];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="assistant-overlay" />
        <Dialog.Content
          ref={dialog}
          className="proemios-public quote-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusRef.current?.focus();
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (field.current ?? dialog.current?.querySelector<HTMLButtonElement>("button"))?.focus();
          }}
        >
          <div className="assistant-header">
            <BrandMark />
            <div>
              <Dialog.Title>Il preventivo del tuo libro.</Dialog.Title>
              <Dialog.Description>
                Racconta il progetto in un messaggio, anche a voce. Completiamo soltanto i dettagli mancanti.
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Chiudi assistente">
              <X size={22} />
            </Dialog.Close>
          </div>
          <div className="assistant-body">
            <div className="assistant-history" aria-label="Le tue risposte">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    stop();
                    clearError();
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
                  <span>{step === -1 ? "IL TUO BRIEF" : `PASSO ${step + 1} DI 5`}</span>
                  <h2>{step === -1 ? "Raccontaci il tuo libro, in una volta sola." : questions[step]}</h2>
                </div>
                {step === -1 && <p className="assistant-note">Esempio: “Ho scritto un romanzo di 50.000 parole, da revisionare. Mi servono editing, copertina e impaginazione”. Il prezzo viene sempre dal listino, non da un importo inventato dall’AI. Il campione e la capacità vanno verificati prima di confermare la consegna.</p>}
                <div className="assistant-choices">
                  {step === -1 && <button onClick={()=>setStep(0)}>Preferisco il percorso guidato <ArrowRight size={16}/></button>}
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
                  {step === 3 && (
                    <div className="assistant-mode" role="group" aria-label="Un servizio o il percorso completo">
                      <button type="button" aria-pressed={soloServizio} onClick={() => { setSoloServizio(true); setInput((p) => ({ ...p, requestedServices: (p.requestedServices || []).slice(0, 1) })); }}>
                        Solo un servizio {soloServizio && <Check size={16} />}
                      </button>
                      <button type="button" aria-pressed={!soloServizio} onClick={() => setSoloServizio(false)}>
                        Percorso completo {!soloServizio && <Check size={16} />}
                      </button>
                    </div>
                  )}
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
                              : soloServizio
                                ? [o.valore as ServiceKey]
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
                  <>
                    <p className="assistant-note">
                      {soloServizio
                        ? "Scegli la sola lavorazione che ti serve: il prezzo è quello di listino per quel servizio, senza pacchetti aggiunti."
                        : "Il percorso completo compone tre proposte con impaginazione, EPUB, pubblicazione e assistenza ISBN; i servizi che spunti sono inclusi in ognuna."}
                    </p>
                    <button
                      className="button"
                      disabled={soloServizio && !input.requestedServices?.length}
                      onClick={() =>
                        advance(
                          {},
                          input.requestedServices?.length
                            ? soloServizio
                              ? `Solo ${SERVIZI.find((o) => o.valore === input.requestedServices?.[0])?.label ?? "un servizio"}`
                              : input.requestedServices.length === 1
                                ? "1 servizio incluso nel percorso"
                                : `${input.requestedServices.length} servizi inclusi nel percorso`
                            : "Composizione proposta dal percorso",
                        )
                      }
                    >
                      Conferma i servizi <ArrowRight size={18} />
                    </button>
                  </>
                )}
                {step === 2 && input.textState === "solo-materiali" && (
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
                      onChange={(e) => {
                        stop();
                        clearError();
                        setDraft(e.target.value);
                      }}
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
                {step !== 3 && (
                  <p className="assistant-note" role="status">
                    {listening
                      ? "Microfono attivo: parla, poi controlla il testo prima di inviarlo."
                      : voice
                        ? "La dettatura è gestita dal browser e può usare il suo servizio vocale. Si attiva solo quando premi il microfono."
                        : "Dettatura non disponibile qui: tutte le funzioni restano accessibili da tastiera."}
                  </p>
                )}
              </>
            ) : (
              <div className="assistant-result">
                <span className="eyebrow">IL TUO PUNTO DI PARTENZA</span>
                <h2>{singleService ? "Solo il servizio che hai chiesto." : "Tre percorsi, una storia."}</h2>
                <p>
                  {singleService
                    ? `Prezzo di listino per ${input.wordCount?.toLocaleString("it-IT")} parole, senza servizi aggiunti.`
                    : `Stima indicativa per ${input.wordCount?.toLocaleString("it-IT")} parole. I servizi richiesti sono inclusi in ogni proposta; apri il dettaglio per vedere che cosa compone il prezzo.`}
                </p>
                <div className="assistant-packages">
                  {shownPackages.map((p) => (
                    <div key={p.tier} className={p.recommended && !singleService ? "recommended" : ""}>
                      <span>{p.name}</span>
                      <strong>{euro(p.total)}</strong>
                      <small>{p.includes.join(" · ")}</small>
                      <details className="assistant-lines">
                        <summary>Dettaglio voci</summary>
                        <ul>
                          {p.lineItems.map((li) => (
                            <li key={li.key}><span>{li.label}</span><span>{euro(li.amount)}</span></li>
                          ))}
                          {p.volumeDiscount > 0 && <li><span>Sconto volume</span><span>−{euro(p.volumeDiscount)}</span></li>}
                          {p.rushSurcharge > 0 && <li><span>Maggiorazione tempi prioritari</span><span>+{euro(p.rushSurcharge)}</span></li>}
                          {p.minimumApplied && <li><span>Minimo di progetto applicato</span><span>{euro(p.total)}</span></li>}
                        </ul>
                        <p>Importi IVA esclusa. Acconto {euro(p.deposit)} alla conferma, saldo a consegna.</p>
                      </details>
                    </div>
                  ))}
                </div>
                <p className="assistant-note">
                  {result.disclaimer} Nessun preventivo è stato inviato, nessuna email è partita.
                </p>
                <Link
                  className="button"
                  href={quoteWizardUrl(pricingInput ?? (input as PricingInput))}
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
            {(error || voiceError) && (
              <p className="assistant-error" role="alert">
                {error || voiceError}
              </p>
            )}
            <button
              className="text-link assistant-reset"
              onClick={() => {
                stop();
                clearError();
                setStep(0);
                setSoloServizio(false);
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

