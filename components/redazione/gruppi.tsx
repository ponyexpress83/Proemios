"use client";

import { useMemo, useState } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Badge } from "@/components/ui/badge";
import { Nota } from "@/components/ui/primitivi";
import { Scheda, SchedaCorpo } from "@/components/ui/scheda";
import { ETICHETTA_CATEGORIA } from "@/lib/ai/livelli";
import { raggruppa, risparmio, type InterventoDaRaggruppare } from "@/lib/produzione/triage";
import type { InterventoPerRedattore } from "@/lib/dto/job";

/**
 * Il triage: gli interventi raggruppati in unità di decisione.
 *
 * Il raggruppamento è calcolato qui nel browser perché è **deterministico e
 * istantaneo** — confronta stringhe, non chiama nessun modello. Il redattore
 * può passare dalla vista raggruppata a quella per singola voce senza attendere
 * niente, e questo conta: un triage che fa aspettare viene disattivato.
 *
 * Le decisioni passano dalla stessa azione del banco: il gruppo è un modo di
 * scegliere quali id mandare, non un percorso diverso verso il database.
 */
export function VistaGruppi({
  interventi,
  inCorso,
  onDecidiGruppo,
  onApriGruppo,
}: {
  interventi: InterventoPerRedattore[];
  inCorso: boolean;
  onDecidiGruppo: (ids: string[], decisione: "accepted" | "rejected") => void;
  /** Apre il gruppo nella vista per voce, per guardarlo riga per riga. */
  onApriGruppo: (ids: string[]) => void;
}) {
  const [mostraTutti, setMostraTutti] = useState(false);

  const gruppi = useMemo(
    () => raggruppa(interventi as unknown as InterventoDaRaggruppare[]),
    [interventi],
  );
  const stima = risparmio(gruppi);

  const inBlocco = gruppi.filter((g) => !g.richiedeAttenzione);
  const daGuardare = gruppi.filter((g) => g.richiedeAttenzione);
  const visibili = mostraTutti ? gruppi : gruppi.slice(0, 40);

  if (gruppi.length === 0) {
    return <Nota>Non c&apos;è più niente da decidere.</Nota>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-bordo bg-superficie flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4">
        <span className="text-testo text-sm">
          <span className="cifre">{stima.interventi}</span> interventi in{" "}
          <span className="cifre text-lime">{stima.decisioni}</span> decisioni
        </span>
        <Nota>
          {inBlocco.length} gruppi si possono chiudere in blocco ·{" "}
          {daGuardare.reduce((t, g) => t + g.occorrenze, 0)} voci chiedono un&apos;occhiata
        </Nota>
      </div>

      <ul className="flex flex-col gap-2">
        {visibili.map((g) => (
          <li key={g.chiave}>
            <Scheda variante={g.richiedeAttenzione ? "sollevata" : "piana"}>
              <SchedaCorpo className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="cifre text-lime text-sm">{g.occorrenze}×</span>
                    <span className="text-testo lettura text-sm">{g.etichetta}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tono="viola">
                      {ETICHETTA_CATEGORIA[g.categoria as never] ?? g.categoria}
                    </Badge>
                    {g.tipo === "ricorrente" ? <Badge>stessa regola</Badge> : null}
                    {g.richiedeAttenzione ? <Badge tono="attenzione">da guardare</Badge> : null}
                    <span className="cifre text-testo-tenue text-xs">
                      min {Math.round(g.confidenzaMinima * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {g.occorrenze > 1 ? (
                    <Bottone
                      misura="piccola"
                      variante="quieto"
                      onClick={() => onApriGruppo(g.interventiIds)}
                    >
                      Vedi le {g.occorrenze}
                    </Bottone>
                  ) : null}
                  <Bottone
                    misura="piccola"
                    variante="secondario"
                    disabled={inCorso}
                    onClick={() => onDecidiGruppo(g.interventiIds, "accepted")}
                  >
                    Accetta
                  </Bottone>
                  <Bottone
                    misura="piccola"
                    variante="distruttivo"
                    disabled={inCorso}
                    onClick={() => onDecidiGruppo(g.interventiIds, "rejected")}
                  >
                    Rifiuta
                  </Bottone>
                </div>
              </SchedaCorpo>
            </Scheda>
          </li>
        ))}
      </ul>

      {!mostraTutti && gruppi.length > visibili.length ? (
        <Bottone variante="secondario" onClick={() => setMostraTutti(true)}>
          Mostra gli altri {gruppi.length - visibili.length} gruppi
        </Bottone>
      ) : null}
    </div>
  );
}
