"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { AreaTesto, Consenso } from "@/components/ui/campi";
import { Badge } from "@/components/ui/badge";
import { Avviso, StatoVuoto } from "@/components/ui/stati";
import { dataEstesa } from "@/lib/format";
import { inviaMessaggio } from "@/app/admin/progetti/azioni";
import type { MessaggioDTO } from "@/lib/dati/comunicazioni";

/**
 * Cronologia delle comunicazioni di progetto.
 *
 * `visibileAlCliente` è una scelta esplicita di chi scrive, con l'etichetta
 * ben visibile sul messaggio: un'interfaccia che decide da sola cosa è interno
 * prima o poi manda al cliente una nota che non doveva leggere.
 */
export function PannelloMessaggi({
  progettoId,
  messaggi,
  puoScrivereNoteInterne,
}: {
  progettoId: string;
  messaggi: MessaggioDTO[];
  puoScrivereNoteInterne: boolean;
}) {
  const [corpo, setCorpo] = useState("");
  const [interno, setInterno] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  const [ottimistici, aggiungiOttimistico] = useOptimistic(
    messaggi,
    (stato: MessaggioDTO[], nuovo: MessaggioDTO) => [nuovo, ...stato],
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const testo = corpo.trim();
          if (!testo) return;
          setErrore(null);
          avvia(async () => {
            aggiungiOttimistico({
              id: `provvisorio-${Date.now()}`,
              corpo: testo,
              autoreId: null,
              autoreNome: "Tu",
              visibileAlCliente: !interno,
              createdAt: new Date().toISOString(),
            });
            const esito = await inviaMessaggio({
              progettoId,
              corpo: testo,
              visibileAlCliente: !interno,
            });
            if (esito.ok) setCorpo("");
            else setErrore(esito.messaggio);
          });
        }}
      >
        <AreaTesto
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          placeholder={
            puoScrivereNoteInterne
              ? "Scrivi al cliente, oppure lascia una nota per i colleghi."
              : "Scrivi al tuo referente."
          }
          aria-label="Nuovo messaggio"
        />
        {errore ? <Avviso tono="errore">{errore}</Avviso> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {puoScrivereNoteInterne ? (
            <Consenso
              id={`interno-${progettoId}`}
              name="interno"
              checked={interno}
              onChange={setInterno}
            >
              Nota interna: il cliente non la vede
            </Consenso>
          ) : (
            <span />
          )}
          <Bottone type="submit" misura="piccola" disabled={inCorso || !corpo.trim()}>
            {inCorso ? "Invio…" : "Invia"}
          </Bottone>
        </div>
      </form>

      {ottimistici.length === 0 ? (
        <StatoVuoto
          titolo="Nessun messaggio"
          descrizione="Le comunicazioni del progetto restano qui, in un posto solo."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {ottimistici.map((m) => (
            <li
              key={m.id}
              className={
                m.visibileAlCliente
                  ? "flex flex-col gap-2 rounded-lg border border-bordo bg-superficie p-4"
                  : "flex flex-col gap-2 rounded-lg border border-dashed border-bordo-forte bg-transparent p-4"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-testo">{m.autoreNome ?? "Sistema"}</span>
                <div className="flex items-center gap-2">
                  {!m.visibileAlCliente ? <Badge tono="attenzione">Interna</Badge> : null}
                  <span className="cifre text-xs text-testo-tenue">{dataEstesa(m.createdAt)}</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-testo-attenuato">
                {m.corpo}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
