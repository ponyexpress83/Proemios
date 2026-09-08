"use client";

import Link from "next/link";
import { useActionState } from "react";
import { creaNuovoProgetto, type EsitoCreaProgetto } from "@/app/admin/progetti/azioni";
import { Bottone } from "@/components/ui/bottone";

export type ClienteSelezionabile = { id: string; etichetta: string };

const campo =
  "h-10 rounded-md border border-bordo-forte bg-fondo px-3 text-testo outline-none focus:border-viola";

export function ModuloNuovoProgetto({
  clienti,
  clientePreselezionato,
}: {
  clienti: ClienteSelezionabile[];
  clientePreselezionato?: string;
}) {
  const [stato, azione, inCorso] = useActionState<EsitoCreaProgetto | null, FormData>(
    creaNuovoProgetto,
    null,
  );

  return (
    <form action={azione} className="grid gap-6">
      <div className="grid gap-4 rounded-lg border border-bordo bg-superficie p-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-testo-attenuato sm:col-span-2">
          Cliente *
          <select
            name="clientId"
            required
            defaultValue={clientePreselezionato ?? ""}
            className={campo}
          >
            <option value="" disabled>
              Seleziona un cliente
            </option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etichetta}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato sm:col-span-2">
          Titolo progetto *
          <input name="titolo" required maxLength={300} className={campo} placeholder="Titolo del libro o nome del progetto" />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Alias visibile in redazione
          <input name="titoloAlias" maxLength={300} className={campo} placeholder="Facoltativo" />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Conteggio parole
          <input name="conteggioParole" type="number" min={1} max={2000000} className={campo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Scadenza
          <input name="scadenza" type="date" className={campo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato sm:col-span-2">
          Istruzioni editoriali
          <textarea
            name="istruzioniEditoriali"
            rows={5}
            maxLength={20000}
            className="rounded-md border border-bordo-forte bg-fondo px-3 py-2 text-testo outline-none focus:border-viola"
            placeholder="Servizio concordato, note di lavorazione, vincoli, richieste del cliente…"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Bottone type="submit" variante="identita" disabled={inCorso || clienti.length === 0}>
          {inCorso ? "Creazione…" : "Crea progetto"}
        </Bottone>
        <Link href="/admin/progetti" className="text-sm text-testo-tenue hover:text-testo">
          Annulla
        </Link>
      </div>

      {clienti.length === 0 ? (
        <p className="text-sm text-attenzione">
          Prima inserisci un cliente. <Link href="/admin/clienti/nuovo" className="underline">Vai ai clienti →</Link>
        </p>
      ) : null}

      {stato ? (
        <div
          role="status"
          className={`rounded-lg border p-4 text-sm ${
            stato.ok
              ? "border-successo/40 bg-successo/10 text-successo"
              : "border-errore/40 bg-errore/10 text-errore"
          }`}
        >
          {stato.ok ? (
            <>
              <p>Progetto {stato.codice} creato.</p>
              <Link
                href={`/admin/progetti/${stato.progettoId}`}
                className="mt-2 inline-block font-medium underline underline-offset-4"
              >
                Apri il progetto →
              </Link>
            </>
          ) : (
            <p>{stato.messaggio}</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
