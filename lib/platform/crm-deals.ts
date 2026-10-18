/**
 * Trattative: tabella e Kanban sulla stessa fonte. Spostare una scheda cambia
 * la fase reale della trattativa (e della richiesta d'origine); le fasi
 * derivate dai fatti non si impostano a mano e «vinta» arriva solo con un
 * incasso verificato. Ogni trattativa aperta ha sempre una prossima azione.
 */
import { and, desc, eq, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmAssignments, crmAttributions, crmContacts, crmDeals } from "@/db/crm-schema";
import { leadActivities, leadOwnership } from "@/db/platform-schema";
import { stageMove } from "@/lib/crm-core/pipelines";
import { lossReasonsSchema, defaultLossReasons, defaultAttributionRules, attributionRulesSchema, PRIORITIES, type LossReasons } from "@/lib/crm-core/rules";
import { validateCustomFields } from "@/lib/crm-core/fields";
import { can } from "./permissions";
import { demand, demandAvailable, audit, type Actor } from "./access";
import { json, notFound, PlatformError, readBody } from "./http";
import { DEFAULT_PIPELINE, dealFacts, dealStage, emitEvent, ensureContact, pipelineFor, pipelines, readSetting, type Reader } from "./crm-relations";
import { manualTransitionAllowed, normalizeStage } from "./pipeline";
import { recordAssignment, setOwner, salesCandidates } from "./crm-routing";
import { fieldDefinitions } from "./crm-contacts";
import { notify } from "./crm-notify";

export const lossReasons = (db: Reader = getDb()) => readSetting<LossReasons>("loss-reasons", lossReasonsSchema, defaultLossReasons, db);
export function dealPredicate(actor: Actor, permission: "crm.read" | "crm.write" = "crm.read"): SQL {
  if (can(actor.grants, permission)) return sql`true`;
  if (can(actor.grants, permission, { assigned: true })) return eq(crmDeals.ownerId, actor.id);
  return sql`false`;
}
export async function dealAccess(actor: Actor, id: string, permission: "crm.read" | "crm.write" = "crm.read") {
  demandAvailable(actor, permission);
  const [deal] = await getDb().select().from(crmDeals).where(and(eq(crmDeals.id, id), dealPredicate(actor, permission)));
  if (!deal) throw notFound();
  return deal;
}
const nextActionSchema = { nextAction: z.string().trim().min(3).max(300), nextActionAt: z.string().datetime() };

export async function dealCollection(request: Request, actor: Actor) {
  if (request.method === "POST") return dealCreate(request, actor);
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "crm.read");
  const p = new URL(request.url).searchParams;
  const q = p.get("q")?.trim().slice(0, 100), owner = p.get("owner")?.slice(0, 100), pipelineKey = p.get("pipeline")?.slice(0, 40) ?? DEFAULT_PIPELINE.key, wanted = p.get("stage")?.slice(0, 40), status = p.get("status")?.slice(0, 10) ?? "open";
  const now = new Date();
  const rows = await getDb()
    .select({ deal: crmDeals, contact: crmContacts.name, owner: user.name })
    .from(crmDeals)
    .innerJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
    .leftJoin(user, eq(user.id, crmDeals.ownerId))
    .where(
      and(
        dealPredicate(actor),
        eq(crmDeals.pipelineKey, pipelineKey),
        q ? or(ilike(crmDeals.title, `%${q}%`), ilike(crmContacts.name, `%${q}%`)) : undefined,
        owner ? (owner === "none" ? isNull(crmDeals.ownerId) : eq(crmDeals.ownerId, owner === "me" ? actor.id : owner)) : undefined,
        p.get("overdue") === "1" ? lt(crmDeals.nextActionAt, now) : undefined,
        p.get("noNext") === "1" ? or(isNull(crmDeals.nextAction), isNull(crmDeals.nextActionAt)) : undefined,
      ),
    )
    .orderBy(crmDeals.nextActionAt, desc(crmDeals.createdAt))
    .limit(300);
  const pipeline = await pipelineFor(pipelineKey);
  const facts = await dealFacts(getDb(), rows.map((r) => r.deal.id));
  const list = rows
    .map(({ deal, contact, owner }) => {
      const state = dealStage(deal, pipeline, facts);
      const quote = facts.quotes.find((q) => q.quote.id === state.quoteId)?.quote;
      return { id: deal.id, title: deal.title, contact, contactId: deal.contactId, owner, ownerId: deal.ownerId, priority: deal.priority, nextAction: deal.nextAction, nextActionAt: deal.nextActionAt, overdue: Boolean(deal.nextActionAt && deal.nextActionAt < now), amount: quote?.prezzoTotale ?? null, ...state };
    })
    .filter((d) => (status === "all" ? true : d.status === status) && (!wanted || d.stage === wanted));
  return json({ deals: list, pipeline, pipelines: (await pipelines()).map((x) => ({ key: x.key, name: x.name })) });
}
/**
 * Trattativa inserita a mano o portata da un venditore. Un venditore non può
 * rivendicare un cliente già seguito da un collega: serve chi gestisce l'assegnazione.
 */
