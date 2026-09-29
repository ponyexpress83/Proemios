"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Selezione } from "@/components/ui/campi";
import { Scheda, SchedaTestata, SchedaCorpo } from "@/components/ui/scheda";
import { Badge } from "@/components/ui/badge";
import { Avviso, StatoVuoto } from "@/components/ui/stati";
import { dataEstesa, numero } from "@/lib/format";
import { ETICHETTA_LIVELLO, LIVELLI, type LivelloServizio } from "@/lib/ai/livelli";
import { ETICHETTA_STATO_JOB, type StatoJob } from "@/lib/produzione/stati";
import {
  aggiungiAllaSquadra,
  assegnaLavoro,
  avviaLavorazione,
  riprendiLavorazione,
  togliDallaSquadra,
} from "@/app/admin/progetti/azioni";

/**
 * Squadra e lavorazioni di un progetto.
 *
 * Queste tre azioni — mettere qualcuno nella squadra, avviare una lavorazione,
 * assegnarla — esistevano nel livello dati ma non avevano interfaccia, e senza
 * di loro il percorso si interrompeva subito dopo la creazione del progetto:
 * `assegnaJob` rifiuta chi non è membro, e nessuno poteva diventarlo.
 *
 * Stanno insieme in un pannello solo perché è così che si usano: si apre il
 * progetto, si mette il redattore nella squadra, si avvia il lavoro sul file
 * caricato e glielo si assegna. Separarle in tre schermate vorrebbe dire far
 * navigare tre volte per un'unica operazione mentale.
 */

export type MembroSquadra = { userId: string; nome: string | null; ruolo: string };
export type PersonaAssegnabile = { id: string; nome: string | null; ruolo: string };
export type VersioneFile = { id: string; nomeFile: string; createdAt: string };
export type LavorazioneInCorso = {
  id: string;
  codice: string;
  stato: string;
  livelloServizio: string;
  assegnatoAId: string | null;
  conteggioInterventi: number;
  conteggioDaVerificare: number;
  scadenzaAt: string | null;
};

