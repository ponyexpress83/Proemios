import { route, json } from "@/lib/platform/http";
import { demandCronSecret } from "@/lib/platform/cron-auth";
import { processAiJobs } from "@/lib/platform/documents/ai-engine";

export const runtime = "nodejs";
// Le lavorazioni AI girano qui, con una durata lunga: il lavoro frequente fa solo passi brevi.
export const maxDuration = 300;

export const POST = route(async (request) => {
  demandCronSecret(request);
  return json(await processAiJobs({ deadlineMs: 240_000 }));
});
export const GET = POST;
