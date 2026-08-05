"use client";

import type { Route } from "next";
import { useState } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, AreaTesto, Consenso } from "@/components/ui/campi";
import { Filetto } from "@/components/ui/primitivi";
import { UI, AZIONI } from "@/config/copy";
import Link from "next/link";

type Stato = "compilazione" | "invio" | "inviato" | "errore";

export function ModuloAgenzia() {
  const [stato, setStato] = useState<Stato>("compilazione");
  const [errore, setErrore] = useState("");
  const [consenso, setConsenso] = useState(false);

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
      const res = await fetch("/api/agenzie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeAgenzia: String(fd.get("nomeAgenzia") ?? ""),
          referente: String(fd.get("referente") ?? ""),
          email: String(fd.get("email") ?? ""),
          telefono: String(fd.get("telefono") ?? ""),
          sito: String(fd.get("sito") ?? ""),
          serviziEsternalizzati: String(fd.get("serviziEsternalizzati") ?? ""),
          volumeStimato: String(fd.get("volumeStimato") ?? ""),
          consensoPrivacy: consenso,
          website: String(fd.get("website") ?? ""),
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
      <div className="rounded-scheda border-esito-positivo/40 bg-carta-alta border p-8">
        <p className="apparato text-esito-positivo">Richiesta ricevuta</p>
        <h3 className="font-display mt-3 text-xl font-medium">
          Vi risponde una persona, non un bot
        </h3>
        <p className="prosa mt-3">
          Entro un giorno lavorativo vi arriva l&rsquo;NDA e il listino riservato, con le condizioni
          per il volume che avete indicato.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={invia} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ag-nome" label="Nome dell'agenzia" obbligatorio>
          {(p) => (
            <Input {...p} name="nomeAgenzia" required minLength={2} autoComplete="organization" />
          )}
        </Campo>
        <Campo id="ag-referente" label="Referente" obbligatorio>
          {(p) => <Input {...p} name="referente" required minLength={2} autoComplete="name" />}
        </Campo>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ag-email" label="Email" obbligatorio>
          {(p) => <Input {...p} name="email" type="email" required autoComplete="email" />}
        </Campo>
        <Campo id="ag-tel" label="Telefono" hint="Facoltativo">
          {(p) => <Input {...p} name="telefono" autoComplete="tel" />}
        </Campo>
      </div>

      <Campo id="ag-sito" label="Sito dell'agenzia" hint="Facoltativo">
        {(p) => <Input {...p} name="sito" inputMode="url" placeholder="esempio.it" />}
      </Campo>

      <Campo
        id="ag-servizi"
        label="Cosa esternalizzate più spesso"
        hint="Editing, impaginazione, copertine, ghostwriting, pubblicazione…"
      >
        {(p) => <AreaTesto {...p} name="serviziEsternalizzati" rows={3} />}
      </Campo>

      <Campo id="ag-volume" label="Volume indicativo" hint="Anche una stima approssimativa aiuta">
        {(p) => <Input {...p} name="volumeStimato" placeholder="es. 2-3 titoli al mese" />}
      </Campo>

      {/* Honeypot */}
      <div className="hidden" aria-hidden>
        <label htmlFor="ag-website">Non compilare</label>
        <input id="ag-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Filetto />

      <Consenso id="ag-consenso" name="consensoPrivacy" checked={consenso} onChange={setConsenso}>
        Ho letto la{" "}
        <Link href={"/privacy" as Route} className="hover:text-alloro underline">
          privacy policy
        </Link>{" "}
        e acconsento al trattamento dei dati per essere ricontattato.
      </Consenso>

      {errore && (
        <p className="text-esito-critico text-sm" role="alert">
          {errore}
        </p>
      )}

      <Bottone type="submit" misura="grande" disabled={stato === "invio"}>
        {stato === "invio" ? UI.caricamento : AZIONI.agenzie}
      </Bottone>
    </form>
  );
}
