/**
 * Rotte di Document Studio (/api/platform/studio/...). Il team e il cliente
 * hanno rotte separate: il cliente non vede mai lavorazioni AI, costi, note
 * interne o proposte del team.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { projects } from "@/db/platform-schema";
import { documents } from "@/db/document-schema";
import { audit, projectAccess, type Actor } from "../access";
import { afterResponse, json, notFound, readBody } from "../http";
import { appOrigin } from "../config";
import { approveVersion, createDocument, decideProposals, editDocument, exportDocx, projectDocuments, staffAccess, staffComment, staffDocumentView } from "./service";
import { aiQueue, jobControl, processAiJobs, staffStartJob } from "./ai-engine";
import { clientComment, clientDocuments, clientSuggest, decideCycle, sendToQualityCheck, submitRevisionRequest } from "./revisions";
import { productionDashboard } from "./production";
import { googleConnect, googleStatus, linkGoogle, pullGoogle, pushGoogle, shareWithClient } from "./google";

const uuid = (v: string | undefined): v is string => Boolean(v) && z.string().uuid().safeParse(v).success;

/** Avvia l'elaborazione subito dopo la risposta: sull'endpoint dedicato (durata lunga) se c'è il segreto, altrimenti un passo breve qui. */
export function kickAiProcessing() {
  afterResponse(async () => {
    if (process.env.CRON_SECRET && process.env.VERCEL) {
      await fetch(`${appOrigin()}/api/jobs/ai`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(3000) }).catch(() => {});
    } else await processAiJobs({ deadlineMs: 20_000 }).catch(() => {});
  });
}

export async function studioRoute(request: Request, actor: Actor, parts: string[]): Promise<Response> {
  const [resource, id, action] = parts;
  const method = request.method;
  switch (resource) {
    case "production":
      if (!id && method === "GET") return json(await productionDashboard(actor));
      break;
    case "queue":
      if (!id && method === "GET") return json({ jobs: await aiQueue(actor) });
      break;
    case "projects":
      if (!uuid(id)) break;
      if (!action && method === "GET") return json(await projectDocuments(actor, id));
      if (!action && method === "POST") {
        const body = await readBody(request, z.object({ fileId: z.string().uuid() }).strict());
        const result = await createDocument(actor, id, body.fileId);
        return json({ document: result.document }, result.created ? 201 : 200);
      }
      if (action === "rounds" && method === "PUT") {
        await projectAccess(actor, id, "project.assign");
        const body = await readBody(request, z.object({ rounds: z.number().int().min(0).max(10), reason: z.string().trim().min(3).max(300) }).strict());
        await getDb().update(projects).set({ revisionRounds: body.rounds, revisionRoundsSetBy: actor.id, updatedAt: new Date() }).where(eq(projects.id, id));
        await audit(actor, "project.revision_rounds_set", "project", id, body);
        return json({ ok: true });
      }
      break;
    case "documents": {
      if (!uuid(id)) break;
      if (!action && method === "GET") return json(await staffDocumentView(actor, id));
      if (!action && method === "PATCH") {
        await staffAccess(actor, id, "project.assign");
        const body = await readBody(request, z.object({ clientAccess: z.enum(["read", "comment", "suggest", "edit"]) }).strict());
        await getDb().update(documents).set({ clientAccess: body.clientAccess, updatedAt: new Date() }).where(eq(documents.id, id));
        await audit(actor, "document.client_access", "document", id, body);
        return json({ ok: true });
      }
      if (method === "POST" && action === "decide") return json(await decideProposals(actor, id, request));
      if (method === "POST" && action === "edit") return json(await editDocument(actor, id, request));
      if (method === "POST" && action === "comments") return json({ comment: await staffComment(actor, id, request) }, 201);
      if (method === "POST" && action === "ai") { const job = await staffStartJob(actor, id, request); kickAiProcessing(); return json({ job: { id: job.id, status: job.status, chunksTotal: job.chunksTotal } }, 201); }
      if (method === "POST" && action === "versions") return json({ version: await approveVersion(actor, id, request) }, 201);
      if (method === "POST" && action === "qa") return sendToQualityCheck(actor, id);
      if (method === "GET" && action === "export") {
        const { doc } = await staffAccess(actor, id);
        const mode = new URL(request.url).searchParams.get("mode") === "clean" ? "clean" : "tracked";
        const bytes = await exportDocx(doc, mode, actor.name);
        await audit(actor, "document.exported", "document", id, { mode });
        return new Response(new Uint8Array(bytes), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename="${encodeURIComponent(doc.title)}${mode === "tracked" ? " - revisioni" : ""}.docx"`, "cache-control": "no-store" } });
      }
      if (method === "POST" && action === "google-link") return json(await linkGoogle(actor, id));
      if (method === "POST" && action === "google-pull") { const body = await readBody(request, z.object({ expectedRevision: z.number().int().min(1) }).strict()); return json(await pullGoogle(actor, id, body.expectedRevision)); }
      if (method === "POST" && action === "google-push") return json(await pushGoogle(actor, id));
      if (method === "POST" && action === "google-share") return shareWithClient(actor, id, request);
      break;
    }
    case "jobs":
      if (uuid(id) && action && method === "POST") { const res = await jobControl(actor, id, action, request); if (action === "resume" || action === "retry") kickAiProcessing(); return res; }
      break;
    case "cycles":
      if (uuid(id) && action === "decide" && method === "POST") { const res = await decideCycle(actor, id, request); kickAiProcessing(); return res; }
      break;
    case "google":
      if (!id && method === "GET") { if (!actor.staff) throw notFound(); return json(await googleStatus()); }
      if (id === "connect" && method === "POST") return json(await googleConnect(actor));
      break;
    // Area del cliente
    case "client":
      if (uuid(id) && !action && method === "GET") return json(await clientDocuments(actor, id));
      break;
    case "client-docs":
      if (!uuid(id) || method !== "POST") break;
      if (action === "comments") return clientComment(actor, id, request);
      if (action === "suggestions") return clientSuggest(actor, id, request);
      if (action === "revision-request") { const res = await submitRevisionRequest(actor, id, request); kickAiProcessing(); return res; }
      break;
  }
  throw notFound();
}
