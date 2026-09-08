/**
 * Gestione degli account: inviti, ruoli, disattivazione, sessioni.
 *
 * Nessuna registrazione spontanea: si entra su invito, e l'invito è l'unico
 * punto in cui si assegna un ruolo. Chi può invitare non può necessariamente
 * assegnare qualunque ruolo (vedi `esigiRuoloAssegnabile`).
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { inviti, sessions, users, type Utente } from "@/db/schema/utenti";
import { organizations } from "@/db/schema/organizzazioni";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso, esigiStessoTenant } from "@/lib/auth/guardie";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import { RUOLI, type Ruolo } from "@/lib/auth/ruoli";
import { utenteDTO, type UtentePerAmministrazione, type UtenteRiferimento } from "@/lib/dto/utente";
import { registra } from "@/lib/audit";

const GIORNI_VALIDITA_INVITO = 7;

/**
 * L'invito è conservato come hash SHA-256: chi legge il database non deve poter
 * usare l'invito di un altro. Il token in chiaro esiste solo nel link inviato,
 * e viene restituito una volta sola da `creaInvito`.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Chi assegna un ruolo non può assegnarne uno più potente del proprio: senza
 * questa regola, chi può invitare potrebbe crearsi un super_admin e usarlo.
 */
const POTERE: Record<Ruolo, number> = {
  super_admin: 100,
  operations_admin: 80,
  editorial_manager: 60,
  finance: 60,
  editor_reviewer: 40,
  client: 10,
};

export function esigiRuoloAssegnabile(attore: Attore, ruolo: Ruolo): void {
  if (POTERE[ruolo] >= POTERE[attore.ruolo] && attore.ruolo !== "super_admin") {
    throw new NonAutorizzato(`${attore.ruolo} non può assegnare il ruolo ${ruolo}`);
  }
}

export type InvitoCreato = {
  id: string;
  email: string;
  ruolo: Ruolo;
  scadeAt: string;
  /** Token in chiaro. Disponibile solo qui: in database c'è solo l'hash. */
  token: string;
};

export async function creaInvito(
  attore: Attore,
  dati: { email: string; ruolo: Ruolo; organizationId?: string },
): Promise<InvitoCreato> {
  esigiPermesso(attore, "staff.invita");
  esigiRuoloAssegnabile(attore, dati.ruolo);

  const organizationId = dati.organizationId ?? attore.organizationId;
  // Invitare in un'altra organizzazione è un'operazione da super_admin: da
  // chiunque altro sarebbe un modo per creare account fuori dal proprio tenant.
  if (organizationId !== attore.organizationId && attore.ruolo !== "super_admin") {
    throw new NonAutorizzato("invito fuori dal proprio tenant");
  }

  const email = dati.email.trim().toLowerCase();
  const db = getDb();

  const [esistente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (esistente) throw new Error("Esiste già un account con questo indirizzo.");

  const token = randomBytes(32).toString("base64url");
  const scadeAt = new Date(Date.now() + GIORNI_VALIDITA_INVITO * 24 * 60 * 60 * 1000);

  const [riga] = await db
    .insert(inviti)
    .values({
      email,
      ruolo: dati.ruolo,
      organizationId,
      tokenHash: hashToken(token),
      invitatoDaId: attore.userId,
      scadeAt,
    })
    .returning();

  await registra(attore, {
    azione: "utente.invitato",
    entita: "invito",
    entitaId: riga!.id,
    metadati: { email, ruolo: dati.ruolo, organizationId },
  });

  return { id: riga!.id, email, ruolo: dati.ruolo, scadeAt: scadeAt.toISOString(), token };
}

/**
 * Accetta un invito e crea l'account. Non richiede un attore: è l'unica
 * operazione compiuta da chi non ha ancora un account.
 *
 * Il confronto sull'hash è a tempo costante: un confronto normale farebbe
 * trapelare il prefisso corretto dai tempi di risposta.
 */
export async function accettaInvito(
  token: string,
  nome: string | null,
): Promise<{ userId: string; email: string; ruolo: Ruolo }> {
  const db = getDb();
  const atteso = hashToken(token);

  const candidati = await db
    .select()
    .from(inviti)
    .where(
      and(
        eq(inviti.tokenHash, atteso),
        gt(inviti.scadeAt, new Date()),
        isNull(inviti.accettatoAt),
        isNull(inviti.revocatoAt),
      ),
    )
    .limit(1);

  const invito = candidati[0];
  if (!invito) throw new NonTrovato("invito inesistente, scaduto, già usato o revocato");

  // Ridondante rispetto alla query (l'uguaglianza SQL ha già selezionato), ma
  // rende esplicito che il confronto del token non passa mai da `===`.
  const a = Buffer.from(invito.tokenHash);
  const b = Buffer.from(atteso);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new NonTrovato("token non corrispondente");
  }

  return db.transaction(async (tx) => {
    const [utente] = await tx
      .insert(users)
      .values({
        email: invito.email,
        name: nome,
        ruolo: invito.ruolo,
        organizationId: invito.organizationId,
        emailVerified: new Date(),
      })
      .returning();

    await tx.update(inviti).set({ accettatoAt: new Date() }).where(eq(inviti.id, invito.id));

    await registra(
      null,
      {
        azione: "utente.creato",
        entita: "utente",
        entitaId: utente!.id,
        metadati: { ruolo: invito.ruolo, organizationId: invito.organizationId },
      },
      tx,
    );

    return { userId: utente!.id, email: utente!.email, ruolo: invito.ruolo as Ruolo };
  });
}

