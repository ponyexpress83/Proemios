/**
 * Progetti: creazione, lettura, membri, tappe, milestone.
 *
 * Le tre viste (cliente, redattore, staff) non sono la stessa query filtrata:
 * partono da condizioni diverse.
 *  - il **cliente** vede i progetti della propria anagrafica;
 *  - il **redattore** vede quelli di cui è membro;
 *  - lo **staff operativo** vede quelli del proprio tenant.
 */
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  approvals,
  milestones,
  projectMembers,
  projectStages,
  projects,
  type Progetto,
} from "@/db/schema/progetti";
import { clients } from "@/db/schema/crm";
import { users } from "@/db/schema/utenti";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { esigiPermesso, esigiUnoDei } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import {
  progettoDTO,
  progettoPerCliente,
  progettoPerRedattore,
  progettoPerStaff,
  type ProgettoDTO,
  type ProgettoPerCliente,
  type ProgettoPerStaff,
} from "@/lib/dto/progetto";
import { clienteDTO, type ClienteDTO } from "@/lib/dto/cliente";
import { registra } from "@/lib/audit";
import { TAPPE_PREDEFINITE } from "@/lib/progetti/tappe";

/**
 * La condizione di visibilità, espressa in SQL.
 *
 * È il cuore dell'autorizzazione sui progetti: viene messa nella `WHERE` di
 * ogni query, mai applicata dopo. Un filtro a valle, con un `LIMIT` davanti,
 * restituirebbe una pagina già sbagliata.
 */
function condizioneVisibilita(attore: Attore) {
  if (attore.ruolo === "client") {
    // Il cliente non ha bisogno di permessi: accede per proprietà.
    return and(
      eq(projects.organizationId, attore.organizationId),
      attore.clientId ? eq(projects.clientId, attore.clientId) : sql`false`,
    );
  }

  if (haPermesso(attore, "progetto.vedi_tutti")) {
    return eq(projects.organizationId, attore.organizationId);
  }

  // Redattore: solo i progetti di cui è membro. La sottoquery è più stretta di
  // una join, e non moltiplica le righe quando i membri sono più d'uno.
  return and(
    eq(projects.organizationId, attore.organizationId),
    sql`exists (
      select 1 from ${projectMembers}
      where ${projectMembers.projectId} = ${projects.id}
        and ${projectMembers.userId} = ${attore.userId}
        and ${projectMembers.rimossoAt} is null
    )`,
  );
}

export type FiltriProgetti = {
  stato?: string[];
  clientId?: string;
  projectManagerId?: string;
  soloInRitardo?: boolean;
  pagina?: number;
  perPagina?: number;
};

export type PaginaProgetti = {
  voci: ProgettoDTO[];
  totale: number;
};

export async function elencaProgetti(
  attore: Attore,
  filtri: FiltriProgetti = {},
): Promise<PaginaProgetti> {
  esigiUnoDei(attore, ["progetto.vedi_tutti", "progetto.vedi_assegnati", "file.carica"]);
  const db = getDb();

  const pagina = Math.max(1, filtri.pagina ?? 1);
  const perPagina = Math.min(100, Math.max(1, filtri.perPagina ?? 25));

  const condizioni = [condizioneVisibilita(attore)];
  if (filtri.stato?.length) {
    condizioni.push(inArray(projects.stato, filtri.stato as Progetto["stato"][]));
  }
  if (filtri.clientId) condizioni.push(eq(projects.clientId, filtri.clientId));
  if (filtri.projectManagerId) {
    condizioni.push(eq(projects.projectManagerId, filtri.projectManagerId));
  }
  if (filtri.soloInRitardo) {
    condizioni.push(
      and(
        sql`${projects.scadenzaAt} < now()`,
        inArray(projects.stato, ["avvio", "in_corso", "in_attesa_cliente", "in_revisione", "in_consegna"]),
      )!,
    );
  }

  const dove = and(...condizioni);

  const [righe, [conteggio]] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(dove)
      .orderBy(desc(projects.prioritaria), projects.scadenzaAt, desc(projects.createdAt))
      .limit(perPagina)
      .offset((pagina - 1) * perPagina),
    db.select({ n: count() }).from(projects).where(dove),
  ]);

  return {
    voci: righe.map((r) => progettoDTO(attore, r)),
    totale: Number(conteggio?.n ?? 0),
  };
}

