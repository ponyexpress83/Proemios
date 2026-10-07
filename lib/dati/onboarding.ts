/**
 * Onboarding operativo di clienti già acquisiti fuori da Proemios.
 *
 * Un cliente storico non viene trasformato in un lead fittizio: farlo
 * inquinerebbe funnel e attribuzione. Entra direttamente in anagrafica con un
 * audit esplicito `cliente.creato` e potrà poi ricevere uno o più progetti.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { registra } from "@/lib/audit";

export type DatiClienteEsistente = {
  tipo: "privato" | "azienda";
  nome: string;
  cognome?: string | null;
  ragioneSociale?: string | null;
  email: string;
  telefono?: string | null;
  partitaIva?: string | null;
  codiceFiscale?: string | null;
  pec?: string | null;
  codiceDestinatario?: string | null;
  alias?: string | null;
  noteCommerciali?: string | null;
};

export async function creaClienteEsistente(
  attore: Attore,
  dati: DatiClienteEsistente,
): Promise<{ id: string; email: string }> {
  esigiPermesso(attore, "cliente.modifica");
  const db = getDb();
  const email = dati.email.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const [duplicato] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.organizationId, attore.organizationId), eq(clients.email, email)))
      .limit(1);
    if (duplicato) {
      throw new Error("Esiste già un cliente con questo indirizzo email.");
    }

    const [cliente] = await tx
      .insert(clients)
      .values({
        organizationId: attore.organizationId,
        tipo: dati.tipo,
        nome: dati.nome.trim(),
        cognome: dati.cognome?.trim() || null,
        ragioneSociale: dati.ragioneSociale?.trim() || null,
        email,
        telefono: dati.telefono?.trim() || null,
        partitaIva: dati.partitaIva?.trim() || null,
        codiceFiscale: dati.codiceFiscale?.trim() || null,
        pec: dati.pec?.trim().toLowerCase() || null,
        codiceDestinatario: dati.codiceDestinatario?.trim() || null,
        alias: dati.alias?.trim() || null,
        noteCommerciali: dati.noteCommerciali?.trim() || null,
      })
      .returning({ id: clients.id, email: clients.email });

    if (!cliente) throw new Error("Creazione cliente non riuscita.");

    await registra(
      attore,
      {
        azione: "cliente.creato",
        entita: "cliente",
        entitaId: cliente.id,
        metadati: { origine: "onboarding_cliente_esistente" },
      },
      tx,
    );

    return cliente;
  });
}
