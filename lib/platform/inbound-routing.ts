/**
 * Lead routing for inbound public requests.
 * Assignment is transactional and serialized to keep both sellers balanced.
 * If there are no active, verified sellers, the lead remains in the admin queue.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { leads } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { memberships, leadOwnership } from "@/db/platform-schema";
import { getDb } from "@/db";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function assignInboundLead(tx: Tx, leadId: string): Promise<string | null> {
  await tx.execute(sql`select pg_advisory_xact_lock(617821321)`);
  const candidates = await tx
    .select({ id: memberships.userId })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(and(eq(memberships.role, "seller"), eq(memberships.active, true), eq(user.emailVerified, true)))
    .orderBy(memberships.userId);

  const sellerIds = [...new Set(candidates.map((candidate) => candidate.id))];
  if (!sellerIds.length) return null;

  const assigned = await tx
    .select({ id: leadOwnership.assignedTo, count: sql<number>`count(*)::int` })
    .from(leadOwnership)
    .innerJoin(leads, eq(leads.id, leadOwnership.leadId))
    .where(and(inArray(leadOwnership.assignedTo, sellerIds), sql`${leads.stage} not in ('won', 'lost', 'unreachable')`))
    .groupBy(leadOwnership.assignedTo);
  const workload = new Map(assigned.map((r) => [r.id, Number(r.count)]));
  const seller = sellerIds.reduce((best, id) =>
    (workload.get(id) ?? 0) < (workload.get(best) ?? 0) ? id : best,
  );
  await tx.insert(leadOwnership).values({ leadId, assignedTo: seller });
  return seller;
}