/** Riga di progetto grezza, per uso interno al livello dati. */
async function leggiRiga(attore: Attore, id: string): Promise<Progetto> {
  const db = getDb();
  const [riga] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), condizioneVisibilita(attore)))
    .limit(1);
  if (!riga) throw new NonTrovato(`progetto ${id} inesistente o non visibile a ${attore.userId}`);
  return riga;
}

export type DettaglioProgetto = {
  progetto: ProgettoDTO;
  cliente: ClienteDTO | null;
  tappe: {
    id: string;
    nome: string;
    descrizione: string | null;
    stato: string;
    ordine: number;
    finePrevistaAt: string | null;
    completataAt: string | null;
  }[];
  milestone: {
    id: string;
    nome: string;
    descrizione: string | null;
    stato: string;
    scadenzaAt: string | null;
    approvataAt: string | null;
    /** Importo mostrato solo a chi può vedere i prezzi. */
    importoCent: number | null;
  }[];
  approvazioniInAttesa: number;
  membri: { userId: string; nome: string | null; ruolo: string }[];
};

export async function leggiProgetto(attore: Attore, id: string): Promise<DettaglioProgetto> {
  const db = getDb();
  const riga = await leggiRiga(attore, id);

  const [tappe, milestoneRighe, membriRighe, [approvazioni]] = await Promise.all([
    db.select().from(projectStages).where(eq(projectStages.projectId, id)).orderBy(projectStages.ordine),
    db.select().from(milestones).where(eq(milestones.projectId, id)).orderBy(milestones.ordine),
    db
      .select({ userId: projectMembers.userId, ruolo: projectMembers.ruolo, nome: users.name })
      .from(projectMembers)
      .leftJoin(users, eq(users.id, projectMembers.userId))
      .where(and(eq(projectMembers.projectId, id), isNull(projectMembers.rimossoAt))),
    db
      .select({ n: count() })
      .from(approvals)
      .where(and(eq(approvals.projectId, id), eq(approvals.stato, "richiesta"))),
  ]);

  // L'anagrafica del cliente si legge solo se l'attore può vederne qualcosa:
  // per il redattore la query non parte nemmeno.
  let cliente: ClienteDTO | null = null;
  if (attore.ruolo !== "editor_reviewer") {
    const [rigaCliente] = await db.select().from(clients).where(eq(clients.id, riga.clientId)).limit(1);
    if (rigaCliente) cliente = clienteDTO(attore, rigaCliente);
  }

  const vedePrezzi = haPermesso(attore, "prezzo.vedi");

  return {
    progetto: progettoDTO(attore, riga),
    cliente,
    tappe: tappe.map((t) => ({
      id: t.id,
      nome: t.nome,
      descrizione: t.descrizione,
      stato: t.stato,
      ordine: t.ordine,
      finePrevistaAt: t.finePrevistaAt?.toISOString() ?? null,
      completataAt: t.completataAt?.toISOString() ?? null,
    })),
    milestone: milestoneRighe.map((m) => ({
      id: m.id,
      nome: m.nome,
      descrizione: m.descrizione,
      stato: m.stato,
      scadenzaAt: m.scadenzaAt?.toISOString() ?? null,
      approvataAt: m.approvataAt?.toISOString() ?? null,
      importoCent: vedePrezzi ? m.importoCent : null,
    })),
    approvazioniInAttesa: Number(approvazioni?.n ?? 0),
    // I membri non sono visibili al cliente: chi lavora al suo progetto è
    // informazione interna, e il referente è il project manager.
    membri:
      attore.ruolo === "client"
        ? []
        : membriRighe.map((m) => ({ userId: m.userId, nome: m.nome, ruolo: m.ruolo })),
  };
}

/** Codice progetto progressivo: P-184. */
async function prossimoCodice(): Promise<string> {
  const db = getDb();
  const [riga] = await db
    .select({ n: count() })
    .from(projects);
  return `P-${100 + Number(riga?.n ?? 0) + 1}`;
}

export type DatiNuovoProgetto = {
  clientId: string;
  titolo: string;
  titoloAlias?: string | null;
  percorsoSlug?: string | null;
  serviziSlug?: string[];
  orderId?: string | null;
  projectManagerId?: string | null;
  conteggioParole?: number | null;
  scadenzaAt?: Date | null;
  istruzioniEditoriali?: string | null;
};

