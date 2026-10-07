/**
 * Ponte fra la sessione Auth.js e l'`Attore` usato dal livello dati.
 *
 * Nessun componente e nessuna route legge la sessione direttamente: passano
 * tutti da qui, così la costruzione dell'attore — inclusa la risoluzione del
 * `clientId` — esiste in un punto solo.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema/crm";
import { auth } from "./config";
import type { Attore } from "./attore";
import { NonAutenticato, NonAutorizzato } from "./errori";
import type { Permesso, Ruolo } from "./ruoli";
import { haPermesso } from "./attore";
import { isStaff } from "./ruoli";

/**
 * `cache` di React: dentro una stessa richiesta la sessione e la query sul
 * cliente vengono risolte una volta sola, anche se dieci componenti chiedono
 * l'attore.
 */
export const attoreCorrente = cache(async (): Promise<Attore | null> => {
  const sessione = await auth();
  const utente = sessione?.user;
  if (!utente?.id || !utente.email) return null;

  const ruolo = utente.ruolo as Ruolo;

  // Il cliente accede alle proprie cose per proprietà: serve l'anagrafica.
  let clientId: string | null = null;
  if (ruolo === "client") {
    const db = getDb();
    const [riga] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.userId, utente.id))
      .limit(1);
    clientId = riga?.id ?? null;
  }

  return {
    userId: utente.id,
    email: utente.email,
    nome: utente.name ?? null,
    ruolo,
    organizationId: utente.organizationId,
    clientId,
    attivo: utente.attivo,
  };
});

/** Attore obbligatorio. Per le pagine e le azioni che richiedono l'accesso. */
export async function esigiAttore(): Promise<Attore> {
  const attore = await attoreCorrente();
  if (!attore) throw new NonAutenticato();
  if (!attore.attivo) throw new NonAutorizzato(`account disattivato: ${attore.userId}`);
  return attore;
}

/** Attore di staff con un permesso specifico. Per le pagine di back-office. */
export async function esigiStaff(permesso?: Permesso): Promise<Attore> {
  const attore = await esigiAttore();
  if (!isStaff(attore.ruolo)) {
    throw new NonAutorizzato(`ruolo non di staff: ${attore.ruolo}`);
  }
  if (permesso && !haPermesso(attore, permesso)) {
    throw new NonAutorizzato(`permesso mancante: ${permesso} per ruolo ${attore.ruolo}`);
  }
  return attore;
}

/** Attore cliente con anagrafica collegata. */
export async function esigiCliente(): Promise<Attore & { clientId: string }> {
  const attore = await esigiAttore();
  if (attore.ruolo !== "client" || !attore.clientId) {
    throw new NonAutorizzato(`non è un cliente con anagrafica: ${attore.ruolo}`);
  }
  return attore as Attore & { clientId: string };
}

/* ── Varianti per le pagine ──────────────────────────────────────────────
 *
 * Le funzioni sopra lanciano: è il comportamento giusto per le azioni server e
 * per il livello dati, dove un errore non gestito è preferibile a un accesso
 * concesso per sbaglio.
 *
 * Una pagina però non deve rispondere 500 a chi ha semplicemente un cookie
 * scaduto: quelle sotto rimandano dove serve. La sicurezza non cambia — chi
 * non ha diritto non vede i dati in nessuno dei due casi — cambia solo cosa
 * legge in pagina.
 */

/** Attore per una pagina riservata. Chi non è autenticato torna all'accesso. */
export async function attorePerPagina(destinazione: string): Promise<Attore> {
  const attore = await attoreCorrente();
  if (!attore) redirect(`/accedi?da=${encodeURIComponent(destinazione)}`);
  if (!attore.attivo) redirect("/accedi/errore?error=AccessDenied");
  return attore;
}

/** Attore di staff per una pagina di back-office. */
export async function staffPerPagina(
  destinazione: string,
  permesso?: Permesso,
): Promise<Attore> {
  const attore = await attorePerPagina(destinazione);
  if (!isStaff(attore.ruolo)) redirect("/area");
  if (permesso && !haPermesso(attore, permesso)) redirect("/admin/non-autorizzato");
  return attore;
}
