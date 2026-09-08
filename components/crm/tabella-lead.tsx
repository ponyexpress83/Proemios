"use client";

import { useState } from "react";
import { Tabella, Riga, Cella } from "@/components/ui/tabella";
import { Badge, BadgeStato } from "@/components/ui/badge";
import { StatoVuoto } from "@/components/ui/stati";
import { euro, dataEstesa } from "@/lib/format";
import type { LeadPerStaff } from "@/lib/dto/lead";
import type { UtenteRiferimento } from "@/lib/dto/utente";
import { ETICHETTA_FONTE, ETICHETTA_STATO, TONO_STATO, temperatura } from "./etichette";
import { SchedaLead } from "./scheda-lead";
import type { StatoLead } from "@/lib/crm/pipeline";

const INTESTAZIONI = [
  { chiave: "nome", testo: "Lead" },
  { chiave: "stato", testo: "Stato" },
  { chiave: "punteggio", testo: "Punteggio", numerica: true },
  { chiave: "valore", testo: "Valore", numerica: true },
  { chiave: "owner", testo: "Titolare" },
  { chiave: "fonte", testo: "Origine" },
  { chiave: "prossima", testo: "Prossima attività" },
] as const;

export function TabellaLead({
  lead,
  staff,
  puoAssegnare,
  puoModificare,
  vedeAttribuzione,
}: {
  lead: LeadPerStaff[];
  staff: UtenteRiferimento[];
  puoAssegnare: boolean;
  puoModificare: boolean;
  vedeAttribuzione: boolean;
}) {
  const [selezionato, setSelezionato] = useState<LeadPerStaff | null>(null);

  if (lead.length === 0) {
    return (
      <StatoVuoto
        titolo="Nessun lead con questi filtri"
        descrizione="Prova ad allargare l'intervallo di date o a togliere un filtro."
      />
    );
  }

  const nomiStaff = new Map(staff.map((s) => [s.id, s.nome ?? "Senza nome"]));

  return (
    <>
      <Tabella intestazioni={INTESTAZIONI} didascalia="Elenco dei lead">
        {lead.map((l) => {
          const t = temperatura(l.leadScore);
          return (
            <Riga
              key={l.id}
              className="cursor-pointer"
              onClick={() => setSelezionato(l)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelezionato(l);
                }
              }}
            >
              <Cella intestazione>
                <span className="block text-testo">{l.nome}</span>
                <span className="block text-xs text-testo-tenue">{l.email}</span>
              </Cella>
              <Cella>
                <BadgeStato tono={TONO_STATO[l.stato as StatoLead]}>
                  {ETICHETTA_STATO[l.stato as StatoLead]}
                </BadgeStato>
              </Cella>
              <Cella numerica>
                <span className="inline-flex items-center gap-2">
                  {l.leadScore ?? "—"}
                  <Badge tono={t.tono}>{t.etichetta}</Badge>
                </span>
              </Cella>
              <Cella numerica>{l.valoreStimato ? euro(l.valoreStimato) : "—"}</Cella>
              <Cella>{l.ownerId ? (nomiStaff.get(l.ownerId) ?? "—") : "Non assegnato"}</Cella>
              <Cella>{ETICHETTA_FONTE[l.fonte] ?? l.fonte}</Cella>
              <Cella>
                {l.prossimaAttivitaAt ? (
                  <span className="flex flex-col">
                    <span className="cifre text-xs text-testo">
                      {dataEstesa(l.prossimaAttivitaAt)}
                    </span>
                    <span className="text-xs text-testo-tenue">{l.prossimaAttivita}</span>
                  </span>
                ) : (
                  "—"
                )}
              </Cella>
            </Riga>
          );
        })}
      </Tabella>

      <SchedaLead
        lead={selezionato}
        staff={staff}
        puoAssegnare={puoAssegnare}
        puoModificare={puoModificare}
        vedeAttribuzione={vedeAttribuzione}
        onChiudi={() => setSelezionato(null)}
      />
    </>
  );
}