async function dealCreate(request: Request, actor: Actor) {
  demandAvailable(actor, "crm.write");
  const body = await readBody(
    request,
    z
      .object({
        contactId: z.string().uuid().optional(),
        contact: z.object({ name: z.string().trim().min(2).max(200), email: z.string().trim().email().max(320), phone: z.string().trim().max(40).optional() }).strict().optional(),
        title: z.string().trim().min(2).max(200),
        pipelineKey: z.string().max(40).default(DEFAULT_PIPELINE.key),
        priority: z.enum(PRIORITIES).default("normal"),
        sourceDetail: z.string().trim().max(200).optional(),
        ownerId: z.string().max(100).optional(),
        ...nextActionSchema,
      })
      .strict()
      .refine((b) => Boolean(b.contactId) !== Boolean(b.contact), { message: "Indica un contatto esistente o i dati di uno nuovo." }),
  );
  const manager = can(actor.grants, "crm.assign");
  if (body.ownerId && body.ownerId !== actor.id && !manager) throw new PlatformError(403, "FORBIDDEN", "Solo chi gestisce l'assegnazione sceglie un altro responsabile.");
  const owner = body.ownerId ?? actor.id;
  if (owner !== actor.id && !(await salesCandidates(getDb())).some((c) => c.userId === owner && c.active)) throw new PlatformError(422, "INVALID_ASSIGNEE", "Scegli una persona attiva che segue contatti.");
  const pipeline = await pipelineFor(body.pipelineKey);
  if (pipeline.archived) throw new PlatformError(409, "PIPELINE_ARCHIVED", "Questa pipeline è archiviata: scegline una attiva.");
  const rules = await readSetting("attribution-rules", attributionRulesSchema, defaultAttributionRules);
  const result = await getDb().transaction(async (tx) => {
    let contact: typeof crmContacts.$inferSelect;
    if (body.contactId) {
      const [found] = await tx.select().from(crmContacts).where(and(eq(crmContacts.id, body.contactId), isNull(crmContacts.mergedIntoId)));
      if (!found) throw notFound();
      contact = found;
    } else contact = (await ensureContact(tx, { name: body.contact!.name, email: body.contact!.email, phone: body.contact!.phone })).contact;
    const others = await tx.select().from(crmDeals).where(eq(crmDeals.contactId, contact.id));
    const windowStart = Date.now() - rules.relationshipWindowDays * 86400_000;
    const foreign = others.find((d) => d.ownerId && d.ownerId !== owner && (!d.closedAt || d.closedAt.getTime() >= windowStart));
    if (foreign && !manager) throw new PlatformError(409, "CONTACT_FOLLOWED", "Questo cliente è già seguito da un collega: chiedi a chi gestisce l'assegnazione.", { dealId: foreign.id });
    const [lead] = await tx.insert(leads).values({ nome: contact.name, email: contact.email, telefono: contact.phone, fonte: "contatto", sourceKind: actor.roles.includes("seller") ? "seller" : "manual", sourcedBy: actor.id, sourceDetail: body.sourceDetail ?? null, contactId: contact.id, priority: body.priority, language: contact.language, assignmentStatus: "assigned", firstResponseAt: new Date(), consensoPrivacy: false, consensoMarketing: false }).returning();
    const [deal] = await tx.insert(crmDeals).values({ contactId: contact.id, originLeadId: lead!.id, title: body.title, pipelineKey: pipeline.key, stage: pipeline.key === DEFAULT_PIPELINE.key ? "received" : pipeline.stages[0]!.key, priority: body.priority, nextAction: body.nextAction, nextActionAt: new Date(body.nextActionAt), createdBy: actor.id, lastActivityAt: new Date() }).returning();
    await tx.update(leads).set({ dealId: deal!.id }).where(eq(leads.id, lead!.id));
    await setOwner(tx, { leadId: lead!.id, dealId: deal!.id, to: owner, method: "manual", reason: owner === actor.id ? "seller_sourced" : "manager_choice", actorId: actor.id });
    await tx.insert(leadActivities).values({ leadId: lead!.id, dealId: deal!.id, actorId: actor.id, kind: "created", channel: "manual", direction: "inbound", body: `Trattativa aperta a mano${body.sourceDetail ? ` (${body.sourceDetail})` : ""}.` });
    await emitEvent(tx, "lead.created", lead!.id, lead!.id, { leadId: lead!.id, contactId: contact.id, dealId: deal!.id, source: "manual" });
    return { deal: deal!, contactId: contact.id, leadId: lead!.id, warning: others.length ? "Contatto già presente: la nuova trattativa è collegata alla stessa scheda." : null };
  });
  await audit(actor, "deal.created", "deal", result.deal.id, { contactId: result.contactId });
  return json(result, 201);
}

