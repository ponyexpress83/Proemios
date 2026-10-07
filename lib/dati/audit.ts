import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents } from "@/db/schema/sistema";
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";

export type EventoAuditDTO = {
  id: string;
  azione: string;
  entita: string | null;
  entitaId: string | null;
  attoreRuolo: string | null;
  esito: string;
  createdAt: string;
};

export async function elencaAudit(
  attore: Attore,
  limite = 100,
): Promise<EventoAuditDTO[]> {
  esigiPermesso(attore, "audit.vedi");
  const righe = await getDb()
    .select({
      id: auditEvents.id,
      azione: auditEvents.azione,
      entita: auditEvents.entita,
      entitaId: auditEvents.entitaId,
      attoreRuolo: auditEvents.attoreRuolo,
      esito: auditEvents.esito,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, attore.organizationId),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(Math.min(250, Math.max(1, limite)));

  return righe.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
