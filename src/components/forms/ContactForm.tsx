"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Status = "idle" | "loading" | "success" | "error";

const inputBase =
  "w-full rounded-md border border-linea bg-carta px-4 py-3 text-inchiostro placeholder:text-inchiostro-40 focus:border-bronzo";

export function ContactForm({
  fonte = "contatto",
  messaggioLabel = "Messaggio",
  messaggioPlaceholder = "Raccontaci del tuo progetto…",
  submitLabel = "Invia messaggio",
}: {
  fonte?: "contatto" | "agenzie";
  messaggioLabel?: string;
  messaggioPlaceholder?: string;
  submitLabel?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      nome: String(fd.get("nome") ?? ""),
      email: String(fd.get("email") ?? ""),
      telefono: String(fd.get("telefono") ?? ""),
      messaggio: String(fd.get("messaggio") ?? ""),
      website: String(fd.get("website") ?? ""),
      fonte,
    };
    try {
      const res = await fetch("/api/contatto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Si è verificato un errore.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Errore imprevisto.");
    }
  }

  if (status === "success") {
    return (
      <div className="border-successo/40 bg-successo/5 rounded-lg border p-8 text-center">
        <p className="font-display text-inchiostro text-xl font-medium">Messaggio ricevuto</p>
        <p className="text-inchiostro-60 mt-2 text-sm">
          Grazie. Ti risponderemo al più presto all{"'"}indirizzo che ci hai indicato.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-inchiostro-80 mb-1.5 block text-sm font-medium">Nome *</span>
          <input name="nome" required minLength={2} className={inputBase} autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-inchiostro-80 mb-1.5 block text-sm font-medium">Email *</span>
          <input name="email" type="email" required className={inputBase} autoComplete="email" />
        </label>
      </div>
      <label className="block">
        <span className="text-inchiostro-80 mb-1.5 block text-sm font-medium">
          Telefono <span className="text-inchiostro-40">(opzionale)</span>
        </span>
        <input name="telefono" className={inputBase} autoComplete="tel" />
      </label>
      <label className="block">
        <span className="text-inchiostro-80 mb-1.5 block text-sm font-medium">
          {messaggioLabel} *
        </span>
        <textarea
          name="messaggio"
          required
          minLength={10}
          rows={5}
          placeholder={messaggioPlaceholder}
          className={cn(inputBase, "resize-y")}
        />
      </label>

      {/* Honeypot anti-spam: nascosto agli utenti reali. */}
      <div className="hidden" aria-hidden>
        <label>
          Non compilare questo campo
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === "error" && (
        <p className="text-errore text-sm" role="alert">
          {errorMsg}
        </p>
      )}

      <Button type="submit" size="lg" disabled={status === "loading"}>
        {status === "loading" ? "Invio in corso…" : submitLabel}
      </Button>
    </form>
  );
}
