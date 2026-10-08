import { after } from "next/server";
import { route, json, checkMutationOrigin } from "@/lib/platform/http";
import { submitAnalysis, analysisStatus, runAnalysisJob } from "@/lib/platform/analysis";
import { demoAttiva, reportDemo, registraAnalisi } from "@/lib/demo";
import { gateAnalisiSchema, primoErrore } from "@/lib/validation";
import { estraiTesto, estensioneDi, MAX_BYTES } from "@/lib/extract";
import { calcolaMetriche } from "@/lib/metrics";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const GET = route(analysisStatus);
export const POST = route(async request => {
  if (!demoAttiva()) {
    checkMutationOrigin(request);
    const response = await submitAnalysis(request);
    const data = await response.clone().json();
    if (data.jobId && data.status === "queued") after(async () => { await runAnalysisJob(data.jobId); });
    return response;
  }
  // Explicit test/staging path only. Never enabled by missing providers.
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ errore: "Richiesta non leggibile." }, 400); }
  const gate = gateAnalisiSchema.safeParse({ nome: form.get("nome"), email: form.get("email"), consensoPrivacy: form.get("consensoPrivacy") === "true", consensoMarketing: form.get("consensoMarketing") === "true" });
  if (!gate.success) return json({ errore: primoErrore(gate.error) }, 422);
  const uploaded = form.get("file");
  if (!(uploaded instanceof File) || !uploaded.size) return json({ errore: "Scegli un file." }, 422);
  if (uploaded.size > MAX_BYTES) return json({ errore: "Il file supera 4 MB." }, 413);
  const extension = estensioneDi(uploaded.name);
  if (!extension) return json({ errore: "Formato non gestito." }, 415);
  let text: string;
  try { text = await estraiTesto(Buffer.from(await uploaded.arrayBuffer()), extension); }
  catch { return json({ errore: "Documento non leggibile." }, 422); }
  const metrics = calcolaMetriche(text);
  if (metrics.parole < 100) return json({ errore: "Occorrono almeno 100 parole." }, 422);
  const report = reportDemo(metrics);
  registraAnalisi({ filename: uploaded.name, wordCount: metrics.parole, report });
  return json({ report, demo: true });
});
