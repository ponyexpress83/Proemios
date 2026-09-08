/**
 * Contratti.
 *
 * Il principio che regge il modulo: **il testo si congela all'invio**. Un
 * contratto che rimanda a un modello vivo cambia insieme al modello, e fra sei
 * mesi nessuno sa più cosa il cliente avesse davanti quando ha firmato. Perciò
 * `testo` contiene il documento per intero al momento in cui è partito, e da
 * quel momento non si tocca: una modifica è una versione nuova.
 *
 * L'accettazione è a valore legale limitato — è una conferma tracciata, non una
 * firma elettronica qualificata. Il prodotto non pretende il contrario, e il
 * testo dell'interfaccia lo dice.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contracts, orders } from "@/db/schema/commercio";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { registra } from "@/lib/audit";
import { iso, sigilla } from "@/lib/dto/comuni";

export type ContrattoDTO = {
  id: string;
  orderId: string;
  stato: string;
  versione: number;
  testo: string | null;
  inviatoAt: string | null;
  firmatoAt: string | null;
  firmatoDa: string | null;
};

function contrattoDTO(c: typeof contracts.$inferSelect): ContrattoDTO {
  return sigilla({
    id: c.id,
    orderId: c.orderId,
    stato: c.stato,
    versione: c.versione,
    testo: c.testo,
    inviatoAt: iso(c.inviatoAt),
    firmatoAt: iso(c.firmatoAt),
    firmatoDa: c.firmatoDa,
  });
}

/** L'ordine dev'essere raggiungibile da chi chiede il contratto. */
async function ordineAccessibile(attore: Attore, ordineId: string) {
  const db = getDb();
  const [ordine] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, ordineId), eq(orders.organizationId, attore.organizationId)))
    .limit(1);
  if (!ordine) throw new NonTrovato(`ordine ${ordineId} inesistente o di altro tenant`);

  if (attore.ruolo === "client" && ordine.clientId !== attore.clientId) {
    throw new NonTrovato(`ordine ${ordineId} non appartiene al cliente`);
  }
  if (attore.ruolo !== "client" && !haPermesso(attore, "contratto.vedi")) {
    throw new NonTrovato(`ordine ${ordineId} non visibile`);
  }
  return ordine;
}

/**
 * Prepara una bozza di contratto sull'ordine.
 *
 * Una bozza esistente viene sostituita; un contratto già inviato no — quello si
 * supera con una versione nuova, perché il cliente ne ha già una copia.
 */
export async function preparaContratto(
  attore: Attore,
  ordineId: string,
  testo: string,
): Promise<ContrattoDTO> {
  esigiPermesso(attore, "contratto.modifica");
  if (!testo.trim()) throw new Error("Un contratto senza testo non si manda a nessuno.");
  await ordineAccessibile(attore, ordineId);
  const db = getDb();

  const [precedente] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.orderId, ordineId))
    .orderBy(desc(contracts.versione))
    .limit(1);

  if (precedente?.stato === "firmato") {
    throw new Error("Il contratto è già firmato: una modifica richiede un ordine nuovo.");
  }

  if (precedente?.stato === "bozza") {
    const [aggiornato] = await db
      .update(contracts)
      .set({ testo, updatedAt: new Date() })
      .where(eq(contracts.id, precedente.id))
      .returning();
    return contrattoDTO(aggiornato!);
  }

  const [creato] = await db
    .insert(contracts)
    .values({
      orderId: ordineId,
      organizationId: attore.organizationId,
      stato: "bozza",
      versione: (precedente?.versione ?? 0) + 1,
      testo,
    })
    .returning();
  return contrattoDTO(creato!);
}

/**
 * Invia il contratto al cliente.
 *
 * Da questo momento il testo è quello che il cliente ha davanti, e non si
 * modifica più: `preparaContratto` rifiuta di toccarlo e ne crea una versione
 * nuova.
 */
