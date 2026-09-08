import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Titolo, Nota, Dato } from "@/components/ui/primitivi";
import { Badge } from "@/components/ui/badge";
import { Avviso } from "@/components/ui/stati";
import { BottoneLink } from "@/components/ui/bottone";
import { BancoRevisione } from "@/components/redazione/banco";
import { ChiusuraRevisione } from "@/components/redazione/chiusura";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import { leggiJob } from "@/lib/dati/job";
import { ETICHETTA_STATO_JOB } from "@/lib/produzione/stati";
import { ETICHETTA_LIVELLO } from "@/lib/ai/livelli";
import { dataEstesa } from "@/lib/format";

export const metadata: Metadata = {
  title: "Revisione",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaginaRevisione({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attore = await staffPerPagina(`/redazione/${id}`, "job.vedi_assegnati");

  // Un Job di un altro tenant, o non assegnato, deve risultare inesistente:
  // distinguere «non tuo» da «non esiste» è già una risposta di troppo.
  let dettaglio;
  try {
    dettaglio = await leggiJob(attore, id);
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) notFound();
    throw errore;
  }

  const { job, interventi } = dettaglio;
  const inRevisione = job.stato === "needs_review" || job.stato === "needs_input";
  const inSospeso = interventi.filter((i) => i.stato === "pending").length;
  const documentoEsito =
    "fileVersionEsitoId" in job ? (job.fileVersionEsitoId as string | null) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/redazione" className="garbo text-testo-tenue hover:text-testo text-sm">
          ← Torna al banco
        </Link>
        <Titolo livello={1} occhiello={job.codice} sotto={job.istruzioni ?? undefined}>
          {ETICHETTA_LIVELLO[job.livelloServizio as never] ?? job.livelloServizio}
        </Titolo>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tono={inRevisione ? "attenzione" : "neutro"}>
            {ETICHETTA_STATO_JOB[job.stato as never] ?? job.stato}
          </Badge>
          {job.prioritaria ? <Badge tono="errore">Prioritaria</Badge> : null}
          <Nota>Progetto {job.progettoCodice}</Nota>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Dato etichetta="Parole" numerico>
          {job.conteggioParole?.toLocaleString("it-IT") ?? "—"}
        </Dato>
        <Dato etichetta="Interventi proposti" numerico>
          {interventi.length}
        </Dato>
        <Dato etichetta="Consegna prevista">
          {job.scadenzaAt ? dataEstesa(job.scadenzaAt) : "—"}
        </Dato>
      </div>

      {documentoEsito ? (
        <Avviso tono="successo" titolo="Documento revisionato disponibile">
          <div className="flex flex-col items-start gap-3">
            <span>
              Il file Word con le revisioni tracciate è stato generato a partire
              dall&apos;originale. Aprendolo si vedono le correzioni come modifiche da accettare o
              rifiutare.
            </span>
            <BottoneLink
              href={`/api/file/versione/${documentoEsito}`}
              misura="piccola"
              variante="secondario"
            >
              Scarica il documento
            </BottoneLink>
          </div>
        </Avviso>
      ) : null}

      <BancoRevisione
        jobId={job.id}
        interventi={interventi}
        puoModificare={haPermesso(attore, "job.modifica_intervento")}
        modificabile={inRevisione}
      />

      {inRevisione ? (
        <ChiusuraRevisione
          jobId={job.id}
          inSospeso={inSospeso}
          puoApprovare={haPermesso(attore, "job.approva_editorialmente")}
        />
      ) : null}
    </div>
  );
}
