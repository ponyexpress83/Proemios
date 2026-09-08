"use client";

import Link from "next/link";
import { useActionState } from "react";
import { creaClienteAttuale, type EsitoCliente } from "@/app/admin/clienti/azioni";
import { Bottone } from "@/components/ui/bottone";

const classeCampo =
  "h-10 rounded-md border border-bordo-forte bg-fondo px-3 text-testo outline-none focus:border-viola";

export function ModuloNuovoCliente() {
  const [stato, azione, inCorso] = useActionState<EsitoCliente | null, FormData>(
    creaClienteAttuale,
    null,
  );

  return (
    <form action={azione} className="grid gap-6">
      <div className="grid gap-4 rounded-lg border border-bordo bg-superficie p-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Tipo
          <select name="tipo" defaultValue="privato" className={classeCampo}>
            <option value="privato">Privato</option>
            <option value="azienda">Azienda / professionista</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Nome *
          <input name="nome" required maxLength={200} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Cognome
          <input name="cognome" maxLength={200} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Ragione sociale
          <input name="ragioneSociale" maxLength={300} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Email *
          <input name="email" required type="email" maxLength={320} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Telefono
          <input name="telefono" type="tel" maxLength={40} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Partita IVA
          <input name="partitaIva" maxLength={30} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Codice fiscale
          <input name="codiceFiscale" maxLength={30} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          PEC
          <input name="pec" type="email" maxLength={320} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato">
          Codice destinatario
          <input name="codiceDestinatario" maxLength={20} className={classeCampo} />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato sm:col-span-2">
          Alias interno / pseudonimo
          <input name="alias" maxLength={80} className={classeCampo} placeholder="Es. Cliente P-184" />
        </label>
        <label className="grid gap-2 text-sm text-testo-attenuato sm:col-span-2">
          Note commerciali
          <textarea
            name="noteCommerciali"
            maxLength={5000}
            rows={4}
            className="rounded-md border border-bordo-forte bg-fondo px-3 py-2 text-testo outline-none focus:border-viola"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Bottone type="submit" variante="identita" disabled={inCorso}>
          {inCorso ? "Salvataggio…" : "Inserisci cliente"}
        </Bottone>
        <Link href="/admin/clienti" className="text-sm text-testo-tenue hover:text-testo">
          Annulla
        </Link>
      </div>

      {stato ? (
        <div
          role="status"
          className={`rounded-lg border p-4 text-sm ${
            stato.ok
              ? "border-successo/40 bg-successo/10 text-successo"
              : "border-errore/40 bg-errore/10 text-errore"
          }`}
        >
          <p>{stato.messaggio}</p>
          {stato.ok ? (
            <Link
              href={`/admin/progetti/nuovo?cliente=${encodeURIComponent(stato.clienteId)}`}
              className="mt-2 inline-block font-medium underline underline-offset-4"
            >
              Crea subito il progetto →
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