export async function revocaInvito(attore: Attore, invitoId: string): Promise<void> {
  esigiPermesso(attore, "staff.invita");
  const db = getDb();
  const [riga] = await db
    .update(inviti)
    .set({ revocatoAt: new Date() })
    .where(and(eq(inviti.id, invitoId), eq(inviti.organizationId, attore.organizationId)))
    .returning({ id: inviti.id });
  if (!riga) throw new NonTrovato(`invito ${invitoId} inesistente o di altro tenant`);
}

export async function elencaStaff(attore: Attore): Promise<UtentePerAmministrazione[]> {
  esigiPermesso(attore, "staff.vedi");
  const db = getDb();
  const righe = await db
    .select()
    .from(users)
    .where(and(eq(users.organizationId, attore.organizationId), or(...RUOLI.filter((r) => r !== "client").map((r) => eq(users.ruolo, r)))))
    .orderBy(desc(users.createdAt));
  return righe.map((u) => utenteDTO(attore, u) as UtentePerAmministrazione);
}

export async function cambiaRuolo(
  attore: Attore,
  userId: string,
  nuovoRuolo: Ruolo,
): Promise<void> {
  esigiPermesso(attore, "staff.cambia_ruolo");
  esigiRuoloAssegnabile(attore, nuovoRuolo);
  if (userId === attore.userId) {
    throw new NonAutorizzato("cambiare il proprio ruolo non è consentito");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const [utente] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!utente) throw new NonTrovato(`utente ${userId} inesistente`);
    esigiStessoTenant(attore, utente.organizationId, "cambio ruolo");
    esigiRuoloAssegnabile(attore, utente.ruolo as Ruolo);

    await tx.update(users).set({ ruolo: nuovoRuolo, updatedAt: new Date() }).where(eq(users.id, userId));

    // Un cambio di ruolo deve avere effetto subito: le sessioni aperte con il
    // ruolo precedente vengono chiuse.
    await tx.delete(sessions).where(eq(sessions.userId, userId));

    await registra(
      attore,
      {
        azione: "utente.ruolo_cambiato",
        entita: "utente",
        entitaId: userId,
        metadati: { da: utente.ruolo, a: nuovoRuolo },
      },
      tx,
    );
  });
}

