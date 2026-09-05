/**
 * Messaggi, richieste di chiarimento e approvazioni.
 *
 * Tre catene di approvazione distinte e non sovrapponibili:
 *  - `milestone_cliente` — la decide il cliente;
 *  - `editoriale` — la decide un redattore o il responsabile editoriale;
 *  - `operativa` — la decide operations, ed è l'unica che autorizza la consegna.
 *
 * Nessun ruolo può chiudere due anelli della stessa catena.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  approvals,
  clarificationRequests,
  messages,
  milestones,
  projectMembers,
  projects,
} from "@/db/schema/progetti";
import { users } from "@/db/schema/utenti";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import { notificaClienteDiProgetto } from "./notifiche";

/**
 * Verifica che l'attore possa operare su questo progetto e restituisce i dati
 * minimi che servono. Ogni funzione del modulo comincia da qui: senza, ognuna
 * dovrebbe ricordarsi di controllare tenant, proprietà e appartenenza.
 */
async function progettoAccessibile(
  attore: Attore,
  progettoId: string,
): Promise<{ id: string; clientId: string; organizationId: string }> {
  const db = getDb();
  const [riga] = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      organizationId: projects.organizationId,
    })
    .from(projects)
    .where(and(eq(projects.id, progettoId), eq(projects.organizationId, attore.organizationId)))
    .limit(1);
  if (!riga) throw new NonTrovato(`progetto ${progettoId} inesistente o di altro tenant`);

  if (attore.ruolo === "client") {
    if (riga.clientId !== attore.clientId) {
      throw new NonTrovato(`progetto ${progettoId} non appartiene al cliente ${attore.clientId}`);
    }
    return riga;
  }

  if (!haPermesso(attore, "progetto.vedi_tutti")) {
    const [membro] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, progettoId),
          eq(projectMembers.userId, attore.userId),
          isNull(projectMembers.rimossoAt),
        ),
      )
      .limit(1);
    if (!membro) throw new NonTrovato(`${attore.userId} non è membro del progetto ${progettoId}`);
  }

  return riga;
}

/* ── Messaggi ────────────────────────────────────────────────────────── */

export type MessaggioDTO = {
  id: string;
  corpo: string;
  autoreId: string | null;
  autoreNome: string | null;
  visibileAlCliente: boolean;
  createdAt: string;
};

