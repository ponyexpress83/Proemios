import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
import { quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import {
  projects,
  projectMembers,
  projectFiles,
  approvals,
  messages,
  tasks,
  notifications,
  leadOwnership,
  messageReads,
} from "@/db/platform-schema";
import {
  projectAccess,
  projectPredicate,
  leadAccess,
  leadPredicate,
  demand,
  demandAvailable,
  audit,
  type Actor,
} from "./access";
import { can } from "./permissions";
import { readBody, json, notFound, forbidden, PlatformError } from "./http";
import { limitRequest } from "./rate-limit";
import { storePrivate, readPrivate, deletePrivate, inspectUpload, scanUpload, DIRECT_UPLOAD_MAX_BYTES } from "./storage";
import { enqueueMail } from "./mail";
import { appOrigin } from "./config";
import { impaginaEmail, esc } from "@/lib/email";

const projectBody = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().max(5000).optional(),
    type: z
      .enum(["romanzo", "saggio", "memoir", "libro-professionale", "solo-grafica"])
      .default("romanzo"),
    authorId: z.string().max(100).optional(),
  })
  .strict();
const projectEdit = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    description: z.string().max(5000).optional(),
    stage: z
      .enum(["brief", "estimate", "materials", "intake", "editing", "review", "approved", "delivered"])
      .optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .strict();
