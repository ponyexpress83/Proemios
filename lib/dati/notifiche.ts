/**
 * Centro notifiche.
 *
 * Una notifica appartiene a **una persona**: si legge solo la propria, e non
 * esiste una funzione per leggere quelle di qualcun altro. Non è una
 * restrizione di ruolo — è che il destinatario è la chiave di ogni query.
 *
 * L'email è un canale in più, non un canale alternativo: la notifica esiste
 * comunque in-app, e se l'invio fallisce resta l'errore accanto alla riga
 * invece di sparire.
 */
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, type EsecutoreDb } from "@/db";
import { notifications } from "@/db/schema/sistema";
import { users } from "@/db/schema/utenti";
import { clients } from "@/db/schema/crm";
import { projectMembers, projects } from "@/db/schema/progetti";
import type { Attore } from "@/lib/auth/attore";
import { iso, sigilla } from "@/lib/dto/comuni";
import { componiNotifica, type ContestoNotifica, type TipoNotifica } from "@/lib/notifiche/tipi";
import { inviaEmail, impaginaEmail, esc } from "@/lib/email";
import { assoluto } from "@/lib/seo";

export type NotificaDTO = {
  id: string;
  tipo: string;
  titolo: string;
  corpo: string | null;
  percorso: string | null;
  letta: boolean;
  createdAt: string;
};

function notificaDTO(n: typeof notifications.$inferSelect): NotificaDTO {
  return sigilla({
    id: n.id,
    tipo: n.tipo,
    titolo: n.titolo,
    corpo: n.corpo,
    percorso: n.percorso,
    letta: n.lettaAt !== null,
    createdAt: iso(n.createdAt)!,
  });
}

/**
 * Crea una notifica e, quando il tipo lo prevede, manda l'email.
 *
 * L'invio dell'email non è dentro la transazione e non fa fallire la
 * creazione: una notifica scritta senza email è recuperabile, un'email mandata
 * senza notifica no.
 */
export async function notifica(
  destinatarioId: string,
  tipo: TipoNotifica,
  contesto: ContestoNotifica = {},
  esecutore?: EsecutoreDb,
): Promise<void> {
  const modello = componiNotifica(tipo, contesto);
  const db = esecutore ?? getDb();

  const [destinatario] = await db
    .select({
      id: users.id,
      email: users.email,
      nome: users.name,
      organizationId: users.organizationId,
      attivo: users.attivo,
    })
    .from(users)
    .where(eq(users.id, destinatarioId))
    .limit(1);
  // Un account disattivato non riceve niente: né campanella né email.
  if (!destinatario || !destinatario.attivo) return;

  await db.insert(notifications).values({
    organizationId: destinatario.organizationId,
    destinatarioId,
    tipo,
    canale: modello.email ? "email" : "in_app",
    titolo: modello.titolo,
    corpo: modello.corpo,
    percorso: modello.percorso,
    entita: contesto.progettoId ? "progetto" : contesto.ordineId ? "ordine" : null,
    entitaId: contesto.progettoId ?? contesto.ordineId ?? null,
  });

  if (!modello.email || !destinatario.email) return;

  await inviaEmail({
    to: destinatario.email,
    subject: modello.titolo,
    html: impaginaEmail(
      modello.titolo,
      `<p>${destinatario.nome ? `Ciao ${esc(destinatario.nome)},` : "Ciao,"}</p>
       <p>${esc(modello.corpo)}</p>
       <p><a href="${assoluto(modello.percorso)}" style="color:#5b3df5;font-weight:600;">Apri nella tua area</a></p>`,
    ),
  }).catch(async (errore) => {
    // L'errore resta accanto alla notifica: un'email non partita che non
    // lascia traccia è un'email che nessuno saprà mai di dover rimandare.
    await getDb()
      .update(notifications)
      .set({ erroreInvio: String(errore).slice(0, 300) })
      .where(
        and(
          eq(notifications.destinatarioId, destinatarioId),
          eq(notifications.tipo, tipo),
          isNull(notifications.inviataAt),
        ),
      );
  });

  await getDb()
    .update(notifications)
    .set({ inviataAt: new Date() })
    .where(
      and(
        eq(notifications.destinatarioId, destinatarioId),
        eq(notifications.tipo, tipo),
        isNull(notifications.inviataAt),
      ),
    );
}

/** Le proprie notifiche, le più recenti per prime. */
export async function elencaNotifiche(
  attore: Attore,
  opzioni: { soloNonLette?: boolean; limite?: number } = {},
): Promise<NotificaDTO[]> {
  const db = getDb();
  const condizioni = [eq(notifications.destinatarioId, attore.userId)];
  if (opzioni.soloNonLette) condizioni.push(isNull(notifications.lettaAt));

  const righe = await db
    .select()
    .from(notifications)
    .where(and(...condizioni))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(200, Math.max(1, opzioni.limite ?? 50)));

  return righe.map(notificaDTO);
}

export async function contaNonLette(attore: Attore): Promise<number> {
  const db = getDb();
  const [riga] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.destinatarioId, attore.userId), isNull(notifications.lettaAt)));
  return Number(riga?.n ?? 0);
}

/**
 * Segna come lette. Il vincolo sul destinatario è nella `WHERE`: passare l'id
 * della notifica di un'altra persona non aggiorna niente, e non serve un
 * controllo a parte per dirlo.
 */
export async function segnaLette(attore: Attore, ids?: readonly string[]): Promise<number> {
  const db = getDb();
  const condizioni = [
    eq(notifications.destinatarioId, attore.userId),
    isNull(notifications.lettaAt),
  ];
  if (ids && ids.length > 0) {
    // `inArray` parametrizza: costruire la lista interpolando gli id in una
    // stringa SQL sarebbe un'iniezione, e questi id arrivano dal browser.
    condizioni.push(inArray(notifications.id, [...ids]));
  }

  const righe = await db
    .update(notifications)
    .set({ lettaAt: new Date() })
    .where(and(...condizioni))
    .returning({ id: notifications.id });
  return righe.length;
}

/**
 * Avvisa il cliente di un progetto.
 *
 * Trova l'account collegato all'anagrafica: un cliente senza account non
 * riceve nulla in-app, e non è un errore — molti clienti lavorano solo per
 * email, e il portale è un servizio in più, non un obbligo.
 */
export async function notificaClienteDiProgetto(
  progettoId: string,
  tipo: TipoNotifica,
  contesto: ContestoNotifica = {},
): Promise<void> {
  const db = getDb();
  const [riga] = await db
    .select({ userId: clients.userId, titolo: projects.titolo })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.id, progettoId))
    .limit(1);
  if (!riga?.userId) return;

  await notifica(riga.userId, tipo, {
    ...contesto,
    progettoId,
    progettoTitolo: contesto.progettoTitolo ?? riga.titolo,
  });
}

/**
 * Avvisa lo staff assegnato a un progetto.
 *
 * Non manda a tutto il tenant: solo a chi è membro del progetto. Una notifica
 * che arriva a chi non c'entra è rumore, e il rumore si impara a ignorare.
 */
export async function notificaStaffDiProgetto(
  progettoId: string,
  tipo: TipoNotifica,
  contesto: ContestoNotifica = {},
): Promise<void> {
  const db = getDb();
  const membri = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, progettoId), isNull(projectMembers.rimossoAt)));

  for (const m of membri) {
    await notifica(m.userId, tipo, { ...contesto, progettoId });
  }
}