/**
 * Crea un progetto con le sue tappe iniziali, in transazione: un progetto
 * senza tappe non è mostrabile al cliente, e un fallimento a metà lo
 * produrrebbe.
 */
export async function creaProgetto(
  attore: Attore,
  dati: DatiNuovoProgetto,
): Promise<ProgettoPerStaff> {
  esigiPermesso(attore, "progetto.crea");
  const db = getDb();

  return db.transaction(async (tx) => {
    const [cliente] = await tx
      .select({ id: clients.id, organizationId: clients.organizationId })
      .from(clients)
      .where(and(eq(clients.id, dati.clientId), eq(clients.organizationId, attore.organizationId)))
      .limit(1);
    if (!cliente) throw new NonTrovato(`cliente ${dati.clientId} inesistente o di altro tenant`);

    const codice = await prossimoCodice();

    const [progetto] = await tx
      .insert(projects)
      .values({
        codice,
        organizationId: attore.organizationId,
        clientId: dati.clientId,
        orderId: dati.orderId ?? null,
        titolo: dati.titolo,
        titoloAlias: dati.titoloAlias ?? null,
        percorsoSlug: dati.percorsoSlug ?? null,
        serviziSlug: dati.serviziSlug ?? [],
        projectManagerId: dati.projectManagerId ?? attore.userId,
        conteggioParole: dati.conteggioParole ?? null,
        scadenzaAt: dati.scadenzaAt ?? null,
        istruzioniEditoriali: dati.istruzioniEditoriali ?? null,
      })
      .returning();

    await tx.insert(projectStages).values(
      TAPPE_PREDEFINITE.map((t, i) => ({
        projectId: progetto!.id,
        nome: t.nome,
        descrizione: t.descrizione,
        ordine: i,
        stato: i === 0 ? ("in_corso" as const) : ("attesa" as const),
      })),
    );

    if (dati.projectManagerId ?? attore.userId) {
      await tx.insert(projectMembers).values({
        projectId: progetto!.id,
        userId: dati.projectManagerId ?? attore.userId,
        ruolo: "operations_admin",
        assegnatoDaId: attore.userId,
      });
    }

    await registra(
      attore,
      {
        azione: "progetto.creato",
        entita: "progetto",
        entitaId: progetto!.id,
        metadati: { codice, clientId: dati.clientId },
      },
      tx,
    );

    return progettoPerStaff(progetto!);
  });
}

export async function aggiungiMembro(
  attore: Attore,
  progettoId: string,
  userId: string,
  ruolo: Attore["ruolo"],
): Promise<void> {
  esigiPermesso(attore, "progetto.assegna_membri");
  const db = getDb();

  await db.transaction(async (tx) => {
    const [progetto] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, progettoId), eq(projects.organizationId, attore.organizationId)))
      .limit(1);
    if (!progetto) throw new NonTrovato(`progetto ${progettoId} inesistente o di altro tenant`);

    const [utente] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, attore.organizationId)))
      .limit(1);
    if (!utente) throw new NonTrovato(`utente ${userId} inesistente o di altro tenant`);

    // Riassegnare un membro rimosso deve riattivarlo, non creare un duplicato.
    const [esistente] = await tx
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, progettoId), eq(projectMembers.userId, userId)))
      .limit(1);

    if (esistente) {
      await tx
        .update(projectMembers)
        .set({ ruolo, rimossoAt: null, assegnatoDaId: attore.userId, updatedAt: new Date() })
        .where(eq(projectMembers.id, esistente.id));
    } else {
      await tx.insert(projectMembers).values({
        projectId: progettoId,
        userId,
        ruolo,
        assegnatoDaId: attore.userId,
      });
    }

    await registra(
      attore,
      {
        azione: "progetto.membro_aggiunto",
        entita: "progetto",
        entitaId: progettoId,
        metadati: { userId, ruolo },
      },
      tx,
    );
  });
}