const steps: Record<string, string[]> = {
  brief: ["estimate", "materials"],
  estimate: ["materials"],
  // Verifica iniziale dei materiali (facoltativa): il team controlla ciò che è
  // arrivato prima di avviare la lavorazione; si può saltare.
  materials: ["intake", "editing"],
  intake: ["editing", "materials"],
  editing: ["review"],
  review: ["editing"],
  approved: ["delivered", "review"],
  delivered: [],
};
async function notifyProject(
  project: typeof projects.$inferSelect,
  actor: Actor,
  title: string,
  body: string,
) {
  const members = await getDb()
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, project.id));
  const recipients = [...new Set([project.authorId, ...members.map((m) => m.userId)])].filter(
    (id) => id !== actor.id,
  );
  // L'autore apre il progetto nella sua area; il team nel proprio spazio di lavoro.
  const hrefFor = (userId: string) =>
    userId === project.authorId ? `/area-autore?progetto=${project.id}` : `/spazio?progetto=${project.id}`;
  if (recipients.length)
    await getDb()
      .insert(notifications)
      .values(
        recipients.map((userId) => ({
          userId,
          title,
          body,
          href: hrefFor(userId),
        })),
      );
  for (const userId of recipients) {
    const [person] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (person) await enqueueMail(`notification:${project.id}:${userId}:${Date.now()}`, {
      to: person.email, subject: `${title} · Proemios`,
      html: impaginaEmail(esc(title), `<p>${esc(body)}</p><p><a href="${appOrigin()}${hrefFor(userId)}">Apri il progetto</a></p>`),
    });
  }
}
export async function projectCollection(request: Request, actor: Actor) {
  if (request.method === "GET") {
    demandAvailable(actor, "project.read");
    const rows = await getDb()
      .select()
      .from(projects)
      .where(await projectPredicate(actor))
      .orderBy(desc(projects.updatedAt))
      .limit(100);
    // Per ogni progetto: chi lo segue, cosa aspetta l'autore e cosa aspetta il team.
    const ids = rows.map((p) => p.id);
    const referentIds = [...new Set(rows.map((p) => p.referentId).filter((v): v is string => Boolean(v)))];
    const referents = referentIds.length ? await getDb().select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, referentIds)) : [];
    const [members, files, decided] = ids.length
      ? await Promise.all([
          getDb().select({ projectId: projectMembers.projectId, id: user.id, name: user.name }).from(projectMembers).innerJoin(user, eq(user.id, projectMembers.userId)).where(sql`${projectMembers.projectId} in ${ids}`),
          getDb().select({ id: projectFiles.id, projectId: projectFiles.projectId, kind: projectFiles.kind, status: projectFiles.status, name: projectFiles.name, version: projectFiles.version, createdAt: projectFiles.createdAt }).from(projectFiles).where(and(sql`${projectFiles.projectId} in ${ids}`, sql`${projectFiles.status} <> 'deleted'`)),
          getDb().select({ fileId: approvals.fileId }).from(approvals).where(sql`${approvals.projectId} in ${ids}`),
        ])
      : [[], [], []];
    const decidedIds = new Set(decided.map((d) => d.fileId));
    const unread = ids.length
      ? await getDb()
          .select({ projectId: messages.projectId, count: sql<number>`count(*)::integer` })
          .from(messages)
          .leftJoin(messageReads, and(eq(messageReads.messageId, messages.id), eq(messageReads.userId, actor.id)))
          .where(and(sql`${messages.projectId} in ${ids}`, eq(messages.internal, false), sql`${messages.senderId} <> ${actor.id}`, sql`${messageReads.id} is null`))
          .groupBy(messages.projectId)
      : [];
    return json({
      projects: rows.map((p) => {
        const own = files.filter((f) => f.projectId === p.id);
        const latestDelivery = (name: string) => own.filter((f) => f.kind === "delivery" && f.name === name).sort((a, b) => b.version - a.version)[0];
        const awaiting = own.filter((f) => f.kind === "delivery" && f.status === "ready" && !decidedIds.has(f.id) && latestDelivery(f.name)?.id === f.id);
        return {
          ...p,
          members: members.filter((m) => m.projectId === p.id).map((m) => ({ id: m.id, name: m.name })),
          referent: referents.find((r) => r.id === p.referentId) ?? members.find((m) => m.projectId === p.id) ?? null,
          materialsCount: own.filter((f) => f.kind === "manuscript").length,
          materialsPending: own.filter((f) => f.kind === "manuscript" && f.status === "quarantine").length,
          deliveriesAwaiting: awaiting.map((f) => ({ id: f.id, name: f.name, version: f.version })),
          lastDeliveryAt: own.filter((f) => f.kind === "delivery").map((f) => f.createdAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
          unreadMessages: unread.find((u) => u.projectId === p.id)?.count ?? 0,
        };
      }),
    });
  }
  if (request.method !== "POST") throw notFound();
  await limitRequest("project-create", actor.id, 20, 3600);
  const body = await readBody(request, projectBody),
    authorId = body.authorId ?? actor.id;
  demand(actor, "project.write", { own: authorId === actor.id });
  if (authorId !== actor.id) demand(actor, "project.assign");
  const [author] = await getDb()
    .select({ id: user.id, verified: user.emailVerified })
    .from(user)
    .where(eq(user.id, authorId))
    .limit(1);
  if (!author?.verified)
    throw new PlatformError(422, "INVALID_AUTHOR", "Seleziona un autore con account verificato.");
  const [project] = await getDb()
    .insert(projects)
    .values({ ...body, authorId })
    .returning();
  await audit(actor, "project.created", "project", project!.id);
  return json({ project }, 201);
}
export async function projectDetail(request: Request, actor: Actor, id: string) {
  const access = await projectAccess(
    actor,
    id,
    request.method === "PATCH" ? "project.write" : "project.read",
  );
  if (request.method === "GET") {
    const [files, projectApprovals, projectTasks, members] = await Promise.all([
      can(actor.grants, "file.read", access.resource)
        ? getDb()
            .select({
              id: projectFiles.id,
              name: projectFiles.name,
              mime: projectFiles.mime,
              size: projectFiles.size,
              version: projectFiles.version,
              previousId: projectFiles.previousId,
              kind: projectFiles.kind,
              status: projectFiles.status,
              createdAt: projectFiles.createdAt,
            })
            .from(projectFiles)
            .where(eq(projectFiles.projectId, id))
            .orderBy(desc(projectFiles.createdAt))
        : Promise.resolve([]),
      can(actor.grants, "approval.read", access.resource)
        ? getDb().select().from(approvals).where(eq(approvals.projectId, id))
        : Promise.resolve([]),
      can(actor.grants, "task.read", access.resource)
        ? getDb()
            .select()
            .from(tasks)
            .where(
              and(
                eq(tasks.projectId, id),
                can(actor.grants, "message.internal", access.resource)
                  ? sql`true`
                  : eq(tasks.internal, false),
              ),
            )
            .orderBy(tasks.dueAt)
        : Promise.resolve([]),
      getDb()
        .select({ id: user.id, name: user.name })
        .from(projectMembers)
        .innerJoin(user, eq(user.id, projectMembers.userId))
        .where(eq(projectMembers.projectId, id)),
    ]);
    const [referent] = access.project.referentId ? await getDb().select({ id: user.id, name: user.name }).from(user).where(eq(user.id, access.project.referentId)) : [];
    return json({
      project: access.project,
      referent: referent ?? members[0] ?? null,
      files,
      approvals: projectApprovals,
      tasks: projectTasks,
      members,
    });
  }
  if (request.method !== "PATCH") throw notFound();
  const body = await readBody(request, projectEdit);
  if (body.dueAt !== undefined) demand(actor, "project.assign", access.resource);
  if (body.stage) {
    demand(actor, "file.deliver", access.resource);
    if (!(steps[access.project.stage] ?? []).includes(body.stage))
      throw new PlatformError(
        409,
        "INVALID_TRANSITION",
        "Questo passaggio non è disponibile nello stato attuale.",
      );
    // La lavorazione parte solo con l'incasso previsto per il servizio (acconto
    // o saldo); i materiali e le consegne di revisione non sono mai bloccati.
    if (body.stage === "editing" && access.project.quoteId && !access.project.startedAt)
      throw new PlatformError(409, "PAYMENT_REQUIRED", access.project.startCondition === "balance" ? "Per questo servizio la lavorazione parte dopo il saldo confermato." : "La lavorazione parte dopo l'acconto confermato dal servizio di pagamento.");
    if (body.stage === "delivered" && access.project.quoteId) {
      const { resolvePurchaseRule } = await import("./crm");
      const rule = await resolvePurchaseRule();
      if (rule.balanceBeforeDelivery) {
        const [quoteRow] = await getDb().select({ stato: quotes.stato }).from(quotes).where(eq(quotes.id, access.project.quoteId));
        if (quoteRow?.stato !== "won") throw new PlatformError(409, "BALANCE_REQUIRED", "La consegna finale avviene dopo il saldo confermato. Il cliente trova il pagamento nella sua area.");
      }
    }
    if (body.stage === "delivered") {
      const files = await getDb()
        .select({ id: projectFiles.id })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, id),
            eq(projectFiles.kind, "delivery"),
            eq(projectFiles.status, "ready"),
          ),
        )
        .limit(1);
      if (!files.length)
        throw new PlatformError(
          409,
          "MISSING_DELIVERY",
          "Prima carica una consegna pronta e approvata.",
        );
    }
  }
  const [project] = await getDb()
    .update(projects)
    .set({
      ...body,
      dueAt:
        body.dueAt === undefined ? undefined : body.dueAt === null ? null : new Date(body.dueAt),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, id), eq(projects.stage, access.project.stage)))
    .returning();
  if (!project)
    throw new PlatformError(
      409,
      "CONCURRENT_CHANGE",
      "Il progetto è cambiato. Aggiorna la pagina e riprova.",
    );
  await audit(actor, "project.updated", "project", id, { stage: project.stage });
  if (body.stage)
    await notifyProject(
      project,
      actor,
      "Il progetto è avanzato",
      "È disponibile un nuovo aggiornamento del progetto.",
    );
  return json({ project });
}
export async function projectAssignment(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await projectAccess(actor, id, "project.assign");
  demand(actor, "project.assign", access.resource);
  const body = await readBody(
    request,
    z.object({ userId: z.string().min(1).max(100), remove: z.boolean().default(false) }).strict(),
  );
  const [target] = await getDb()
    .select({ id: user.id, verified: user.emailVerified })
    .from(user)
    .where(eq(user.id, body.userId));
  if (!target?.verified)
    throw new PlatformError(422, "INVALID_MEMBER", "L'utente deve avere un account verificato.");
  if (body.remove)
    await getDb()
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, body.userId)));
  else
    await getDb()
      .insert(projectMembers)
      .values({ projectId: id, userId: body.userId })
      .onConflictDoNothing();
  await audit(
    actor,
    body.remove ? "project.member.removed" : "project.member.assigned",
    "project",
    id,
    { userId: body.userId },
  );
  return json({ ok: true });
}
export async function projectMessages(request: Request, actor: Actor, id: string) {
  const access = await projectAccess(
    actor,
    id,
    request.method === "POST" ? "message.write" : "message.read",
  );
  if (request.method === "GET") {
    const rows = await getDb()
      .select({
        id: messages.id,
        body: messages.body,
        internal: messages.internal,
        senderId: messages.senderId,
        name: user.name,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(user, eq(user.id, messages.senderId))
      .where(
        and(
          eq(messages.projectId, id),
          can(actor.grants, "message.internal", access.resource)
            ? sql`true`
            : eq(messages.internal, false),
        ),
      )
      .orderBy(asc(messages.createdAt))
      .limit(200);
    const reads = await getDb().select({ messageId: messageReads.messageId }).from(messageReads).where(eq(messageReads.userId, actor.id));
    return json({ messages: rows.map(m => ({ ...m, read: reads.some(r => r.messageId === m.id) || m.senderId === actor.id })) });
  }
  if (request.method === "PATCH") {
    const body = await readBody(request, z.object({ messageId: z.string().uuid() }).strict());
    const [message] = await getDb().select().from(messages).where(and(eq(messages.id, body.messageId), eq(messages.projectId, id)));
    if (!message || (message.internal && !can(actor.grants, "message.internal", access.resource))) throw notFound();
    await getDb().insert(messageReads).values({ messageId: message.id, userId: actor.id }).onConflictDoNothing();
    return json({ ok: true });
  }
  if (request.method !== "POST") throw notFound();
  await limitRequest("messages", actor.id, 60, 3600);
  const body = await readBody(
    request,
    z
      .object({ body: z.string().trim().min(1).max(8000), internal: z.boolean().default(false) })
      .strict(),
  );
  if (body.internal) demand(actor, "message.internal", access.resource);
  const [message] = await getDb()
    .insert(messages)
    .values({ ...body, projectId: id, senderId: actor.id })
    .returning();
  if (!body.internal)
    await notifyProject(
      access.project,
      actor,
      "Nuovo messaggio",
      "C'è un nuovo messaggio nel tuo progetto.",
    );
  await audit(actor, "message.created", "project", id, { internal: body.internal });
  return json({ message }, 201);
}
export async function projectUpload(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await projectAccess(actor, id, "file.upload");
  await limitRequest("uploads", actor.id, 20, 3600);
  const length = Number(request.headers.get("content-length"));
  if (length > 4.5 * 1024 * 1024)
    throw new PlatformError(413, "FILE_TOO_LARGE", "Il file supera il limite di 4 MB.");
  const form = await request.formData(),
    uploaded = form.get("file");
  if (!(uploaded instanceof File))
    throw new PlatformError(422, "MISSING_FILE", "Seleziona un file.");
  const kindResult = z.enum(["manuscript", "delivery"]).safeParse(form.get("kind") ?? "manuscript");
  if (!kindResult.success) throw new PlatformError(422, "INVALID_FILE_KIND", "Scegli un tipo di file valido.");
  const kind = kindResult.data;
  if (kind === "delivery") demand(actor, "file.deliver", access.resource);
  if (uploaded.size > 4 * 1024 * 1024)
    throw new PlatformError(413, "FILE_TOO_LARGE", "Il file supera il limite di 4 MB.");
  return saveUpload(actor, access, id, uploaded.name, kind, new Uint8Array(await uploaded.arrayBuffer()));
}
/**
 * Registra un file caricato: controllo del formato, scanner per DOCX e PDF,
 * versione, stato del progetto, avvisi. Con `stored` il file è già nell'archivio
 * privato (caricamento diretto dei file grandi) e non viene ricaricato; se non
 * supera i controlli viene cancellato.
 */
export async function saveUpload(actor: Actor, access: Awaited<ReturnType<typeof projectAccess>>, id: string, name: string, kind: "manuscript" | "delivery", bytes: Uint8Array, stored?: string) {
  let inspection: ReturnType<typeof inspectUpload>;
  try {
    inspection = inspectUpload(name, bytes, stored ? DIRECT_UPLOAD_MAX_BYTES : undefined);
    if (!inspection.text && (!process.env.FILE_SCANNER_URL || !process.env.FILE_SCANNER_TOKEN)) throw new PlatformError(503, "SCANNER_REQUIRED", "Il controllo di DOCX e PDF non è attivo. Puoi usare un file TXT UTF-8.");
  } catch (error) {
    if (stored) await deletePrivate(stored).catch(() => {});
    throw error;
  }
  const key = stored ?? (await storePrivate(id, bytes, inspection.mime));
  let file: typeof projectFiles.$inferSelect;
  try {
    file = await getDb().transaction(async (tx) => {
      await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).for("update");
      const [previous] = await tx
        .select()
        .from(projectFiles)
        .where(and(eq(projectFiles.projectId, id), eq(projectFiles.name, name)))
        .orderBy(desc(projectFiles.version))
        .limit(1);
      if (previous?.hash === createHash("sha256").update(bytes).digest("hex") && previous.kind === kind && previous.status !== "rejected" && previous.status !== "deleted") return previous;
      const [saved] = await tx
        .insert(projectFiles)
        .values({
          projectId: id,
          uploadedBy: actor.id,
          name: name,
          mime: inspection.mime,
          size: bytes.byteLength,
          hash: createHash("sha256").update(bytes).digest("hex"),
          storageKey: key,
          kind,
          status: inspection.text ? "ready" : "quarantine",
          expiresAt: inspection.text ? null : new Date(Date.now() + 7 * 86400_000),
          previousId: previous?.id,
          version: (previous?.version ?? 0) + 1,
        })
        .returning();
      if (kind === "delivery")
        await tx
          .update(projects)
          .set({ stage: "review", updatedAt: new Date() })
          .where(eq(projects.id, id));
      // Materiali arrivati (e già controllati): la produzione può assegnare il lavoro.
      if (kind === "manuscript" && saved!.status === "ready")
        await tx.update(projects).set({ opsStatus: "ready_for_assignment", updatedAt: new Date() }).where(and(eq(projects.id, id), eq(projects.opsStatus, "waiting_materials")));
      if (kind === "delivery") await tx.update(projects).set({ opsStatus: "client_review" }).where(and(eq(projects.id, id), eq(projects.opsStatus, "quality_check")));
      return saved!;
    });
  } catch (error) {
    await deletePrivate(key).catch(() => {});
    throw error;
  }
  if (file.storageKey !== key) {
    await deletePrivate(key);
    const { storageKey: _storageKey, hash: _hash, ...visible } = file;
    return json({ file: visible, duplicate: true });
  }
  if (!inspection.text) {
    try {
      if (await scanUpload(bytes)) {
        await getDb()
          .update(projectFiles)
          .set({ status: "ready" })
          .where(eq(projectFiles.id, file.id));
        file.status = "ready";
        if (kind === "manuscript") await getDb().update(projects).set({ opsStatus: "ready_for_assignment", updatedAt: new Date() }).where(and(eq(projects.id, id), eq(projects.opsStatus, "waiting_materials")));
      }
    } catch (error) {
      if (error instanceof PlatformError && error.code === "UNSAFE_FILE") {
        await getDb()
          .update(projectFiles)
          .set({ status: "rejected" })
          .where(eq(projectFiles.id, file.id));
        await deletePrivate(key);
        throw error;
      }
      // The private quarantined file remains unavailable; maintenance can retry the scan.
    }
  }
  await audit(actor, "file.uploaded", "project", id, {
    fileId: file.id,
    version: file.version,
    status: file.status,
  });
  await notifyProject(
    access.project,
    actor,
    "Nuova versione disponibile",
    file.status === "ready"
      ? "È disponibile un nuovo file nel progetto."
      : "Un nuovo file è in attesa del controllo di sicurezza.",
  );
  const { storageKey: _storageKey, hash: _hash, ...visible } = file;
  return json({ file: visible }, file.status === "quarantine" ? 202 : 201);
}
export async function fileDownload(actor: Actor, id: string) {
  const [file] = await getDb().select().from(projectFiles).where(eq(projectFiles.id, id));
  if (!file) throw notFound();
  await projectAccess(actor, file.projectId, "file.read");
  if (file.status !== "ready")
    throw new PlatformError(
      409,
      "FILE_NOT_READY",
      "Il file non è ancora disponibile per il download.",
    );
  return new Response(await readPrivate(file.storageKey), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function fileApproval(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const [file] = await getDb().select().from(projectFiles).where(eq(projectFiles.id, id));
  if (!file) throw notFound();
  const access = await projectAccess(actor, file.projectId, "approval.write");
  if (access.project.authorId !== actor.id || file.kind !== "delivery" || file.status !== "ready")
    throw notFound();
  const body = await readBody(
    request,
    z
      .object({
        decision: z.enum(["approved", "changes_requested"]),
        comment: z.string().max(5000).optional(),
      })
      .strict(),
  );
  await getDb().transaction(async (tx) => {
    await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, file.projectId))
      .for("update");
    const [latest] = await tx
      .select({ id: projectFiles.id })
      .from(projectFiles)
      .where(and(eq(projectFiles.projectId, file.projectId), eq(projectFiles.name, file.name)))
      .orderBy(desc(projectFiles.version))
      .limit(1);
    if (latest?.id !== file.id)
      throw new PlatformError(
        409,
        "STALE_VERSION",
        "C'è una versione più recente. Aprila prima di approvare.",
      );
    await tx
      .insert(approvals)
      .values({ projectId: file.projectId, fileId: id, authorId: actor.id, ...body })
      .onConflictDoUpdate({
        target: [approvals.fileId, approvals.authorId],
        set: { decision: body.decision, comment: body.comment ?? null, createdAt: new Date() },
      });
    const current = await tx
      .selectDistinctOn([projectFiles.name], { id: projectFiles.id, status: projectFiles.status })
      .from(projectFiles)
      .where(and(eq(projectFiles.projectId, file.projectId), eq(projectFiles.kind, "delivery")))
      .orderBy(projectFiles.name, desc(projectFiles.version));
    const decisions = await tx
      .select()
      .from(approvals)
      .where(and(eq(approvals.projectId, file.projectId), eq(approvals.authorId, actor.id)));
    const approved =
      current.length > 0 &&
      current.every(
        (f) =>
          f.status === "ready" &&
          decisions.some((a) => a.fileId === f.id && a.decision === "approved"),
      );
    await tx
      .update(projects)
      .set({ stage: approved ? "approved" : "review", updatedAt: new Date() })
      .where(eq(projects.id, file.projectId));
  });
  await audit(actor, "file.approval", "project", file.projectId, {
    fileId: id,
    decision: body.decision,
  });
  await notifyProject(
    access.project,
    actor,
    body.decision === "approved" ? "Consegna approvata" : "Richieste di revisione",
    "L'autore ha aggiornato la decisione sulla consegna.",
  );
  return json({ ok: true });
}
export async function taskCollection(request: Request, actor: Actor) {
  demandAvailable(actor, request.method === "POST" ? "task.write" : "task.read");
  if (request.method === "GET") {
    const allowedProjects = await getDb()
      .select({ id: projects.id })
      .from(projects)
      .where(await projectPredicate(actor, "task.read"));
    const allowedIds = allowedProjects.map((p) => p.id);
    const allowedLeads = await getDb()
      .select({ id: leadOwnership.leadId })
      .from(leadOwnership)
      .where(leadPredicate(actor, "crm.read"));
    const rows = await getDb()
      .select()
      .from(tasks)
      .where(
        and(
          can(actor.grants, "task.read") ? sql`true` : eq(tasks.assignedTo, actor.id),
          sql`(${tasks.projectId} is null ${allowedIds.length ? sql`or ${inArray(tasks.projectId, allowedIds)}` : sql``})`,
          actor.staff ? sql`true` : eq(tasks.internal, false),
          sql`(${tasks.leadId} is null ${
            allowedLeads.length
              ? sql`or ${inArray(
                  tasks.leadId,
                  allowedLeads.map((l) => l.id),
                )}`
              : sql``
          })`,
        ),
      )
      .orderBy(tasks.dueAt)
      .limit(100);
    return json({ tasks: rows });
  }
  if (request.method !== "POST") throw notFound();
  const body = await readBody(
    request,
    z
      .object({
        title: z.string().trim().min(2).max(200),
        projectId: z.string().uuid().optional(),
        leadId: z.string().uuid().optional(),
        assignedTo: z.string().max(100).optional(),
        dueAt: z.string().datetime().optional(),
        internal: z.boolean().default(true),
      })
      .strict(),
  );
  const assignedTo = body.assignedTo ?? actor.id;
  if (body.projectId) {
    const access = await projectAccess(actor, body.projectId, "task.write");
    if (assignedTo !== actor.id) demand(actor, "project.assign", access.resource);
  } else {
    if (assignedTo !== actor.id) demand(actor, "task.write");
  }
  if (body.leadId) await leadAccess(actor, body.leadId, "crm.write");
  const [task] = await getDb()
    .insert(tasks)
    .values({
      ...body,
      assignedTo,
      createdBy: actor.id,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    })
    .returning();
  return json({ task }, 201);
}
export async function taskUpdate(request: Request, actor: Actor, id: string) {
  if (request.method !== "PATCH") throw notFound();
  const [task] = await getDb().select().from(tasks).where(eq(tasks.id, id));
  if (!task) throw notFound();
  demand(actor, "task.write", {
    own: task.assignedTo === actor.id,
    assigned: task.assignedTo === actor.id,
  });
  if (task.projectId) await projectAccess(actor, task.projectId, "task.write");
  if (task.leadId) await leadAccess(actor, task.leadId, "crm.write");
  const body = await readBody(request, z.object({ done: z.boolean() }).strict());
  await getDb().update(tasks).set(body).where(eq(tasks.id, id));
  return json({ ok: true });
}

/** Il responsabile sospende o riattiva i promemoria automatici di un progetto. */
export async function projectReminders(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await projectAccess(actor, id, "project.write");
  if (!actor.staff) throw forbidden();
  void access;
  const body = await readBody(request, z.object({ paused: z.boolean() }).strict());
  await getDb().update(projects).set({ remindersPausedAt: body.paused ? new Date() : null, updatedAt: new Date() }).where(eq(projects.id, id));
  await audit(actor, body.paused ? "project.reminders_paused" : "project.reminders_resumed", "project", id);
  return json({ ok: true, paused: body.paused });
}
