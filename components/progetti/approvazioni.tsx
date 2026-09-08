"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Bottone } from "@/components/ui/bottone";
import { AreaTesto } from "@/components/ui/campi";
import { Badge } from "@/components/ui/badge";
import { Avviso } from "@/components/ui/stati";
import { Scheda, SchedaCorpo } from "@/components/ui/scheda";
import { dataEstesa } from "@/lib/format";
import { decidi } from "@/app/admin/progetti/azioni";
import { TIPO_APPROVAZIONE } from "@/config/back-office";
import type { ApprovazioneDTO } from "@/lib/dati/comunicazioni";

/**
 * Elenco delle approvazioni in attesa.
 *
 * Il rifiuto richiede una motivazione: un «no» senza spiegazione costringe chi
 * lo riceve a indovinare cosa rifare, e di solito produce un secondo giro
 * sbagliato quanto il primo.
 */
export function ElencoApprovazioni({
  voci,
  percorsoRitorno = "/admin/progetti",
}: {
  voci: ApprovazioneDTO[];
  percorsoRitorno?: string;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {voci.map((a) => (
        <li key={a.id}>
          <VoceApprovazione approvazione={a} percorsoRitorno={percorsoRitorno} />
        </li>
      ))}
    </ul>
  );
}

function VoceApprovazione({
  approvazione,
  percorsoRitorno,
}: {
  approvazione: ApprovazioneDTO;
  percorsoRitorno: string;
}) {
  const [motivazione, setMotivazione] = useState("");
  const [rifiutando, setRifiutando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [decisa, setDecisa] = useState<"approvata" | "respinta" | null>(null);
  const [inCorso, avvia] = useTransition();

  function esegui(decisione: "approvata" | "respinta") {
    setErrore(null);
    avvia(async () => {
      const esito = await decidi({
        approvazioneId: approvazione.id,
        decisione,
        motivazione: decisione === "respinta" ? motivazione : undefined,
      });
      if (esito.ok) setDecisa(decisione);
      else setErrore(esito.messaggio);
    });
  }

  if (decisa) {
    return (
      <Avviso tono={decisa === "approvata" ? "successo" : "attenzione"}>
        {decisa === "approvata"
          ? "Approvata. Il lavoro può proseguire."
          : "Respinta. Chi l'ha richiesta riceve la tua motivazione."}
      </Avviso>
    );
  }

  return (
    <Scheda>
      <SchedaCorpo className="flex flex-col gap-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-medium text-testo">
              {TIPO_APPROVAZIONE[approvazione.tipo] ?? approvazione.tipo}
            </span>
            <span className="text-sm text-testo-tenue">
              <Link
                href={`${percorsoRitorno}/${approvazione.progettoId}` as Route}
                className="garbo cifre text-viola-chiaro hover:underline"
              >
                {approvazione.progettoCodice}
              </Link>
              {approvazione.milestoneNome ? ` · ${approvazione.milestoneNome}` : ""}
            </span>
          </div>
          {approvazione.scadeAt ? (
            <Badge tono="attenzione">Entro {dataEstesa(approvazione.scadeAt)}</Badge>
          ) : null}
        </div>

        {approvazione.motivazione ? (
          <p className="text-sm leading-relaxed text-testo-attenuato">{approvazione.motivazione}</p>
        ) : null}

        {errore ? <Avviso tono="errore">{errore}</Avviso> : null}

        {rifiutando ? (
          <div className="flex flex-col gap-3">
            <AreaTesto
              value={motivazione}
              onChange={(e) => setMotivazione(e.target.value)}
              placeholder="Cosa non va, e cosa serve perché vada bene."
              aria-label="Motivazione del rifiuto"
            />
            <div className="flex gap-3">
              <Bottone
                variante="distruttivo"
                misura="piccola"
                disabled={inCorso || motivazione.trim().length < 5}
                onClick={() => esegui("respinta")}
              >
                Conferma il rifiuto
              </Bottone>
              <Bottone variante="quieto" misura="piccola" onClick={() => setRifiutando(false)}>
                Annulla
              </Bottone>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Bottone
              variante="identita"
              misura="piccola"
              disabled={inCorso}
              onClick={() => esegui("approvata")}
            >
              Approva
            </Bottone>
            <Bottone variante="secondario" misura="piccola" onClick={() => setRifiutando(true)}>
              Rifiuta
            </Bottone>
          </div>
        )}
      </SchedaCorpo>
    </Scheda>
  );
}
