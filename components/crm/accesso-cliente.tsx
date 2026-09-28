"use client";

import { useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Badge } from "@/components/ui/badge";
import { invitaClienteAllArea } from "@/app/admin/clienti/azioni";

/**
 * Stato dell'accesso di un cliente alla propria area, con l'invito.
 *
 * Inserire un'anagrafica non dà un accesso: sono due passaggi, e prima non
 * c'era modo di fare il secondo. Qui la differenza è visibile — chi può
 * entrare porta l'etichetta, chi non può ha il pulsante.
 */
export function AccessoCliente({
  clienteId,
  haAccesso,
}: {
  clienteId: string;
  haAccesso: boolean;
}) {
  const [esito, setEsito] = useState<string | null>(null);
  const [errore, setErrore] = useState(false);
  const [inCorso, avvia] = useTransition();

  if (haAccesso) return <Badge tono="lime">Attivo</Badge>;

  if (esito) {
    return (
      <span className={errore ? "text-xs text-errore" : "text-xs text-testo-attenuato"}>
        {esito}
      </span>
    );
  }

  return (
    <Bottone
      variante="secondario"
      misura="piccola"
      disabled={inCorso}
      onClick={() =>
        avvia(async () => {
          const r = await invitaClienteAllArea(clienteId);
          setErrore(!r.ok);
          setEsito(r.messaggio);
        })
      }
    >
      {inCorso ? "Invio…" : "Invita"}
    </Bottone>
  );
}
