"use client";

import { useEffect, useState, useTransition } from "react";
import { Cassetto } from "@/components/ui/cassetto";
import { Badge, BadgeStato } from "@/components/ui/badge";
import { Bottone } from "@/components/ui/bottone";
import { Campo, AreaTesto, Selezione, Input } from "@/components/ui/campi";
import { Avviso, StatoVuoto } from "@/components/ui/stati";
import { Dato, Filetto } from "@/components/ui/primitivi";
import { euro, dataEstesa } from "@/lib/format";
import type { LeadPerStaff, AttribuzioneLead } from "@/lib/dto/lead";
import type { UtenteRiferimento } from "@/lib/dto/utente";
import type { StatoLead } from "@/lib/crm/pipeline";
import { ETICHETTA_FONTE, ETICHETTA_STATO, TONO_STATO, temperatura } from "./etichette";
import { azioneAssegna, azioneCambiaStato, azioneNota, azionePianifica } from "@/app/admin/crm/azioni";
import { caricaDettaglioLead, type DettaglioLead } from "@/app/admin/crm/dettaglio";

export function SchedaLead({
  lead,
  staff,
  puoAssegnare,
  puoModificare,
  vedeAttribuzione,
  onChiudi,
}: {
  lead: LeadPerStaff | null;
  staff: UtenteRiferimento[];
  puoAssegnare: boolean;
  puoModificare: boolean;
  vedeAttribuzione: boolean;
  onChiudi: () => void;
}) {
  const [dettaglio, setDettaglio] = useState<DettaglioLead | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [inCorso, avvia] = useTransition();

  // La cronologia e l'attribuzione si caricano all'apertura: tenerle nella
  // lista significherebbe leggerle per ogni riga, anche per le 24 che nessuno apre.
  useEffect(() => {
    if (!lead) {
      setDettaglio(null);
      return;
    }
    let annullato = false;
    caricaDettaglioLead(lead.id).then((d) => {
      if (!annullato) setDettaglio(d);
    });
    return () => {
      annullato = true;
    };
  }, [lead]);

  if (!lead) return null;

  const t = temperatura(lead.leadScore);
  const statiPossibili = dettaglio?.statiRaggiungibili ?? [];

  function esegui(azione: () => Promise<{ ok: true } | { ok: false; messaggio: string }>) {
    setErrore(null);
    avvia(async () => {
      const esito = await azione();
      if (!esito.ok) setErrore(esito.messaggio);
      else if (lead) {
        const aggiornato = await caricaDettaglioLead(lead.id);
        setDettaglio(aggiornato);
      }
    });
  }

  return (
    <Cassetto
      aperto={Boolean(lead)}
      onApertoChange={(v) => !v && onChiudi()}
      titolo={lead.nome}
      descrizione={lead.email}
    >
      <div className="flex flex-col gap-7">
        {errore ? <Avviso tono="errore">{errore}</Avviso> : null}

        <div className="flex flex-wrap items-center gap-2">
          <BadgeStato tono={TONO_STATO[lead.stato as StatoLead]}>
            {ETICHETTA_STATO[lead.stato as StatoLead]}
          </BadgeStato>
          <Badge tono={t.tono}>
            {t.etichetta}
            {lead.leadScore !== null ? ` · ${lead.leadScore}` : ""}
          </Badge>
          <Badge>{ETICHETTA_FONTE[lead.fonte] ?? lead.fonte}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Dato etichetta="Telefono">{lead.telefono ?? "—"}</Dato>
          <Dato etichetta="Valore stimato" numerico>
            {lead.valoreStimato ? euro(lead.valoreStimato) : "—"}
          </Dato>
          <Dato etichetta="Primo contatto">
            {lead.createdAt ? dataEstesa(lead.createdAt) : "—"}
          </Dato>
          <Dato etichetta="Ultima attività">
            {lead.ultimaAttivitaAt ? dataEstesa(lead.ultimaAttivitaAt) : "—"}
          </Dato>
          <Dato etichetta="Consenso privacy">{lead.consensoPrivacy ? "Sì" : "No"}</Dato>
          <Dato etichetta="Consenso marketing">{lead.consensoMarketing ? "Sì" : "No"}</Dato>
        </div>

        {lead.note ? (
          <div className="flex flex-col gap-1.5">
            <span className="etichetta text-testo-tenue">Nota iniziale</span>
            <p className="text-sm leading-relaxed text-testo-attenuato">{lead.note}</p>
          </div>
        ) : null}

        {puoModificare ? (
          <>
            <Filetto />
            <div className="flex flex-col gap-4">
              <span className="etichetta text-testo-tenue">Cambia stato</span>
              {statiPossibili.length === 0 ? (
                <p className="text-sm text-testo-tenue">
                  Da questo stato non sono previste transizioni.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {statiPossibili.map((s) => (
                    <Bottone
                      key={s}
                      variante="secondario"
                      misura="piccola"
                      disabled={inCorso}
                      onClick={() =>
                        esegui(() => azioneCambiaStato({ leadId: lead.id, stato: s }))
                      }
                    >
                      {ETICHETTA_STATO[s]}
                    </Bottone>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}

        {puoAssegnare ? (
          <div className="flex flex-col gap-2">
            <Campo label="Titolare" id="owner-lead">
              {(props) => (
                <Selezione
                  {...props}
                  defaultValue={lead.ownerId ?? ""}
                  disabled={inCorso}
                  onChange={(e) =>
                    esegui(() =>
                      azioneAssegna({ leadId: lead.id, ownerId: e.target.value || null }),
                    )
                  }
                >
                  <option value="">Non assegnato</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome ?? s.id.slice(0, 8)}
                    </option>
                  ))}
                </Selezione>
              )}
            </Campo>
          </div>
        ) : null}

        {puoModificare ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nota.trim()) return;
              esegui(async () => {
                const esito = await azioneNota({ leadId: lead.id, nota });
                if (esito.ok) setNota("");
                return esito;
              });
            }}
          >
            <Campo label="Aggiungi una nota" id="nota-lead">
              {(props) => (
                <AreaTesto
                  {...props}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Cosa è emerso, cosa serve, cosa aspettiamo."
                />
              )}
            </Campo>
            <Bottone type="submit" misura="piccola" disabled={inCorso || !nota.trim()}>
              Salva nota
            </Bottone>
          </form>
        ) : null}

        {puoModificare ? <PianificaAttivita leadId={lead.id} onEsegui={esegui} /> : null}

        {vedeAttribuzione && dettaglio?.attribuzione ? (
          <>
            <Filetto />
            <Attribuzione dati={dettaglio.attribuzione} />
          </>
        ) : null}

        <Filetto />
        <div className="flex flex-col gap-3">
          <span className="etichetta text-testo-tenue">Cronologia</span>
          {!dettaglio ? (
            <p className="text-sm text-testo-tenue">Caricamento…</p>
          ) : dettaglio.cronologia.length === 0 ? (
            <StatoVuoto titolo="Nessun evento registrato" />
          ) : (
            <ol className="flex flex-col divide-y divide-bordo">
              {dettaglio.cronologia.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-3 first:pt-0">
                  <span className="text-sm text-testo">{e.descrizione ?? e.tipo}</span>
                  <span className="cifre text-xs text-testo-tenue">{dataEstesa(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Cassetto>
  );
}

function PianificaAttivita({
  leadId,
  onEsegui,
}: {
  leadId: string;
  onEsegui: (a: () => Promise<{ ok: true } | { ok: false; messaggio: string }>) => void;
}) {
  const [quando, setQuando] = useState("");
  const [cosa, setCosa] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!quando || !cosa.trim()) return;
        onEsegui(async () => {
          const esito = await azionePianifica({
            leadId,
            quando: new Date(quando).toISOString(),
            cosa,
          });
          if (esito.ok) {
            setQuando("");
            setCosa("");
          }
          return esito;
        });
      }}
    >
      <span className="etichetta text-testo-tenue">Prossima attività</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Quando" id="quando-lead">
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
            />
          )}
        </Campo>
        <Campo label="Cosa" id="cosa-lead">
          {(props) => (
            <Input
              {...props}
              value={cosa}
              onChange={(e) => setCosa(e.target.value)}
              placeholder="Richiamare per il preventivo"
            />
          )}
        </Campo>
      </div>
      <Bottone type="submit" misura="piccola" variante="secondario" disabled={!quando || !cosa.trim()}>
        Pianifica
      </Bottone>
    </form>
  );
}

function Attribuzione({ dati }: { dati: AttribuzioneLead }) {
  const voci: [string, string | null][] = [
    ["Sorgente", dati.utmSource],
    ["Mezzo", dati.utmMedium],
    ["Campagna", dati.utmCampaign],
    ["Contenuto", dati.utmContent],
    ["Termine", dati.utmTerm],
    ["Google click id", dati.gclid],
    ["Meta click id", dati.fbclid],
    ["Landing", dati.landingPath],
    ["Referrer", dati.referrer],
  ];
  const presenti = voci.filter(([, v]) => v);

  return (
    <div className="flex flex-col gap-3">
      <span className="etichetta text-testo-tenue">Attribuzione</span>
      {presenti.length === 0 ? (
        <p className="text-sm text-testo-tenue">Nessun dato di campagna: traffico diretto.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          {presenti.map(([etichetta, valore]) => (
            <div key={etichetta} className="flex flex-col gap-1">
              <dt className="etichetta text-testo-tenue">{etichetta}</dt>
              <dd className="truncate text-sm text-testo" title={valore ?? undefined}>
                {valore}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
