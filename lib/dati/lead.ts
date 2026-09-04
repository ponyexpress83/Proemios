/**
 * CRM — accesso ai lead.
 *
 * La pipeline è: nuovo → qualificato → call → proposta → cliente → produzione
 * → post_pubblicazione, con `perso` come uscita da qualunque punto.
 */
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leadEvents, leads, type Lead } from "@/db/schema/crm";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { attribuzioneDTO, leadDTO, type AttribuzioneLead, type LeadPerStaff } from "@/lib/dto/lead";
import { registra } from "@/lib/audit";
import {
  STATI_LEAD,
  statiRaggiungibili,
  transizioneAmmessa,
  type StatoLead,
} from "@/lib/crm/pipeline";

// La pipeline è pura e vive in lib/crm/pipeline.ts, così i componenti client
// possono importarla senza trascinare Drizzle e il driver Postgres nel bundle.
export { STATI_LEAD, statiRaggiungibili, transizioneAmmessa };
export type { StatoLead };

export type FiltriLead = {
  stato?: StatoLead[];
  ownerId?: string | null;
  fonte?: string[];
  punteggioMinimo?: number;
  cerca?: string;
  daAt?: Date;
  aAt?: Date;
  ordina?: "recenti" | "punteggio" | "valore" | "prossima_attivita";
  pagina?: number;
  perPagina?: number;
};

export type PaginaLead = {
  voci: LeadPerStaff[];
  totale: number;
  pagina: number;
  perPagina: number;
};

/**
 * Il filtro di tenant vive nella WHERE, non in un `.filter()` a valle: con un
 * LIMIT applicato prima del filtro, la prima pagina conterrebbe righe di un
 * altro tenant.
 *
 * I lead senza organizzazione (creati dal sito pubblico prima di essere
 * assegnati) appartengono allo studio: sono visibili solo a chi opera nello
 * studio, mai a un'agenzia.
 */
function filtroTenant(attore: Attore, isStudio: boolean) {
  return isStudio
    ? or(eq(leads.organizationId, attore.organizationId), isNull(leads.organizationId))
    : eq(leads.organizationId, attore.organizationId);
}

export async function elencaLead(
  attore: Attore,
  filtri: FiltriLead = {},
  opzioni: { organizzazioneStudio: boolean } = { organizzazioneStudio: true },
): Promise<PaginaLead> {
  esigiPermesso(attore, "crm.vedi_lead");
  const db = getDb();

  const pagina = Math.max(1, filtri.pagina ?? 1);
  const perPagina = Math.min(100, Math.max(1, filtri.perPagina ?? 25));

  const condizioni = [filtroTenant(attore, opzioni.organizzazioneStudio)];
  if (filtri.stato?.length) condizioni.push(inArray(leads.stato, filtri.stato));
  if (filtri.ownerId === null) condizioni.push(isNull(leads.ownerId));
  else if (filtri.ownerId) condizioni.push(eq(leads.ownerId, filtri.ownerId));
  if (filtri.fonte?.length) {
    condizioni.push(inArray(leads.fonte, filtri.fonte as Lead["fonte"][]));
  }
  if (typeof filtri.punteggioMinimo === "number") {
    condizioni.push(gte(leads.leadScore, filtri.punteggioMinimo));
  }
  if (filtri.daAt) condizioni.push(gte(leads.createdAt, filtri.daAt));
  if (filtri.aAt) condizioni.push(lte(leads.createdAt, filtri.aAt));
  if (filtri.cerca?.trim()) {
    const termine = `%${filtri.cerca.trim()}%`;
    condizioni.push(or(ilike(leads.nome, termine), ilike(leads.email, termine))!);
  }

  const dove = and(...condizioni);

  const ordinamento = {
    recenti: desc(leads.createdAt),
    punteggio: desc(leads.leadScore),
    valore: desc(leads.valoreStimato),
    prossima_attivita: asc(leads.prossimaAttivitaAt),
  }[filtri.ordina ?? "recenti"];

  const [righe, [conteggio]] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(dove)
      .orderBy(ordinamento, desc(leads.createdAt))
      .limit(perPagina)
      .offset((pagina - 1) * perPagina),
    db.select({ n: count() }).from(leads).where(dove),
  ]);

  return {
    voci: righe.map((r) => leadDTO(attore, r)),
    totale: Number(conteggio?.n ?? 0),
    pagina,
    perPagina,
  };
}

