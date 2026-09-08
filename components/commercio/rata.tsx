"use client";

import { useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Badge } from "@/components/ui/badge";
import { Avviso } from "@/components/ui/stati";
import { euroDaCentesimi, dataEstesa } from "@/lib/format";
import { paga } from "@/app/area/pagamenti/azioni";
import type { PagamentoPerCliente } from "@/lib/dto/commercio";

const ETICHETTA_TIPO: Record<string, string> = {
  acconto: "Acconto",
  saldo: "Saldo",
  milestone: "Rata a stato avanzamento",
  personalizzato: "Rata",
};

const ETICHETTA_STATO: Record<string, string> = {
  in_attesa: "Da saldare",
  autorizzato: "Autorizzato",
  pagato: "Pagato",
  fallito: "Non riuscito",
  rimborsato: "Rimborsato",
  annullato: "Annullato",
};

const TONO_STATO: Record<string, "neutro" | "lime" | "attenzione" | "errore"> = {
  in_attesa: "attenzione",
  autorizzato: "neutro",
  pagato: "lime",
  fallito: "errore",
  rimborsato: "neutro",
  annullato: "neutro",
};

/**
 * Una rata nell'area cliente.
 *
 * Il pulsante manda al server **solo l'id**: l'importo lo decide l'ordine. È
 * il motivo per cui qui non compare da nessuna parte un campo con una cifra
 * modificabile, nemmeno nascosto.
 */
export function Rata({ rata }: { rata: PagamentoPerCliente }) {
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  function avviaPagamento() {
    setErrore(null);
    avvia(async () => {
      const esito = await paga({ pagamentoId: rata.id });
      if (!esito.ok) {
        setErrore(esito.messaggio);
        return;
      }
      // Stripe è un dominio esterno: si esce dall'applicazione, non si naviga.
      window.location.href = esito.url;
    });
  }

  return (
    <div className="border-bordo bg-superficie flex flex-col gap-3 rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-testo font-semibold">{ETICHETTA_TIPO[rata.tipo] ?? "Rata"}</span>
          {rata.pagatoAt ? (
            <span className="text-testo-tenue text-sm">Pagato il {dataEstesa(rata.pagatoAt)}</span>
          ) : rata.scadenzaAt ? (
            <span className="text-testo-tenue text-sm">Entro il {dataEstesa(rata.scadenzaAt)}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="cifre text-testo text-lg">{euroDaCentesimi(rata.importoCent)}</span>
          <Badge tono={TONO_STATO[rata.stato] ?? "neutro"}>
            {ETICHETTA_STATO[rata.stato] ?? rata.stato}
          </Badge>
        </div>
      </div>

      {errore ? (
        <Avviso tono="errore" titolo="Non è stato possibile aprire il pagamento">
          {errore}
        </Avviso>
      ) : null}

      {rata.pagabileOra ? (
        <div>
          <Bottone variante="identita" disabled={inCorso} onClick={avviaPagamento}>
            {inCorso ? "Apro il pagamento…" : `Paga ${euroDaCentesimi(rata.importoCent)}`}
          </Bottone>
        </div>
      ) : null}
    </div>
  );
}
