"use client";

import type { Route } from "next";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Selezione, Input } from "@/components/ui/campi";
import { Bottone } from "@/components/ui/bottone";
import { STATI_LEAD } from "@/lib/crm/pipeline";
import { ETICHETTA_STATO, ETICHETTA_FONTE } from "./etichette";
import type { UtenteRiferimento } from "@/lib/dto/utente";

const FONTI = ["preventivo", "analisi", "contatto", "agenzie"] as const;

/**
 * I filtri vivono nella query string, non nello stato del componente: così un
 * elenco filtrato è un URL condivisibile e il tasto Indietro funziona.
 */
export function FiltriLead({ staff }: { staff: UtenteRiferimento[] }) {
  const router = useRouter();
  const percorso = usePathname();
  const parametri = useSearchParams();
  const [inCorso, avvia] = useTransition();

  function imposta(chiave: string, valore: string) {
    const nuovi = new URLSearchParams(parametri.toString());
    if (valore) nuovi.set(chiave, valore);
    else nuovi.delete(chiave);
    nuovi.delete("pagina");
    // `typedRoutes` non sa tipizzare una query string costruita a runtime:
    // il percorso base è comunque una rotta reale del progetto.
    avvia(() => router.push(`${percorso}?${nuovi.toString()}` as Route));
  }

  const haFiltri = ["stato", "fonte", "owner", "cerca", "punteggio"].some((k) => parametri.get(k));

  return (
    <div className="flex flex-wrap items-end gap-3" data-in-corso={inCorso}>
      <label className="flex flex-col gap-1.5">
        <span className="etichetta text-testo-tenue">Cerca</span>
        <Input
          type="search"
          defaultValue={parametri.get("cerca") ?? ""}
          placeholder="Nome o email"
          className="w-56"
          onKeyDown={(e) => {
            if (e.key === "Enter") imposta("cerca", (e.target as HTMLInputElement).value);
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="etichetta text-testo-tenue">Stato</span>
        <Selezione
          className="w-44"
          defaultValue={parametri.get("stato") ?? ""}
          onChange={(e) => imposta("stato", e.target.value)}
        >
          <option value="">Tutti</option>
          {STATI_LEAD.map((s) => (
            <option key={s} value={s}>
              {ETICHETTA_STATO[s]}
            </option>
          ))}
        </Selezione>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="etichetta text-testo-tenue">Origine</span>
        <Selezione
          className="w-40"
          defaultValue={parametri.get("fonte") ?? ""}
          onChange={(e) => imposta("fonte", e.target.value)}
        >
          <option value="">Tutte</option>
          {FONTI.map((f) => (
            <option key={f} value={f}>
              {ETICHETTA_FONTE[f]}
            </option>
          ))}
        </Selezione>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="etichetta text-testo-tenue">Titolare</span>
        <Selezione
          className="w-44"
          defaultValue={parametri.get("owner") ?? ""}
          onChange={(e) => imposta("owner", e.target.value)}
        >
          <option value="">Tutti</option>
          <option value="nessuno">Non assegnati</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome ?? s.id.slice(0, 8)}
            </option>
          ))}
        </Selezione>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="etichetta text-testo-tenue">Ordina</span>
        <Selezione
          className="w-40"
          defaultValue={parametri.get("ordina") ?? "recenti"}
          onChange={(e) => imposta("ordina", e.target.value)}
        >
          <option value="recenti">Più recenti</option>
          <option value="punteggio">Punteggio</option>
          <option value="valore">Valore</option>
          <option value="prossima_attivita">Prossima attività</option>
        </Selezione>
      </label>

      {haFiltri ? (
        <Bottone variante="quieto" misura="piccola" onClick={() => avvia(() => router.push(percorso as Route))}>
          Azzera i filtri
        </Bottone>
      ) : null}
    </div>
  );
}
