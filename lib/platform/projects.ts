import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
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
import { readBody, json, notFound, PlatformError } from "./http";
import { limitRequest } from "./rate-limit";
import { storePrivate, readPrivate, deletePrivate, inspectUpload, scanUpload } from "./storage";
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
      .enum(["brief", "estimate", "materials", "editing", "review", "approved", "delivered"])
      .optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .strict();
const steps: Record<string, string[]> = {
  brief: ["estimate", "materials"],
  estimate: ["materials"],
  materials: ["editing"],
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
  if (recipients.length)
    await getDb()
      .insert(notifications)
      .values(
        recipients.map((userId) => ({
          userId,
          title,
          body,
          href: `/area-autore?progetto=${project.id}`,
        })),
      );
  for (const userId of recipients) {
    const [person] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (person) await enqueueMail(`notification:${project.id}:${userId}:${Date.now()}`, {
      to: person.email, subject: `${title} · Proemios`,
      html: impaginaEmail(esc(title), `<p>${esc(body)}</p><p><a href="${appOrigin()}/spazio">Apri il tuo spazio</a></p>`),
    });
  }
}
export async function projectCollection(request: Request, actor: Actor) {
  if (request.method === "GET") {
    const rows = await getDb()
      .select()
      .from(projects)
      .where(await projectPredicate(actor))
      .orderBy(desc(projects.updatedAt))
      .limit(100);
    return json({ projects: rows });
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
    return json({
      project: access.project,
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
  const bytes = new Uint8Array(await uploaded.arrayBuffer()),
    inspection = inspectUpload(uploaded.name, bytes);
  if (!inspection.text && (!process.env.FILE_SCANNER_URL || !process.env.FILE_SCANNER_TOKEN)) throw new PlatformError(503, "SCANNER_REQUIRED", "Il controllo di DOCX e PDF non è attivo. Puoi usare un file TXT UTF-8.");
  const key = await storePrivate(id, bytes, inspection.mime);
  let file: typeof projectFiles.$inferSelect;
  try {
    file = await getDb().transaction(async (tx) => {
      await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).for("update");
      const [previous] = await tx
        .select()
        .from(projectFiles)
        .where(and(eq(projectFiles.projectId, id), eq(projectFiles.name, uploaded.name)))
        .orderBy(desc(projectFiles.version))
        .limit(1);
      if (previous?.hash === createHash("sha256").update(bytes).digest("hex") && previous.kind === kind && previous.status !== "rejected" && previous.status !== "deleted") return previous;
      const [saved] = await tx
        .insert(projectFiles)
        .values({
          projectId: id,
          uploadedBy: actor.id,
          name: uploaded.name,
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
