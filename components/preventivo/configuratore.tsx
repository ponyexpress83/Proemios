"use client";

import { contattoPreventivoSchema } from "@/lib/validation";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, AreaTesto, Consenso } from "@/components/ui/campi";
import { Filetto, cx } from "@/components/ui/primitivi";
import { RisultatoPreventivo } from "./risultato";
import { VoiceBrief } from "./voice-brief";
import { TIPI_PROGETTO, STATI_TESTO, QUANTITA_MATERIALE, PRESET_PAROLE, SERVIZI, TEMPI } from "./opzioni";
import { computeQuote, type ProjectType, type TextState, type ServiceKey, type QuoteResult } from "@/lib/pricing";
import { FlussoAnalisi } from "@/components/analisi/flusso";
import { Report } from "@/components/analisi/report";
import type { ReportCompleto } from "@/lib/ai";
import { hasManuscript, applyAnalysisWords, type QuotePrefill } from "@/lib/quote-brief";
import { purchasePath } from "@/lib/platform/commercial";
import { countWords, wordsFromFile } from "@/lib/word-count";
import type { MaterialAmount } from "@/config/pricing";
import { UI } from "@/config/copy";
import { euro, numero } from "@/lib/format";

interface Stato {
  tipo: ProjectType | null;
  statoTesto: TextState | null;
  parole: number;
  materiale: MaterialAmount;
  servizi: ServiceKey[];
  soloServizio: boolean;
  tempi: "standard" | "prioritaria";
  nome: string;
  email: string;
  telefono: string;
  ricontatto: boolean;
  note: string;
  consensoPrivacy: boolean;
  consensoMarketing: boolean;
}
type Question = "tipo" | "testo" | "dimensione" | "servizi" | "tempi";
const QUESTIONS: Question[] = ["tipo", "testo", "dimensione", "servizi", "tempi"];
const TITLES: Record<Question, string> = {
  tipo: "Che tipo di libro vuoi realizzare?",
  testo: "A che punto è il testo?",
  dimensione: "Quanto sarà lungo il libro?",
  servizi: "Di quali servizi hai bisogno?",
  tempi: "Hai una scadenza?",
};
const MOMENTS = ["Il tuo progetto", "La tua proposta", "Conferma"] as const;
function track(name: string, quoteId?: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;
    void fetch("/api/eventi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...(quoteId ? { quoteId } : {}) }), keepalive: true }).catch(() => {});
  } catch {
    /* la misurazione non deve mai bloccare il percorso */
  }
}
/**
 * Il preventivatore in tre momenti: il progetto (domande progressive, solo
 * quelle senza risposta), la proposta (stima dal listino e contatti), la
 * conferma (sulla piattaforma, o la richiesta di valutazione al team).
 * Le risposte già date, dall'assistente o da una pagina servizio, restano
 * modificabili e non si chiedono due volte. Importi e acquistabilità li
 * decide sempre il server.
 */