export async function leggiLead(
  attore: Attore,
  id: string,
  opzioni: { organizzazioneStudio: boolean } = { organizzazioneStudio: true },
): Promise<LeadPerStaff> {
  esigiPermesso(attore, "crm.vedi_lead");
  const db = getDb();
  const [riga] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), filtroTenant(attore, opzioni.organizzazioneStudio)))
    .limit(1);
  if (!riga) throw new NonTrovato(`lead ${id} inesistente o di altro tenant`);
  return leadDTO(attore, riga);
}

/** L'attribuzione ha un permesso proprio: al redattore non arriva mai. */
export async function leggiAttribuzione(
  attore: Attore,
  id: string,
  opzioni: { organizzazioneStudio: boolean } = { organizzazioneStudio: true },
): Promise<AttribuzioneLead> {
  esigiPermesso(attore, "crm.vedi_attribuzione");
  const db = getDb();
  const [riga] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), filtroTenant(attore, opzioni.organizzazioneStudio)))
    .limit(1);
  if (!riga) throw new NonTrovato(`lead ${id} inesistente o di altro tenant`);
  return attribuzioneDTO(attore, riga);
}

export type EventoLeadDTO = {
  id: string;
  tipo: string;
  descrizione: string | null;
  attoreId: string | null;
  createdAt: string;
};

export async function cronologiaLead(
  attore: Attore,
  leadId: string,
  opzioni: { organizzazioneStudio: boolean } = { organizzazioneStudio: true },
): Promise<EventoLeadDTO[]> {
  // Rileggere il lead prima serve a verificare il tenant: senza, chiunque abbia
  // il permesso potrebbe leggere la cronologia di un lead altrui conoscendone l'id.
  await leggiLead(attore, leadId, opzioni);
  const db = getDb();
  const righe = await db
    .select()
    .from(leadEvents)
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(desc(leadEvents.createdAt))
    .limit(200);
  return righe.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    descrizione: e.descrizione,
    attoreId: e.attoreId,
    createdAt: e.createdAt.toISOString(),
  }));
}

/** Cambia stato al lead, verificando che la transizione sia ammessa. */
export async function cambiaStatoLead(
  attore: Attore,
  leadId: string,
  nuovoStato: StatoLead,
  motivo?: string,
): Promise<LeadPerStaff> {
  esigiPermesso(attore, "crm.modifica_lead");
  const db = getDb();

  return db.transaction(async (tx) => {
    const [riga] = await tx
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), filtroTenant(attore, true)))
      .limit(1);
    if (!riga) throw new NonTrovato(`lead ${leadId} inesistente o di altro tenant`);

    const precedente = riga.stato as StatoLead;
    if (precedente === nuovoStato) return leadDTO(attore, riga);
    if (!transizioneAmmessa(precedente, nuovoStato)) {
      throw new Error(`Transizione non ammessa: ${precedente} → ${nuovoStato}.`);
    }

    const adesso = new Date();
    const [aggiornato] = await tx
      .update(leads)
      .set({
        stato: nuovoStato,
        persoMotivo: nuovoStato === "perso" ? (motivo ?? null) : null,
        ultimaAttivitaAt: adesso,
        updatedAt: adesso,
      })
      .where(eq(leads.id, leadId))
      .returning();

    await tx.insert(leadEvents).values({
      leadId,
      tipo: "stato_cambiato",
      attoreId: attore.userId,
      descrizione: `${precedente} → ${nuovoStato}`,
      dettagli: motivo ? { motivo } : null,
    });

    await registra(
      attore,
      {
        azione: "lead.stato_cambiato",
        entita: "lead",
        entitaId: leadId,
        metadati: { da: precedente, a: nuovoStato },
      },
      tx,
    );

    return leadDTO(attore, aggiornato!);
  });
}

