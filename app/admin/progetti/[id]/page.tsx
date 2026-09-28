import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Titolo, Dato } from "@/components/ui/primitivi";
import { Scheda, SchedaTestata, SchedaCorpo } from "@/components/ui/scheda";
import { BadgeStato, Badge } from "@/components/ui/badge";
import { Cronologia, Tappa } from "@/components/ui/cronologia";
import { Progresso } from "@/components/ui/progresso";
import { StatoVuoto } from "@/components/ui/stati";
import { Schede } from "@/components/ui/tab";
import { PannelloMessaggi } from "@/components/progetti/messaggi";
import { staffPerPagina } from "@/lib/auth/sessione";
import { leggiProgetto } from "@/lib/dati/progetti";
import { elencaMessaggi, elencaChiarimenti } from "@/lib/dati/comunicazioni";
import { haPermesso } from "@/lib/auth/attore";
import { haIdentita } from "@/lib/dto/cliente";
import { NonTrovato } from "@/lib/auth/errori";
import { numero, dataEstesa, euro } from "@/lib/format";
import { STATO_PROGETTO, STATO_TAPPA } from "@/config/back-office";


export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DettaglioProgetto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const attore = await staffPerPagina(`/admin/progetti/${id}`);

  let dettaglio;
  try {
    dettaglio = await leggiProgetto(attore, id);
  } catch (errore) {
    // Un progetto di altro tenant e un progetto inesistente devono essere
    // indistinguibili: entrambi diventano un 404.
    if (errore instanceof NonTrovato) notFound();
    throw errore;
  }

  const [messaggi, chiarimenti] = await Promise.all([
    elencaMessaggi(attore, id),
    elencaChiarimenti(attore, id),
  ]);

  /*
   * Niente cast: `leggiProgetto` restituisce un DTO di forma diversa a seconda
   * del ruolo, e un redattore non riceve `avanzamento`. I campi opzionali si
   * leggono con `in`, e ciò che non c'è semplicemente non viene mostrato.
   */
  const progetto = dettaglio.progetto;
  const avanzamento = "avanzamento" in progetto ? progetto.avanzamento : null;
  const stato = STATO_PROGETTO[progetto.stato] ?? {
    etichetta: progetto.stato,
    tono: "neutro" as const,
  };
  const vedePrezzi = haPermesso(attore, "prezzo.vedi");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="cifre text-sm text-viola-chiaro">{progetto.codice}</span>
          <BadgeStato tono={stato.tono}>{stato.etichetta}</BadgeStato>
          {"prioritaria" in progetto && progetto.prioritaria ? (
            <Badge tono="errore">Prioritario</Badge>
          ) : null}
        </div>
        <Titolo livello={1}>{progetto.titolo}</Titolo>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Schede
            valorePredefinito="avanzamento"
            voci={[
              {
                valore: "avanzamento",
                titolo: "Avanzamento",
                contenuto: (
                  <div className="flex flex-col gap-6">
                    {avanzamento !== null ? (
                      <Progresso valore={avanzamento} etichetta="Avanzamento complessivo" />
                    ) : null}
                    <Cronologia>
                      {dettaglio.tappe.map((t, i) => (
                        <Tappa
                          key={t.id}
                          titolo={t.nome}
                          stato={STATO_TAPPA[t.stato] ?? "attesa"}
                          data={
                            t.completataAt
                              ? dataEstesa(t.completataAt)
                              : t.finePrevistaAt
                                ? dataEstesa(t.finePrevistaAt)
                                : undefined
                          }
                          dettaglio={t.descrizione}
                          ultima={i === dettaglio.tappe.length - 1}
                        />
                      ))}
                    </Cronologia>
                  </div>
                ),
              },
              {
                valore: "milestone",
                titolo: "Milestone",
                conteggio: dettaglio.milestone.length,
                contenuto:
                  dettaglio.milestone.length === 0 ? (
                    <StatoVuoto
                      titolo="Nessuna milestone"
                      descrizione="Le milestone segnano i punti in cui il cliente deve approvare o pagare."
                    />
                  ) : (
                    <ul className="flex flex-col divide-y divide-bordo rounded-lg border border-bordo bg-superficie">
                      {dettaglio.milestone.map((m) => (
                        <li key={m.id} className="flex items-start justify-between gap-4 p-4">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="text-sm font-medium text-testo">{m.nome}</span>
                            {m.descrizione ? (
                              <span className="text-xs leading-relaxed text-testo-tenue">
                                {m.descrizione}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <Badge>{m.stato}</Badge>
                            {vedePrezzi && m.importoCent ? (
                              <span className="cifre text-xs text-testo-tenue">
                                {euro(m.importoCent / 100)}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                valore: "comunicazioni",
                titolo: "Comunicazioni",
                conteggio: messaggi.length,
                contenuto: (
                  <PannelloMessaggi
                    progettoId={id}
                    messaggi={messaggi}
                    puoScrivereNoteInterne
                  />
                ),
              },
              {
                valore: "chiarimenti",
                titolo: "Chiarimenti",
                conteggio: chiarimenti.length,
                contenuto:
                  chiarimenti.length === 0 ? (
                    <StatoVuoto
                      titolo="Nessuna richiesta"
                      descrizione="Le domande che i redattori pongono sul testo compaiono qui, prima di essere inoltrate al cliente."
                    />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {chiarimenti.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-col gap-2 rounded-lg border border-bordo bg-superficie p-4"
                        >
                          <p className="text-sm text-testo">{c.domanda}</p>
                          {c.riferimento ? (
                            <p className="cifre text-xs text-testo-tenue">{c.riferimento}</p>
                          ) : null}
                          {c.risposta ? (
                            <p className="border-l-2 border-lime pl-3 text-sm text-testo-attenuato">
                              {c.risposta}
                            </p>
                          ) : (
                            <Badge tono={c.inoltrataAlClienteAt ? "attenzione" : "neutro"}>
                              {c.inoltrataAlClienteAt ? "In attesa del cliente" : "Da inoltrare"}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  ),
              },
            ]}
          />
        </div>

        <aside className="flex flex-col gap-5">
          <Scheda>
            <SchedaTestata titolo="Scheda" />
            <SchedaCorpo className="flex flex-col gap-5">
              {dettaglio.cliente ? (
                <Dato etichetta="Cliente">
                  {haIdentita(dettaglio.cliente)
                    ? dettaglio.cliente.nome
                    : dettaglio.cliente.riferimento}
                </Dato>
              ) : null}
              <Dato etichetta="Servizi">
                {progetto.serviziSlug.length > 0 ? progetto.serviziSlug.join(", ") : "—"}
              </Dato>
              <Dato etichetta="Parole" numerico>
                {"conteggioParole" in progetto && progetto.conteggioParole
                  ? numero(progetto.conteggioParole)
                  : "—"}
              </Dato>
              <Dato etichetta="Scadenza">
                {progetto.scadenzaAt ? dataEstesa(progetto.scadenzaAt) : "Non fissata"}
              </Dato>
              <Dato etichetta="Approvazioni in attesa" numerico>
                {dettaglio.approvazioniInAttesa}
              </Dato>
            </SchedaCorpo>
          </Scheda>

          {dettaglio.membri.length > 0 ? (
            <Scheda>
              <SchedaTestata titolo="Chi ci lavora" />
              <SchedaCorpo>
                <ul className="flex flex-col gap-3">
                  {dettaglio.membri.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-testo">{m.nome ?? "Senza nome"}</span>
                      <Badge>{m.ruolo}</Badge>
                    </li>
                  ))}
                </ul>
              </SchedaCorpo>
            </Scheda>
          ) : null}

          {"istruzioniEditoriali" in progetto && progetto.istruzioniEditoriali ? (
            <Scheda>
              <SchedaTestata titolo="Istruzioni editoriali" />
              <SchedaCorpo>
                <p className="text-sm leading-relaxed text-testo-attenuato">
                  {progetto.istruzioniEditoriali}
                </p>
              </SchedaCorpo>
            </Scheda>
          ) : null}

          {"noteInterne" in progetto && progetto.noteInterne ? (
            <Scheda variante="tratteggiata">
              <SchedaTestata titolo="Note interne" sotto="Non visibili al cliente" />
              <SchedaCorpo>
                <p className="text-sm leading-relaxed text-testo-tenue">{progetto.noteInterne}</p>
              </SchedaCorpo>
            </Scheda>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
