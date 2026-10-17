/**
 * Instradamento delle richieste pubbliche. La logica (regole versionate,
 * competenze, lingue, orari, assenze, capacità, carico, coda monitorata) vive
 * in crm-routing.ts; questo modulo resta come punto d'ingresso compatibile.
 */
import { routeLead } from "./crm-routing";
import type { Tx } from "./crm-relations";

export async function assignInboundLead(tx: Tx, leadId: string): Promise<string | null> {
  return (await routeLead(tx, leadId, { notifyAssignee: false })).assignee;
}