export async function assegnaLead(
  attore: Attore,
  leadId: string,
  ownerId: string | null,
): Promise<LeadPerStaff> {
  esigiPermesso(attore, "crm.assegna_lead");
  const db = getDb();

  return db.transaction(async (tx) => {
    const [riga] = await tx
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), filtroTenant(attore, true)))
      .limit(1);
    if (!riga) throw new NonTrovato(`lead ${leadId} inesistente o di altro tenant`);

    const adesso = new Date();
    const [aggiornato] = await tx
      .update(leads)
      .set({ ownerId, ultimaAttivitaAt: adesso, updatedAt: adesso })
      .where(eq(leads.id, leadId))
      .returning();

    await tx.insert(leadEvents).values({
      leadId,
      tipo: ownerId ? "assegnato" : "disassegnato",
      attoreId: attore.userId,
      descrizione: ownerId ? `Assegnato a ${ownerId}` : "Assegnazione rimossa",
    });

    await registra(
      attore,
      { azione: "lead.assegnato", entita: "lead", entitaId: leadId, metadati: { ownerId } },
      tx,
    );

    return leadDTO(attore, aggiornato!);
  });
}

export async function aggiungiNotaLead(
  attore: Attore,
  leadId: string,
  nota: string,
): Promise<void> {
  esigiPermesso(attore, "crm.modifica_lead");
  const testo = nota.trim();
  if (!testo) throw new Error("La nota è vuota.");

  const db = getDb();
  await db.transaction(async (tx) => {
    const [riga] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), filtroTenant(attore, true)))
      .limit(1);
    if (!riga) throw new NonTrovato(`lead ${leadId} inesistente o di altro tenant`);

    const adesso = new Date();
    await tx.insert(leadEvents).values({
      leadId,
      tipo: "nota",
      attoreId: attore.userId,
      descrizione: testo.slice(0, 500),
    });
    await tx
      .update(leads)
      .set({ ultimaAttivitaAt: adesso, updatedAt: adesso })
      .where(eq(leads.id, leadId));
  });
}

export async function pianificaAttivita(
  attore: Attore,
  leadId: string,
  quando: Date,
  cosa: string,
): Promise<void> {
  esigiPermesso(attore, "crm.modifica_lead");
  const db = getDb();
  const [riga] = await db
    .update(leads)
    .set({
      prossimaAttivitaAt: quando,
      prossimaAttivita: cosa.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), filtroTenant(attore, true)))
    .returning({ id: leads.id });
  if (!riga) throw new NonTrovato(`lead ${leadId} inesistente o di altro tenant`);
}

export type FunnelCrm = {
  stato: StatoLead;
  conteggio: number;
  valore: number;
}[];

/** Conteggi e valore per stato: la base della dashboard del funnel. */
export async function funnel(
  attore: Attore,
  intervallo?: { da: Date; a: Date },
): Promise<FunnelCrm> {
  esigiPermesso(attore, "crm.vedi_lead");
  const db = getDb();

  const condizioni = [filtroTenant(attore, true)];
  if (intervallo) {
    condizioni.push(gte(leads.createdAt, intervallo.da), lte(leads.createdAt, intervallo.a));
  }

  const righe = await db
    .select({
      stato: leads.stato,
      conteggio: count(),
      valore: sql<number>`coalesce(sum(${leads.valoreStimato}), 0)::int`,
    })
    .from(leads)
    .where(and(...condizioni))
    .groupBy(leads.stato);

  const perStato = new Map(righe.map((r) => [r.stato as StatoLead, r]));
  return STATI_LEAD.map((stato) => ({
    stato,
    conteggio: Number(perStato.get(stato)?.conteggio ?? 0),
    valore: Number(perStato.get(stato)?.valore ?? 0),
  }));
}
