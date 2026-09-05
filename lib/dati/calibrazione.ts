/**
 * Lettura della calibrazione dal database.
 *
 * I dati esistono già: `editorial_interventions` conserva sia la proposta
 * (`dopo`) sia la decisione della persona (`stato`, `testoModificato`). Il
 * tasso di disaccordo è quindi misurabile dal primo Job, senza aggiungere
 * niente — bastava guardarci.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { editorialInterventions, editorialJobs } from "@/db/schema/produzione";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import {
  accordoPerCategoria,
  accordoPerFascia,
  raccomandazione,
  type AccordoPerCategoria,
  type AccordoPerFascia,
  type DecisionePresa,
  type Raccomandazione,
} from "@/lib/produzione/calibrazione";

export type RigaCalibrazione = AccordoPerCategoria & { raccomandazione: Raccomandazione };

export type Calibrazione = {
  perCategoria: RigaCalibrazione[];
  perFascia: AccordoPerFascia[];
  /** Job da cui provengono le decisioni: dice quanto è largo il campione. */
  jobConsiderati: number;
  decisioniTotali: number;
};

/**
 * Quanto il modello e i redattori sono d'accordo, negli ultimi `giorni`.
 *
 * Filtra per tenant come ogni altra lettura: la calibrazione di un'agenzia è
 * fatta sui suoi manoscritti, e mescolarla con quella di un'altra darebbe un
 * numero che non descrive nessuno dei due.
 */
export async function calibrazione(attore: Attore, giorni = 90): Promise<Calibrazione> {
  // Chi vede le run AI è chi risponde della qualità editoriale: è la stessa
  // persona a cui serve sapere se il modello si può lasciare più libero.
  esigiPermesso(attore, "job.vedi_run_ai");

  const db = getDb();
  const da = new Date(Date.now() - giorni * 24 * 60 * 60 * 1000);

  const righe = await db
    .select({
      categoria: editorialInterventions.categoria,
      confidenza: editorialInterventions.confidenza,
      stato: editorialInterventions.stato,
      jobId: editorialInterventions.jobId,
    })
    .from(editorialInterventions)
    .innerJoin(editorialJobs, eq(editorialJobs.id, editorialInterventions.jobId))
    .where(
      and(
        eq(editorialInterventions.organizationId, attore.organizationId),
        // Solo ciò che una persona ha davvero deciso.
        sql`${editorialInterventions.rivistoAt} is not null`,
        gte(editorialInterventions.rivistoAt, da),
      ),
    )
    .limit(200_000);

  const decisioni: DecisionePresa[] = righe.map((r) => ({
    categoria: r.categoria,
    confidenza: r.confidenza,
    stato: r.stato,
  }));

  const perCategoria = accordoPerCategoria(decisioni).map((a) => ({
    ...a,
    raccomandazione: raccomandazione(a),
  }));

  return {
    perCategoria,
    perFascia: accordoPerFascia(decisioni),
    jobConsiderati: new Set(righe.map((r) => r.jobId)).size,
    decisioniTotali: decisioni.length,
  };
}
