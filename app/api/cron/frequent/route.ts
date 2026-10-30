import { route, json } from "@/lib/platform/http";
import { demandCronSecret } from "@/lib/platform/cron-auth";
import { runJob, frequentWork } from "@/lib/platform/automation";
export const runtime = "nodejs";
export const maxDuration = 60;
/** Manutenzione frequente (ogni 10–15 minuti): scadenze, code, prenotazioni, webhook e posta in coda. Idempotente. */
export const GET = route(async (request) => {
  demandCronSecret(request);
  return json(await runJob("frequent", "cron", frequentWork));
});