export function Configuratore({ precompilato, demoMode = false, retention = 30 }: { demoMode?: boolean; retention?: number; precompilato?: QuotePrefill }) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<ReportCompleto | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [answered, setAnswered] = useState<Set<Question>>(() => {
    const set = new Set<Question>();
    if (precompilato?.tipo) set.add("tipo");
    if (precompilato?.statoTesto || precompilato?.tipo === "memoir" || precompilato?.tipo === "solo-grafica") set.add("testo");
    if (precompilato?.parole) set.add("dimensione");
    if (precompilato?.servizi?.length) set.add("servizi");
    if (precompilato?.tempi) set.add("tempi");
    return set;
  });
  const [editing, setEditing] = useState<Question | null>(null);
  const [atProposal, setAtProposal] = useState(false);
  const question = useRef<HTMLHeadingElement>(null);
  const submissionKey = useRef<string | null>(null);
  const started = useRef(false);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [trap, setTrap] = useState("");
  const [pasted, setPasted] = useState("");
  const [countNote, setCountNote] = useState("");
  const [risultato, setRisultato] = useState<{ esito: QuoteResult; quoteId: string; demo: boolean; commercialState: "estimate" | "offer"; expiresAt: string | null } | null>(null);
  const [s, setS] = useState<Stato>({
    tipo: precompilato?.tipo ?? null,
    statoTesto: precompilato?.statoTesto ?? (precompilato?.tipo === "memoir" ? "solo-materiali" : precompilato?.tipo === "solo-grafica" ? "finito-revisionato" : null),
    parole: precompilato?.parole ?? 50_000,
    materiale: precompilato?.materiale ?? "parziale",
    servizi: precompilato?.servizi ?? [],
    soloServizio: precompilato?.soloServizio ?? Boolean(precompilato?.servizi?.length === 1),
    tempi: precompilato?.tempi ?? "standard",
    nome: "",
    email: "",
    telefono: "",
    ricontatto: false,
    note: precompilato?.contesto ?? "",
    consensoPrivacy: false,
    consensoMarketing: false,
  });
  function agg<K extends keyof Stato>(k: K, v: Stato[K]) {
    setS((prec) => ({ ...prec, [k]: v }));
    setFieldErrors((e) => ({ ...e, [k]: "" }));
  }
  const soloMateriali = s.statoTesto === "solo-materiali";
  const manuscript = s.tipo && s.statoTesto ? hasManuscript({ projectType: s.tipo, textState: s.statoTesto }) : false;
  const soloGrafica = s.tipo === "solo-grafica";
  const pricingInput = useMemo(() => (s.tipo && s.statoTesto && s.parole >= 1 ? {
    projectType: s.tipo,
    textState: s.statoTesto,
    wordCount: s.parole,
    materialAmount: soloMateriali ? s.materiale : undefined,
    requestedServices: s.soloServizio ? [] : s.servizi,
    singleService: s.soloServizio && s.servizi.length === 1 ? s.servizi[0] : undefined,
    urgency: s.tempi,
  } : null), [s, soloMateriali]);
  // Anteprima calcolata in locale: stesso motore puro del server, mai un prezzo inventato.
  const anteprima: QuoteResult | null = useMemo(() => {
    if (!pricingInput) return null;
    try { return computeQuote(pricingInput); } catch { return null; }
  }, [pricingInput]);
  const firstMissing = QUESTIONS.find((q) => !answered.has(q)) ?? null;
  const current: Question | null = editing ?? (atProposal ? null : firstMissing);
  const moment = risultato ? 3 : current ? 1 : 2;
  const stepIndex = current ? QUESTIONS.indexOf(current) : QUESTIONS.length;
  useEffect(() => {
    if (!started.current) { started.current = true; track("quote_started"); }
  }, []);
  useEffect(() => {
    if (moment === 2 && !risultato) track("estimate_viewed");
  }, [moment, risultato]);
  const previousKey = useRef<string>("");
  useEffect(() => {
    const key = `${moment}:${current ?? "proposta"}`;
    if (previousKey.current === key) return;
    previousKey.current = key;
    question.current?.focus({ preventScroll: true });
    question.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [moment, current]);
  const valid = (q: Question): boolean => {
    switch (q) {
      case "tipo": return s.tipo !== null;
      case "testo": return s.statoTesto !== null;
      case "dimensione": return Number.isInteger(s.parole) && s.parole > 0 && s.parole <= 2_000_000;
      case "servizi": return !s.soloServizio || s.servizi.length === 1;
      case "tempi": return true;
    }
  };
  function answer(q: Question) {
    setAnswered((prev) => new Set(prev).add(q));
    setEditing(null);
    setErrore("");
  }
  function back() {
    if (current) {
      const index = QUESTIONS.indexOf(current);
      if (index > 0) { const prev = QUESTIONS[index - 1]!; setAnswered((set) => { const next = new Set(set); next.delete(prev); return next; }); setEditing(null); }
      return;
    }
    // Dalla proposta si torna all'ultima domanda, senza perdere niente.
    setAtProposal(false);
    setEditing("tempi");
  }
  const chips = QUESTIONS.filter((q) => answered.has(q) && q !== current).map((q) => ({
    q,
    label: q === "tipo" ? TIPI_PROGETTO.find((o) => o.valore === s.tipo)?.label : q === "testo" ? STATI_TESTO.find((o) => o.valore === s.statoTesto)?.label : q === "dimensione" ? `${numero(s.parole)} parole` : q === "servizi" ? (s.servizi.length ? `${s.soloServizio ? "Solo " : ""}${s.servizi.map((k) => SERVIZI.find((o) => o.valore === k)?.label).filter(Boolean).join(", ")}` : "Servizi dal percorso") : TEMPI.find((o) => o.valore === s.tempi)?.label,
  }));
  const pathKind = pricingInput ? purchasePath(pricingInput) : null;
  async function countFile(file: File | undefined) {
    if (!file) return;
    setCountNote("");
    try {
      const result = await wordsFromFile(file);
      agg("parole", result.words);
      setCountNote(`${numero(result.words)} parole contate nel browser (${result.method.toUpperCase()}). Il file non è stato inviato.`);
    } catch (e) {
      setCountNote(e instanceof Error ? e.message : "Conteggio non riuscito: indica il numero a mano.");
    }
  }
  async function calcola() {
    if (!pricingInput) return;
    const validation = contattoPreventivoSchema.safeParse(s);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors);
      setErrore("Controlla i campi evidenziati: nome, email e consenso privacy sono necessari.");
      const first = validation.error.issues[0]?.path[0];
      document.getElementById(first === "nome" ? "pv-nome" : first === "email" ? "pv-email" : "pv-privacy")?.focus();
      return;
    }
    setFieldErrors({});
    setInvio(true);
    setErrore("");
    try {
      submissionKey.current ??= crypto.randomUUID();
      const ref = new URL(window.location.href).searchParams.get("ref");
      const res = await fetch("/api/preventivo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": submissionKey.current },
        body: JSON.stringify({
          sito: trap,
          ...(ref && /^[a-z0-9]{16}$/.test(ref) ? { ref } : {}),
          input: pricingInput,
          contatto: { nome: s.nome, email: s.email, telefono: s.telefono, note: s.note, consensoPrivacy: s.consensoPrivacy, consensoMarketing: s.consensoMarketing, ricontatto: s.ricontatto && Boolean(s.telefono.trim()) },
        }),
      });
      const dati = (await res.json()) as { quoteId?: string; demo?: boolean; preventivo?: QuoteResult; errore?: string; commercialState?: "estimate" | "offer"; expiresAt?: string | null };
      if (!res.ok || !dati.quoteId || !dati.preventivo) throw new Error(dati.errore ?? UI.erroreGenerico);
      setRisultato({ esito: dati.preventivo, quoteId: dati.quoteId, demo: dati.demo === true, commercialState: dati.commercialState ?? "estimate", expiresAt: dati.expiresAt ?? null });
      track("proposal_viewed", dati.quoteId);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
    } finally {
      setInvio(false);
    }
  }
  const progress = (
    <div className="mb-8" aria-label="Avanzamento">
      <ol className="quote-moments" aria-label="I tre momenti del preventivo">
        {MOMENTS.map((m, i) => <li key={m} aria-current={moment === i + 1 ? "step" : undefined} className={moment > i + 1 ? "done" : moment === i + 1 ? "current" : ""}><span>{i + 1}</span>{m}</li>)}
      </ol>
      {moment === 1 && (
        <>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="apparato text-ottone">{UI.passo} {stepIndex + 1} {UI.di} {QUESTIONS.length}</span>
            <span className="apparato text-stampa">{current ? ({ tipo: "Progetto", testo: "Testo", dimensione: "Dimensione", servizi: "Servizi", tempi: "Tempi" })[current] : ""}</span>
          </div>
          <div className="bg-filetto-notte mt-3 h-px w-full"><div className="bg-ottone h-px transition-all duration-300" style={{ width: `${((stepIndex + 1) / QUESTIONS.length) * 100}%` }} /></div>
        </>
      )}
      {chips.length > 0 && (
        <div className="quote-chips mt-4" aria-label="Le tue risposte">
          {chips.map((c) => <button type="button" key={c.q} onClick={() => { setAtProposal(false); setEditing(c.q); }} title="Modifica questa risposta">{c.label} <span aria-hidden="true">✎</span><span className="sr-only">, modifica</span></button>)}
        </div>
      )}
    </div>
  );

  // ── Momento 3: proposta salvata ───────────────────────────────────────
  if (risultato) {
    return (
      <div>
        {progress}
        <div className="mb-10">
          <p className="apparato text-ottone">{risultato.commercialState === "offer" ? "Proposta acquistabile" : "Stima indicativa"}</p>
          <h2 className="font-display text-inchiostro mt-3 text-3xl font-medium">
            {new Set(risultato.esito.packages.map((p) => p.tier)).size === 1 ? "La proposta per il tuo servizio" : "Tre modi di fare questo libro"}
          </h2>
          <p className="prosa text-stampa mt-3 max-w-2xl">
            {risultato.demo
              ? "Questo è un preventivo dimostrativo: nessuna email è stata inviata e nessun pagamento viene addebitato."
              : risultato.commercialState === "offer"
                ? "Prezzo e condizioni sono quelli di listino per questo servizio: puoi confermare e pagare l'acconto dopo aver creato l'account."
                : "È una stima dal listino sui dati inseriti. Per renderla definitiva il team verifica il progetto: lo chiedi con un clic dalla tua area, dopo aver creato l'account."}
          </p>
        </div>
        <RisultatoPreventivo esito={risultato.esito} quoteId={risultato.quoteId} commercialState={risultato.commercialState} expiresAt={risultato.expiresAt} demo={risultato.demo} />
      </div>
    );
  }

  // ── Momento 2: la proposta ────────────────────────────────────────────
  if (!current) {
    return (
      <div className="quote-wizard grid gap-10 lg:grid-cols-[1.7fr_1fr]">
        <div>
          {progress}
          <h2 ref={question} tabIndex={-1} className="wizard-question">La tua proposta</h2>
          {anteprima ? (
            <>
              <p className="glossa text-stampa mb-4">
                {pathKind === "standard"
                  ? "Servizio singolo con prezzo di listino: la proposta è coerente con quanto hai scelto, senza servizi aggiunti."
                  : pathKind === "complex"
                    ? "Per questo progetto il team costruisce con te una proposta per fasi: questa è una stima di partenza."
                    : "Stima dal listino per i dati inseriti. Dopo la verifica del testo il team la conferma: se il lavoro è meno di quanto stimato, il prezzo scende."}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {anteprima.packages.filter((p, i, all) => all.findIndex((o) => o.tier === p.tier) === i).map((p) => (
                  <div key={p.tier} className={cx("rounded-scheda border p-5", p.recommended ? "border-ottone bg-carta-alta" : "border-filetto bg-carta-alta")}>
                    <p className="font-display text-inchiostro text-xl">{p.name}</p>
                    <p className="cifre text-inchiostro mt-2 text-2xl">{euro(p.total)}</p>
                    <p className="apparato text-stampa mt-1">acconto {euro(p.deposit)} · IVA esclusa</p>
                    <ul className="mt-3 space-y-1">{p.lineItems.map((li) => <li key={li.key} className="font-lettura text-stampa text-sm">{li.label}</li>)}</ul>
                  </div>
                ))}
              </div>
              <p className="glossa text-stampa mt-3">{anteprima.disclaimer}</p>
            </>
          ) : (
            <p className="prosa text-stampa">Completa le risposte per vedere la stima.</p>
          )}
          <Filetto className="my-8" tono="carta" />
          <h3 className="font-display text-inchiostro text-xl">Salva la proposta e continua</h3>
          <p className="glossa text-stampa mt-1 mb-5">Ti scriviamo per ritrovarla quando vuoi. Il telefono è facoltativo: ti chiamiamo solo se lo chiedi.</p>
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo id="pv-nome" label="Nome" obbligatorio errore={fieldErrors.nome}>{(p) => <Input {...p} tono="carta" value={s.nome} onChange={(e) => agg("nome", e.target.value)} autoComplete="name" />}</Campo>
              <Campo id="pv-email" label="Email" obbligatorio errore={fieldErrors.email}>{(p) => <Input {...p} tono="carta" type="email" value={s.email} onChange={(e) => agg("email", e.target.value)} autoComplete="email" />}</Campo>
            </div>
            <Campo id="pv-tel" label="Telefono" hint="Facoltativo" errore={fieldErrors.telefono}>{(p) => <Input {...p} tono="carta" type="tel" value={s.telefono} onChange={(e) => agg("telefono", e.target.value)} autoComplete="tel" />}</Campo>
            <Consenso id="pv-ricontatto" name="ricontatto" checked={s.ricontatto} onChange={(v) => agg("ricontatto", v)} tono="carta">Vorrei essere ricontattato al telefono dal team.</Consenso>
            <Campo id="pv-note" label="Qualcosa che dovremmo sapere" hint="Facoltativo">{(p) => <AreaTesto {...p} tono="carta" rows={3} value={s.note} onChange={(e) => agg("note", e.target.value)} />}</Campo>
            <div className="hidden" aria-hidden="true"><label htmlFor="pv-sito">Non compilare</label><input id="pv-sito" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></div>
            <Filetto tono="carta" />
            <Consenso id="pv-privacy" name="consensoPrivacy" checked={s.consensoPrivacy} onChange={(v) => agg("consensoPrivacy", v)} tono="carta">Ho letto la <Link href={"/privacy" as Route} className="hover:text-ottone underline">privacy policy</Link> e acconsento al trattamento dei dati per ricevere il preventivo. *</Consenso>
            {fieldErrors.consensoPrivacy && <p className="field-error" role="alert">{fieldErrors.consensoPrivacy}</p>}
            <Consenso id="pv-marketing" name="consensoMarketing" checked={s.consensoMarketing} onChange={(v) => agg("consensoMarketing", v)} tono="carta">Voglio ricevere anche le guide sull&rsquo;autopubblicazione. Facoltativo, niente spam.</Consenso>
            {errore && <p className="text-ottone text-sm" role="alert">{errore}</p>}
          </div>
          <div className="border-filetto mt-10 flex items-center justify-between border-t pt-6">
            <Bottone variante="secondario" misura="grande" onClick={back} disabled={invio}>← {UI.indietro}</Bottone>
            <Bottone variante="primario" misura="grande" onClick={calcola} disabled={invio || !anteprima}>{invio ? UI.caricamento : "Salva la proposta e continua →"}</Bottone>
          </div>
        </div>
        <Riepilogo anteprima={anteprima} demoMode={demoMode} manuscript={manuscript} statoTesto={s.statoTesto} />
      </div>
    );
  }

  // ── Momento 1: il progetto, una domanda alla volta ────────────────────
  return (
    <div className="quote-wizard grid gap-10 lg:grid-cols-[1.7fr_1fr]">
      <div>
        {current === "tipo" && (
          <VoiceBrief
            initialText={s.note}
            onApply={(input, text) => {
              setS((prev) => ({ ...prev, tipo: input.projectType ?? prev.tipo, statoTesto: input.textState ?? prev.statoTesto, parole: input.wordCount ?? prev.parole, servizi: [...new Set([...prev.servizi, ...(input.requestedServices || [])])], note: text }));
              setAnswered((prev) => { const next = new Set(prev); if (input.projectType) next.add("tipo"); if (input.textState) next.add("testo"); if (input.wordCount) next.add("dimensione"); if (input.requestedServices?.length) next.add("servizi"); return next; });
            }}
          />
        )}
        {progress}
        <div className="min-h-[22rem]">
          <h2 ref={question} tabIndex={-1} className="wizard-question">{TITLES[current]}</h2>
          {current === "tipo" && (
            <Griglia>{TIPI_PROGETTO.map((o) => <Opzione key={o.valore} scelta={s.tipo === o.valore} label={o.label} nota={o.nota} onClick={() => { agg("tipo", o.valore); if (o.valore === "memoir" && !s.statoTesto) { agg("statoTesto", "solo-materiali"); } if (o.valore === "solo-grafica") agg("statoTesto", "finito-revisionato"); }} />)}</Griglia>
          )}
          {current === "testo" && (
            <Griglia>{STATI_TESTO.map((o) => <Opzione key={o.valore} scelta={s.statoTesto === o.valore} label={o.label} nota={o.nota} onClick={() => agg("statoTesto", o.valore)} />)}</Griglia>
          )}
          {current === "dimensione" && (
            <div>
              <p className="font-display text-inchiostro text-xl">{soloMateriali ? "Quanto lungo pensi debba essere il libro finito?" : "Quante parole ha il testo?"}</p>
              <p className="glossa text-stampa mt-2">{soloMateriali ? "Una stima basta: la definiamo insieme guardando il materiale." : "Scegli una fascia, scrivi il numero, oppure lascia contare al browser: il testo non viene inviato a nessuno."}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {PRESET_PAROLE.map((p) => <button key={p} type="button" onClick={() => agg("parole", p)} aria-pressed={s.parole === p} className={cx("garbo cifre rounded-campo border px-4 py-2 text-sm", s.parole === p ? "border-ottone bg-ottone/15 text-inchiostro" : "border-filetto text-stampa hover:border-ottone")}>{numero(p)}</button>)}
              </div>
              <div className="mt-5 max-w-xs">
                <Campo id="parole" label="Oppure indica il numero preciso">{(p) => <Input {...p} tono="carta" type="number" inputMode="numeric" min={1} max={2_000_000} step={1} value={s.parole || ""} onChange={(e) => agg("parole", Number(e.target.value))} className="cifre text-lg" />}</Campo>
              </div>
              {manuscript && (
                <details className="quote-count mt-6">
                  <summary>Conta le parole dal testo o dal file</summary>
                  <div className="mt-4 space-y-4">
                    <Campo id="pv-incolla" label="Incolla il testo" hint="Resta nel tuo browser: serve solo a contare.">{(p) => <AreaTesto {...p} tono="carta" rows={4} value={pasted} onChange={(e) => { setPasted(e.target.value); const n = countWords(e.target.value); if (n > 0) { agg("parole", n); setCountNote(`${numero(n)} parole nel testo incollato.`); } }} />}</Campo>
                    <Campo id="pv-file" label="Oppure scegli un file TXT o DOCX" hint="I PDF non si leggono qui: incolla il testo o scrivi il numero.">{(p) => <input {...p} type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="block w-full text-sm" onChange={(e) => countFile(e.target.files?.[0])} />}</Campo>
                    {countNote && <p className="glossa text-stampa" role="status">{countNote}</p>}
                  </div>
                </details>
              )}
              {manuscript && (
                <div className="optional-analysis-step mt-8">
                  <p>Vuoi una prima valutazione del manoscritto? È facoltativa e distinta dal conteggio: metriche del testo e una prima indicazione automatica degli interventi. Richiede nome, email e presa visione della privacy.</p>
                  {!analysisOpen && !analysisReport && <Bottone variante="secondario" className="mt-3" onClick={() => setAnalysisOpen(true)}>Aggiungi la valutazione facoltativa</Bottone>}
                  {analysisReport ? (
                    <>
                      <div className="analysis-count-choice">
                        <button className="button secondary" onClick={() => setS((prev) => applyAnalysisWords(prev, analysisReport.metriche.parole))}>Usa il conteggio del report</button>
                        <span>{numero(analysisReport.metriche.parole)} parole: applica solo se il file è completo.</span>
                      </div>
                      <Report report={analysisReport} demo={demoMode} onContinue={() => answer("dimensione")} />
                    </>
                  ) : analysisOpen && <FlussoAnalisi giorniConservazione={retention} demoMode={demoMode} onComplete={setAnalysisReport} onBusyChange={setAnalysisBusy} onContinue={() => answer("dimensione")} />}
                </div>
              )}
              {soloMateriali && (
                <div className="mt-8">
                  <p className="font-display text-inchiostro text-lg">Quanto materiale hai già?</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">{QUANTITA_MATERIALE.map((o) => <Opzione key={o.valore} scelta={s.materiale === o.valore} label={o.label} nota={o.nota} onClick={() => agg("materiale", o.valore)} />)}</div>
                </div>
              )}
            </div>
          )}
          {current === "servizi" && (
            <div>
              <p className="glossa text-stampa mb-5">{soloGrafica ? "Per la sola grafica contano copertina, impaginazione ed EPUB." : "Un solo servizio, senza pacchetti aggiunti, oppure un percorso completo."}</p>
              <div className="mb-5 flex flex-wrap gap-3" role="group" aria-label="Tipo di richiesta">
                <button type="button" aria-pressed={s.soloServizio} className={s.soloServizio ? "rounded-xl border border-[#f16650] bg-[#fff0eb] px-4 py-3" : "rounded-xl border px-4 py-3"} onClick={() => setS((prev) => ({ ...prev, soloServizio: true, servizi: prev.servizi.slice(0, 1) }))}>Solo un servizio</button>
                <button type="button" aria-pressed={!s.soloServizio} className={!s.soloServizio ? "rounded-xl border border-[#f16650] bg-[#fff0eb] px-4 py-3" : "rounded-xl border px-4 py-3"} onClick={() => setS((prev) => ({ ...prev, soloServizio: false }))}>Percorso completo</button>
              </div>
              <Griglia>{SERVIZI.map((o) => <Opzione key={o.valore} scelta={s.servizi.includes(o.valore)} label={o.label} nota={o.nota} casella onClick={() => agg("servizi", s.servizi.includes(o.valore) ? s.servizi.filter((x) => x !== o.valore) : s.soloServizio ? [o.valore] : [...s.servizi, o.valore])} />)}</Griglia>
            </div>
          )}
          {current === "tempi" && (
            <Griglia>{TEMPI.map((o) => <Opzione key={o.valore} scelta={s.tempi === o.valore} label={o.label} nota={o.nota} onClick={() => agg("tempi", o.valore)} />)}</Griglia>
          )}
        </div>
        <div className="border-filetto mt-10 flex items-center justify-between border-t pt-6">
          <Bottone variante="secondario" misura="grande" onClick={back} disabled={(stepIndex === 0 && !editing) || invio || analysisBusy}>← {UI.indietro}</Bottone>
          <Bottone variante="primario" misura="grande" onClick={() => answer(current)} disabled={!valid(current) || analysisBusy}>{editing && firstMissing === null ? "Salva la modifica →" : `${UI.avanti} →`}</Bottone>
        </div>
      </div>
      <Riepilogo anteprima={anteprima} demoMode={demoMode} manuscript={manuscript} statoTesto={s.statoTesto} />
    </div>
  );
}

