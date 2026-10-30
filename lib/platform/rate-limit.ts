import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { requestLimits } from "@/db/platform-schema";
import { PlatformError } from "./http";

export async function limitRequest(
  namespace: string,
  identity: string,
  maximum: number,
  seconds: number,
) {
  const windowStart = Math.floor(Date.now() / (seconds * 1000)) * seconds * 1000;
  const key = createHash("sha256").update(`${namespace}:${identity}:${windowStart}`).digest("hex");
  const [row] = await getDb()
    .insert(requestLimits)
    .values({ key, count: 1, windowStart })
    .onConflictDoUpdate({
      target: requestLimits.key,
      set: { count: sql`${requestLimits.count} + 1` },
    })
    .returning({ count: requestLimits.count });
  if (!row || row.count > maximum)
    throw new PlatformError(429, "RATE_LIMITED", "Troppe richieste. Attendi e riprova.");
}
export function requestIdentity(request: Request): string {
  // Vercel overwrites this header at its trusted edge; elsewhere do not trust arbitrary forwarding headers.
  return process.env.VERCEL
    ? (request.headers.get("x-vercel-forwarded-for") ?? "unknown")
    : "local";
}