export async function elencaMessaggi(
  attore: Attore,
  progettoId: string,
): Promise<MessaggioDTO[]> {
  await progettoAccessibile(attore, progettoId);
  const db = getDb();

  const condizioni = [eq(messages.projectId, progettoId)];
  // Le note fra operatori vivono nella stessa cronologia ma non escono: il
  // filtro è nella query, non una proprietà che l'interfaccia decide di non
  // mostrare.
  if (attore.ruolo === "client") condizioni.push(eq(messages.visibileAlCliente, true));

  const righe = await db
    .select({
      id: messages.id,
      corpo: messages.corpo,
      autoreId: messages.autoreId,
      autoreNome: users.name,
      visibileAlCliente: messages.visibileAlCliente,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.autoreId))
    .where(and(...condizioni))
    .orderBy(desc(messages.createdAt))
    .limit(200);

  return righe.map((m) => ({
    id: m.id,
    corpo: m.corpo,
    autoreId: m.autoreId,
    autoreNome: m.autoreNome,
    visibileAlCliente: m.visibileAlCliente,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function scriviMessaggio(
  attore: Attore,
  progettoId: string,
  corpo: string,
  visibileAlCliente: boolean,
): Promise<MessaggioDTO> {
  await progettoAccessibile(attore, progettoId);
  const testo = corpo.trim();
  if (!testo) throw new Error("Il messaggio è vuoto.");

  // Un cliente non può scrivere una nota interna: la sua è per definizione una
  // comunicazione visibile.
  const visibile = attore.ruolo === "client" ? true : visibileAlCliente;

  const db = getDb();
  const [riga] = await db
    .insert(messages)
    .values({
      projectId: progettoId,
      autoreId: attore.userId,
      corpo: testo,
      visibileAlCliente: visibile,
    })
    .returning();

  // Un messaggio non visibile al cliente è una nota interna: avvisare il
  // cliente che «c'è un messaggio» che poi non può leggere sarebbe peggio che
  // non avvisarlo.
  if (visibile && attore.ruolo !== "client") {
    await notificaClienteDiProgetto(progettoId, "messaggio.ricevuto", {
      mittente: attore.nome ?? undefined,
    });
  }

  return {
    id: riga!.id,
    corpo: riga!.corpo,
    autoreId: riga!.autoreId,
    autoreNome: attore.nome,
    visibileAlCliente: riga!.visibileAlCliente,
    createdAt: riga!.createdAt.toISOString(),
  };
}

/* ── Richieste di chiarimento ────────────────────────────────────────── */

export type ChiarimentoDTO = {
  id: string;
  /** Il testo che il destinatario può leggere: dipende da chi guarda. */
  domanda: string;
  riferimento: string | null;
  risposta: string | null;
  rispostaAt: string | null;
  inoltrataAlClienteAt: string | null;
  chiusaAt: string | null;
  createdAt: string;
};

export async function elencaChiarimenti(
  attore: Attore,
  progettoId: string,
): Promise<ChiarimentoDTO[]> {
  await progettoAccessibile(attore, progettoId);
  const db = getDb();

  const condizioni = [eq(clarificationRequests.projectId, progettoId)];
  // Al cliente arrivano solo le richieste già inoltrate: la formulazione
  // interna del redattore non è pensata per lui.
  if (attore.ruolo === "client") {
    condizioni.push(sql`${clarificationRequests.inoltrataAlClienteAt} is not null`);
  }

  const righe = await db
    .select()
    .from(clarificationRequests)
    .where(and(...condizioni))
    .orderBy(desc(clarificationRequests.createdAt));

  return righe.map((r) => ({
    id: r.id,
    domanda:
      attore.ruolo === "client" ? (r.domandaAlCliente ?? "") : r.domandaInterna,
    riferimento: r.riferimento,
    risposta: r.risposta,
    rispostaAt: r.rispostaAt?.toISOString() ?? null,
    inoltrataAlClienteAt: r.inoltrataAlClienteAt?.toISOString() ?? null,
    chiusaAt: r.chiusaAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function chiediChiarimento(
  attore: Attore,
  progettoId: string,
  domandaInterna: string,
  riferimento?: string,
  jobId?: string,
): Promise<string> {
  esigiPermesso(attore, "job.richiedi_chiarimento");
  await progettoAccessibile(attore, progettoId);

  const db = getDb();
  const [riga] = await db
    .insert(clarificationRequests)
    .values({
      projectId: progettoId,
      jobId: jobId ?? null,
      richiedenteId: attore.userId,
      domandaInterna: domandaInterna.trim(),
      riferimento: riferimento?.slice(0, 300) ?? null,
    })
    .returning({ id: clarificationRequests.id });

  return riga!.id;
}

/**
 * Inoltra al cliente una richiesta, riformulata. Il redattore scrive la
 * domanda tecnica; chi la inoltra decide cosa e come chiedere al cliente.
 */
export async function inoltraChiarimento(
  attore: Attore,
  chiarimentoId: string,
  domandaAlCliente: string,
): Promise<void> {
  esigiPermesso(attore, "progetto.modifica");
  const db = getDb();

  const [riga] = await db
    .select({ projectId: clarificationRequests.projectId })
    .from(clarificationRequests)
    .where(eq(clarificationRequests.id, chiarimentoId))
    .limit(1);
  if (!riga) throw new NonTrovato(`chiarimento ${chiarimentoId} inesistente`);
  await progettoAccessibile(attore, riga.projectId);

  await db
    .update(clarificationRequests)
    .set({
      domandaAlCliente: domandaAlCliente.trim(),
      inoltrataAlClienteAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(clarificationRequests.id, chiarimentoId));

  await notificaClienteDiProgetto(riga.projectId, "chiarimento.richiesto");
}

export async function rispondiChiarimento(
  attore: Attore,
  chiarimentoId: string,
  risposta: string,
): Promise<void> {
  const db = getDb();
  const [riga] = await db
    .select({
      projectId: clarificationRequests.projectId,
      inoltrata: clarificationRequests.inoltrataAlClienteAt,
    })
    .from(clarificationRequests)
    .where(eq(clarificationRequests.id, chiarimentoId))
    .limit(1);
  if (!riga) throw new NonTrovato(`chiarimento ${chiarimentoId} inesistente`);
  await progettoAccessibile(attore, riga.projectId);

  // Un cliente può rispondere solo a ciò che gli è stato effettivamente
  // inoltrato: rispondere a una domanda interna significherebbe averla letta.
  if (attore.ruolo === "client" && !riga.inoltrata) {
    throw new NonTrovato(`chiarimento ${chiarimentoId} non inoltrato al cliente`);
  }

  await db
    .update(clarificationRequests)
    .set({
      risposta: risposta.trim(),
      rispostaDaId: attore.userId,
      rispostaAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(clarificationRequests.id, chiarimentoId));
}

/* ── Approvazioni ────────────────────────────────────────────────────── */

export type ApprovazioneDTO = {
  id: string;
  progettoId: string;
  progettoCodice: string;
  tipo: string;
  stato: string;
  milestoneId: string | null;
  milestoneNome: string | null;
  motivazione: string | null;
  scadeAt: string | null;
  createdAt: string;
};

/** Le approvazioni che aspettano una decisione dell'attore. */
export async function approvazioniInAttesa(attore: Attore): Promise<ApprovazioneDTO[]> {
  const db = getDb();

  const condizioni = [
    eq(approvals.stato, "richiesta"),
    eq(projects.organizationId, attore.organizationId),
  ];

  if (attore.ruolo === "client") {
    condizioni.push(
      eq(approvals.tipo, "milestone_cliente"),
      attore.clientId ? eq(projects.clientId, attore.clientId) : sql`false`,
    );
  } else if (haPermesso(attore, "progetto.approva_consegna")) {
    condizioni.push(inArray(approvals.tipo, ["operativa", "variazione"]));
  } else if (haPermesso(attore, "job.approva_editorialmente")) {
    condizioni.push(eq(approvals.tipo, "editoriale"));
  } else {
    return [];
  }

  const righe = await db
    .select({
      id: approvals.id,
      progettoId: approvals.projectId,
      progettoCodice: projects.codice,
      tipo: approvals.tipo,
      stato: approvals.stato,
      milestoneId: approvals.milestoneId,
      milestoneNome: milestones.nome,
      motivazione: approvals.motivazione,
      scadeAt: approvals.scadeAt,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .innerJoin(projects, eq(projects.id, approvals.projectId))
    .leftJoin(milestones, eq(milestones.id, approvals.milestoneId))
    .where(and(...condizioni))
    .orderBy(approvals.scadeAt, desc(approvals.createdAt))
    .limit(100);

  return righe.map((a) => ({
    id: a.id,
    progettoId: a.progettoId,
    progettoCodice: a.progettoCodice,
    tipo: a.tipo,
    stato: a.stato,
    milestoneId: a.milestoneId,
    milestoneNome: a.milestoneNome,
    motivazione: a.motivazione,
    scadeAt: a.scadeAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
}

/** Chi può decidere quale tipo di approvazione. Un ruolo, un anello. */
const DECISORE: Record<string, (attore: Attore) => boolean> = {
  milestone_cliente: (a) => a.ruolo === "client",
  editoriale: (a) => haPermesso(a, "job.approva_editorialmente"),
  operativa: (a) => haPermesso(a, "progetto.approva_consegna"),
  variazione: (a) => a.ruolo === "client" || haPermesso(a, "progetto.approva_consegna"),
};

export async function decidiApprovazione(
  attore: Attore,
  approvazioneId: string,
  decisione: "approvata" | "respinta",
  motivazione?: string,
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const [riga] = await tx
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvazioneId))
      .limit(1);
    if (!riga) throw new NonTrovato(`approvazione ${approvazioneId} inesistente`);

    await progettoAccessibile(attore, riga.projectId);

    if (riga.stato !== "richiesta") {
      throw new Error("Questa approvazione è già stata decisa.");
    }

    const puoDecidere = DECISORE[riga.tipo];
    if (!puoDecidere || !puoDecidere(attore)) {
      throw new NonAutorizzato(
        `ruolo ${attore.ruolo} non può decidere un'approvazione di tipo ${riga.tipo}`,
      );
    }

    // Chi ha richiesto l'approvazione non la concede a sé stesso: sarebbe il
    // modo più semplice per aggirare la separazione fra approvazione e consegna.
    if (riga.richiestaDaId === attore.userId) {
      throw new NonAutorizzato("chi richiede un'approvazione non può concederla");
    }

    await tx
      .update(approvals)
      .set({
        stato: decisione,
        decisaDaId: attore.userId,
        decisaAt: new Date(),
        motivazione: motivazione?.slice(0, 2000) ?? riga.motivazione,
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, approvazioneId));

    if (riga.milestoneId && decisione === "approvata") {
      await tx
        .update(milestones)
        .set({ stato: "approvata", approvataAt: new Date(), approvataDaId: attore.userId })
        .where(eq(milestones.id, riga.milestoneId));
    }
    if (riga.milestoneId && decisione === "respinta") {
      await tx
        .update(milestones)
        .set({ stato: "respinta" })
        .where(eq(milestones.id, riga.milestoneId));
    }

    await registra(
      attore,
      {
        azione:
          decisione === "respinta"
            ? "approvazione.respinta"
            : riga.tipo === "editoriale"
              ? "approvazione.editoriale"
              : "approvazione.operativa",
        entita: "approvazione",
        entitaId: approvazioneId,
        metadati: { tipo: riga.tipo, progettoId: riga.projectId },
      },
      tx,
    );
  });
}

export async function richiediApprovazione(
  attore: Attore,
  dati: {
    progettoId: string;
    tipo: "milestone_cliente" | "editoriale" | "operativa" | "variazione";
    milestoneId?: string;
    jobId?: string;
    richiestaAId?: string;
    motivazione?: string;
    scadeAt?: Date;
  },
): Promise<string> {
  await progettoAccessibile(attore, dati.progettoId);
  const db = getDb();

  const [riga] = await db
    .insert(approvals)
    .values({
      projectId: dati.progettoId,
      milestoneId: dati.milestoneId ?? null,
      jobId: dati.jobId ?? null,
      tipo: dati.tipo,
      richiestaDaId: attore.userId,
      richiestaAId: dati.richiestaAId ?? null,
      motivazione: dati.motivazione ?? null,
      scadeAt: dati.scadeAt ?? null,
    })
    .returning({ id: approvals.id });

  if (dati.milestoneId) {
    await db
      .update(milestones)
      .set({ stato: "in_approvazione" })
      .where(eq(milestones.id, dati.milestoneId));
  }

  // Solo l'approvazione del cliente lo riguarda: quella editoriale e quella
  // operativa sono passaggi interni, e avvisarlo lo farebbe entrare in un
  // flusso che non è suo.
  if (dati.tipo === "milestone_cliente") {
    await notificaClienteDiProgetto(dati.progettoId, "approvazione.richiesta");
  }

  return riga!.id;
}

export async function conteggioApprovazioniInAttesa(attore: Attore): Promise<number> {
  const elenco = await approvazioniInAttesa(attore);
  return elenco.length;
}

export { progettoAccessibile };
