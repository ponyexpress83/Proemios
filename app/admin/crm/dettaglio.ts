"use server";

import { esigiStaff } from "@/lib/auth/sessione";
import {
  cronologiaLead,
  leggiAttribuzione,
  leggiLead,
  statiRaggiungibili,
  type EventoLeadDTO,
  type StatoLead,
} from "@/lib/dati/lead";
import { haPermesso } from "@/lib/auth/attore";
import type { AttribuzioneLead } from "@/lib/dto/lead";

export type DettaglioLead = {
  cronologia: EventoLeadDTO[];
  attribuzione: AttribuzioneLead | null;
  statiRaggiungibili: StatoLead[];
};

/**
 * Dettaglio caricato all'apertura della scheda. Cronologia e attribuzione non
 * stanno nella lista perché costerebbero una query per ogni riga mostrata,
 * comprese quelle che nessuno aprirà.
 *
 * L'attribuzione è omessa — non troncata — se l'attore non ha il permesso: il
 * campo non esiste proprio nella risposta.
 */
export async function caricaDettaglioLead(leadId: string): Promise<DettaglioLead> {
  const attore = await esigiStaff("crm.vedi_lead");
  const lead = await leggiLead(attore, leadId);

  const attribuzione = haPermesso(attore, "crm.vedi_attribuzione")
    ? await leggiAttribuzione(attore, leadId)
    : null;

  return {
    cronologia: await cronologiaLead(attore, leadId),
    attribuzione,
    statiRaggiungibili: [...statiRaggiungibili(lead.stato as StatoLead)],
  };
}
