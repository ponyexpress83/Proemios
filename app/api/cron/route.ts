import { route, json } from "@/lib/platform/http";
import { demandCronSecret } from "@/lib/platform/cron-auth";
import { runJob, dailyWork } from "@/lib/platform/automation";
export const runtime = "nodejs";
// Scansioni e un job di analisi possono superare il limite predefinito.
export const maxDuration = 300;
/** Attività giornaliere: una sola esecuzione riuscita al giorno, le chiamate successive vengono registrate come saltate. */
export const GET = route(async (request) => {
  demandCronSecret(request);
  return json(await runJob("daily", "cron", () => dailyWork("cron")));
});