export async function dealDetail(request: Request, actor: Actor, id: string) {
  if (request.method === "PATCH") return dealUpdate(request, actor, id);
  if (request.method !== "GET") throw notFound();
  const deal = await dealAccess(actor, id);
  const db = getDb();
  const pipeline = await pipelineFor(deal.pipelineKey, db);
  const facts = await dealFacts(db, [id]);
  const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, deal.contactId));
  const requestRows = await db.select({ id: leads.id, createdAt: leads.createdAt, source: leads.sourceKind, fonte: leads.fonte, priority: leads.priority, slaDueAt: leads.slaDueAt, firstResponseAt: leads.firstResponseAt }).from(leads).where(eq(leads.dealId, id));
  const leadIds = requestRows.map((r) => r.id);
  const activities = leadIds.length ? await db.select({ a: leadActivities, name: user.name }).from(leadActivities).leftJoin(user, eq(user.id, leadActivities.actorId)).where(inArray(leadActivities.leadId, leadIds)).orderBy(desc(leadActivities.createdAt)).limit(100) : [];
  const history = await db.select({ a: crmAssignments, to: user.name }).from(crmAssignments).leftJoin(user, eq(user.id, crmAssignments.toUser)).where(and(eq(crmAssignments.entityType, "deal"), eq(crmAssignments.entityId, id))).orderBy(desc(crmAssignments.createdAt));
  const quoteIds = facts.quotes.map((q) => q.quote.id);
  const attributions = quoteIds.length ? await db.select().from(crmAttributions).where(inArray(crmAttributions.quoteId, quoteIds)).orderBy(crmAttributions.quoteId, desc(crmAttributions.version)) : [];
  const [owner] = deal.ownerId ? await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, deal.ownerId)) : [];
  return json({
    deal: { ...deal, ...dealStage(deal, pipeline, facts), owner: owner ?? null },
    contact: contact ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone, language: contact.language } : null,
    requests: requestRows,
    quotes: facts.quotes.map(({ quote, record }) => ({ id: quote.id, createdAt: quote.createdAt, version: record.version, commercialState: record.commercialState, acceptedAt: record.acceptedAt, total: quote.prezzoTotale, paid: facts.orders.some((o) => o.quoteId === quote.id && o.status === "paid") })),
    activities: activities.map(({ a, name }) => ({ id: a.id, kind: a.kind, body: a.body, outcome: a.outcome, structured: a.structured, createdAt: a.createdAt, name })),
    assignments: history.map(({ a, to }) => ({ at: a.createdAt, to, method: a.method, reason: a.reason, ruleVersion: a.ruleVersion })),
    attributions,
    pipeline,
    lossReasons: (await lossReasons()).reasons.filter((r) => r.active),
    fields: await fieldDefinitions("deal"),
  });
}