export async function disattivaUtente(
  attore: Attore,
  userId: string,
  motivo: string,
): Promise<void> {
  esigiPermesso(attore, "staff.disattiva");
  if (userId === attore.userId) {
    throw new NonAutorizzato("disattivare il proprio account non è consentito");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const [utente] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!utente) throw new NonTrovato(`utente ${userId} inesistente`);
    esigiStessoTenant(attore, utente.organizationId, "disattivazione utente");
    esigiRuoloAssegnabile(attore, utente.ruolo as Ruolo);

    await tx
      .update(users)
      .set({
        attivo: false,
        disattivatoAt: new Date(),
        motivoDisattivazione: motivo.slice(0, 300),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Revoca immediata: un account disattivato con una sessione aperta è
    // ancora un account attivo.
    await tx.delete(sessions).where(eq(sessions.userId, userId));

    await registra(
      attore,
      { azione: "utente.disattivato", entita: "utente", entitaId: userId, metadati: { motivo } },
      tx,
    );
  });
}

export async function riattivaUtente(attore: Attore, userId: string): Promise<void> {
  esigiPermesso(attore, "staff.disattiva");
  const db = getDb();
  const [utente] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!utente) throw new NonTrovato(`utente ${userId} inesistente`);
  esigiStessoTenant(attore, utente.organizationId, "riattivazione utente");

  await db
    .update(users)
    .set({ attivo: true, disattivatoAt: null, motivoDisattivazione: null, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await registra(attore, { azione: "utente.riattivato", entita: "utente", entitaId: userId });
}

export type SessioneAttiva = {
  token: string;
  creataAt: string;
  scadeAt: string;
  userAgent: string | null;
};

/** Le proprie sessioni aperte, per poterle revocare. */
export async function sessioniProprie(attore: Attore): Promise<SessioneAttiva[]> {
  const db = getDb();
  const righe = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, attore.userId), gt(sessions.expires, new Date())))
    .orderBy(desc(sessions.creataAt));
  return righe.map((s) => ({
    // Il token non esce mai per intero: basta un prefisso per distinguere le righe.
    token: `${s.sessionToken.slice(0, 8)}…`,
    creataAt: s.creataAt.toISOString(),
    scadeAt: s.expires.toISOString(),
    userAgent: s.userAgent,
  }));
}

export async function revocaSessioniProprie(attore: Attore, tranneCorrente?: string): Promise<void> {
  const db = getDb();
  await db
    .delete(sessions)
    .where(
      tranneCorrente
        ? and(eq(sessions.userId, attore.userId), lt(sessions.sessionToken, tranneCorrente))
        : eq(sessions.userId, attore.userId),
    );
  await registra(attore, { azione: "sessione.revocata", entita: "utente", entitaId: attore.userId });
}

/** Riferimenti utente per popolare i selettori di assegnazione. */
export async function riferimentiStaff(attore: Attore): Promise<UtenteRiferimento[]> {
  esigiPermesso(attore, "staff.vedi");
  const db = getDb();
  const righe = await db
    .select({ id: users.id, name: users.name, ruolo: users.ruolo })
    .from(users)
    .where(and(eq(users.organizationId, attore.organizationId), eq(users.attivo, true)))
    .orderBy(users.name);
  return righe
    .filter((u) => u.ruolo !== "client")
    .map((u) => ({ id: u.id, nome: u.name, ruolo: u.ruolo as Ruolo }));
}

/** Organizzazione dell'attore: serve a sapere se opera nello studio. */
export async function organizzazioneDi(attore: Attore): Promise<{
  id: string;
  nome: string;
  tipo: string;
  proemiosInvisibile: boolean;
}> {
  const db = getDb();
  const [riga] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, attore.organizationId))
    .limit(1);
  if (!riga) throw new NonTrovato(`organizzazione ${attore.organizationId} inesistente`);
  return {
    id: riga.id,
    nome: riga.nome,
    tipo: riga.tipo,
    proemiosInvisibile: riga.proemiosInvisibile,
  };
}

export type { Utente };
