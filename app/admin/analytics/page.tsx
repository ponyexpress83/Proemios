import type { Metadata } from "next";
import { Titolo, Nota } from "@/components/ui/primitivi";
import { SchedaMetrica, Scheda, SchedaCorpo, SchedaTestata } from "@/components/ui/scheda";
import { Badge } from "@/components/ui/badge";
import { Avviso, StatoVuoto } from "@/components/ui/stati";
import { staffPerPagina } from "@/lib/auth/sessione";
import { funnelConversioni, ultimeConversioni, providerConversioni } from "@/lib/dati/conversioni";
import { funnel } from "@/lib/dati/lead";
import { euroDaCentesimi, dataEstesa } from "@/lib/format";
import { EVENTI_ESITO, EVENTI_NAVIGAZIONE } from "@/lib/analytics/eventi";
import { SEQUENZA_FUNNEL } from "@/lib/crm/pipeline";
import { ETICHETTA_STATO } from "@/components/crm/etichette";

export const metadata: Metadata = {
  title: "Funnel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ETICHETTA_EVENTO: Record<string, string> = {
  lead_created: "Contatti raccolti",
  quote_started: "Preventivi iniziati",
  quote_generated: "Preventivi generati",
  consultation_clicked: "Call richieste",
  checkout_started: "Checkout aperti",
  manuscript_analysis_completed: "Analisi completate",
  qualified_lead: "Lead qualificati",
  proposal_sent: "Proposte inviate",
  client_won: "Clienti acquisiti",
  purchase: "Incassi",
};

export default async function PaginaAnalytics() {
  const attore = await staffPerPagina("/admin/analytics", "analytics.vedi");
  const [eventi, ultime, imbuto] = await Promise.all([
    funnelConversioni(attore, 30),
    ultimeConversioni(attore, 30),
    funnel(attore),
  ]);

  const perEvento = new Map(eventi.map((f) => [f.evento, f]));
  const nonInviate = eventi.reduce((t, f) => t + f.nonInviate, 0);
  const provider = providerConversioni();
  const valoreTotale = perEvento.get("purchase")?.valoreCent ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello="Ultimi 30 giorni"
        sotto="Le conversioni registrate dal prodotto, non quelle stimate da una piattaforma. Il funnel qui sotto è la pipeline reale: un lead non può risultare acquisito senza essere passato dagli stadi precedenti."
      >
        Funnel
      </Titolo>

      {!provider.configurato() ? (
        <Avviso tono="informazione" titolo="Le conversioni non vengono inviate a Google Ads">
          Restano registrate qui e sono ritentabili: mancano le credenziali di Google Ads. Il funnel
          interno non ne dipende.
        </Avviso>
      ) : nonInviate > 0 ? (
        <Avviso tono="attenzione" titolo={`${nonInviate} conversioni in attesa di invio`}>
          Sono registrate ma non ancora consegnate alla piattaforma. Verranno riprovate.
        </Avviso>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SchedaMetrica
          etichetta="Clienti acquisiti"
          valore={String(perEvento.get("client_won")?.conteggio ?? 0)}
          tono="positivo"
        />
        <SchedaMetrica
          etichetta="Proposte inviate"
          valore={String(perEvento.get("proposal_sent")?.conteggio ?? 0)}
        />
        <SchedaMetrica etichetta="Incassato" valore={euroDaCentesimi(valoreTotale)} />
      </div>

      <Scheda>
        <SchedaTestata
          titolo="Pipeline commerciale"
          sotto="Quanti lead ci sono adesso in ogni stadio."
        />
        <SchedaCorpo className="flex flex-col gap-2">
          {SEQUENZA_FUNNEL.map((stadio) => {
            const n = imbuto.find((r) => r.stato === stadio)?.conteggio ?? 0;
            const massimo = Math.max(
              1,
              ...SEQUENZA_FUNNEL.map((s) => imbuto.find((r) => r.stato === s)?.conteggio ?? 0),
            );
            return (
              <div key={stadio} className="flex items-center gap-3">
                <span className="text-testo-attenuato w-44 shrink-0 text-sm">
                  {ETICHETTA_STATO[stadio]}
                </span>
                <div className="bg-superficie h-6 flex-1 overflow-hidden rounded">
                  <div
                    className="bg-viola h-full rounded"
                    style={{ width: `${Math.round((n / massimo) * 100)}%` }}
                  />
                </div>
                <span className="cifre text-testo w-12 shrink-0 text-right text-sm">{n}</span>
              </div>
            );
          })}
        </SchedaCorpo>
      </Scheda>

      <Scheda>
        <SchedaTestata
          titolo="Eventi registrati"
          sotto="Gli eventi di esito nascono sul server, quando spesso nessun browser è aperto: un pixel non li vedrebbe."
        />
        <SchedaCorpo className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="etichetta text-testo-tenue">Esito (server)</p>
            {EVENTI_ESITO.map((e) => (
              <div key={e} className="flex items-center justify-between gap-3">
                <span className="text-testo-attenuato text-sm">{ETICHETTA_EVENTO[e] ?? e}</span>
                <span className="cifre text-testo text-sm">
                  {perEvento.get(e)?.conteggio ?? 0}
                  {perEvento.get(e)?.valoreCent
                    ? ` · ${euroDaCentesimi(perEvento.get(e)!.valoreCent)}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <p className="etichetta text-testo-tenue">Navigazione (browser)</p>
            <Nota>
              {EVENTI_NAVIGAZIONE.map((e) => ETICHETTA_EVENTO[e] ?? e).join(" · ")} — vivono nel
              dataLayer di Google Tag Manager e si leggono da lì.
            </Nota>
          </div>
        </SchedaCorpo>
      </Scheda>

      <Scheda>
        <SchedaTestata titolo="Ultime conversioni" />
        <SchedaCorpo>
          {ultime.length === 0 ? (
            <StatoVuoto
              titolo="Nessuna conversione"
              descrizione="Compaiono qui appena un lead avanza nella pipeline o arriva un incasso."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {ultime.map((c) => (
                <li
                  key={c.id}
                  className="border-bordo flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-testo text-sm">
                      {ETICHETTA_EVENTO[c.evento] ?? c.evento}
                    </span>
                    {c.sorgente ? <Badge>{c.sorgente}</Badge> : null}
                    {c.inviataAt ? null : <Badge tono="attenzione">non inviata</Badge>}
                  </div>
                  <span className="text-testo-tenue text-xs">
                    {c.valoreCent ? `${euroDaCentesimi(c.valoreCent)} · ` : ""}
                    {dataEstesa(c.avvenutaAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SchedaCorpo>
      </Scheda>
    </div>
  );
}
