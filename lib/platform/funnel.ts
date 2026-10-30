import { and, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { funnelEvents } from "@/db/platform-schema";
import { checkMutationOrigin, json, readBody } from "./http";
import { limitRequest, requestIdentity } from "./rate-limit";

/**
 * Eventi del percorso di acquisto. Quelli "ui" li manda il browser e valgono
 * come segnale d'interfaccia; quelli "economic" li scrive il server quando il
 * fatto è verificato. Nessun cookie, nessun IP, nessun dato personale.
 */
export const UI_EVENTS = ["quote_started", "estimate_viewed", "package_chosen", "proposal_viewed", "checkout_opened"] as const;
export const ECONOMIC_EVENTS = ["quote_saved", "email_verified", "review_requested", "offer_made", "quote_accepted", "checkout_started", "payment_confirmed"] as const;
type Db = Pick<ReturnType<typeof getDb>, "insert">;
export async function recordFunnel(
  db: Db,
  name: (typeof ECONOMIC_EVENTS)[number],
  quoteId?: string | null,
  meta?: Record<string, unknown>,
) {
  await db.insert(funnelEvents).values({ name, kind: "economic", quoteId: quoteId ?? null, meta: meta ?? null });
}
/** POST /api/eventi: un evento d'interfaccia, anonimo, limitato per origine. */
export async function publicFunnelEvent(request: Request) {
  checkMutationOrigin(request);
  if (!process.env.DATABASE_URL) return json({ ok: true, stored: false });
  await limitRequest("funnel", requestIdentity(request), 120, 3600);
  const body = await readBody(
    request,
    z
      .object({
        name: z.enum(UI_EVENTS),
        quoteId: z.string().uuid().optional(),
        visitor: z.string().regex(/^[a-z0-9-]{8,64}$/).optional(),
        meta: z.record(z.union([z.string().max(60), z.number(), z.boolean()])).optional(),
      })
      .strict(),
  );
  await getDb().insert(funnelEvents).values({ name: body.name, kind: "ui", quoteId: body.quoteId ?? null, visitorKey: body.visitor ?? null, meta: body.meta ?? null });
  return json({ ok: true, stored: true });
}
/** Conteggi degli ultimi N giorni, per la dashboard del proprietario. */
export async function funnelSummary(days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await getDb()
    .select({ name: funnelEvents.name, kind: funnelEvents.kind, count: sql<number>`count(*)::integer`, quotes: sql<number>`count(distinct ${funnelEvents.quoteId})::integer` })
    .from(funnelEvents)
    .where(and(gte(funnelEvents.createdAt, since)))
    .groupBy(funnelEvents.name, funnelEvents.kind);
  return { days, events: rows };
}
