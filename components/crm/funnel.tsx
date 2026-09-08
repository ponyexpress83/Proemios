import { Scheda } from "@/components/ui/scheda";
import { euro, numero } from "@/lib/format";
import { SEQUENZA_FUNNEL } from "@/lib/crm/pipeline";
import type { FunnelCrm } from "@/lib/dati/lead";
import { ETICHETTA_STATO } from "./etichette";
import { cn } from "@/lib/cn";

/**
 * Funnel commerciale. La barra è proporzionale al conteggio del primo stadio,
 * non a quello massimo: così si legge la caduta fra uno stadio e il successivo,
 * che è l'unica cosa che il funnel serve a mostrare.
 */
export function FunnelCommerciale({ dati }: { dati: FunnelCrm }) {
  const perStato = new Map(dati.map((d) => [d.stato, d]));
  const base = perStato.get("nuovo")?.conteggio ?? 0;
  const perso = perStato.get("perso");

  return (
    <Scheda className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-testo">Funnel</h2>
        {perso && perso.conteggio > 0 ? (
          <span className="text-xs text-testo-tenue">
            {numero(perso.conteggio)} persi
          </span>
        ) : null}
      </div>

      <ol className="flex flex-col gap-3">
        {SEQUENZA_FUNNEL.map((stato, i) => {
          const voce = perStato.get(stato);
          const conteggio = voce?.conteggio ?? 0;
          const larghezza = base > 0 ? Math.max(2, (conteggio / base) * 100) : 0;
          const precedente = i > 0 ? (perStato.get(SEQUENZA_FUNNEL[i - 1]!)?.conteggio ?? 0) : null;
          const conversione =
            precedente && precedente > 0 ? Math.round((conteggio / precedente) * 100) : null;

          return (
            <li key={stato} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-testo">{ETICHETTA_STATO[stato]}</span>
                <span className="flex items-baseline gap-3">
                  {conversione !== null ? (
                    <span className="cifre text-xs text-testo-tenue">{conversione}%</span>
                  ) : null}
                  <span className="cifre text-sm text-testo">{numero(conteggio)}</span>
                  {voce && voce.valore > 0 ? (
                    <span className="cifre text-xs text-testo-tenue">{euro(voce.valore)}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-superficie-viva">
                <div
                  className={cn(
                    "h-full rounded-full",
                    stato === "cliente" || stato === "produzione" ? "bg-lime" : "bg-viola",
                  )}
                  style={{ width: `${larghezza}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </Scheda>
  );
}