function Riepilogo({ anteprima, demoMode, manuscript, statoTesto }: { anteprima: QuoteResult | null; demoMode: boolean; manuscript: boolean; statoTesto: TextState | null }) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-scheda border-filetto bg-carta-alta border p-6">
        <p className="apparato text-ottone">La tua stima anonima</p>
        <p className="glossa text-stampa">Indicativa, senza upload né dati personali. Il prezzo definitivo si conferma con il team.</p>
        {!manuscript && statoTesto && <p className="glossa text-stampa mt-3">Parti da materiali o da un’idea: non ti chiediamo un manoscritto.</p>}
        {anteprima ? (
          <>
            <div className="mt-4 space-y-2">
              {anteprima.packages.filter((p, i, all) => all.findIndex((o) => o.tier === p.tier) === i).map((p) => (
                <div key={p.tier} className={cx("flex items-baseline justify-between gap-3 rounded-[2px] px-3 py-2.5", p.recommended ? "bg-ottone/15" : "bg-carta")}>
                  <span className={cx("font-ui text-sm", p.recommended ? "text-inchiostro" : "text-stampa")}>{p.name}</span>
                  <span className="cifre text-inchiostro text-sm">{euro(p.total)}</span>
                </div>
              ))}
            </div>
            <button type="button" className="text-link" onClick={() => {
              const text = `PROEMIOS — STIMA INDICATIVA${demoMode ? " DEMO" : ""}\n${anteprima.wordCount} parole\n\n` + anteprima.packages.map((p) => `${p.name}: ${euro(p.total)}\n${p.includes.join(", ")}`).join("\n\n") + "\n\n" + anteprima.disclaimer;
              const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
              const a = document.createElement("a"); a.href = url; a.download = "proemios-riepilogo-stima.txt"; a.click(); URL.revokeObjectURL(url);
            }}>Scarica la stima, senza dati personali →</button>
            <Filetto className="my-4" tono="carta" />
            <dl className="flex justify-between text-xs"><dt className="apparato text-stampa">Pagine stimate</dt><dd className="cifre text-stampa">{numero(anteprima.estimatedPages)}</dd></dl>
            <p className="glossa text-stampa mt-4">{demoMode ? "Stima dimostrativa: nessuna email sarà inviata. Usa dati di prova per completare il percorso." : "Si aggiorna mentre rispondi. Le proposte saranno verificate con il team prima di definire il lavoro."}</p>
          </>
        ) : (
          <p className="prosa text-stampa mt-4 text-sm">Rispondi alle prime domande e qui compaiono i percorsi con il prezzo.</p>
        )}
      </div>
    </aside>
  );
}

// ── Sotto-componenti ──────────────────────────────────────────────────────

function Griglia({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Opzione({ scelta, label, nota, onClick, casella = false }: { scelta: boolean; label: string; nota?: string; onClick: () => void; casella?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={scelta} className={cx("garbo rounded-scheda flex items-start gap-3 border p-4 text-left", scelta ? "border-ottone bg-ottone/10" : "border-filetto bg-carta-alta hover:border-ottone/50")}>
      <span className={cx("text-notte mt-0.5 grid size-4 shrink-0 place-items-center border", casella ? "rounded-[2px]" : "rounded-full", scelta ? "border-ottone bg-ottone" : "border-filetto-forte")} aria-hidden>
        {scelta && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.2 4 7.2l4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span>
        <span className="font-ui text-inchiostro block text-[0.95rem] font-medium">{label}</span>
        {nota && <span className="font-lettura text-stampa mt-0.5 block text-sm">{nota}</span>}
      </span>
    </button>
  );
}
