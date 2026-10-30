import { route } from "@/lib/platform/http";
import { apiV1 } from "@/lib/platform/crm-api";
import { getDb } from "@/db";
import { apiKeys } from "@/db/crm-schema";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** CORS solo per le origini dichiarate sulle chiavi pubbliche di modulo. */
async function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  const keys = await getDb().select({ origins: apiKeys.allowedOrigins }).from(apiKeys).where(and(eq(apiKeys.kind, "form"), isNull(apiKeys.revokedAt)));
  return keys.some((k) => k.origins.includes(origin)) ? origin : null;
}
const handler = route(async (request) => {
  const origin = await allowedOrigin(request.headers.get("origin"));
  if (request.method === "OPTIONS")
    return new Response(null, { status: origin ? 204 : 403, headers: origin ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type, idempotency-key, x-proemios-form-key", "access-control-max-age": "600", vary: "origin" } : {} });
  const response = await apiV1(request);
  if (origin) { response.headers.set("access-control-allow-origin", origin); response.headers.set("vary", "origin"); }
  return response;
});
export const GET = handler, POST = handler, OPTIONS = handler;
