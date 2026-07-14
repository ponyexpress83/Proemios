"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ReportView } from "./ReportView";
import type { FullReport } from "@/lib/analysisSchema";
import { AI_ANALYSIS_DISCLAIMER } from "@/config/site";
import { cn } from "@/lib/cn";

type Status = "idle" | "loading" | "done" | "error";

const inputBase =
  "w-full rounded-md border border-linea bg-carta px-4 py-3 text-inchiostro placeholder:text-inchiostro-40 focus:border-bronzo";

export function AnalysisFlow() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [report, setReport] = useState<FullReport | null>(null);
  const [fileName, setFileName] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Seleziona un file da analizzare.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/analisi", { method: "POST", body: fd });
      const data = (await res.json()) as { report?: FullReport; error?: string };
      if (!res.ok || !data.report) {
        throw new Error(data.error ?? "Analisi non riuscita.");
      }
      setReport(data.report);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
    }
  }

  if (status === "done" && report) {
    return <ReportView report={report} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={onSubmit} className="border-linea bg-carta rounded-xl border p-6 sm:p-8">
        {/* Dropzone */}
        <label
          className={cn(
            "border-linea bg-carta-2 lift hover:border-bronzo flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center",
            status === "loading" && "pointer-events-none opacity-60",
          )}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            className="text-bronzo"
            aria-hidden
          >
            <path
              d="M16 21V7m0 0-5 5m5-5 5 5M7 23v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-inchiostro mt-3 font-medium">
            {fileName || "Trascina il file o clicca per caricare"}
          </span>
          <span className="text-inchiostro-40 mt-1 text-sm">.docx, .pdf o .txt — max 15 MB</span>
          <input
            type="file"
            name="file"
            accept=".docx,.pdf,.txt"
            required
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
        </label>

        {/* Email gate */}
        <p className="text-inchiostro-60 mt-6 mb-4 text-sm">
          Inserisci i tuoi dati: il report completo ti arriva anche via email.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-inchiostro-80 mb-1.5 block text-sm font-medium">Nome *</span>
            <input name="nome" required minLength={2} className={inputBase} autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-inchiostro-80 mb-1.5 block text-sm font-medium">Email *</span>
            <input name="email" type="email" required className={inputBase} autoComplete="email" />
          </label>
        </div>

        {error && (
          <p className="text-errore mt-4 text-sm" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={status === "loading"}>
          {status === "loading"
            ? "Analisi in corso… (può richiedere un minuto)"
            : "Analizza il manoscritto"}
        </Button>

        <p className="text-inchiostro-40 mt-4 text-xs leading-relaxed">{AI_ANALYSIS_DISCLAIMER}</p>
      </form>
    </div>
  );
}
