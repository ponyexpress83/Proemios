"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, AreaTesto, Consenso } from "@/components/ui/campi";
import { Filetto } from "@/components/ui/primitivi";
import { UI } from "@/config/copy";

type Stato = "compilazione" | "invio" | "inviato" | "errore";

export function ModuloContatto() {
  const [stato, setStato] = useState<Stato>("compilazione");
  const [errore, setErrore] = useState("");
  const [consenso, setConsenso] = useState(false);
  const [marketing, setMarketing] = useState(false);

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consenso) {
      setErrore(UI.consensoRichiesto);
      return;
    }
    setStato("invio");
    setErrore("");

    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      const res = await fetch("/api/contatto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: String(fd.get("nome") ?? ""),
          email: String(fd.get("email") ?? ""),
          telefono: String(fd.get("telefono") ?? ""),
          messaggio: String(fd.get("messaggio") ?? ""),
          consensoPrivacy: consenso,
          consensoMarketing: marketing,
          sito: String(fd.get("sito") ?? ""),
        }),
      });
      const dati = (await res.json()) as { errore?: string };
      if (!res.ok) throw new Error(dati.errore ?? UI.erroreGenerico);
      setStato("inviato");
      form.reset();
    } catch (err) {
      setStato("errore");
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
    }
  }

  if (stato === "inviato") {
    return (
      <div className="rounded-lg border-esito-positivo/40 bg-superficie border p-8">
        <p className="etichetta text-successo">Messaggio ricevuto</p>
        <h3 className="mt-3 text-xl font-medium">Ti rispondiamo presto</h3>
        <p className="prosa mt-3">
          Di solito entro un giorno lavorativo. Se nel frattempo vuoi già i numeri, il configuratore
          di preventivo è sempre aperto.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={invia} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ct-nome" label="Nome" obbligatorio>
          {(p) => <Input {...p} name="nome" required minLength={2} autoComplete="name" />}
        </Campo>
        <Campo id="ct-email" label="Email" obbligatorio>
          {(p) => <Input {...p} name="email" type="email" required autoComplete="email" />}
        </Campo>
      </div>

      <Campo id="ct-tel" label="Telefono" hint="Facoltativo">
        {(p) => <Input {...p} name="telefono" autoComplete="tel" />}
      </Campo>

      <Campo
        id="ct-msg"
        label="Il tuo progetto"
        hint="A che punto sei e cosa ti serve. Bastano due frasi."
        obbligatorio
      >
        {(p) => <AreaTesto {...p} name="messaggio" required minLength={10} rows={5} />}
      </Campo>

      <div className="hidden" aria-hidden>
        <label htmlFor="ct-sito">Non compilare</label>
        <input id="ct-sito" name="sito" tabIndex={-1} autoComplete="off" />
      </div>

      <Filetto />

      <div className="space-y-3">
        <Consenso id="ct-privacy" name="consensoPrivacy" checked={consenso} onChange={setConsenso}>
          Ho letto la{" "}
          <Link href={"/privacy" as Route} className="hover:text-viola-chiaro underline">
            privacy policy
          </Link>{" "}
          e acconsento al trattamento dei dati per essere ricontattato. *
        </Consenso>
        <Consenso
          id="ct-marketing"
          name="consensoMarketing"
          checked={marketing}
          onChange={setMarketing}
        >
          Mandatemi anche le guide sull&rsquo;autopubblicazione. Facoltativo.
        </Consenso>
      </div>

      {errore && (
        <p className="text-errore text-sm" role="alert">
          {errore}
        </p>
      )}

      <Bottone type="submit" misura="grande" disabled={stato === "invio"}>
        {stato === "invio" ? UI.caricamento : "Invia il messaggio"}
      </Bottone>
    </form>
  );
}
