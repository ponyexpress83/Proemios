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
      /**
       * Marcatore della ripresa manuale, parte della chiave di idempotenza.
       *
       * 0 per l'avvio normale, così due eventi accidentali per lo stesso Job
       * restano un'elaborazione sola. L'istante della richiesta quando
       * qualcuno riprende un Job fermo: senza un valore diverso, Inngest
       * scarterebbe l'evento come doppione e la ripresa non farebbe nulla.
       */
      ripresa: number;
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

/**
 * Mette un Job in coda per l'elaborazione.
 *
 * Era l'anello che mancava: `lib/lavori/funzioni.ts` ascolta `job/elabora` e
 * `creaJob` scrive il Job in stato `queued`, ma nessuno emetteva l'evento fra
 * i due. Un Job creato restava quindi fermo per sempre, e la pipeline AI non
 * poteva partire da nessun punto del prodotto.
 *
 * Se la coda non è configurata non si finge di aver avviato niente: si torna
 * `false` e chi chiama lo dice in interfaccia. Elaborare dentro la richiesta
 * HTTP non è un ripiego accettabile — un manoscritto lungo supererebbe il
 * limite di durata della funzione e lascerebbe il Job a metà.
 */
export async function accodaElaborazione(dati: {
  jobId: string;
  organizationId: string;
  /** Omesso per l'avvio normale; valorizzato da una ripresa manuale. */
  ripresa?: number;
}): Promise<boolean> {
  if (!codaConfigurata()) return false;
  await inngest.send({
    name: "job/elabora",
    data: { jobId: dati.jobId, organizationId: dati.organizationId, ripresa: dati.ripresa ?? 0 },
  });
  return true;
}

/** Chiede l'annullamento di un Job già in coda. */
export async function accodaAnnullamento(dati: {
  jobId: string;
  organizationId: string;
}): Promise<boolean> {
  if (!codaConfigurata()) return false;
  await inngest.send({ name: "job/annulla", data: dati });
  return true;
}
