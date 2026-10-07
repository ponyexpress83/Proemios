import type { Metadata } from "next";
import { Gabbia, Titolo } from "@/components/ui/primitivi";
import { SchedaMetrica } from "@/components/ui/scheda";
import { Avviso } from "@/components/ui/stati";
import { FiltriLead } from "@/components/crm/filtri";
import { TabellaLead } from "@/components/crm/tabella-lead";
import { FunnelCommerciale } from "@/components/crm/funnel";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { elencaLead, funnel, STATI_LEAD, type StatoLead } from "@/lib/dati/lead";
import { riferimentiStaff } from "@/lib/dati/utenti";
import { euro, numero } from "@/lib/format";
import { isErroreAutorizzazione } from "@/lib/auth/errori";

export const metadata: Metadata = { title: "CRM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function primoValore(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PaginaCrm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const attore = await staffPerPagina("/admin/crm", "crm.vedi_lead");
  const parametri = await searchParams;

  const statoParam = primoValore(parametri.stato);
  const ownerParam = primoValore(parametri.owner);
  const ordinaParam = primoValore(parametri.ordina);

  let contenuto: React.ReactNode;
  try {
    const [pagina, dati, staff] = await Promise.all([
      elencaLead(attore, {
        stato:
          statoParam && STATI_LEAD.includes(statoParam as StatoLead)
            ? [statoParam as StatoLead]
            : undefined,
        fonte: primoValore(parametri.fonte) ? [primoValore(parametri.fonte)!] : undefined,
        ownerId: ownerParam === "nessuno" ? null : (ownerParam ?? undefined),
        cerca: primoValore(parametri.cerca),
        ordina: (ordinaParam as "recenti" | "punteggio" | "valore" | "prossima_attivita") ?? "recenti",
        pagina: Number(primoValore(parametri.pagina) ?? 1),
        perPagina: 50,
      }),
      funnel(attore),
      riferimentiStaff(attore).catch(() => []),
    ]);

    const clienti = dati.find((d) => d.stato === "cliente")?.conteggio ?? 0;
    const totale = dati.reduce((s, d) => s + d.conteggio, 0);
    const valorePipeline = dati
      .filter((d) => !["perso", "post_pubblicazione"].includes(d.stato))
      .reduce((s, d) => s + d.valore, 0);
    const caldi = pagina.voci.filter((l) => (l.leadScore ?? 0) >= 75).length;

    contenuto = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SchedaMetrica etichetta="Lead totali" valore={numero(totale)} />
          <SchedaMetrica
            etichetta="Caldi in pagina"
            valore={numero(caldi)}
            tono={caldi > 0 ? "positivo" : "neutro"}
            dettaglio="Punteggio ≥ 75"
          />
          <SchedaMetrica etichetta="Clienti" valore={numero(clienti)} />
          <SchedaMetrica
            etichetta="Valore pipeline"
            valore={euro(valorePipeline)}
            dettaglio="Esclusi persi e chiusi"
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <FiltriLead staff={staff} />
            <TabellaLead
              lead={pagina.voci}
              staff={staff}
              puoAssegnare={haPermesso(attore, "crm.assegna_lead")}
              puoModificare={haPermesso(attore, "crm.modifica_lead")}
              vedeAttribuzione={haPermesso(attore, "crm.vedi_attribuzione")}
            />
            <p className="text-sm text-testo-tenue">
              {numero(pagina.totale)} lead · pagina {pagina.pagina}
            </p>
          </div>
          <FunnelCommerciale dati={dati} />
        </div>
      </>
    );
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) throw errore;
    // Il database può non essere raggiungibile: la pagina lo dice invece di
    // mostrare uno stack trace.
    contenuto = (
      <Avviso tono="errore" titolo="Non riusciamo a leggere i lead">
        {errore instanceof Error ? errore.message : "Errore sconosciuto."}
      </Avviso>
    );
  }

  return (
    <Gabbia className="py-10">
      <Titolo
        livello={1}
        occhiello="CRM"
        sotto="Pipeline commerciale: dal primo contatto al progetto in produzione."
      >
        Lead
      </Titolo>
      <div className="mt-8">{contenuto}</div>
    </Gabbia>
  );
}
