/**
 * Lo store dei contatori, su PostgreSQL.
 *
 * In database e non in memoria: su un runtime serverless ogni istanza ha la
 * propria memoria, e un contatore per istanza si aggira aprendo connessioni
 * finché non se ne prende una nuova. Un limite che si aggira così non è un
 * limite.
 *
 * Il conteggio si aggiorna con **una sola istruzione**: un `insert … on
 * conflict do update` che decide dentro la query se la finestra è scaduta.
 * Leggere e poi scrivere lascerebbe una finestra fra le due in cui due
 * richieste contemporanee leggono lo stesso valore e lo incrementano entrambe
 * a partire da lì — che è esattamente il caso che un limite deve fermare.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema/sistema";
import type { Regola } from "./limite";

export type EsitoStore = {
  ammessa: boolean;
  restanti: number;
  attendiSecondi: number;
};

/**
 * Conta una richiesta e dice se è ammessa.
 *
 * In caso di errore del database **ammette** la richiesta. È una scelta:
 * rifiutare tutto quando il contatore non è raggiungibile trasformerebbe un
 * problema del limitatore nell'indisponibilità dei form pubblici. Il limite
 * protegge dall'abuso, non è l'ultima difesa — la validazione, l'autenticazione
 * e i permessi restano al loro posto.
 */
export async function conta(chiave: string, regola: Regola): Promise<EsitoStore> {
  const db = getDb();
  const durata = `${regola.finestraSecondi} seconds`;

  try {
    const righe = await db.execute<{
      conteggio: number;
      finestra_inizio: Date;
    }>(sql`
      insert into ${rateLimits} (chiave, conteggio, finestra_inizio, updated_at)
      values (${chiave}, 1, now(), now())
      on conflict (chiave) do update set
        conteggio = case
          when ${rateLimits.finestraInizio} < now() - ${durata}::interval then 1
          else ${rateLimits.conteggio} + 1
        end,
        finestra_inizio = case
          when ${rateLimits.finestraInizio} < now() - ${durata}::interval then now()
          else ${rateLimits.finestraInizio}
        end,
        updated_at = now()
      returning conteggio, finestra_inizio
    `);

    const riga = (righe as unknown as { rows?: { conteggio: number; finestra_inizio: Date }[] })
      .rows?.[0];
    if (!riga) return { ammessa: true, restanti: regola.massimo - 1, attendiSecondi: 0 };

    const conteggio = Number(riga.conteggio);
    if (conteggio <= regola.massimo) {
      return { ammessa: true, restanti: regola.massimo - conteggio, attendiSecondi: 0 };
    }

    const inizio = new Date(riga.finestra_inizio).getTime();
    const attendiMs = inizio + regola.finestraSecondi * 1000 - Date.now();
    return {
      ammessa: false,
      restanti: 0,
      attendiSecondi: Math.max(1, Math.ceil(attendiMs / 1000)),
    };
  } catch (errore) {
    console.error(JSON.stringify({ evt: "limite.errore", err: String(errore).slice(0, 200) }));
    return { ammessa: true, restanti: regola.massimo, attendiSecondi: 0 };
  }
}

/**
 * Cancella le finestre scadute da un pezzo.
 *
 * Da chiamare da un lavoro periodico: la tabella cresce con gli indirizzi
 * visti, e senza pulizia diventa una lista di chi è passato — che oltre a
 * essere inutile è un dato da custodire.
 */
export async function ripulisci(oreDiVita = 24): Promise<number> {
  const db = getDb();
  const righe = await db
    .delete(rateLimits)
    .where(sql`${rateLimits.finestraInizio} < now() - ${`${oreDiVita} hours`}::interval`)
    .returning({ chiave: rateLimits.chiave });
  return righe.length;
}
