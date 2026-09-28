/**
 * Funzioni durevoli.
 *
 * Ogni funzione è divisa in `step`: Inngest li esegue uno per volta e ricorda
 * quali sono già riusciti. Se il terzo passo fallisce, al ritentativo i primi
 * due non vengono rieseguiti — che è la differenza fra una coda durevole e un
 * `setTimeout`.
 */
import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { editorialJobs } from "@/db/schema/produzione";
import { elaboraJob, segnalaFallimento, ErroreElaborazione } from "@/lib/produzione/motore";
import { transizioneAmmessa, type StatoJob } from "@/lib/produzione/stati";
import { registra } from "@/lib/audit";
import type { AttoreSistema } from "@/lib/auth/attore";
import { inngest } from "./client";

function attoreSistema(organizationId: string): AttoreSistema {
  return { tipo: "sistema", origine: "coda-lavori", organizationId };
}

/**
 * Elaborazione di un Job editoriale.
 *
 * `idempotency` sul jobId: se lo stesso evento arriva due volte — un doppio
 * clic, un ritentativo del chiamante, una consegna duplicata del webhook — il
 * Job viene elaborato una volta sola. Senza, un manoscritto verrebbe mandato
 * due volte al provider, con il doppio del costo e due serie di interventi
 * sovrapposti.
 */
export const elaborazioneJob = inngest.createFunction(
  {
    id: "elaborazione-job-editoriale",
    name: "Elaborazione di un Job editoriale",
    retries: 3,
    concurrency: [
      // Un tenant che manda in coda venti manoscritti non deve bloccare gli altri.
      { key: "event.data.organizationId", limit: 3 },
      { limit: 10 },
    ],
    idempotency: "event.data.jobId",
    cancelOn: [{ event: "job/annulla", match: "data.jobId" }],
    onFailure: async ({ event, error }) => {
      // Dopo l'ultimo ritentativo il Job non resta "running" per sempre.
      const dati = event.data.event.data as { jobId: string; organizationId: string };
      await segnalaFallimento(
        dati.jobId,
        attoreSistema(dati.organizationId),
        error.message ?? "Elaborazione non riuscita dopo i ritentativi previsti.",
      );
    },
  },
  { event: "job/elabora" },
  async ({ event, step }) => {
    const { jobId, organizationId } = event.data;
    const attore = attoreSistema(organizationId);

    // ── Passo 1: prendere in carico ──
    // La transizione a `running` è anche il lucchetto: se un altro tentativo
    // l'ha già fatta, questo si ferma invece di elaborare in parallelo.
    const preso = await step.run("prendi-in-carico", async () => {
      const db = getDb();
      const [job] = await db
        .select({ stato: editorialJobs.stato })
        .from(editorialJobs)
        .where(eq(editorialJobs.id, jobId))
        .limit(1);

      if (!job) throw new NonRetriableError(`Job ${jobId} inesistente.`);
      if (job.stato === "running") return true; // ripresa dopo un ritentativo
      if (!transizioneAmmessa(job.stato as StatoJob, "running")) {
        throw new NonRetriableError(`Job ${jobId} in stato ${job.stato}: non è avviabile.`);
      }

      await db
        .update(editorialJobs)
        .set({ stato: "running", erroreMessaggio: null, updatedAt: new Date() })
        .where(eq(editorialJobs.id, jobId));

      await registra(attore, {
        azione: "job.stato_cambiato",
        entita: "job",
        entitaId: jobId,
        metadati: { da: job.stato, a: "running" },
      });
      return true;
    });

    if (!preso) return { saltato: true };

    // ── Passo 2: elaborare ──
    // Non è spezzato in un passo per segmento di proposito: gli interventi
    // vengono salvati in una sola transazione alla fine, e riprendere a metà
    // lascerebbe un Job con metà delle correzioni.
    const esito = await step.run("elabora", async () => {
      try {
        return await elaboraJob(jobId, attore);
      } catch (errore) {
        // Un errore non ritentabile — credenziali mancanti, nessun modello
        // ammesso, file illeggibile — non migliora riprovando.
        if (errore instanceof ErroreElaborazione && !errore.ritentabile) {
          throw new NonRetriableError(errore.message);
        }
        throw errore;
      }
    });

    return esito;
  },
);

/**
 * Annullamento. L'evento è già intercettato da `cancelOn`, che ferma
 * l'esecuzione in corso; questa funzione porta il Job nello stato coerente.
 */
export const annullamentoJob = inngest.createFunction(
  { id: "annullamento-job", name: "Annullamento di un Job", retries: 1 },
  { event: "job/annulla" },
  async ({ event, step }) => {
    const { jobId, organizationId } = event.data;
    await step.run("segna-annullato", async () => {
      const db = getDb();
      const [job] = await db
        .select({ stato: editorialJobs.stato })
        .from(editorialJobs)
        .where(eq(editorialJobs.id, jobId))
        .limit(1);
      if (!job) return;
      if (!transizioneAmmessa(job.stato as StatoJob, "cancelled")) return;

      await db
        .update(editorialJobs)
        .set({ stato: "cancelled", updatedAt: new Date() })
        .where(eq(editorialJobs.id, jobId));

      await registra(attoreSistema(organizationId), {
        azione: "job.stato_cambiato",
        entita: "job",
        entitaId: jobId,
        metadati: { da: job.stato, a: "cancelled" },
      });
    });
  },
);

export const funzioni = [elaborazioneJob, annullamentoJob];
