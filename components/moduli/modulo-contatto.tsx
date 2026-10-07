"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Pulsante } from "@/components/sito/pulsante";
import { Campo, Input, AreaTesto, Consenso, RiepilogoErrori } from "@/components/sito/campo";
import { Filetto } from "@/components/sito/sezione";
import { UI } from "@/config/copy";

/*
 * Invio, consensi e honeypot sono quelli di sempre. Cambia la presentazione:
 * gli errori stanno sul campo, con un riepilogo focalizzato all'invio, e la
 * conferma usa lo stesso verbo del pulsante.
 */
type Stato = "compilazione" | "invio" | "inviato" | "errore";

/**
 * `motivo="editor"` precompila il messaggio per chi arriva da «Parla con un
 * editor»; `quote` è l'id del preventivo da cui si arriva, e finisce nel
 * messaggio come riferimento.
 */
export function ModuloContatto({ motivo, quote }: { motivo?: "editor"; quote?: string } = {}) {
  const [stato, setStato] = useState<Stato>("compilazione");
  const [errore, setErrore] = useState("");
  const [erroriCampi, setErroriCampi] = useState<{ id: string; messaggio: string }[]>([]);
  const [consenso, setConsenso] = useState(false);
  const [marketing, setMarketing] = useState(false);
  // In demo l'API non invia niente e lo dice: la conferma deve dirlo anche lei.
  const [simulato, setSimulato] = useState(false);

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const errori: { id: string; messaggio: string }[] = [];
    if (String(fd.get("nome") ?? "").trim().length < 2) errori.push({ id: "ct-nome", messaggio: "Scrivi il tuo nome." });
    if (!/.+@.+\..+/.test(String(fd.get("email") ?? ""))) errori.push({ id: "ct-email", messaggio: "Inserisci un indirizzo email a cui rispondere." });
    if (String(fd.get("messaggio") ?? "").trim().length < 10) errori.push({ id: "ct-msg", messaggio: "Raccontaci il progetto in almeno due frasi." });
    if (!consenso) errori.push({ id: "ct-privacy", messaggio: UI.consensoRichiesto });
    setErroriCampi(errori);
    if (errori.length) {
      document.getElementById(errori[0]!.id)?.focus();
      return;
    }

    setStato("invio");
    setErrore("");

    try {
      const res = await fetch("/api/contatto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: String(fd.get("nome") ?? ""),
          email: String(fd.get("email") ?? ""),
          telefono: String(fd.get("telefono") ?? ""),
          messaggio: `${motivo === "editor" ? "Richiesta: confronto con un editor.\n" : ""}${quote ? `Riferimento preventivo: ${quote}.\n` : ""}${String(fd.get("messaggio") ?? "")}`,
          consensoPrivacy: consenso,
          consensoMarketing: marketing,
          sito: String(fd.get("sito") ?? ""),
        }),
      });
      const dati = (await res.json()) as { errore?: string; demo?: boolean };
      if (!res.ok) throw new Error(dati.errore ?? UI.erroreGenerico);
      setSimulato(dati.demo === true);
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
        <h3 className="font-serif text-t-lg text-inchiostro">
          {simulato ? "Invio simulato." : "Messaggio inviato."}
        </h3>
        <p className="mt-3 text-t-base text-grafite">
          {simulato ? "Nessuna email è stata inviata e nessuno riceverà questa richiesta: il sito è in modalità dimostrativa." : <>
          Ti rispondiamo entro un giorno lavorativo. Se nel frattempo vuoi già i numeri, il
          configuratore di preventivo è sempre aperto.
        </>}</p>
      </div>
    );
  }

  const erroreDi = (id: string) => erroriCampi.find((e) => e.id === id)?.messaggio;

  return (
    <form onSubmit={invia} className="space-y-5" noValidate>
      {erroriCampi.length > 0 && <RiepilogoErrori errori={erroriCampi} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ct-nome" label="Nome" obbligatorio errore={erroreDi("ct-nome")}>
          {(p) => <Input {...p} name="nome" minLength={2} autoComplete="name" />}
        </Campo>
        <Campo id="ct-email" label="Email" obbligatorio errore={erroreDi("ct-email")}>
          {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" />}
        </Campo>
      </div>

      <Campo id="ct-tel" label="Telefono" hint="Se preferisci una telefonata.">
        {(p) => <Input {...p} name="telefono" type="tel" inputMode="tel" autoComplete="tel" />}
      </Campo>

      <Campo
        id="ct-msg"
        label="Il tuo progetto"
        hint="A che punto sei e cosa ti serve. Bastano due frasi."
        obbligatorio
        errore={erroreDi("ct-msg")}
      >
        {(p) => (
          <AreaTesto
            {...p}
            name="messaggio"
            minLength={10}
            rows={5}
            defaultValue={motivo === "editor" ? "Vorrei parlare con un editor del mio progetto." : undefined}
          />
        )}
      </Campo>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="ct-sito">Non compilare</label>
        <input id="ct-sito" name="sito" tabIndex={-1} autoComplete="off" />
      </div>

      <Filetto />

      <div className="space-y-2">
        <Consenso
          id="ct-privacy"
          name="consensoPrivacy"
          checked={consenso}
          onChange={setConsenso}
          errore={erroreDi("ct-privacy")}
        >
          Ho letto la{" "}
          <Link href={"/privacy" as Route} className="sottolinea-matita text-blu-matita">
            privacy policy
          </Link>{" "}
          e acconsento al trattamento dei dati per essere ricontattato.
        </Consenso>
        <Consenso id="ct-marketing" name="consensoMarketing" checked={marketing} onChange={setMarketing}>
          Mandatemi anche le guide sull&rsquo;autopubblicazione. Facoltativo.
        </Consenso>
      </div>

      {errore && (
        <p className="text-t-sm text-rosso-matita" role="alert">
          {errore}
        </p>
      )}

      <Pulsante type="submit" variante="primario" disabled={stato === "invio"}>
        {stato === "invio" ? UI.caricamento : "Invia il messaggio"}
      </Pulsante>
    </form>
  );
}
