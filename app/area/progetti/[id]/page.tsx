import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gabbia, Titolo, Dato } from "@/components/ui/primitivi";
import { Scheda, SchedaTestata, SchedaCorpo } from "@/components/ui/scheda";
import { BadgeStato } from "@/components/ui/badge";
import { Cronologia, Tappa } from "@/components/ui/cronologia";
import { Progresso } from "@/components/ui/progresso";
import { StatoVuoto } from "@/components/ui/stati";
import { Schede } from "@/components/ui/tab";
import { PannelloMessaggi } from "@/components/progetti/messaggi";
import { RispostaChiarimento } from "@/components/progetti/chiarimento";
import { attorePerPagina } from "@/lib/auth/sessione";
import { leggiProgetto } from "@/lib/dati/progetti";
import { elencaChiarimenti, elencaMessaggi } from "@/lib/dati/comunicazioni";
import { NonTrovato } from "@/lib/auth/errori";
import { dataEstesa } from "@/lib/format";
import { STATO_PROGETTO, STATO_TAPPA } from "@/config/back-office";
import { getServizio } from "@/config/catalogo";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProgettoCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attore = await attorePerPagina(`/area/progetti/${id}`);

  let dettaglio;
  try {
    dettaglio = await leggiProgetto(attore, id);
  } catch (errore) {
    if (errore instanceof NonTrovato) notFound();
    throw errore;
  }

  const [messaggi, chiarimenti] = await Promise.all([
    elencaMessaggi(attore, id),
    elencaChiarimenti(attore, id),
  ]);

  const progetto = dettaglio.progetto;
  const avanzamento = "avanzamento" in progetto ? progetto.avanzamento : 0;
  const apertoIl = "createdAt" in progetto ? progetto.createdAt : null;
  const stato = STATO_PROGETTO[progetto.stato] ?? {
    etichetta: progetto.stato,
    tono: "neutro" as const,
  };
  const daRispondere = chiarimenti.filter((c) => !c.risposta);
  const servizi = progetto.serviziSlug.map(getServizio).filter((s) => s !== undefined);

  return (
    <Gabbia className="flex flex-col gap-8 py-12">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="cifre text-sm text-testo-tenue">{progetto.codice}</span>
          <BadgeStato tono={stato.tono}>{stato.etichetta}</BadgeStato>
        </div>
        <Titolo livello={1}>{progetto.titolo}</Titolo>
      </div>

      <Progresso valore={avanzamento} etichetta="Avanzamento del progetto" />

      {daRispondere.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="etichetta text-lime">Aspettiamo una tua risposta</h2>
          <ul className="flex flex-col gap-3">
            {daRispondere.map((c) => (
              <li key={c.id}>
                <RispostaChiarimento chiarimento={c} percorso={`/area/progetti/${id}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <Schede
            valorePredefinito="avanzamento"
            voci={[
              {
                valore: "avanzamento",
                titolo: "A che punto siamo",
                contenuto: (
                  <Cronologia>
                    {dettaglio.tappe.map((t, i) => (
                      <Tappa
                        key={t.id}
                        titolo={t.nome}
                        stato={STATO_TAPPA[t.stato] ?? "attesa"}
                        data={t.completataAt ? dataEstesa(t.completataAt) : undefined}
                        dettaglio={t.descrizione}
                        ultima={i === dettaglio.tappe.length - 1}
                      />
                    ))}
                  </Cronologia>
                ),
              },
              {
                valore: "milestone",
                titolo: "Consegne",
                conteggio: dettaglio.milestone.length,
                contenuto:
                  dettaglio.milestone.length === 0 ? (
                    <StatoVuoto
                      titolo="Nessuna consegna programmata"
                      descrizione="Le consegne compaiono qui quando il progetto entra in produzione."
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
                          <span className="cifre shrink-0 text-xs text-testo-tenue">
                            {m.approvataAt
                              ? `Approvata ${dataEstesa(m.approvataAt)}`
                              : m.scadenzaAt
                                ? dataEstesa(m.scadenzaAt)
                                : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                valore: "messaggi",
                titolo: "Comunicazioni",
                conteggio: messaggi.length,
                contenuto: (
                  <PannelloMessaggi
                    progettoId={id}
                    messaggi={messaggi}
                    puoScrivereNoteInterne={false}
                  />
                ),
              },
            ]}
          />
        </div>

        <aside className="flex flex-col gap-5">
          <Scheda>
            <SchedaTestata titolo="Il tuo progetto" />
            <SchedaCorpo className="flex flex-col gap-5">
              <Dato etichetta="Servizi">
                {servizi.length > 0 ? servizi.map((s) => s.nome).join(", ") : "—"}
              </Dato>
              <Dato etichetta="Consegna prevista">
                {progetto.scadenzaAt ? dataEstesa(progetto.scadenzaAt) : "Da fissare insieme"}
              </Dato>
              <Dato etichetta="Aperto il">{apertoIl ? dataEstesa(apertoIl) : "—"}</Dato>
            </SchedaCorpo>
          </Scheda>
        </aside>
      </div>
    </Gabbia>
  );
}
