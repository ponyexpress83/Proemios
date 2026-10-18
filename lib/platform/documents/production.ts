/**
 * Cruscotto di produzione: ordini, assegnazioni, materiali, lavorazioni AI,
 * revisioni da controllare, richieste dei clienti, qualità, consegne, ritardi,
 * carico e problemi. Ogni riga porta al progetto o al documento. Chi ha solo
 * progetti assegnati vede solo quelli.
 */
import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/auth-schema";
import { projects, tasks } from "@/db/platform-schema";
import { crmHandoffs } from "@/db/crm-schema";
import { aiJobs, docSuggestions, documents, revisionCycles } from "@/db/document-schema";
import { projectPredicate, type Actor } from "../access";
import { can } from "../permissions";
import { notFound } from "../http";

export async function productionDashboard(actor: Actor, now = new Date()) {
  if (!actor.staff || !can(actor.grants, "project.read", { assigned: true })) throw notFound();
  const db = getDb();
  const visible = await db.select().from(projects).where(await projectPredicate(actor, "project.read")).orderBy(desc(projects.updatedAt)).limit(300);
  const ids = visible.map((p) => p.id);
  if (!ids.length) return { projects: [], sections: {}, load: [], problems: [] };
  const docs = await db.select({ id: documents.id, projectId: documents.projectId, title: documents.title }).from(documents).where(inArray(documents.projectId, ids));
  const docIds = docs.map((d) => d.id);
  const pending = docIds.length ? await db.select({ documentId: docSuggestions.documentId, n: sql<number>`count(*)::int` }).from(docSuggestions).where(and(inArray(docSuggestions.documentId, docIds), eq(docSuggestions.status, "pending"))).groupBy(docSuggestions.documentId) : [];
  const jobs = await db.select({ id: aiJobs.id, projectId: aiJobs.projectId, documentId: aiJobs.documentId, status: aiJobs.status, service: aiJobs.service, statusReason: aiJobs.statusReason, chunksDone: aiJobs.chunksDone, chunksTotal: aiJobs.chunksTotal }).from(aiJobs).where(and(inArray(aiJobs.projectId, ids), inArray(aiJobs.status, ["queued", "running", "paused", "failed", "blocked", "needs_review"])));
  const cycles = await db.select().from(revisionCycles).where(and(inArray(revisionCycles.projectId, ids), sql`${revisionCycles.status} not in ('delivered','rejected','collecting')`));
  const handoffs = await db.select({ projectId: crmHandoffs.projectId, status: crmHandoffs.status }).from(crmHandoffs).where(inArray(crmHandoffs.projectId, ids));
  const openTasks = await db.select({ projectId: tasks.projectId, assignedTo: tasks.assignedTo, name: user.name }).from(tasks).leftJoin(user, eq(user.id, tasks.assignedTo)).where(and(inArray(tasks.projectId, ids), ne(tasks.status, "done"), isNotNull(tasks.phase)));
  const docOf = (projectId: string) => docs.filter((d) => d.projectId === projectId);
  const row = (p: typeof visible[number]) => {
    const pDocs = docOf(p.id);
    const late = Boolean(p.contractualDueAt && p.contractualDueAt < now && p.opsStatus !== "concluded");
    return {
      id: p.id, title: p.title, opsStatus: p.opsStatus, stage: p.stage, contractualDueAt: p.contractualDueAt, late,
      documents: pDocs.map((d) => ({ id: d.id, title: d.title, pending: pending.find((x) => x.documentId === d.id)?.n ?? 0, job: jobs.find((j) => j.documentId === d.id) ?? null })),
      cycles: cycles.filter((c) => c.projectId === p.id).map((c) => ({ id: c.id, documentId: c.documentId, number: c.number, status: c.status, kind: c.kind })),
      operators: [...new Set(openTasks.filter((t) => t.projectId === p.id && t.name).map((t) => t.name!))],
      handoff: handoffs.find((h) => h.projectId === p.id)?.status ?? null,
    };
  };
  const rows = visible.map(row);
  const soon = new Date(now.getTime() + 14 * 86400_000);
  const sections = {
    newOrders: rows.filter((r) => r.opsStatus === "waiting_materials" || r.opsStatus === "ready_for_assignment").map((r) => r.id),
    toAssign: rows.filter((r) => r.opsStatus === "ready_for_assignment").map((r) => r.id),
    missingMaterials: rows.filter((r) => r.opsStatus === "waiting_materials").map((r) => r.id),
    aiRunning: rows.filter((r) => r.documents.some((d) => d.job && ["queued", "running"].includes(d.job.status))).map((r) => r.id),
    aiDone: rows.filter((r) => r.documents.some((d) => d.job?.status === "needs_review")).map((r) => r.id),
    toReview: rows.filter((r) => r.documents.some((d) => d.pending > 0)).map((r) => r.id),
    clientRevisions: rows.filter((r) => r.cycles.length).map((r) => r.id),
    qualityCheck: rows.filter((r) => r.opsStatus === "quality_check").map((r) => r.id),
    dueSoon: rows.filter((r) => r.contractualDueAt && r.contractualDueAt <= soon && r.opsStatus !== "concluded" && !r.late).map((r) => r.id),
    late: rows.filter((r) => r.late).map((r) => r.id),
  };
  const loadMap = new Map<string, number>();
  for (const t of openTasks) if (t.name) loadMap.set(t.name, (loadMap.get(t.name) ?? 0) + 1);
  const problems = [
    ...jobs.filter((j) => ["failed", "paused", "blocked"].includes(j.status)).map((j) => ({ kind: "ai_job", projectId: j.projectId, documentId: j.documentId, detail: `${j.service}: ${j.status}${j.statusReason ? ` — ${j.statusReason}` : ""}` })),
    ...cycles.filter((c) => ["needs_decision", "needs_quote"].includes(c.status)).map((c) => ({ kind: "revision", projectId: c.projectId, documentId: c.documentId, detail: c.status === "needs_quote" ? `Revisione n. ${c.number} fuori contratto: serve un preventivo` : `Revisione n. ${c.number} da valutare: cicli inclusi non indicati` })),
    ...handoffs.filter((h) => h.status === "blocked").map((h) => ({ kind: "handoff", projectId: h.projectId, documentId: null, detail: "Passaggio alla produzione bloccato" })),
  ];
  return { projects: rows, sections, load: [...loadMap].map(([name, open]) => ({ name, open })).sort((a, b) => b.open - a.open), problems, canAssign: can(actor.grants, "project.assign") };
}
