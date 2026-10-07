"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Pulsante } from "@/components/sito/pulsante";
import { Campo, Input, Consenso, RiepilogoErrori } from "@/components/sito/campo";
import { Filetto } from "@/components/sito/sezione";
import { cn } from "@/lib/cn";
import { Report } from "./report";
import { ANALISI, UI } from "@/config/copy";
import type { ReportCompleto } from "@/lib/ai";

/*
 * L'invio e la lettura della risposta sono quelli di sempre. Cambia l'area
 * di caricamento, che ora ha stati distinti — vuota, trascinamento, file
 * pronto, in analisi, errore — e dice prima dell'invio come viene trattato
 * il testo.
 */
type Stato = "attesa" | "analisi" | "fatto" | "errore";

const FORMATI = [".docx", ".pdf", ".txt"];
const LIMITE_MB = 15;

function peso(b: number): string {
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function FlussoAnalisi({ giorniConservazione }: { giorniConservazione: number }) {
  const [stato, setStato] = useState<Stato>("attesa");
  const [errore, setErrore] = useState("");
  const [erroreFile, setErroreFile] = useState("");
  const [erroriCampi, setErroriCampi] = useState<{ id: string; messaggio: string }[]>([]);
  const [report, setReport] = useState<ReportCompleto | null>(null);
  const [demo, setDemo] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [trascinamento, setTrascinamento] = useState(false);
  const [consenso, setConsenso] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idFile = useId();

  /** Controllo immediato di formato e peso, con la soluzione nel messaggio. */
  function accettaFile(f: File | null) {
    setErroreFile("");
    if (!f) {
      setFile(null);
      return;
    }
    const est = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (!FORMATI.includes(est)) {
      setFile(null);
      setErroreFile(`Il formato ${est || "del file"} non è tra quelli accettati. Esporta il testo in .docx, .pdf o .txt e ricaricalo.`);
      return;
    }
    if (f.size > LIMITE_MB * 1024 * 1024) {
      setFile(null);
      setErroreFile(`Il file pesa ${peso(f.size)}: il limite è ${LIMITE_MB} MB. Prova a salvarlo senza immagini, oppure incolla il testo in un .txt.`);
      return;
    }
    setFile(f);
  }

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore("");

    const form = e.currentTarget;
    const fd = new FormData(form);
    const f = fd.get("file");

    const errori: { id: string; messaggio: string }[] = [];
    if (!(f instanceof File) || f.size === 0) errori.push({ id: idFile, messaggio: "Scegli un file da analizzare." });
    const nome = String(fd.get("nome") ?? "");
    const email = String(fd.get("email") ?? "");
    if (nome.trim().length < 2) errori.push({ id: "an-nome", messaggio: "Scrivi il tuo nome." });
    if (!/.+@.+\..+/.test(email)) errori.push({ id: "an-email", messaggio: "Inserisci la tua email per ricevere il report." });
    if (!consenso) errori.push({ id: "an-privacy", messaggio: UI.consensoRichiesto });
    setErroriCampi(errori);
    if (errori.length) {
      document.getElementById(errori[0]!.id)?.focus();
      return;
    }

    fd.set("consensoPrivacy", String(consenso));
    fd.set("consensoMarketing", String(marketing));

    setStato("analisi");
    try {
      const res = await fetch("/api/analisi", { method: "POST", body: fd });
      const dati = (await res.json()) as {
        report?: ReportCompleto;
        errore?: string;
        demo?: boolean;
      };
      if (!res.ok || !dati.report) throw new Error(dati.errore ?? UI.erroreGenerico);
      setReport(dati.report);
      setDemo(dati.demo === true);
      setStato("fatto");
    } catch (err) {
      setStato("errore");
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
    }
  }

  if (stato === "fatto" && report) {
    return <Report report={report} demo={demo} />;
  }

  const inCorso = stato === "analisi";
  const erroreDi = (id: string) => erroriCampi.find((e) => e.id === id)?.messaggio;

  return (
    <form onSubmit={invia} className="mx-auto max-w-2xl" noValidate>
      {erroriCampi.length > 0 && <RiepilogoErrori errori={erroriCampi} className="mb-6" />}

      {/* Area di caricamento */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!inCorso) setTrascinamento(true);
        }}
        onDragLeave={() => setTrascinamento(false)}
        onDrop={(e) => {
          e.preventDefault();
          setTrascinamento(false);
          if (inCorso) return;
          const f = e.dataTransfer.files?.[0] ?? null;
          if (f && inputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(f);
            inputRef.current.files = dt.files;
          }
          accettaFile(f);
        }}
        className={cn(
          "rounded-foglio border-2 border-dashed p-6 text-center transition-[border-color,background-color] duration-200 ease-matita sm:p-10",
          trascinamento
            ? "border-blu-matita bg-carta-ombra"
            : file
              ? "border-esito-ok bg-bianco"
              : erroreFile || erroreDi(idFile)
                ? "border-rosso-matita bg-bianco"
                : "border-filetto bg-bianco",
          inCorso && "opacity-70",
        )}
      >
        {inCorso ? (
          <div>
            <p className="text-t-base font-bold text-inchiostro">{ANALISI.inCorso}</p>
            <div className="mx-auto mt-4 h-1 max-w-xs overflow-hidden rounded-pillola bg-filetto" role="progressbar" aria-label="Analisi in corso">
              <div className="barra-indeterminata h-full w-1/3 rounded-pillola bg-rosso-matita" />
            </div>
            <p className="mt-3 text-t-sm text-grafite">{file?.name}</p>
          </div>
        ) : file ? (
          <div>
            <p className="maiuscoletto text-t-sm text-esito-ok">File pronto</p>
            <p className="mt-2 text-t-base font-bold text-inchiostro break-all">{file.name}</p>
            <p className="mt-1 text-t-sm text-grafite">{peso(file.size)}</p>
            <button
              type="button"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                accettaFile(null);
                inputRef.current?.click();
              }}
              className="sottolinea-matita mt-3 inline-flex min-h-11 items-center rounded-campo text-t-sm text-blu-matita"
            >
              Cambia file
            </button>
          </div>
        ) : (
          <div>
            <svg viewBox="0 0 48 40" className="mx-auto h-10 w-12 text-inchiostro" aria-hidden="true">
              <path
                d="M24 30V8m0 0-8 8m8-8 8 8M8 30v4a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3v-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-4 text-t-base text-inchiostro">
              {trascinamento ? "Lascia qui il file" : "Trascina qui il manoscritto"}
            </p>
            <label
              htmlFor={idFile}
              className="mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-campo border border-inchiostro px-5 text-t-base font-bold text-inchiostro"
            >
              oppure scegli un file
            </label>
            <p className="mt-3 text-t-sm text-grafite">{ANALISI.formati}</p>
          </div>
        )}
        <input
          ref={inputRef}
          id={idFile}
          type="file"
          name="file"
          accept={FORMATI.join(",")}
          required
          className="sr-only"
          aria-invalid={erroreFile || erroreDi(idFile) ? true : undefined}
          aria-describedby={erroreFile || erroreDi(idFile) ? `${idFile}-errore` : undefined}
          onChange={(e) => accettaFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {(erroreFile || erroreDi(idFile)) && (
        <p id={`${idFile}-errore`} className="mt-2 text-t-sm text-rosso-matita" role="alert">
          {erroreFile || erroreDi(idFile)}
        </p>
      )}

      <Filetto className="my-7" />

      <h2 className="font-serif text-t-lg text-inchiostro">{ANALISI.gateTitolo}</h2>
      <p className="mt-2 text-t-sm text-grafite">{ANALISI.gateTesto}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Campo id="an-nome" label="Nome" obbligatorio errore={erroreDi("an-nome")}>
          {(p) => <Input {...p} name="nome" minLength={2} autoComplete="name" />}
        </Campo>
        <Campo id="an-email" label="Email" obbligatorio errore={erroreDi("an-email")}>
          {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" />}
        </Campo>
      </div>

      <div className="mt-5 space-y-2">
        <Consenso
          id="an-privacy"
          name="consensoPrivacy"
          checked={consenso}
          onChange={setConsenso}
          errore={erroreDi("an-privacy")}
        >
          Ho letto la{" "}
          <Link href={"/privacy" as Route} className="sottolinea-matita text-blu-matita">
            privacy policy
          </Link>{" "}
          e acconsento al trattamento dei dati per ricevere il report.
        </Consenso>
        <Consenso id="an-marketing" name="consensoMarketing" checked={marketing} onChange={setMarketing}>
          Mandatemi anche le guide sull&rsquo;autopubblicazione. Facoltativo.
        </Consenso>
      </div>

      {errore && (
        <p className="mt-5 text-t-sm text-rosso-matita" role="alert">
          {errore}
        </p>
      )}

      <p className="mt-6 text-t-sm text-inchiostro">
        <strong>Il tuo testo non viene archiviato.</strong> Conserviamo solo il conteggio delle parole
        e il report.
      </p>

      <Pulsante type="submit" variante="primario" className="mt-4 w-full" disabled={inCorso}>
        {inCorso ? ANALISI.inCorso : "Carica il manoscritto e analizzalo"}
      </Pulsante>

      <p className="mt-4 text-t-xs text-grafite">{ANALISI.conservazione(giorniConservazione)}</p>
    </form>
  );
}
