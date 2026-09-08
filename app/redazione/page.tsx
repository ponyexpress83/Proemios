import type { Metadata } from "next";
import Link from "next/link";
import { Titolo, Nota } from "@/components/ui/primitivi";
import { Scheda, SchedaCorpo } from "@/components/ui/scheda";
import { Badge } from "@/components/ui/badge";
import { StatoVuoto } from "@/components/ui/stati";
import { staffPerPagina } from "@/lib/auth/sessione";
import { elencaJob } from "@/lib/dati/job";
import { ETICHETTA_STATO_JOB } from "@/lib/produzione/stati";
import { dataEstesa } from "@/lib/format";
import { ETICHETTA_LIVELLO } from "@/lib/ai/livelli";

export const metadata: Metadata = {
  title: "Da rivedere",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Toni dei badge di stato: solo quelli che il redattore incontra davvero. */
const TONO_STATO: Record<string, "neutro" | "viola" | "lime" | "attenzione" | "errore"> = {
  queued: "neutro",
  running: "viola",
  needs_review: "attenzione",
  needs_input: "attenzione",
  editorially_approved: "lime",
  approved: "lime",
  delivered: "neutro",
  failed: "errore",
  cancelled: "neutro",
};

export default async function PaginaRedazione() {
  const attore = await staffPerPagina("/redazione", "job.vedi_assegnati");

  // Il banco mostra ciò su cui si può lavorare adesso: quel che è in coda o in
  // elaborazione non richiede una persona, e quel che è già approvato non è più
  // in mano al redattore.
  const { voci } = await elencaJob(attore, {
    stato: ["needs_review", "needs_input"],
    perPagina: 50,
  });

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello={`${voci.length} in attesa`}
        sotto="Le lavorazioni che aspettano una decisione editoriale. Approvare qui chiude l'anello del redattore: la consegna al cliente resta a qualcun altro."
      >
        Da rivedere
      </Titolo>

      {voci.length === 0 ? (
        <StatoVuoto
          titolo="Il banco è sgombro"
          descrizione="Non c'è nessuna lavorazione che aspetti una tua revisione."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {voci.map((j) => (
            <li key={j.id}>
              <Link href={`/redazione/${j.id}`} className="garbo block">
                <Scheda interattiva>
                  <SchedaCorpo className="flex flex-wrap items-center justify-between gap-4 pt-5">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="cifre text-testo-tenue text-xs">{j.codice}</span>
                        <span className="text-testo font-semibold">
                          {ETICHETTA_LIVELLO[j.livelloServizio as never] ?? j.livelloServizio}
                        </span>
                        {j.prioritaria ? <Badge tono="errore">Prioritaria</Badge> : null}
                      </div>
                      <Nota>
                        Progetto {j.progettoCodice}
                        {j.conteggioParole
                          ? ` · ${j.conteggioParole.toLocaleString("it-IT")} parole`
                          : ""}
                        {j.scadenzaAt ? ` · consegna ${dataEstesa(j.scadenzaAt)}` : ""}
                      </Nota>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="cifre text-testo text-lg leading-none">
                          {j.conteggioDaVerificare}
                        </p>
                        <p className="etichetta text-testo-tenue">da decidere</p>
                      </div>
                      <Badge tono={TONO_STATO[j.stato] ?? "neutro"}>
                        {ETICHETTA_STATO_JOB[j.stato as never] ?? j.stato}
                      </Badge>
                    </div>
                  </SchedaCorpo>
                </Scheda>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