export async function inviaContratto(attore: Attore, contrattoId: string): Promise<ContrattoDTO> {
  esigiPermesso(attore, "contratto.modifica");
  const db = getDb();

  const [contratto] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, contrattoId), eq(contracts.organizationId, attore.organizationId)))
    .limit(1);
  if (!contratto) throw new NonTrovato(`contratto ${contrattoId} inesistente o di altro tenant`);
  if (contratto.stato !== "bozza") {
    throw new Error(`Il contratto è ${contratto.stato}: solo una bozza si invia.`);
  }
  if (!contratto.testo?.trim()) throw new Error("Il contratto non ha testo.");

  const [inviato] = await db
    .update(contracts)
    .set({ stato: "inviato", inviatoAt: new Date(), updatedAt: new Date() })
    .where(eq(contracts.id, contrattoId))
    .returning();

  await registra(attore, {
    azione: "contratto.inviato",
    entita: "contratto",
    entitaId: contrattoId,
    metadati: { ordineId: contratto.orderId, versione: contratto.versione },
  });

  return contrattoDTO(inviato!);
}

/**
 * Il cliente accetta il contratto.
 *
 * Solo il cliente proprietario dell'ordine può farlo: accettare per conto di
 * qualcun altro non è un permesso che esiste. `firmatoDa` conserva il nome
 * dichiarato al momento dell'accettazione, che è ciò che rende la traccia utile
 * a distanza di tempo.
 */
export async function accettaContratto(
  attore: Attore,
  contrattoId: string,
  nomeFirmatario: string,
): Promise<ContrattoDTO> {
  if (attore.ruolo !== "client") {
    throw new Error("Il contratto lo accetta il cliente, non lo staff per suo conto.");
  }
  if (!nomeFirmatario.trim()) throw new Error("Serve il nome di chi accetta.");

  const db = getDb();
  const [riga] = await db
    .select({ contratto: contracts, ordine: orders })
    .from(contracts)
    .innerJoin(orders, eq(orders.id, contracts.orderId))
    .where(eq(contracts.id, contrattoId))
    .limit(1);
  if (!riga) throw new NonTrovato(`contratto ${contrattoId} inesistente`);
  if (
    riga.ordine.organizationId !== attore.organizationId ||
    riga.ordine.clientId !== attore.clientId
  ) {
    throw new NonTrovato(`contratto ${contrattoId} non appartiene al cliente`);
  }
  if (riga.contratto.stato === "firmato") return contrattoDTO(riga.contratto);
  if (riga.contratto.stato !== "inviato") {
    throw new Error("Questo contratto non è stato inviato.");
  }

  const [firmato] = await db
    .update(contracts)
    .set({
      stato: "firmato",
      firmatoAt: new Date(),
      firmatoDa: nomeFirmatario.slice(0, 200),
      updatedAt: new Date(),
    })
    // La condizione sullo stato rende l'accettazione idempotente su un doppio
    // clic: la seconda non trova nulla da aggiornare.
    .where(and(eq(contracts.id, contrattoId), eq(contracts.stato, "inviato")))
    .returning();

  await registra(attore, {
    azione: "contratto.firmato",
    entita: "contratto",
    entitaId: contrattoId,
    metadati: { ordineId: riga.contratto.orderId, versione: riga.contratto.versione },
  });

  return contrattoDTO(firmato ?? riga.contratto);
}

/** Il contratto corrente di un ordine, per chi può vederlo. */
export async function contrattoDiOrdine(
  attore: Attore,
  ordineId: string,
): Promise<ContrattoDTO | null> {
  await ordineAccessibile(attore, ordineId);
  const db = getDb();
  const [contratto] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.orderId, ordineId))
    .orderBy(desc(contracts.versione))
    .limit(1);
  if (!contratto) return null;
  // Una bozza non è ancora niente per il cliente: la vede solo lo staff.
  if (attore.ruolo === "client" && contratto.stato === "bozza") return null;
  return contrattoDTO(contratto);
}
