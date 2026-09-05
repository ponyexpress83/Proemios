"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, Consenso } from "@/components/ui/campi";
import { Filetto, cn } from "@/components/ui/primitivi";
import { Report } from "./report";
import { ANALISI, UI } from "@/config/copy";
import type { ReportCompleto } from "@/lib/ai";

type Stato = "attesa" | "analisi" | "fatto" | "errore";

export function FlussoAnalisi({ giorniConservazione }: { giorniConservazione: number }) {
  const [stato, setStato] = useState<Stato>("attesa");
  const [errore, setErrore] = useState("");
  const [report, setReport] = useState<ReportCompleto | null>(null);
  const [demo, setDemo] = useState(false);
  const [nomeFile, setNomeFile] = useState("");
  const [consenso, setConsenso] = useState(false);
  const [marketing, setMarketing] = useState(false);

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore("");

    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setErrore("Scegli un file da analizzare.");
      return;
    }
    if (!consenso) {
      setErrore(UI.consensoRichiesto);
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

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={invia}
        className="rounded-lg border-bordo bg-superficie border p-6 sm:p-8"
        noValidate
      >
        {/* Caricamento */}
        <label
          className={cn(
            "garbo rounded-lg flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-12 text-center",
            nomeFile ? "border-lime bg-lime/5" : "border-bordo hover:border-lime",
            inCorso && "pointer-events-none opacity-60",
          )}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            className="text-lime"
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
          <span className="text-testo mt-4 text-[0.95rem] font-medium">
            {nomeFile || "Scegli il file o trascinalo qui"}
          </span>
          <span className="etichetta text-testo-tenue mt-2">{ANALISI.formati}</span>
          <input
            type="file"
            name="file"
            accept=".docx,.pdf,.txt"
            required
            className="sr-only"
            onChange={(e) => setNomeFile(e.target.files?.[0]?.name ?? "")}
          />
        </label>

        <Filetto className="my-7" />

        {/* Email gate */}
        <p className="etichetta text-lime">{ANALISI.gateTitolo}</p>
        <p className="prosa text-testo/65 mt-2 text-sm">{ANALISI.gateTesto}</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Campo id="an-nome" label="Nome" obbligatorio>
            {(p) => (
              <Input {...p} name="nome" required minLength={2} autoComplete="name" />
            )}
          </Campo>
          <Campo id="an-email" label="Email" obbligatorio>
            {(p) => (
              <Input {...p} name="email" type="email" required autoComplete="email" />
            )}
          </Campo>
        </div>

        <div className="mt-5 space-y-3">
          <Consenso
            id="an-privacy"
            name="consensoPrivacy"
            checked={consenso}
            onChange={setConsenso}
          >
            Ho letto la{" "}
            <Link href={"/privacy" as Route} className="hover:text-lime underline">
              privacy policy
            </Link>{" "}
            e acconsento al trattamento dei dati per ricevere il report. *
          </Consenso>
          <Consenso
            id="an-marketing"
            name="consensoMarketing"
            checked={marketing}
            onChange={setMarketing}
          >
            Mandatemi anche le guide sull&rsquo;autopubblicazione. Facoltativo.
          </Consenso>
        </div>

        {errore && (
          <p className="text-lime mt-5 text-sm leading-relaxed" role="alert">
            {errore}
          </p>
        )}

        <Bottone
          type="submit"
          variante="identita"
          misura="grande"
          className="mt-6 w-full"
          disabled={inCorso}
        >
          {inCorso ? ANALISI.inCorso : "Analizza il manoscritto"}
        </Bottone>

        <p className="editoriale text-testo-tenue mt-5">{ANALISI.conservazione(giorniConservazione)}</p>
      </form>
    </div>
  );
}
