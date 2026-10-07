"use client";

import type { Route } from "next";
import { useState } from "react";
import { Pulsante } from "@/components/sito/pulsante";
import { Campo, Input, AreaTesto, Consenso, RiepilogoErrori } from "@/components/sito/campo";
import { Filetto } from "@/components/sito/sezione";
import { UI, AZIONI } from "@/config/copy";
import Link from "next/link";

/* Invio, consenso e honeypot sono quelli di sempre: cambiano campi e stili. */
type Stato = "compilazione" | "invio" | "inviato" | "errore";

export function ModuloAgenzia() {
  const [stato, setStato] = useState<Stato>("compilazione");
  const [errore, setErrore] = useState("");
  const [erroriCampi, setErroriCampi] = useState<{ id: string; messaggio: string }[]>([]);
  const [consenso, setConsenso] = useState(false);

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const errori: { id: string; messaggio: string }[] = [];
    if (String(fd.get("nomeAgenzia") ?? "").trim().length < 2) errori.push({ id: "ag-nome", messaggio: "Scrivi il nome dell'agenzia." });
    if (String(fd.get("referente") ?? "").trim().length < 2) errori.push({ id: "ag-referente", messaggio: "Indica chi seguirà il rapporto." });
    if (!/.+@.+\..+/.test(String(fd.get("email") ?? ""))) errori.push({ id: "ag-email", messaggio: "Inserisci un indirizzo email a cui rispondere." });
    if (!consenso) errori.push({ id: "ag-consenso", messaggio: UI.consensoRichiesto });
    setErroriCampi(errori);
    if (errori.length) {
      document.getElementById(errori[0]!.id)?.focus();
      return;
    }

    setStato("invio");
    setErrore("");

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
      <div className="rounded-foglio border-t-4 border-esito-ok bg-bianco p-8 shadow-foglio" role="status">
        <h3 className="font-serif text-t-lg text-inchiostro">Richiesta inviata.</h3>
        <p className="mt-3 text-t-base text-grafite">
          Vi risponde una persona entro un giorno lavorativo, con l&rsquo;accordo di riservatezza e
          il listino riservato per il volume che avete indicato.
        </p>
      </div>
    );
  }

  const erroreDi = (id: string) => erroriCampi.find((e) => e.id === id)?.messaggio;

  return (
    <form onSubmit={invia} className="space-y-5" noValidate>
      {erroriCampi.length > 0 && <RiepilogoErrori errori={erroriCampi} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ag-nome" label="Nome dell'agenzia" obbligatorio errore={erroreDi("ag-nome")}>
          {(p) => <Input {...p} name="nomeAgenzia" minLength={2} autoComplete="organization" />}
        </Campo>
        <Campo id="ag-referente" label="Referente" obbligatorio errore={erroreDi("ag-referente")}>
          {(p) => <Input {...p} name="referente" minLength={2} autoComplete="name" />}
        </Campo>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ag-email" label="Email" obbligatorio errore={erroreDi("ag-email")}>
          {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" />}
        </Campo>
        <Campo id="ag-tel" label="Telefono">
          {(p) => <Input {...p} name="telefono" type="tel" inputMode="tel" autoComplete="tel" />}
        </Campo>
      </div>

      <Campo id="ag-sito" label="Sito dell'agenzia">
        {(p) => <Input {...p} name="sito" type="url" inputMode="url" autoComplete="url" placeholder="https://esempio.it" />}
      </Campo>

      <Campo
        id="ag-servizi"
        label="Cosa esternalizzate più spesso"
        hint="Editing, impaginazione, copertine, ghostwriting, pubblicazione…"
      >
        {(p) => <AreaTesto {...p} name="serviziEsternalizzati" rows={3} />}
      </Campo>

      <Campo id="ag-volume" label="Volume indicativo" hint="Anche una stima approssimativa aiuta.">
        {(p) => <Input {...p} name="volumeStimato" placeholder="es. 2-3 titoli al mese" />}
      </Campo>

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="ag-website">Non compilare</label>
        <input id="ag-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Filetto />

      <Consenso id="ag-consenso" name="consensoPrivacy" checked={consenso} onChange={setConsenso} errore={erroreDi("ag-consenso")}>
        Ho letto la{" "}
        <Link href={"/privacy" as Route} className="sottolinea-matita text-blu-matita">
          privacy policy
        </Link>{" "}
        e acconsento al trattamento dei dati per essere ricontattato.
      </Consenso>

      {errore && (
        <p className="text-t-sm text-rosso-matita" role="alert">
          {errore}
        </p>
      )}

      <Pulsante type="submit" variante="primario" disabled={stato === "invio"}>
        {stato === "invio" ? UI.caricamento : AZIONI.agenzie}
      </Pulsante>
    </form>
  );
}
