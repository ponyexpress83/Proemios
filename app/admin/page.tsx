import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, Flame } from "lucide-react";
import { Titolo, Nota } from "@/components/ui/primitivi";
import { Scheda, SchedaMetrica, SchedaTestata, SchedaCorpo } from "@/components/ui/scheda";
import { Badge, BadgeStato } from "@/components/ui/badge";
import { Avviso, StatoVuoto } from "@/components/ui/stati";
import { BottoneLink } from "@/components/ui/bottone";
import { staffPerPagina } from "@/lib/auth/sessione";
import { cruscotto, jobAssegnati } from "@/lib/dati/cruscotto";
import { approvazioniInAttesa } from "@/lib/dati/comunicazioni";
import { elencaProgetti } from "@/lib/dati/progetti";
import { euro, numero, dataEstesa } from "@/lib/format";
import { demoEsplicita } from "@/lib/demo";
import { STATO_PROGETTO, TIPO_APPROVAZIONE } from "@/config/back-office";
import { ETICHETTE_RUOLO } from "@/lib/auth/ruoli";

export const metadata: Metadata = { title: "Cruscotto", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Cruscotto() {
  if (demoEsplicita()) return <AvvisoDemo />;

  const attore = await staffPerPagina("/admin");
  const [numeri, approvazioni, progetti, job] = await Promise.all([
    cruscotto(attore),
    approvazioniInAttesa(attore),
    elencaProgetti(attore, { perPagina: 8 }).catch(() => ({ voci: [], totale: 0 })),
    attore.ruolo === "editor_reviewer" ? jobAssegnati(attore) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Titolo livello={1} occhiello={ETICHETTE_RUOLO[attore.ruolo]}>
        Cruscotto
      </Titolo>

      {numeri.commerciale ? (
        <section className="flex flex-col gap-4">
          <h2 className="etichetta text-testo-tenue">Commerciale</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SchedaMetrica
              etichetta="Nuovi (7 giorni)"
              valore={numero(numeri.commerciale.leadNuovi7g)}
            />
            <SchedaMetrica
              etichetta="Lead caldi"
              valore={numero(numeri.commerciale.leadCaldi)}
              tono={numeri.commerciale.leadCaldi > 0 ? "positivo" : "neutro"}
              dettaglio="Da richiamare subito"
            />
            <SchedaMetrica etichetta="Call" valore={numero(numeri.commerciale.callPrenotate)} />
            <SchedaMetrica etichetta="Offerte aperte" valore={numero(numeri.commerciale.proposteAperte)} />
            <SchedaMetrica
              etichetta="Valore pipeline"
              valore={euro(numeri.commerciale.valorePipeline)}
            />
          </div>
        </section>
      ) : null}

      {numeri.produzione ? (
        <section className="flex flex-col gap-4">
          <h2 className="etichetta text-testo-tenue">Produzione</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SchedaMetrica
              etichetta="Progetti in corso"
              valore={numero(numeri.produzione.progettiInCorso)}
            />
            <SchedaMetrica
              etichetta="In ritardo"
              valore={numero(numeri.produzione.progettiInRitardo)}
              tono={numeri.produzione.progettiInRitardo > 0 ? "critico" : "neutro"}
            />
            <SchedaMetrica
              etichetta="Job in revisione"
              valore={numero(numeri.produzione.jobInRevisione)}
            />
            <SchedaMetrica
              etichetta="Job falliti"
              valore={numero(numeri.produzione.jobFalliti)}
              tono={numeri.produzione.jobFalliti > 0 ? "critico" : "neutro"}
            />
          </div>
        </section>
      ) : null}

      {numeri.amministrazione ? (
        <section className="flex flex-col gap-4">
          <h2 className="etichetta text-testo-tenue">Amministrazione</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <SchedaMetrica
              etichetta="Pagamenti in attesa"
              valore={numero(numeri.amministrazione.pagamentiInAttesa)}
              tono={numeri.amministrazione.pagamentiInAttesa > 0 ? "attenzione" : "neutro"}
            />
            <SchedaMetrica
              etichetta="Incassato questo mese"
              valore={euro(numeri.amministrazione.incassatoMese / 100)}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Scheda>
          <SchedaTestata
            titolo="Approvazioni che aspettano te"
            sotto={
              approvazioni.length > 0
                ? `${approvazioni.length} in attesa di una decisione`
                : undefined
            }
          />
          <SchedaCorpo>
            {approvazioni.length === 0 ? (
              <StatoVuoto titolo="Nulla in attesa" descrizione="Niente da decidere in questo momento." />
            ) : (
              <ul className="flex flex-col divide-y divide-bordo">
                {approvazioni.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm text-testo">
                        {TIPO_APPROVAZIONE[a.tipo] ?? a.tipo}
                      </span>
                      <span className="text-xs text-testo-tenue">
                        <span className="cifre">{a.progettoCodice}</span>
                        {a.milestoneNome ? ` · ${a.milestoneNome}` : ""}
                      </span>
                    </div>
                    {a.scadeAt ? (
                      <Badge tono="attenzione">
                        <Clock className="size-3" aria-hidden />
                        {dataEstesa(a.scadeAt)}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SchedaCorpo>
        </Scheda>

        <Scheda>
          <SchedaTestata
            titolo={attore.ruolo === "editor_reviewer" ? "I tuoi lavori" : "Progetti recenti"}
            azione={
              attore.ruolo !== "editor_reviewer" ? (
                <BottoneLink href="/admin/progetti" variante="quieto" misura="piccola">
                  Tutti
                </BottoneLink>
              ) : undefined
            }
          />
          <SchedaCorpo>
            {attore.ruolo === "editor_reviewer" ? (
              job.length === 0 ? (
                <StatoVuoto
                  titolo="Nessun lavoro assegnato"
                  descrizione="Quando ti viene assegnato un lavoro lo trovi qui."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-bordo">
                  {job.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="cifre text-sm text-testo">{j.progettoCodice}</span>
                        <span className="text-xs text-testo-tenue">
                          {j.livelloServizio} ·{" "}
                          {j.conteggioParole ? `${numero(j.conteggioParole)} parole` : "—"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {j.prioritaria ? (
                          <Badge tono="errore">
                            <Flame className="size-3" aria-hidden />
                            Urgente
                          </Badge>
                        ) : null}
                        {j.conteggioDaVerificare > 0 ? (
                          <Badge tono="attenzione">{j.conteggioDaVerificare} da verificare</Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : progetti.voci.length === 0 ? (
              <StatoVuoto
                titolo="Nessun progetto"
                descrizione="I progetti compaiono qui appena vengono creati."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-bordo">
                {progetti.voci.map((p) => {
                  const stato = STATO_PROGETTO[p.stato] ?? { etichetta: p.stato, tono: "neutro" as const };
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/admin/progetti/${p.id}` as Route}
                        className="garbo -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 hover:bg-superficie-viva"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-sm text-testo">{p.titolo}</span>
                          <span className="cifre text-xs text-testo-tenue">{p.codice}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <BadgeStato tono={stato.tono}>{stato.etichetta}</BadgeStato>
                          <ArrowRight className="size-3.5 text-testo-tenue" aria-hidden />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SchedaCorpo>
        </Scheda>
      </div>

      {numeri.produzione && numeri.produzione.progettiInRitardo > 0 ? (
        <Avviso tono="attenzione" titolo="Ci sono progetti oltre la data prevista">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="size-3.5" aria-hidden />
            {numero(numeri.produzione.progettiInRitardo)} progetti hanno superato la scadenza
            concordata. Vanno riprogrammati con il cliente, non lasciati scorrere.
          </span>
        </Avviso>
      ) : null}

      <Nota>
        I numeri mostrati dipendono dal tuo ruolo: quello che non vedi non è nascosto,
        semplicemente non viene calcolato.
      </Nota>
    </div>
  );
}

function AvvisoDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Titolo livello={1} occhiello="Demo">
        Cruscotto
      </Titolo>
      <Avviso tono="informazione" titolo="Modalità dimostrativa">
        Il back-office richiede un database e un account di staff. In questa modalità non ci sono
        dati veri da mostrare: il sito pubblico resta navigabile per intero.
      </Avviso>
    </div>
  );
}
