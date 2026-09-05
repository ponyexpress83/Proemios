"use client";

import { useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Input, Selezione } from "@/components/ui/campi";
import { Badge } from "@/components/ui/badge";
import { Avviso } from "@/components/ui/stati";
import { euroDaCentesimi, dataEstesa } from "@/lib/format";
import { fattura, registraIncasso, rimborsa } from "@/app/admin/pagamenti/azioni";
import type { PagamentoPerStaff } from "@/lib/dto/commercio";

const ETICHETTA_TIPO: Record<string, string> = {
  acconto: "Acconto",
  saldo: "Saldo",
  milestone: "Milestone",
  personalizzato: "Rata",
};

const TONO: Record<string, "neutro" | "lime" | "attenzione" | "errore"> = {
  in_attesa: "attenzione",
  autorizzato: "neutro",
  pagato: "lime",
  fallito: "errore",
  rimborsato: "neutro",
  annullato: "neutro",
};

/**
 * Una rata nel back-office, con le azioni che l'amministrazione può compiere.
 *
 * I pulsanti compaiono in base allo stato, ma **la nascita del pulsante non è
 * il controllo**: ogni azione verifica il proprio permesso lato server. Qui la
 * regola serve a non proporre a nessuno un'operazione che verrebbe rifiutata.
 */
export function RigaIncasso({
  rata,
  puoRegistrare,
  puoRimborsare,
  puoFatturare,
  ordineCodice,
  cliente,
}: {
  rata: PagamentoPerStaff;
  puoRegistrare: boolean;
  puoRimborsare: boolean;
  puoFatturare: boolean;
  ordineCodice?: string;
  cliente?: string;
}) {
  const [pannello, setPannello] = useState<"nessuno" | "incasso" | "rimborso">("nessuno");
  const [riferimento, setRiferimento] = useState("");
  const [metodo, setMetodo] = useState<"bonifico" | "altro">("bonifico");
  const [importoRimborso, setImportoRimborso] = useState("");
  const [motivo, setMotivo] = useState("");
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  function esegui(azione: () => Promise<{ ok: boolean; messaggio?: string }>) {
    setMessaggio(null);
    avvia(async () => {
      const esito = await azione();
      setMessaggio({
        ok: esito.ok,
        testo: esito.messaggio ?? (esito.ok ? "Fatto." : "Operazione non riuscita."),
      });
      if (esito.ok) setPannello("nessuno");
    });
  }

  const rimborsabileCent = rata.importoCent - rata.importoRimborsatoCent;

  return (
    <div className="border-bordo bg-superficie flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-testo text-sm font-semibold">
              {ETICHETTA_TIPO[rata.tipo] ?? "Rata"}
            </span>
            {ordineCodice ? (
              <span className="cifre text-testo-tenue text-xs">{ordineCodice}</span>
            ) : null}
            <Badge tono={TONO[rata.stato] ?? "neutro"}>{rata.stato.replace("_", " ")}</Badge>
            <Badge>{rata.metodo}</Badge>
          </div>
          <span className="text-testo-tenue text-xs">
            {cliente ? `${cliente} · ` : ""}
            {rata.pagatoAt ? `incassato il ${dataEstesa(rata.pagatoAt)}` : "non incassato"}
            {rata.importoRimborsatoCent > 0
              ? ` · rimborsati ${euroDaCentesimi(rata.importoRimborsatoCent)}`
              : ""}
          </span>
        </div>
        <span className="cifre text-testo">{euroDaCentesimi(rata.importoCent)}</span>
      </div>

      {messaggio ? (
        <Avviso
          tono={messaggio.ok ? "successo" : "errore"}
          titolo={messaggio.ok ? "Fatto" : "Non riuscito"}
        >
          {messaggio.testo}
        </Avviso>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {puoRegistrare && rata.stato === "in_attesa" ? (
          <Bottone
            misura="piccola"
            variante="secondario"
            onClick={() => setPannello(pannello === "incasso" ? "nessuno" : "incasso")}
          >
            Registra un bonifico
          </Bottone>
        ) : null}
        {puoRimborsare && rimborsabileCent > 0 && rata.stato === "pagato" ? (
          <Bottone
            misura="piccola"
            variante="distruttivo"
            onClick={() => setPannello(pannello === "rimborso" ? "nessuno" : "rimborso")}
          >
            Rimborsa
          </Bottone>
        ) : null}
        {puoFatturare && rata.stato === "pagato" ? (
          <Bottone
            misura="piccola"
            variante="quieto"
            disabled={inCorso}
            onClick={() => esegui(() => fattura({ pagamentoId: rata.id }))}
          >
            Emetti fattura
          </Bottone>
        ) : null}
      </div>

      {pannello === "incasso" ? (
        <div className="border-bordo flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`metodo-${rata.id}`} className="etichetta text-testo-tenue">
              Metodo
            </label>
            <Selezione
              id={`metodo-${rata.id}`}
              className="h-9 w-36 text-sm"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as "bonifico" | "altro")}
            >
              <option value="bonifico">Bonifico</option>
              <option value="altro">Altro</option>
            </Selezione>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <label htmlFor={`rif-${rata.id}`} className="etichetta text-testo-tenue">
              Riferimento (CRO, estremi)
            </label>
            <Input
              id={`rif-${rata.id}`}
              className="h-9 text-sm"
              value={riferimento}
              onChange={(e) => setRiferimento(e.target.value)}
            />
          </div>
          <Bottone
            misura="piccola"
            disabled={inCorso || !riferimento.trim()}
            onClick={() =>
              esegui(() =>
                registraIncasso({ pagamentoId: rata.id, metodo, riferimentoEsterno: riferimento }),
              )
            }
          >
            Registra
          </Bottone>
        </div>
      ) : null}

      {pannello === "rimborso" ? (
        <div className="border-errore/40 flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`imp-${rata.id}`} className="etichetta text-testo-tenue">
              Importo in euro (max {euroDaCentesimi(rimborsabileCent)})
            </label>
            <Input
              id={`imp-${rata.id}`}
              className="h-9 w-40 text-sm"
              inputMode="decimal"
              value={importoRimborso}
              onChange={(e) => setImportoRimborso(e.target.value)}
            />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <label htmlFor={`mot-${rata.id}`} className="etichetta text-testo-tenue">
              Motivo
            </label>
            <Input
              id={`mot-${rata.id}`}
              className="h-9 text-sm"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <Bottone
            misura="piccola"
            variante="distruttivo"
            disabled={inCorso || !motivo.trim() || !importoRimborso.trim()}
            onClick={() =>
              esegui(() =>
                rimborsa({
                  pagamentoId: rata.id,
                  // La conversione avviene qui, e il server rifiuta comunque
                  // qualunque importo superi il rimborsabile.
                  importoCent: Math.round(Number(importoRimborso.replace(",", ".")) * 100),
                  motivo,
                }),
              )
            }
          >
            Rimborsa
          </Bottone>
        </div>
      ) : null}
    </div>
  );
}
