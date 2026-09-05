"use client";

import { useMemo, useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { AreaTesto, Input, Selezione } from "@/components/ui/campi";
import { Badge } from "@/components/ui/badge";
import { Avviso } from "@/components/ui/stati";
import { Scheda, SchedaCorpo } from "@/components/ui/scheda";
import { Nota } from "@/components/ui/primitivi";
import { cn } from "@/lib/cn";
import { ETICHETTA_CATEGORIA } from "@/lib/ai/livelli";
import { decidi } from "@/app/redazione/azioni";
import { VistaGruppi } from "./gruppi";
import type { InterventoPerRedattore } from "@/lib/dto/job";

/**
 * Il banco di revisione.
 *
 * Il vincolo che ha determinato la forma di questo componente: un manoscritto
 * da ottantamila parole produce più di mille interventi, e un redattore non li
 * legge uno alla volta in una pagina che ricarica. Perciò:
 *
 *  - le decisioni si accumulano in locale e partono a blocchi, non una per
 *    richiesta;
 *  - i filtri lavorano sul client, senza andare al server;
 *  - si disegna una finestra di voci alla volta, non tutte: mille schede nel
 *    DOM rendono la pagina inutilizzabile su un portatile normale.
 *
 * Ciò che il componente **non** fa è altrettanto importante: non consegna, non
 * approva la consegna, non tocca lo stato del Job. Quelle sono azioni separate,
 * con permessi separati, esposte altrove.
 */

const PASSO_FINESTRA = 60;
/** Le decisioni partono a blocchi: una richiesta con mille voci è fragile. */
const BLOCCO = 400;

type StatoFiltro = "tutti" | "pending" | "accepted" | "rejected" | "modified";

const ETICHETTA_STATO_INTERVENTO: Record<string, string> = {
  pending: "Da decidere",
  accepted: "Accettato",
  rejected: "Rifiutato",
  modified: "Modificato",
};

const TONO_STATO_INTERVENTO: Record<string, "neutro" | "lime" | "errore" | "viola"> = {
  pending: "neutro",
  accepted: "lime",
  rejected: "errore",
  modified: "viola",
};

export function BancoRevisione({
  jobId,
  interventi,
  puoModificare,
  modificabile,
}: {
  jobId: string;
  interventi: InterventoPerRedattore[];
  /** `job.modifica_intervento`: senza, restano solo accetta e rifiuta. */
  puoModificare: boolean;
  /** Falso quando il Job non è più in revisione: il banco diventa di sola lettura. */
  modificabile: boolean;
}) {
  const [voci, setVoci] = useState(interventi);
  const [filtroStato, setFiltroStato] = useState<StatoFiltro>("pending");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("tutte");
  const [ricerca, setRicerca] = useState("");
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  const [finestra, setFinestra] = useState(PASSO_FINESTRA);
  /**
   * La vista raggruppata è quella predefinita: su un manoscritto vero le voci
   * sono centinaia, e aprirle una per una è il motivo per cui il triage esiste.
   */
  const [vista, setVista] = useState<"gruppi" | "voci">("gruppi");
  /** Sottoinsieme aperto da un gruppo, per guardarlo riga per riga. */
  const [apertiDaGruppo, setApertiDaGruppo] = useState<Set<string> | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  const categorie = useMemo(() => [...new Set(voci.map((i) => i.categoria))].sort(), [voci]);

  const filtrati = useMemo(() => {
    const cerca = ricerca.trim().toLowerCase();
    return voci.filter((i) => {
      if (apertiDaGruppo && !apertiDaGruppo.has(i.id)) return false;
      if (filtroStato !== "tutti" && i.stato !== filtroStato) return false;
      if (filtroCategoria !== "tutte" && i.categoria !== filtroCategoria) return false;
      if (cerca && !`${i.prima} ${i.dopo}`.toLowerCase().includes(cerca)) return false;
      return true;
    });
  }, [voci, filtroStato, filtroCategoria, ricerca, apertiDaGruppo]);

  const visibili = filtrati.slice(0, finestra);
  const inSospeso = voci.filter((i) => i.stato === "pending").length;

  /** Manda le decisioni al server e aggiorna la lista solo se sono passate. */
  function invia(
    decisioni: {
      interventoId: string;
      decisione: "accepted" | "rejected" | "modified";
      testoModificato?: string;
      commentoPerAutore?: string;
    }[],
  ) {
    if (decisioni.length === 0) return;
    setErrore(null);

    avvia(async () => {
      for (let i = 0; i < decisioni.length; i += BLOCCO) {
        const blocco = decisioni.slice(i, i + BLOCCO);
        const esito = await decidi({ jobId, decisioni: blocco });
        if (!esito.ok) {
          setErrore(esito.messaggio);
          return;
        }
        // Si aggiorna solo ciò che il server ha accettato: la lista non deve
        // mai mostrare uno stato che il database non ha.
        const perId = new Map(blocco.map((d) => [d.interventoId, d]));
        setVoci((precedenti) =>
          precedenti.map((v) => {
            const d = perId.get(v.id);
            if (!d) return v;
            return {
              ...v,
              stato: d.decisione,
              testoModificato: d.decisione === "modified" ? (d.testoModificato ?? null) : null,
              commentoPerAutore: d.commentoPerAutore ?? v.commentoPerAutore,
              rivistoAt: new Date().toISOString(),
            };
          }),
        );
      }
      setSelezione(new Set());
    });
  }

  function decidiSelezionati(decisione: "accepted" | "rejected") {
    invia([...selezione].map((interventoId) => ({ interventoId, decisione })));
  }

  function decidiFiltrati(decisione: "accepted" | "rejected") {
    invia(filtrati.map((i) => ({ interventoId: i.id, decisione })));
  }

  return (
    <div className="flex flex-col gap-5">
      {errore ? (
        <Avviso tono="errore" titolo="Le decisioni non sono state salvate">
          {errore}
        </Avviso>
      ) : null}

      {/* ── Vista ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Bottone
          misura="piccola"
          variante={vista === "gruppi" ? "primario" : "secondario"}
          onClick={() => {
            setVista("gruppi");
            setApertiDaGruppo(null);
          }}
        >
          Raggruppati
        </Bottone>
        <Bottone
          misura="piccola"
          variante={vista === "voci" ? "primario" : "secondario"}
          onClick={() => setVista("voci")}
        >
          Voce per voce
        </Bottone>
        {apertiDaGruppo ? (
          <Bottone
            misura="piccola"
            variante="quieto"
            onClick={() => {
              setApertiDaGruppo(null);
              setVista("gruppi");
            }}
          >
            ← Torna ai gruppi ({apertiDaGruppo.size} voci aperte)
          </Bottone>
        ) : null}
      </div>

      {vista === "gruppi" && !apertiDaGruppo ? (
        <VistaGruppi
          interventi={voci}
          inCorso={inCorso}
          onDecidiGruppo={(ids, decisione) =>
            invia(ids.map((interventoId) => ({ interventoId, decisione })))
          }
          onApriGruppo={(ids) => {
            setApertiDaGruppo(new Set(ids));
            setVista("voci");
            setFiltroStato("pending");
            setFinestra(PASSO_FINESTRA);
          }}
        />
      ) : (
        <>
          {/* ── Filtri ─────────────────────────────────────────────── */}
          <div className="border-bordo bg-superficie flex flex-wrap items-end gap-3 rounded-lg border p-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-stato" className="etichetta text-testo-tenue">
                Stato
              </label>
              <Selezione
                id="filtro-stato"
                className="h-9 w-44 text-sm"
                value={filtroStato}
                onChange={(e) => {
                  setFiltroStato(e.target.value as StatoFiltro);
                  setFinestra(PASSO_FINESTRA);
                }}
              >
                <option value="pending">Da decidere</option>
                <option value="accepted">Accettati</option>
                <option value="modified">Modificati</option>
                <option value="rejected">Rifiutati</option>
                <option value="tutti">Tutti</option>
              </Selezione>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-categoria" className="etichetta text-testo-tenue">
                Categoria
              </label>
              <Selezione
                id="filtro-categoria"
                className="h-9 w-52 text-sm"
                value={filtroCategoria}
                onChange={(e) => {
                  setFiltroCategoria(e.target.value);
                  setFinestra(PASSO_FINESTRA);
                }}
              >
                <option value="tutte">Tutte</option>
                {categorie.map((c) => (
                  <option key={c} value={c}>
                    {ETICHETTA_CATEGORIA[c as never] ?? c}
                  </option>
                ))}
              </Selezione>
            </div>

            <div className="flex min-w-52 flex-1 flex-col gap-1.5">
              <label htmlFor="filtro-ricerca" className="etichetta text-testo-tenue">
                Cerca nel testo
              </label>
              <Input
                id="filtro-ricerca"
                className="h-9 text-sm"
                value={ricerca}
                placeholder="una parola o un frammento"
                onChange={(e) => {
                  setRicerca(e.target.value);
                  setFinestra(PASSO_FINESTRA);
                }}
              />
            </div>

            <p aria-live="polite" className="text-testo-tenue pb-2 text-sm">
              {filtrati.length} di {voci.length} · {inSospeso} da decidere
            </p>
          </div>

          {/* ── Azioni in blocco ───────────────────────────────────── */}
          {modificabile ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-testo-attenuato flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-viola size-4"
                  checked={visibili.length > 0 && visibili.every((i) => selezione.has(i.id))}
                  onChange={(e) => {
                    const nuova = new Set(selezione);
                    for (const i of visibili) {
                      if (e.target.checked) nuova.add(i.id);
                      else nuova.delete(i.id);
                    }
                    setSelezione(nuova);
                  }}
                />
                Seleziona i {visibili.length} visibili
              </label>

              <Bottone
                misura="piccola"
                variante="secondario"
                disabled={selezione.size === 0 || inCorso}
                onClick={() => decidiSelezionati("accepted")}
              >
                Accetta {selezione.size > 0 ? `(${selezione.size})` : ""}
              </Bottone>
              <Bottone
                misura="piccola"
                variante="distruttivo"
                disabled={selezione.size === 0 || inCorso}
                onClick={() => decidiSelezionati("rejected")}
              >
                Rifiuta {selezione.size > 0 ? `(${selezione.size})` : ""}
              </Bottone>

              <span className="bg-bordo mx-1 h-5 w-px" aria-hidden />

              {/* Accettare in blocco è comodo e pericoloso: il conteggio nel testo
              del pulsante costringe a leggere quante voci si stanno decidendo. */}
              <Bottone
                misura="piccola"
                variante="quieto"
                disabled={filtrati.length === 0 || inCorso}
                onClick={() => decidiFiltrati("accepted")}
              >
                Accetta tutti i {filtrati.length} filtrati
              </Bottone>
              {inCorso ? <Nota>Salvataggio in corso…</Nota> : null}
            </div>
          ) : (
            <Avviso tono="informazione" titolo="Revisione chiusa">
              Questa lavorazione non è più in revisione: gli interventi restano consultabili ma non
              si possono più cambiare.
            </Avviso>
          )}

          {/* ── Elenco ─────────────────────────────────────────────── */}
          {filtrati.length === 0 ? (
            <Nota>Nessun intervento corrisponde ai filtri.</Nota>
          ) : (
            <ul className="flex flex-col gap-3">
              {visibili.map((i) => (
                <li key={i.id}>
                  <VoceIntervento
                    intervento={i}
                    selezionato={selezione.has(i.id)}
                    modificabile={modificabile}
                    puoModificare={puoModificare}
                    inCorso={inCorso}
                    onSeleziona={(attivo) => {
                      const nuova = new Set(selezione);
                      if (attivo) nuova.add(i.id);
                      else nuova.delete(i.id);
                      setSelezione(nuova);
                    }}
                    onDecidi={(d) => invia([{ interventoId: i.id, ...d }])}
                  />
                </li>
              ))}
            </ul>
          )}

          {finestra < filtrati.length ? (
            <Bottone variante="secondario" onClick={() => setFinestra((f) => f + PASSO_FINESTRA)}>
              Mostra altri {Math.min(PASSO_FINESTRA, filtrati.length - finestra)}
            </Bottone>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Una proposta di intervento.
 *
 * `motivazioneInterna` e `confidenza` si vedono perché servono a decidere in
 * fretta: sono materiale di back-office e non escono da qui — il DTO cliente
 * non ha nemmeno i campi. Il `commentoPerAutore` invece è l'unica cosa che
 * finisce nel documento consegnato, ed è per questo un campo separato che il
 * redattore scrive di sua mano.
 */
function VoceIntervento({
  intervento,
  selezionato,
  modificabile,
  puoModificare,
  inCorso,
  onSeleziona,
  onDecidi,
}: {
  intervento: InterventoPerRedattore;
  selezionato: boolean;
  modificabile: boolean;
  puoModificare: boolean;
  inCorso: boolean;
  onSeleziona: (attivo: boolean) => void;
  onDecidi: (d: {
    decisione: "accepted" | "rejected" | "modified";
    testoModificato?: string;
    commentoPerAutore?: string;
  }) => void;
}) {
  const [apertoModifica, setApertoModifica] = useState(false);
  const [testo, setTesto] = useState(intervento.testoModificato ?? intervento.dopo);
  const [commento, setCommento] = useState(intervento.commentoPerAutore ?? "");

  const deciso = intervento.stato !== "pending";
  const bassaConfidenza = intervento.confidenza < 0.7;

  return (
    <Scheda variante={deciso ? "piana" : "sollevata"} className={cn(deciso && "opacity-70")}>
      <SchedaCorpo className="flex flex-col gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {modificabile ? (
            <input
              type="checkbox"
              className="accent-viola size-4"
              checked={selezionato}
              aria-label={`Seleziona l'intervento su «${intervento.prima.slice(0, 40)}»`}
              onChange={(e) => onSeleziona(e.target.checked)}
            />
          ) : null}
          <Badge tono="viola">
            {ETICHETTA_CATEGORIA[intervento.categoria as never] ?? intervento.categoria}
          </Badge>
          <Badge tono={TONO_STATO_INTERVENTO[intervento.stato] ?? "neutro"}>
            {ETICHETTA_STATO_INTERVENTO[intervento.stato] ?? intervento.stato}
          </Badge>
          {bassaConfidenza ? <Badge tono="attenzione">Da guardare — confidenza bassa</Badge> : null}
          <span className="cifre text-testo-tenue ml-auto text-xs">
            {Math.round(intervento.confidenza * 100)}%
          </span>
        </div>

        <div className="lettura flex flex-col gap-1 text-[0.9375rem]">
          <p className="text-errore/90 decoration-errore/50 line-through">{intervento.prima}</p>
          <p className="text-lime">{intervento.testoModificato ?? intervento.dopo}</p>
        </div>

        <Nota>{intervento.motivazioneInterna}</Nota>

        {modificabile ? (
          <div className="flex flex-wrap items-center gap-2">
            <Bottone
              misura="piccola"
              variante="secondario"
              disabled={inCorso}
              onClick={() =>
                onDecidi({ decisione: "accepted", commentoPerAutore: commento || undefined })
              }
            >
              Accetta
            </Bottone>
            <Bottone
              misura="piccola"
              variante="distruttivo"
              disabled={inCorso}
              onClick={() => onDecidi({ decisione: "rejected" })}
            >
              Rifiuta
            </Bottone>
            {puoModificare ? (
              <Bottone
                misura="piccola"
                variante="quieto"
                onClick={() => setApertoModifica((a) => !a)}
                aria-expanded={apertoModifica}
              >
                {apertoModifica ? "Chiudi" : "Modifica"}
              </Bottone>
            ) : null}
          </div>
        ) : null}

        {apertoModifica && modificabile && puoModificare ? (
          <div className="border-bordo flex flex-col gap-3 rounded-md border p-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`testo-${intervento.id}`} className="etichetta text-testo-tenue">
                Testo che finirà nel documento
              </label>
              <AreaTesto
                id={`testo-${intervento.id}`}
                className="min-h-20 text-sm"
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`commento-${intervento.id}`} className="etichetta text-testo-tenue">
                Nota per l&apos;autore (facoltativa, comparirà come commento Word)
              </label>
              <AreaTesto
                id={`commento-${intervento.id}`}
                className="min-h-16 text-sm"
                value={commento}
                onChange={(e) => setCommento(e.target.value)}
              />
            </div>
            <div>
              <Bottone
                misura="piccola"
                disabled={inCorso || !testo.trim()}
                onClick={() => {
                  onDecidi({
                    decisione: "modified",
                    testoModificato: testo,
                    commentoPerAutore: commento || undefined,
                  });
                  setApertoModifica(false);
                }}
              >
                Salva la modifica
              </Bottone>
            </div>
          </div>
        ) : null}
      </SchedaCorpo>
    </Scheda>
  );
}
