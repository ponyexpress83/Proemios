import { Scheda, SchedaTestata, SchedaCorpo } from "@/components/ui/scheda";
import { Badge } from "@/components/ui/badge";
import { StatoVuoto } from "@/components/ui/stati";
import { dataEstesa } from "@/lib/format";
import type { FileDTO } from "@/lib/dati/file";

/** Quanto pesa, in una forma che si legge a colpo d'occhio. */
function peso(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

const ETICHETTA_RUOLO: Record<string, string> = {
  originale: "Originale",
  lavorazione: "In lavorazione",
  revisionata: "Revisionata",
  approvata: "Approvata",
  deliverable: "Consegna",
};

/**
 * File di un progetto, con il collegamento per scaricarli.
 *
 * Il link punta a `/api/file/versione/[id]`, che chiede al livello dati un URL
 * firmato e ci rimanda: l'indirizzo dello storage non compare mai nel markup,
 * e chi non ha titolo riceve 404 invece di 403 — distinguere «non tuo» da
 * «non esiste» permetterebbe di scoprire quali id esistono provandoli.
 *
 * Cosa si vede dipende dal ruolo, ma non per una scelta di questo componente:
 * `elencaFile` non restituisce affatto al cliente le versioni di lavorazione
 * interne. Qui si mostra ciò che arriva.
 */
export function ElencoFile({
  file,
  titolo = "File",
  sotto,
  azione,
}: {
  file: FileDTO[];
  titolo?: string;
  sotto?: string;
  azione?: React.ReactNode;
}) {
  const versioni = file.flatMap((f) => f.versioni);

  return (
    <Scheda>
      <SchedaTestata titolo={titolo} sotto={sotto} />
      <SchedaCorpo className="flex flex-col gap-5">
        {versioni.length === 0 ? (
          <StatoVuoto
            titolo="Nessun file"
            descrizione="Qui compaiono il manoscritto e tutto ciò che viene consegnato."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-bordo">
            {file.map((f) =>
              f.versioni.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex min-w-0 flex-col">
                    <a
                      href={`/api/file/versione/${v.id}`}
                      className="garbo truncate text-sm font-medium text-testo hover:text-viola-chiaro"
                    >
                      {v.nomeFile}
                    </a>
                    <span className="text-xs text-testo-tenue">
                      v{v.numeroVersione} · {peso(v.dimensioneByte)} · {dataEstesa(v.createdAt)}
                    </span>
                  </span>
                  <Badge tono={v.ruolo === "deliverable" ? "lime" : "neutro"}>
                    {ETICHETTA_RUOLO[v.ruolo] ?? v.ruolo}
                  </Badge>
                </li>
              )),
            )}
          </ul>
        )}
        {azione}
      </SchedaCorpo>
    </Scheda>
  );
}
