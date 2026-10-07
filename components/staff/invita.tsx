"use client";

import { useActionState } from "react";
import { invitaStaff, type EsitoInvito } from "@/app/admin/staff/azioni";
import { Bottone } from "@/components/ui/bottone";

export function ModuloInvitoStaff() {
  const [stato, azione, inCorso] = useActionState<EsitoInvito | null, FormData>(invitaStaff, null);

  return (
    <form action={azione} className="grid gap-4 rounded-lg border border-bordo bg-superficie p-5 md:grid-cols-[1fr_16rem_auto] md:items-end">
      <label className="grid gap-2 text-sm text-testo-attenuato">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-10 rounded-md border border-bordo-forte bg-fondo px-3 text-testo outline-none focus:border-viola"
          placeholder="nome@azienda.it"
        />
      </label>
      <label className="grid gap-2 text-sm text-testo-attenuato">
        Ruolo
        <select
          name="ruolo"
          defaultValue="editor_reviewer"
          className="h-10 rounded-md border border-bordo-forte bg-fondo px-3 text-testo outline-none focus:border-viola"
        >
          <option value="editor_reviewer">Redattore</option>
          <option value="editorial_manager">Responsabile editoriale</option>
          <option value="operations_admin">Operations</option>
          <option value="finance">Amministrazione</option>
        </select>
      </label>
      <Bottone type="submit" disabled={inCorso} variante="identita">
        {inCorso ? "Invio…" : "Invita"}
      </Bottone>
      {stato ? (
        <p
          role="status"
          className={`text-sm md:col-span-3 ${stato.ok ? "text-successo" : "text-errore"}`}
        >
          {stato.messaggio}
        </p>
      ) : null}
    </form>
  );
}
