"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, Consenso } from "@/components/ui/campi";
import { Filetto, cx } from "@/components/ui/primitivi";
import { FileNotice } from "./file-notice";
import { Report } from "./report";
import { ANALISI, UI } from "@/config/copy";
import type { ReportCompleto } from "@/lib/ai";

type Stato = "attesa" | "analisi" | "fatto" | "errore";

export function FlussoAnalisi({
  giorniConservazione,
  demoMode = false,
  onComplete,
  onContinue,
  onBusyChange,
}: {
  giorniConservazione: number;
  demoMode?: boolean;
  onComplete?: (report: ReportCompleto) => void;
  onContinue?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const controller = useRef<AbortController | null>(null);
  const operationKey = useRef<string | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      onBusyChange?.(false);
    },
    [onBusyChange],
  );
  const [stato, setStato] = useState<Stato>("attesa");
  const [errore, setErrore] = useState("");
  const [report, setReport] = useState<ReportCompleto | null>(null);
  const [demo, setDemo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nomeFile, setNomeFile] = useState("");
  const [consenso, setConsenso] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("jobId");
    if (!id || demoMode) return;
    const abort = new AbortController();
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/analisi?jobId=${encodeURIComponent(id!)}`, { signal: abort.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.errore ?? UI.erroreGenerico);
        if (cancelled) return;
        if (result.report) { setReport(result.report); setStato("fatto"); }
        else { setStato("errore"); setErrore(result.errore ?? "L’analisi è ancora in lavorazione. Aggiorna questa pagina per consultarne lo stato."); }
      } catch (error) { if (!cancelled) { setStato("errore"); setErrore(error instanceof Error ? error.message : UI.erroreGenerico); } }
    }
    void load();
    return () => { cancelled = true; abort.abort(); };
  }, [demoMode]);

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore("");

    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = selectedFile ?? fd.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setErrore("Scegli un file da analizzare.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrore("Il file supera 4 MB. Carica un estratto più breve del testo.");
      return;
    }
    if (!/\.(docx|pdf|txt)$/i.test(file.name)) {
      setErrore("Formato non supportato. Usa DOCX, PDF o TXT.");
      return;
    }
    fd.set("file", file);
    if (!consenso) {
      setErrore(UI.consensoRichiesto);
      return;
    }

    fd.set("consensoPrivacy", String(consenso));
    fd.set("consensoMarketing", String(marketing));

    operationKey.current ??= crypto.randomUUID();
    setStato("analisi");
    onBusyChange?.(true);
    controller.current = new AbortController();
    try {
      const res = await fetch("/api/analisi", {
        method: "POST",
        body: fd,
        headers: { "Idempotency-Key": operationKey.current },
        signal: controller.current.signal,
      });
      if (res.status === 413)
        throw new Error("Il file è troppo grande. Usa un estratto fino a 4 MB.");
      if (!res.headers.get("content-type")?.includes("application/json"))
        throw new Error("Il servizio non è disponibile. Riprova tra poco.");
      let dati = (await res.json()) as {
        jobId?: string;
        status?: string;
        report?: ReportCompleto;
        errore?: string;
        demo?: boolean;
      };
      if (!res.ok) throw new Error(dati.errore ?? UI.erroreGenerico);
      for (let i = 0; !dati.report && dati.jobId && dati.status !== "failed" && i < 45; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const polling = await fetch(`/api/analisi?jobId=${encodeURIComponent(dati.jobId)}`, { signal: controller.current.signal, cache: "no-store" });
        const update = await polling.json();
        if (!polling.ok) throw new Error(update.errore ?? UI.erroreGenerico);
        dati = update;
      }
      if (!dati.report) throw new Error(dati.errore ?? "L’analisi è ancora in lavorazione. Il riferimento è conservato nel tuo account; riceverai una notifica quando il report sarà pronto.");
      setReport(dati.report);
      onComplete?.(dati.report);
      setDemo(dati.demo === true);
      setStato("fatto");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setStato("errore");
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
    } finally {
      onBusyChange?.(false);
    }
  }

  if (stato === "fatto" && report) {
    return <Report report={report} demo={demo} onContinue={onContinue} />;
  }

  const inCorso = stato === "analisi";

  return (
    <div className="mx-auto max-w-2xl">
      <FileNotice demo={demoMode} retention={giorniConservazione} />
      <form
        onSubmit={invia}
        className="rounded-scheda border-filetto bg-carta-alta border p-6 sm:p-8"
        noValidate
      >
        {/* Caricamento */}
        <label
          htmlFor="an-file"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (inCorso) return;
            const f = e.dataTransfer.files[0];
            if (f) {
              setSelectedFile(f);
              operationKey.current = null;
              setNomeFile(f.name);
              setErrore("");
            }
          }}
          className={cx(
            "garbo rounded-scheda flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-12 text-center",
            nomeFile ? "border-ottone bg-ottone/5" : "border-filetto hover:border-ottone",
            inCorso && "pointer-events-none opacity-60",
          )}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            className="text-ottone"
            aria-hidden
          >
            <path
              d="M14 18V5m0 0-4.5 4.5M14 5l4.5 4.5M5 20v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-ui text-inchiostro mt-4 text-[0.95rem] font-medium">
            {nomeFile || "Scegli il file o trascinalo qui"}
          </span>
          <span className="apparato text-stampa mt-2">{ANALISI.formati}</span>
          <input
            id="an-file"
            aria-label="File del manoscritto"
            disabled={inCorso}
            type="file"
            name="file"
            accept=".docx,.pdf,.txt"
            required
            className="sr-only"
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] ?? null);
              operationKey.current = null;
              setNomeFile(e.target.files?.[0]?.name ?? "");
              setErrore("");
            }}
          />
        </label>

        <Filetto className="my-7" tono="carta" />

        {/* Email gate */}
        <p className="apparato text-ottone">
          {demoMode ? "Dati di prova per il report demo" : ANALISI.gateTitolo}
        </p>
        <p className="prosa text-stampa mt-2 text-sm">
          {demoMode
            ? "Il report di esempio compare qui: nessuna email sarà inviata. Usa nome ed email di prova."
            : "Per usare l’analisi accedi con un account verificato e usa lo stesso indirizzo email. Il report non sostituisce il confronto con un editor."}
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Campo id="an-nome" label="Nome" obbligatorio>
            {(p) => (
              <Input {...p} tono="carta" name="nome" required minLength={2} autoComplete="name" />
            )}
          </Campo>
          <Campo id="an-email" label="Email" obbligatorio>
            {(p) => (
              <Input {...p} tono="carta" name="email" type="email" required autoComplete="email" />
            )}
          </Campo>
        </div>

        <div className="mt-5 space-y-3">
          <Consenso
            id="an-privacy"
            name="consensoPrivacy"
            checked={consenso}
            onChange={setConsenso}
            tono="carta"
          >
            Ho letto la{" "}
            <Link href={"/privacy" as Route} className="hover:text-ottone underline">
              privacy policy
            </Link>{" "}
            e acconsento al trattamento dei dati per ricevere il report. *
          </Consenso>
          <Consenso
            id="an-marketing"
            name="consensoMarketing"
            checked={marketing}
            onChange={setMarketing}
            tono="carta"
          >
            Mandatemi anche le guide sull&rsquo;autopubblicazione. Facoltativo.
          </Consenso>
        </div>

        {errore && (
          <p className="font-lettura text-ottone mt-5 text-sm leading-relaxed" role="alert">
            {errore}
          </p>
        )}

        <Bottone
          type="submit"
          variante="primario"
          misura="grande"
          className="mt-6 w-full"
          disabled={inCorso}
        >
          {inCorso ? ANALISI.inCorso : "Analizza il manoscritto"}
        </Bottone>

        <p className="glossa text-stampa mt-5">
          Solo DOCX, PDF o TXT, fino a 4 MB e almeno 100 parole. Il report non sostituisce una
          lettura professionale.
        </p>
      </form>
      {inCorso && (
        <Bottone
          variante="secondario"
          onClick={() => {
            controller.current?.abort();
            onBusyChange?.(false);
            setStato("attesa");
          }}
        >
          Interrompi l’attesa
        </Bottone>
      )}
    </div>
  );
}
