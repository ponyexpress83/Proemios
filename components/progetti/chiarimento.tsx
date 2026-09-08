"use client";

import { useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { AreaTesto } from "@/components/ui/campi";
import { Avviso } from "@/components/ui/stati";
import { Scheda, SchedaCorpo } from "@/components/ui/scheda";
import { rispondi } from "@/app/admin/progetti/azioni";
import type { ChiarimentoDTO } from "@/lib/dati/comunicazioni";

/** Risposta a una richiesta di chiarimento, dal lato di chi la riceve. */
export function RispostaChiarimento({
  chiarimento,
  percorso,
}: {
  chiarimento: ChiarimentoDTO;
  percorso: string;
}) {
  const [testo, setTesto] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [inviata, setInviata] = useState(false);
  const [inCorso, avvia] = useTransition();

  if (inviata) {
    return <Avviso tono="successo">Grazie: la risposta è arrivata a chi sta lavorando.</Avviso>;
  }

  return (
    <Scheda variante="identita">
      <SchedaCorpo className="flex flex-col gap-4 pt-5">
        <p className="text-sm leading-relaxed text-testo">{chiarimento.domanda}</p>
        {chiarimento.riferimento ? (
          <p className="cifre text-xs text-testo-tenue">{chiarimento.riferimento}</p>
        ) : null}

        {errore ? <Avviso tono="errore">{errore}</Avviso> : null}

        <AreaTesto
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="La tua risposta"
          aria-label="Risposta"
        />
        <Bottone
          variante="identita"
          misura="piccola"
          className="self-start"
          disabled={inCorso || !testo.trim()}
          onClick={() =>
            avvia(async () => {
              setErrore(null);
              const esito = await rispondi({
                chiarimentoId: chiarimento.id,
                risposta: testo,
                percorso,
              });
              if (esito.ok) setInviata(true);
              else setErrore(esito.messaggio);
            })
          }
        >
          {inCorso ? "Invio…" : "Rispondi"}
        </Bottone>
      </SchedaCorpo>
    </Scheda>
  );
}
