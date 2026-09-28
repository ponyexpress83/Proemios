"use client";

import { useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, AreaTesto, Consenso } from "@/components/ui/campi";
import { Badge } from "@/components/ui/badge";
import { Avviso } from "@/components/ui/stati";
import { Nota } from "@/components/ui/primitivi";
import { Scheda, SchedaCorpo, SchedaTestata } from "@/components/ui/scheda";
import { dataEstesa } from "@/lib/format";
import { revoca, salva } from "@/app/admin/provider/azioni";
import { incoerenzePolicy, type DatiPolicy } from "@/lib/ai/policy-coerenza";
import type { PolicyDTO } from "@/lib/dati/provider";
import type { Provider } from "@/config/modelli";

/**
 * Scheda della policy di un provider.
 *
 * Le incoerenze si mostrano **mentre** si compila, usando la stessa funzione
 * che il server userà per rifiutare: così non si scopre dopo il salvataggio che
 * la combinazione non stava in piedi. Il controllo resta comunque anche di là —
 * questo è comodità, non sicurezza.
 */
export function SchedaPolicy({
  provider,
  iniziale,
  puoApprovare,
}: {
  provider: Provider;
  iniziale: PolicyDTO | null;
  puoApprovare: boolean;
}) {
  const [dati, setDati] = useState<DatiPolicy>({
    provider,
    addestramentoConsentito: iniziale?.addestramentoConsentito ?? false,
    zeroDataRetention: iniziale?.zeroDataRetention ?? false,
    giorniConservazione: iniziale?.giorniConservazione ?? null,
    dpaDisponibile: iniziale?.dpaDisponibile ?? false,
    regioneDati: iniziale?.regioneDati ?? "",
    subresponsabili: iniziale?.subresponsabili ?? [],
    approvatoManoscrittiInediti: iniziale?.approvatoManoscrittiInediti ?? false,
    approvatoProgettiSensibili: iniziale?.approvatoProgettiSensibili ?? false,
    note: iniziale?.note ?? "",
  });
  const [motivoRevoca, setMotivoRevoca] = useState("");
  const [revocando, setRevocando] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  const problemi = incoerenzePolicy(dati);
  const attivo = iniziale?.approvatoManoscrittiInediti ?? false;

  function campo<K extends keyof DatiPolicy>(chiave: K, valore: DatiPolicy[K]) {
    setDati((d) => ({ ...d, [chiave]: valore }));
  }

  return (
    <Scheda variante={attivo ? "identita" : "piana"}>
      <SchedaTestata
        titolo={
          <span className="flex items-center gap-2">
            {provider}
            {attivo ? (
              <Badge tono="lime">Approvato</Badge>
            ) : (
              <Badge tono="attenzione">Non approvato</Badge>
            )}
          </span>
        }
        sotto={
          iniziale?.rivistoAt
            ? `Rivista il ${dataEstesa(iniziale.rivistoAt)}${iniziale.rivistoDaNome ? ` da ${iniziale.rivistoDaNome}` : ""}`
            : "Mai registrata: il router esclude questo fornitore."
        }
      />
      <SchedaCorpo className="flex flex-col gap-5">
        {esito ? (
          <Avviso
            tono={esito.ok ? "successo" : "errore"}
            titolo={esito.ok ? "Salvata" : "Non salvata"}
          >
            {esito.testo}
          </Avviso>
        ) : null}

        <div className="flex flex-col gap-3">
          <p className="etichetta text-testo-tenue">Condizioni dichiarate nel contratto</p>

          <Consenso
            id={`dpa-${provider}`}
            name={`dpa-${provider}`}
            checked={dati.dpaDisponibile}
            onChange={(v) => campo("dpaDisponibile", v)}
          >
            <strong className="text-testo">DPA firmato.</strong> Esiste un accordo sul trattamento
            dei dati, controfirmato.
          </Consenso>

          <Consenso
            id={`addestramento-${provider}`}
            name={`addestramento-${provider}`}
            checked={dati.addestramentoConsentito}
            onChange={(v) => campo("addestramentoConsentito", v)}
          >
            <strong className="text-testo">Il fornitore può addestrare sui dati.</strong> Se è così,
            non si approva: i manoscritti sono inediti.
          </Consenso>

          <Consenso
            id={`zdr-${provider}`}
            name={`zdr-${provider}`}
            checked={dati.zeroDataRetention}
            onChange={(v) => campo("zeroDataRetention", v)}
          >
            <strong className="text-testo">Zero data retention.</strong> Il fornitore non conserva
            il contenuto delle richieste.
          </Consenso>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id={`giorni-${provider}`}
            label="Giorni di conservazione"
            hint="Vuoto se non dichiarato. Zero se non conserva nulla."
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={dati.giorniConservazione ?? ""}
                onChange={(e) =>
                  campo(
                    "giorniConservazione",
                    e.target.value.trim() === "" ? null : Number(e.target.value),
                  )
                }
              />
            )}
          </Campo>

          <Campo id={`regione-${provider}`} label="Regione dei dati">
            {(props) => (
              <Input
                {...props}
                placeholder="Unione Europea"
                value={dati.regioneDati}
                onChange={(e) => campo("regioneDati", e.target.value)}
              />
            )}
          </Campo>
        </div>

        <Campo
          id={`sub-${provider}`}
          label="Sub-responsabili"
          hint="Uno per riga. Sono i fornitori del tuo fornitore: vanno nell'informativa."
        >
          {(props) => (
            <AreaTesto
              {...props}
              className="min-h-20 text-sm"
              value={dati.subresponsabili.join("\n")}
              onChange={(e) =>
                campo(
                  "subresponsabili",
                  e.target.value
                    .split("\n")
                    .map((r) => r.trim())
                    .filter(Boolean),
                )
              }
            />
          )}
        </Campo>

        <div className="border-bordo flex flex-col gap-3 rounded-md border p-4">
          <p className="etichetta text-testo-tenue">Approvazione</p>
          <Nota>
            Spuntare qui significa dichiarare di aver letto il contratto e di assumersene la
            responsabilità. Il tuo nome resta accanto alla riga.
          </Nota>

          <Consenso
            id={`inediti-${provider}`}
            name={`inediti-${provider}`}
            checked={dati.approvatoManoscrittiInediti}
            onChange={(v) => campo("approvatoManoscrittiInediti", v)}
          >
            Approvato per i <strong className="text-testo">manoscritti inediti</strong>. Senza
            questa spunta nessun Job userà il fornitore.
          </Consenso>

          <Consenso
            id={`sensibili-${provider}`}
            name={`sensibili-${provider}`}
            checked={dati.approvatoProgettiSensibili}
            onChange={(v) => campo("approvatoProgettiSensibili", v)}
          >
            Approvato per i <strong className="text-testo">progetti sensibili</strong> (memoir,
            storie familiari, dati particolari).
          </Consenso>
        </div>

        <Campo
          id={`note-${provider}`}
          label="Note"
          hint="Estremi del contratto, data, chi l'ha firmato."
        >
          {(props) => (
            <AreaTesto
              {...props}
              className="min-h-20 text-sm"
              value={dati.note}
              onChange={(e) => campo("note", e.target.value)}
            />
          )}
        </Campo>

        {problemi.length > 0 ? (
          <Avviso tono="attenzione" titolo="Questa combinazione non sta in piedi">
            <ul className="list-disc pl-5">
              {problemi.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Avviso>
        ) : null}

        {puoApprovare ? (
          <div className="flex flex-wrap items-center gap-3">
            <Bottone
              disabled={inCorso || problemi.length > 0}
              onClick={() => {
                setEsito(null);
                avvia(async () => {
                  const r = await salva(dati);
                  setEsito({ ok: r.ok, testo: r.messaggio });
                });
              }}
            >
              {inCorso ? "Salvo…" : "Salva e approva"}
            </Bottone>

            {attivo ? (
              <Bottone
                variante="distruttivo"
                misura="piccola"
                onClick={() => setRevocando((r) => !r)}
              >
                Revoca l&apos;approvazione
              </Bottone>
            ) : null}
          </div>
        ) : (
          <Nota>
            Il tuo ruolo può consultare le policy ma non approvarle: approvare un trattamento dei
            dati è un atto che richiede il ruolo di amministratore.
          </Nota>
        )}

        {revocando && puoApprovare ? (
          <div className="border-errore/40 flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="flex min-w-52 flex-1 flex-col gap-1">
              <label htmlFor={`revoca-${provider}`} className="etichetta text-testo-tenue">
                Perché revochi
              </label>
              <Input
                id={`revoca-${provider}`}
                className="h-9 text-sm"
                value={motivoRevoca}
                onChange={(e) => setMotivoRevoca(e.target.value)}
              />
            </div>
            <Bottone
              variante="distruttivo"
              misura="piccola"
              disabled={inCorso || !motivoRevoca.trim()}
              onClick={() => {
                setEsito(null);
                avvia(async () => {
                  const r = await revoca({ provider, motivo: motivoRevoca });
                  setEsito({ ok: r.ok, testo: r.messaggio });
                  if (r.ok) setRevocando(false);
                });
              }}
            >
              Conferma la revoca
            </Bottone>
          </div>
        ) : null}
      </SchedaCorpo>
    </Scheda>
  );
}
