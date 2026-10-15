import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { leadOwnership } from "@/db/platform-schema";

/**
 * Collega all'autore le richieste pubbliche fatte con la stessa email prima
 * di avere un account. Si usa solo dopo che l'indirizzo è stato verificato:
 * un'email non verificata non dà accesso a preventivi altrui. Le richieste già
 * collegate a un altro account (per esempio con il token di collegamento)
 * non vengono toccate.
 */
export async function linkLeadsToAuthor(userId: string, email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;
  const rows = await getDb()
    .select({ id: leads.id, authorId: leadOwnership.authorId })
    .from(leads)
    .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
    .where(and(eq(sql`lower(${leads.email})`, normalized), isNull(leadOwnership.authorId)));
  let linked = 0;
  for (const row of rows) {
    await getDb()
      .insert(leadOwnership)
      .values({ leadId: row.id, authorId: userId })
      .onConflictDoUpdate({
        target: leadOwnership.leadId,
        set: { authorId: userId, updatedAt: new Date() },
        where: isNull(leadOwnership.authorId),
      });
    linked++;
  }
  return linked;
}
