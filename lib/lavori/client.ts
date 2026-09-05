/**
 * Client Inngest.
 *
 * Le elaborazioni editoriali non possono dipendere da una richiesta HTTP: un
 * manoscritto da ottantamila parole richiede minuti di lavoro e decine di
 * chiamate al provider, ben oltre il tempo massimo di una funzione serverless.
 *
 * Versione della libreria fissata alla 3.x: la 4 ha cambiato la forma di
 * `createFunction` e degli schemi degli eventi, e la migrazione è un lavoro a
 * sé che non va mescolato all'introduzione della coda.
 *
 * Inngest esegue le funzioni in modo durevole, con ritentativi, timeout,
 * idempotenza sull'evento e cancellazione. Lo stato del Job resta comunque in
 * Postgres: la coda orchestra, il database è la verità. Così l'avanzamento e
 * gli errori sono visibili nel back-office anche senza aprire la console del
 * fornitore, e un cambio di orchestratore non porta via la storia del lavoro.
 */
import { EventSchemas, Inngest } from "inngest";

export type EventiProemios = {
  "job/elabora": {
    data: {
      jobId: string;
      organizationId: string;
      /** Contatore dei ritentativi manuali, per distinguerli da quelli automatici. */
      tentativoManuale?: number;
    };
  };
  "job/annulla": {
    data: { jobId: string; organizationId: string };
  };
  "job/consegnato": {
    data: { jobId: string; organizationId: string; projectId: string };
  };
};

export const inngest = new Inngest({
  id: "proemios",
  schemas: new EventSchemas().fromRecord<EventiProemios>(),
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/** Vero se la coda è configurata per l'ambiente corrente. */
export function codaConfigurata(): boolean {
  // In sviluppo il server locale di Inngest non richiede chiave.
  return Boolean(process.env.INNGEST_EVENT_KEY) || process.env.NODE_ENV !== "production";
}
