import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Gabbia, Titolo } from "@/components/ui/primitivi";
import { Scheda, SchedaCorpo } from "@/components/ui/scheda";
import { BadgeStato } from "@/components/ui/badge";
import { StatoVuoto } from "@/components/ui/stati";
import { Progresso } from "@/components/ui/progresso";
import { BottoneLink } from "@/components/ui/bottone";
import { ElencoApprovazioni } from "@/components/progetti/approvazioni";
import { attorePerPagina } from "@/lib/auth/sessione";
import { riepilogoCliente } from "@/lib/dati/progetti";
import { approvazioniInAttesa } from "@/lib/dati/comunicazioni";
import { dataEstesa } from "@/lib/format";
import { STATO_PROGETTO } from "@/config/back-office";

export const metadata: Metadata = { title: "I miei progetti" };
export const dynamic = "force-dynamic";

export default async function AreaCliente() {
  const attore = await attorePerPagina("/area");
  const [riepilogo, approvazioni] = await Promise.all([
    riepilogoCliente(attore),
    approvazioniInAttesa(attore),
  ]);

  const attivi = riepilogo.progetti.filter((p) => p.stato !== "concluso" && p.stato !== "annullato");
  const conclusi = riepilogo.progetti.filter((p) => p.stato === "concluso");

  return (
    <Gabbia className="flex flex-col gap-10 py-12">
      <Titolo
        livello={1}
        occhiello="Area riservata"
        sotto={
          riepilogo.prossimaScadenza
            ? `Prossima scadenza: ${dataEstesa(riepilogo.prossimaScadenza)}.`
            : "Qui trovi lo stato dei tuoi progetti e le richieste che aspettano una tua risposta."
        }
      >
        Ciao{attore.nome ? `, ${attore.nome.split(" ")[0]}` : ""}.
      </Titolo>

      {approvazioni.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="etichetta text-lime">Aspettano una tua risposta</h2>
          <ElencoApprovazioni voci={approvazioni} percorsoRitorno="/area/progetti" />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="etichetta text-testo-tenue">Progetti attivi</h2>
        {attivi.length === 0 ? (
          <StatoVuoto
            icona={<FolderOpen className="size-5" aria-hidden />}
            titolo="Nessun progetto attivo"
            descrizione="Quando apriamo un progetto per te lo trovi qui, con lo stato di avanzamento, i file e le richieste che aspettano una tua risposta."
            azione={
              <BottoneLink href="/preventivo" variante="identita">
                Fai un preventivo
              </BottoneLink>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {attivi.map((p) => {
              const s = STATO_PROGETTO[p.stato] ?? { etichetta: p.stato, tono: "neutro" as const };
              return (
                <Link
                  key={p.id}
                  href={`/area/progetti/${p.id}` as Route}
                  className="garbo group flex flex-col gap-4 rounded-lg border border-bordo bg-superficie p-6 hover:border-bordo-forte hover:bg-superficie-viva"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="cifre text-xs text-testo-tenue">{p.codice}</span>
                      <span className="text-base font-medium text-testo">{p.titolo}</span>
                    </div>
                    <BadgeStato tono={s.tono}>{s.etichetta}</BadgeStato>
                  </div>
                  <Progresso valore={p.avanzamento} etichetta="Avanzamento" />
                  <div className="flex items-center justify-between border-t border-bordo pt-4">
                    <span className="text-xs text-testo-tenue">
                      {p.scadenzaAt ? `Consegna prevista ${dataEstesa(p.scadenzaAt)}` : "Data da fissare"}
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="garbo size-3.5 text-testo-tenue group-hover:translate-x-0.5 group-hover:text-viola-chiaro"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {conclusi.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="etichetta text-testo-tenue">Conclusi</h2>
          <Scheda>
            <SchedaCorpo className="pt-5">
              <ul className="flex flex-col divide-y divide-bordo">
                {conclusi.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/area/progetti/${p.id}` as Route}
                      className="garbo -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 hover:bg-superficie-viva"
                    >
                      <span className="truncate text-sm text-testo">{p.titolo}</span>
                      <span className="cifre shrink-0 text-xs text-testo-tenue">
                        {p.conclusoAt ? dataEstesa(p.conclusoAt) : p.codice}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SchedaCorpo>
          </Scheda>
        </section>
      ) : null}
    </Gabbia>
  );
}
