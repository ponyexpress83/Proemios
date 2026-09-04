/**
 * Anagrafica clienti e conversione da lead.
 */
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, leadEvents, leads, type Cliente } from "@/db/schema/crm";
import { users } from "@/db/schema/utenti";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { clienteDTO, type ClienteDTO } from "@/lib/dto/cliente";
import { registra } from "@/lib/audit";

export async function elencaClienti(
  attore: Attore,
  filtri: { cerca?: string; pagina?: number; perPagina?: number } = {},
): Promise<{ voci: ClienteDTO[]; totale: number }> {
  esigiPermesso(attore, "cliente.vedi_identita");
  const db = getDb();

  const pagina = Math.max(1, filtri.pagina ?? 1);
  const perPagina = Math.min(100, Math.max(1, filtri.perPagina ?? 25));

  const condizioni = [eq(clients.organizationId, attore.organizationId)];
  if (filtri.cerca?.trim()) {
    const t = `%${filtri.cerca.trim()}%`;
    condizioni.push(
      or(ilike(clients.nome, t), ilike(clients.cognome, t), ilike(clients.email, t), ilike(clients.ragioneSociale, t))!,
    );
  }
  const dove = and(...condizioni);

  const [righe, [conteggio]] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(dove)
      .orderBy(desc(clients.createdAt))
      .limit(perPagina)
      .offset((pagina - 1) * perPagina),
    db.select({ n: count() }).from(clients).where(dove),
  ]);

  return { voci: righe.map((c) => clienteDTO(attore, c)), totale: Number(conteggio?.n ?? 0) };
}

export async function leggiCliente(attore: Attore, id: string): Promise<ClienteDTO> {
  esigiPermesso(attore, "cliente.vedi_identita");
  const db = getDb();
  const [riga] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, attore.organizationId)))
    .limit(1);
  if (!riga) throw new NonTrovato(`cliente ${id} inesistente o di altro tenant`);
  return clienteDTO(attore, riga);
}

/**
 * Converte un lead in cliente.
 *
 * I dati vengono presi dal lead, non richiesti di nuovo: chiedere una seconda
 * volta nome ed email a chi li ha già lasciati è il modo più affidabile per
 * ritrovarsi due anagrafiche leggermente diverse della stessa persona.
 *
 * L'operazione è idempotente: se il lead è già stato convertito restituisce il
 * cliente esistente invece di crearne un altro.
 */
export async function convertiLeadInCliente(
  attore: Attore,
  leadId: string,
  aggiunte: Partial<Pick<Cliente, "telefono" | "ragioneSociale" | "partitaIva" | "codiceFiscale" | "tipo">> = {},
): Promise<ClienteDTO> {
  esigiPermesso(attore, "crm.modifica_lead");
  esigiPermesso(attore, "cliente.modifica");
  const db = getDb();

  return db.transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.id, leadId),
          or(eq(leads.organizationId, attore.organizationId), eq(leads.organizationId, attore.organizationId)),
        ),
      )
      .limit(1);
    if (!lead) throw new NonTrovato(`lead ${leadId} inesistente o di altro tenant`);

    if (lead.clientId) {
      const [esistente] = await tx.select().from(clients).where(eq(clients.id, lead.clientId)).limit(1);
      if (esistente) return clienteDTO(attore, esistente);
    }

    const [cliente] = await tx
      .insert(clients)
      .values({
        organizationId: attore.organizationId,
        tipo: aggiunte.tipo ?? "privato",
        nome: lead.nome,
        email: lead.email,
        telefono: aggiunte.telefono ?? lead.telefono,
        ragioneSociale: aggiunte.ragioneSociale ?? null,
        partitaIva: aggiunte.partitaIva ?? null,
        codiceFiscale: aggiunte.codiceFiscale ?? null,
        noteCommerciali: lead.note,
      })
      .returning();

    const adesso = new Date();
    await tx
      .update(leads)
      .set({
        clientId: cliente!.id,
        stato: "cliente",
        organizationId: attore.organizationId,
        ultimaAttivitaAt: adesso,
        updatedAt: adesso,
      })
      .where(eq(leads.id, leadId));

    await tx.insert(leadEvents).values({
      leadId,
      tipo: "convertito",
      attoreId: attore.userId,
      descrizione: `Convertito in cliente ${cliente!.id}`,
    });

    await registra(
      attore,
      {
        azione: "lead.convertito",
        entita: "cliente",
        entitaId: cliente!.id,
        metadati: { leadId },
      },
      tx,
    );

    return clienteDTO(attore, cliente!);
  });
}

/**
 * Collega un account al cliente, così può accedere al portale. Non crea
 * l'account: quello nasce dall'invito, unico punto in cui si assegna un ruolo.
 */
export async function collegaAccount(
  attore: Attore,
  clienteId: string,
  userId: string,
): Promise<void> {
  esigiPermesso(attore, "cliente.modifica");
  const db = getDb();

  await db.transaction(async (tx) => {
    const [utente] = await tx
      .select({ id: users.id, ruolo: users.ruolo })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, attore.organizationId)))
      .limit(1);
    if (!utente) throw new NonTrovato(`utente ${userId} inesistente o di altro tenant`);
    if (utente.ruolo !== "client") {
      throw new Error("Solo un account con ruolo cliente può essere collegato a un'anagrafica.");
    }

    const [riga] = await tx
      .update(clients)
      .set({ userId, updatedAt: new Date() })
      .where(and(eq(clients.id, clienteId), eq(clients.organizationId, attore.organizationId)))
      .returning({ id: clients.id });
    if (!riga) throw new NonTrovato(`cliente ${clienteId} inesistente o di altro tenant`);

    await registra(
      attore,
      {
        azione: "cliente.modificato",
        entita: "cliente",
        entitaId: clienteId,
        metadati: { accountCollegato: userId },
      },
      tx,
    );
  });
}