export function PannelloProduzione({
  progettoId,
  membri,
  staff,
  versioni,
  lavorazioni,
  puoGestireSquadra,
  puoAvviare,
  puoAssegnare,
}: {
  progettoId: string;
  membri: MembroSquadra[];
  staff: PersonaAssegnabile[];
  versioni: VersioneFile[];
  lavorazioni: LavorazioneInCorso[];
  puoGestireSquadra: boolean;
  puoAvviare: boolean;
  puoAssegnare: boolean;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  const nonAncoraMembri = staff.filter((s) => !membri.some((m) => m.userId === s.id));

  function esegui(azione: () => Promise<{ ok: boolean; messaggio?: string }>) {
    setErrore(null);
    avvia(async () => {
      const esito = await azione();
      if (!esito.ok) setErrore(esito.messaggio ?? "Operazione non riuscita.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {errore && <Avviso tono="errore">{errore}</Avviso>}

      {/* ── Squadra ────────────────────────────────────────────────── */}
      <Scheda>
        <SchedaTestata
          titolo="Squadra del progetto"
          sotto="Solo chi è nella squadra può ricevere una lavorazione: assegnarla significa dare accesso al manoscritto."
        />
        <SchedaCorpo className="flex flex-col gap-5">
          {membri.length === 0 ? (
            <StatoVuoto
              titolo="Nessuno assegnato"
              descrizione="Aggiungi almeno un redattore prima di avviare la lavorazione."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-bordo">
              {membri.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <span className="text-sm text-testo">{m.nome ?? "Senza nome"}</span>
                  <div className="flex items-center gap-3">
                    <Badge>{m.ruolo}</Badge>
                    {puoGestireSquadra && (
                      <Bottone
                        variante="quieto"
                        misura="piccola"
                        disabled={inCorso}
                        onClick={() =>
                          esegui(() => togliDallaSquadra({ progettoId, userId: m.userId }))
                        }
                      >
                        Togli
                      </Bottone>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {puoGestireSquadra && nonAncoraMembri.length > 0 && (
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const dati = new FormData(e.currentTarget);
                const userId = String(dati.get("userId") ?? "");
                if (!userId) return;
                const persona = staff.find((s) => s.id === userId);
                if (!persona) return;
                esegui(() =>
                  aggiungiAllaSquadra({
                    progettoId,
                    userId,
                    ruolo: persona.ruolo as Parameters<typeof aggiungiAllaSquadra>[0]["ruolo"],
                  }),
                );
              }}
            >
              <Campo label="Aggiungi alla squadra" id="membro-nuovo" className="flex-1">
                {(props) => (
                  <Selezione name="userId" defaultValue="" {...props}>
                    <option value="" disabled>
                      Scegli una persona
                    </option>
                    {nonAncoraMembri.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome ?? s.id} — {s.ruolo}
                      </option>
                    ))}
                  </Selezione>
                )}
              </Campo>
              <Bottone type="submit" variante="secondario" disabled={inCorso}>
                Aggiungi
              </Bottone>
            </form>
          )}
        </SchedaCorpo>
      </Scheda>

      {/* ── Lavorazioni ────────────────────────────────────────────── */}
      <Scheda>
        <SchedaTestata
          titolo="Lavorazioni"
          sotto="Il testo viene elaborato in coda, non durante la richiesta: un manoscritto lungo supererebbe il limite di durata."
        />
        <SchedaCorpo className="flex flex-col gap-5">
          {lavorazioni.length === 0 ? (
            <StatoVuoto
              titolo="Nessuna lavorazione"
              descrizione="Avvia la prima sul manoscritto caricato."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-bordo">
              {lavorazioni.map((l) => (
                <li key={l.id} className="flex flex-col gap-2 py-3 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/redazione/${l.id}` as Route}
                      className="garbo text-sm font-medium text-testo hover:text-viola-chiaro"
                    >
                      <span className="cifre text-testo-attenuato">{l.codice}</span>{" "}
                      {ETICHETTA_LIVELLO[l.livelloServizio as LivelloServizio] ?? l.livelloServizio}
                    </Link>
                    <div className="flex items-center gap-2">
                      {l.conteggioInterventi > 0 && (
                        <span className="cifre text-xs text-testo-tenue">
                          {numero(l.conteggioInterventi)} interventi
                          {l.conteggioDaVerificare > 0
                            ? `, ${numero(l.conteggioDaVerificare)} da verificare`
                            : ""}
                        </span>
                      )}
                      <Badge>{ETICHETTA_STATO_JOB[l.stato as StatoJob] ?? l.stato}</Badge>
                    </div>
                  </div>
                  {l.scadenzaAt && (
                    <p className="text-xs text-testo-tenue">Scade il {dataEstesa(l.scadenzaAt)}</p>
                  )}

                  {/*
                    Una lavorazione ferma va ripresa a mano: `failed` quando i
                    ritentativi automatici si sono esauriti, `queued` quando
                    l'evento si è perso perché la coda non era raggiungibile.
                    Senza, il cruscotto ne conta il numero e nessuno può farci
                    niente.
                  */}
                  {puoAvviare && (l.stato === "failed" || l.stato === "queued") && (
                    <Bottone
                      variante="secondario"
                      misura="piccola"
                      disabled={inCorso}
                      onClick={() =>
                        esegui(() => riprendiLavorazione({ progettoId, jobId: l.id }))
                      }
                    >
                      {l.stato === "failed" ? "Riprova" : "Rimetti in coda"}
                    </Bottone>
                  )}

                  {puoAssegnare && (
                    <Selezione
                      aria-label="Assegna la lavorazione"
                      className="h-9 text-sm"
                      defaultValue={l.assegnatoAId ?? ""}
                      disabled={inCorso}
                      onChange={(e) =>
                        esegui(() =>
                          assegnaLavoro({ progettoId, jobId: l.id, userId: e.target.value }),
                        )
                      }
                    >
                      <option value="">Non assegnata</option>
                      {membri.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.nome ?? m.userId}
                        </option>
                      ))}
                    </Selezione>
                  )}
                </li>
              ))}
            </ul>
          )}

          {puoAvviare && versioni.length > 0 && (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const dati = new FormData(e.currentTarget);
                esegui(() =>
                  avviaLavorazione({
                    progettoId,
                    fileVersionOrigineId: String(dati.get("fileVersionOrigineId") ?? ""),
                    livelloServizio: String(dati.get("livelloServizio") ?? "") as LivelloServizio,
                    modalitaRevisione: "controllato",
                  }),
                );
              }}
            >
              <Campo label="Manoscritto" id="lavorazione-file">
                {(props) => (
                  <Selezione name="fileVersionOrigineId" defaultValue={versioni[0]?.id} {...props}>
                    {versioni.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nomeFile} — {dataEstesa(v.createdAt)}
                      </option>
                    ))}
                  </Selezione>
                )}
              </Campo>
              <Campo
                label="Livello di intervento"
                id="lavorazione-livello"
                hint="Il livello è un tetto: il motore non applica categorie che non gli competono."
              >
                {(props) => (
                  <Selezione name="livelloServizio" defaultValue={LIVELLI[0]} {...props}>
                    {LIVELLI.map((l) => (
                      <option key={l} value={l}>
                        {ETICHETTA_LIVELLO[l]}
                      </option>
                    ))}
                  </Selezione>
                )}
              </Campo>
              <Bottone type="submit" variante="identita" disabled={inCorso}>
                {inCorso ? "Avvio…" : "Avvia la lavorazione"}
              </Bottone>
            </form>
          )}

          {puoAvviare && versioni.length === 0 && (
            <Avviso tono="informazione">
              Carica il manoscritto prima di avviare una lavorazione.
            </Avviso>
          )}
        </SchedaCorpo>
      </Scheda>
    </div>
  );
}