export async function rimuoviMembro(
  attore: Attore,
  progettoId: string,
  userId: string,
): Promise<void> {
  esigiPermesso(attore, "progetto.assegna_membri");
  const db = getDb();
  const [riga] = await db
    .update(projectMembers)
    .set({ rimossoAt: new Date() })
    .where(
      and(
        eq(projectMembers.projectId, progettoId),
        eq(projectMembers.userId, userId),
        sql`exists (select 1 from ${projects} where ${projects.id} = ${projectMembers.projectId}
             and ${projects.organizationId} = ${attore.organizationId})`,
      ),
    )
    .returning({ id: projectMembers.id });
  if (!riga) throw new NonTrovato(`membro ${userId} del progetto ${progettoId} non trovato`);

  await registra(attore, {
    azione: "progetto.membro_rimosso",
    entita: "progetto",
    entitaId: progettoId,
    metadati: { userId },
  });
}

/**
 * Avanza una tappa e ricalcola l'avanzamento del progetto.
 *
 * L'avanzamento è denormalizzato su `projects.avanzamento` perché le liste lo
 * mostrano per ogni riga: ricalcolarlo con una sottoquery a ogni elenco
 * costerebbe una scansione delle tappe per progetto.
 */
export async function completaTappa(
  attore: Attore,
  progettoId: string,
  tappaId: string,
): Promise<number> {
  esigiPermesso(attore, "progetto.modifica");
  const db = getDb();

  return db.transaction(async (tx) => {
    const [progetto] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, progettoId), eq(projects.organizationId, attore.organizationId)))
      .limit(1);
    if (!progetto) throw new NonTrovato(`progetto ${progettoId} inesistente o di altro tenant`);

    await tx
      .update(projectStages)
      .set({ stato: "completata", completataAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projectStages.id, tappaId), eq(projectStages.projectId, progettoId)));

    const tutte = await tx
      .select({ stato: projectStages.stato, id: projectStages.id, ordine: projectStages.ordine })
      .from(projectStages)
      .where(eq(projectStages.projectId, progettoId))
      .orderBy(projectStages.ordine);

    const completate = tutte.filter((t) => t.stato === "completata").length;
    const avanzamento = tutte.length > 0 ? Math.round((completate / tutte.length) * 100) : 0;

    // La tappa successiva in attesa passa in corso: il cliente deve vedere
    // sempre dove si trova il lavoro, non un elenco di tappe tutte ferme.
    const prossima = tutte.find((t) => t.stato === "attesa");
    if (prossima) {
      await tx
        .update(projectStages)
        .set({ stato: "in_corso", updatedAt: new Date() })
        .where(eq(projectStages.id, prossima.id));
    }

    await tx
      .update(projects)
      .set({
        avanzamento,
        stato: avanzamento === 100 ? "concluso" : undefined,
        conclusoAt: avanzamento === 100 ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, progettoId));

    await registra(
      attore,
      {
        azione: "progetto.modificato",
        entita: "progetto",
        entitaId: progettoId,
        metadati: { tappaCompletata: tappaId, avanzamento },
      },
      tx,
    );

    return avanzamento;
  });
}

/** Riepilogo per la home del cliente. */
export type RiepilogoCliente = {
  progetti: ProgettoPerCliente[];
  approvazioniInAttesa: number;
  prossimaScadenza: string | null;
};

export async function riepilogoCliente(attore: Attore): Promise<RiepilogoCliente> {
  const db = getDb();
  if (!attore.clientId) return { progetti: [], approvazioniInAttesa: 0, prossimaScadenza: null };

  const righe = await db
    .select()
    .from(projects)
    .where(condizioneVisibilita(attore))
    .orderBy(desc(projects.createdAt));

  const [attesa] = await db
    .select({ n: count() })
    .from(approvals)
    .where(
      and(
        eq(approvals.stato, "richiesta"),
        eq(approvals.tipo, "milestone_cliente"),
        inArray(
          approvals.projectId,
          righe.length ? righe.map((r) => r.id) : ["00000000-0000-4000-8000-000000000000"],
        ),
      ),
    );

  const scadenze = righe
    .map((r) => r.scadenzaAt)
    .filter((d): d is Date => d !== null && d > new Date())
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    progetti: righe.map(progettoPerCliente),
    approvazioniInAttesa: Number(attesa?.n ?? 0),
    prossimaScadenza: scadenze[0]?.toISOString() ?? null,
  };
}

export { progettoPerRedattore };