async function dealUpdate(request: Request, actor: Actor, id: string) {
  const deal = await dealAccess(actor, id, "crm.write");
  const body = await readBody(
    request,
    z
      .object({
        stage: z.string().min(2).max(40).optional(),
        title: z.string().trim().min(2).max(200).optional(),
        priority: z.enum(PRIORITIES).optional(),
        nextAction: z.string().trim().min(3).max(300).nullable().optional(),
        nextActionAt: z.string().datetime().nullable().optional(),
        lostReasonKey: z.string().max(40).optional(),
        lostNote: z.string().trim().max(1000).optional(),
        ownerId: z.string().min(1).max(100).nullable().optional(),
        reason: z.string().trim().min(3).max(300).optional(),
        custom: z.record(z.unknown()).optional(),
      })
      .strict(),
  );
  const pipeline = await pipelineFor(deal.pipelineKey);
  const facts = await dealFacts(getDb(), [id]);
  const current = dealStage(deal, pipeline, facts);
  let nextStage: string | undefined, closing = false, reopening = false;
  if (body.stage !== undefined && body.stage !== current.stage) {
    if (pipeline.key === DEFAULT_PIPELINE.key) {
      const target = normalizeStage(body.stage);
      if (target !== body.stage || !manualTransitionAllowed(current.stage as Parameters<typeof manualTransitionAllowed>[0], target))
        throw new PlatformError(409, "INVALID_STATE", target === "won" || body.stage === "won" ? "«Acquisto concluso» lo decide l'incasso verificato, non lo spostamento della scheda." : "Questa fase viene dai fatti (proposta, accettazione, pagamento): non si imposta a mano.");
      nextStage = target;
    } else {
      const move = stageMove(pipeline, body.stage);
      if (!move.ok) throw new PlatformError(409, "INVALID_STATE", move.code === "WON_BY_PAYMENT" ? "La fase vinta arriva solo con un incasso verificato." : move.code === "DERIVED_STAGE" ? "Questa fase viene dai fatti." : "Fase sconosciuta per questa pipeline.");
      nextStage = body.stage;
    }
    if (current.status === "won") throw new PlatformError(409, "INVALID_STATE", "Una trattativa vinta non cambia fase: il seguito è nel progetto e in Finance.");
    const kind = pipeline.stages.find((s) => s.key === nextStage)?.kind ?? "open";
    closing = kind === "lost";
    reopening = current.status === "lost" && kind === "open";
    if (closing) {
      const reasons = await lossReasons();
      const reason = reasons.reasons.find((r) => r.key === body.lostReasonKey && r.active);
      if (!reason) throw new PlatformError(422, "MISSING_REASON", "Scegli il motivo della perdita dall'elenco.");
      if (reason.key === "other" && !body.lostNote) throw new PlatformError(422, "MISSING_REASON", "Per «Altro» scrivi una nota.");
    }
  }
  const nextAction = body.nextAction !== undefined ? body.nextAction : deal.nextAction;
  const nextActionAt = body.nextActionAt !== undefined ? (body.nextActionAt ? new Date(body.nextActionAt) : null) : deal.nextActionAt;
  const willBeOpen = closing ? false : reopening ? true : current.status === "open";
  if (willBeOpen && (!nextAction || !nextActionAt)) throw new PlatformError(422, "NEXT_ACTION_REQUIRED", "Una trattativa aperta ha sempre una prossima azione con data.");
  if (body.ownerId !== undefined) {
    demand(actor, "crm.assign");
    if (!body.reason) throw new PlatformError(422, "MISSING_REASON", "Indica perché cambia il responsabile.");
    if (body.ownerId && !(await salesCandidates(getDb())).some((c) => c.userId === body.ownerId && c.active)) throw new PlatformError(422, "INVALID_ASSIGNEE", "Scegli una persona attiva che segue contatti.");
  }
  let custom = deal.custom;
  if (body.custom) {
    const checked = validateCustomFields(await fieldDefinitions("deal"), { ...deal.custom, ...body.custom });
    if (Object.keys(checked.errors).length) throw new PlatformError(422, "VALIDATION_ERROR", "Controlla i campi personalizzati.", checked.errors);
    custom = checked.values;
  }
  await getDb().transaction(async (tx) => {
    await tx
      .update(crmDeals)
      .set({
        ...(nextStage ? { stage: nextStage, closedAt: closing ? new Date() : reopening ? null : deal.closedAt, lostReasonKey: closing ? body.lostReasonKey! : reopening ? null : deal.lostReasonKey, lostNote: closing ? body.lostNote ?? null : deal.lostNote } : {}),
        ...(body.title ? { title: body.title } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
        nextAction,
        nextActionAt,
        custom,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmDeals.id, id));
    // La richiesta d'origine resta allineata: un solo stato vero per pipeline, lista e Kanban.
    if (nextStage && deal.originLeadId && pipeline.key === DEFAULT_PIPELINE.key)
      await tx.update(leads).set({ stage: nextStage, closedAt: closing ? new Date() : null, lostReason: closing ? `${body.lostReasonKey}${body.lostNote ? `: ${body.lostNote}` : ""}` : null, nextAction: nextAction ?? null, nextActionAt: nextActionAt ?? null, updatedAt: new Date() }).where(eq(leads.id, deal.originLeadId));
    else if (deal.originLeadId && (body.nextAction !== undefined || body.nextActionAt !== undefined)) await tx.update(leads).set({ nextAction: nextAction ?? null, nextActionAt: nextActionAt ?? null }).where(eq(leads.id, deal.originLeadId));
    if (nextStage) {
      if (deal.originLeadId) await tx.insert(leadActivities).values({ leadId: deal.originLeadId, dealId: id, actorId: actor.id, kind: "state", body: `Fase: ${current.stage} → ${nextStage}${closing ? ` · ${body.lostReasonKey}${body.lostNote ? ` (${body.lostNote})` : ""}` : ""}`, outcome: nextStage });
      await emitEvent(tx, "deal.stage_changed", `${id}:${nextStage}:${Date.now()}`, id, { dealId: id, from: current.stage, to: nextStage, pipeline: pipeline.key });
    }
    if (body.ownerId !== undefined) {
      await tx.update(crmDeals).set({ ownerId: body.ownerId }).where(eq(crmDeals.id, id));
      await recordAssignment(tx, { entityType: "deal", entityId: id, fromUser: deal.ownerId, toUser: body.ownerId, method: "manual", reason: body.reason!, actorId: actor.id });
      const attached = await tx.select({ id: leads.id }).from(leads).innerJoin(leadOwnership, eq(leadOwnership.leadId, leads.id)).where(eq(leads.dealId, id));
      for (const l of attached) {
        await tx.update(leadOwnership).set({ assignedTo: body.ownerId, updatedAt: new Date() }).where(eq(leadOwnership.leadId, l.id));
        await recordAssignment(tx, { entityType: "lead", entityId: l.id, fromUser: deal.ownerId, toUser: body.ownerId, method: "manual", reason: body.reason!, actorId: actor.id });
      }
      if (body.ownerId && body.ownerId !== actor.id) await notify(tx, body.ownerId, "lead_assigned", { key: `deal:${id}:${Date.now()}`, title: "Trattativa assegnata a te", body: `${deal.title}: ${body.reason}`, href: `/spazio?tab=deals&deal=${id}` });
    }
  });
  await audit(actor, "deal.updated", "deal", id, { stage: nextStage, owner: body.ownerId });
  return json({ ok: true, stage: nextStage ?? current.stage });
}
