import { timingSafeEqual } from "node:crypto";
import { forbidden, unavailable } from "./http";

/** Solo il pianificatore con il segreto condiviso (intestazione Authorization: Bearer). */
export function demandCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !process.env.DATABASE_URL) throw unavailable();
  const expected = Buffer.from(`Bearer ${secret}`), given = Buffer.from(request.headers.get("authorization") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw forbidden();
}
