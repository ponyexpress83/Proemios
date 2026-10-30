/**
 * Contatti e aziende: elenco con ricerca e filtri, scheda con riepilogo e
 * cronologia (origine, assegnazioni, chiamate e note, proposte, pagamenti,
 * avvio e avanzamento, consegne, assistenza), viste salvate, duplicati e
 * unione controllata che conserva collegamenti e storia.
 */
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmAssignments, crmCompanies, crmContacts, crmDeals, crmFieldDefinitions, crmHandoffs, crmMerges, crmSavedViews, supportRequests } from "@/db/crm-schema";
import { contracts, leadActivities, leadNotes, leadOwnership, paymentOrders, projectFiles, projects, quoteRecords } from "@/db/platform-schema";
import { matchReasons, mergeable, normalizePhone, type DedupRecord } from "@/lib/crm-core/dedup";
import { validateCustomFields, type FieldDefinition } from "@/lib/crm-core/fields";
import { can } from "./permissions";
import { demand, demandAvailable, audit, type Actor } from "./access";
import { json, notFound, PlatformError, readBody } from "./http";
import { dealFacts, dealStage, pipelines } from "./crm-relations";
import { PAID_STATUSES } from "./pipeline";

/** Contatti visibili: tutti con lettura CRM dell'organizzazione, altrimenti solo quelli che la persona segue. */
export function contactPredicate(actor: Actor): SQL {
  if (can(actor.grants, "crm.read")) return sql`true`;
  if (!can(actor.grants, "crm.read", { assigned: true })) return sql`false`;
  return sql`(exists (select 1 from ${crmDeals} d where d.contact_id = ${crmContacts.id} and d.owner_id = ${actor.id}) or exists (select 1 from ${leads} l join ${leadOwnership} o on o.lead_id = l.id where l.contact_id = ${crmContacts.id} and o.assigned_to = ${actor.id}))`;
}
export async function contactAccess(actor: Actor, id: string, write = false) {
  demandAvailable(actor, write ? "crm.write" : "crm.read");
  const [contact] = await getDb().select().from(crmContacts).where(and(eq(crmContacts.id, id), contactPredicate(actor)));
  if (!contact) throw notFound();
  if (write && !can(actor.grants, "crm.write") && !can(actor.grants, "crm.write", { assigned: true })) throw notFound();
  return contact;
}
export async function fieldDefinitions(entity: string): Promise<FieldDefinition[]> {
  return (await getDb().select().from(crmFieldDefinitions).where(eq(crmFieldDefinitions.entity, entity))) as FieldDefinition[];
}

export async function contactCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "crm.read");
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 100), owner = params.get("owner")?.slice(0, 100), company = params.get("company");
  const rows = await getDb()
    .select({ contact: crmContacts, company: crmCompanies.name })
    .from(crmContacts)
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmContacts.companyId))
    .where(
      and(
        isNull(crmContacts.mergedIntoId),
        contactPredicate(actor),
        q ? or(ilike(crmContacts.name, `%${q}%`), ilike(crmContacts.email, `%${q}%`), ilike(crmContacts.phone, `%${q}%`)) : undefined,
        owner ? sql`exists (select 1 from ${crmDeals} d where d.contact_id = ${crmContacts.id} and d.owner_id = ${owner === "me" ? actor.id : owner})` : undefined,
        company && z.string().uuid().safeParse(company).success ? eq(crmContacts.companyId, company) : undefined,
      ),
    )
    .orderBy(desc(crmContacts.updatedAt))
    .limit(200);
  const ids = rows.map((r) => r.contact.id);
  const deals = ids.length ? await getDb().select({ deal: crmDeals, owner: user.name }).from(crmDeals).leftJoin(user, eq(user.id, crmDeals.ownerId)).where(inArray(crmDeals.contactId, ids)) : [];
  return json({
    contacts: rows.map(({ contact, company }) => {
      const own = deals.filter((d) => d.deal.contactId === contact.id);
      return { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone, company, language: contact.language, verified: Boolean(contact.identityVerifiedAt), openDeals: own.filter((d) => !d.deal.closedAt).length, owners: [...new Set(own.filter((d) => !d.deal.closedAt && d.owner).map((d) => d.owner!))], updatedAt: contact.updatedAt };
    }),
  });
}

type TimelineItem = { at: string; kind: string; title: string; detail?: string | null; href?: string | null; actor?: string | null };
export async function contactDetail(request: Request, actor: Actor, id: string) {
  if (request.method === "PATCH") {
    const contact = await contactAccess(actor, id, true);
    const body = await readBody(request, z.object({ name: z.string().trim().min(2).max(200).optional(), phone: z.string().trim().max(40).nullable().optional(), language: z.string().min(2).max(8).optional(), companyId: z.string().uuid().nullable().optional(), custom: z.record(z.unknown()).optional() }).strict());
    let custom = contact.custom;
    if (body.custom) {
      const checked = validateCustomFields(await fieldDefinitions("contact"), { ...contact.custom, ...body.custom });
      if (Object.keys(checked.errors).length) throw new PlatformError(422, "VALIDATION_ERROR", "Controlla i campi personalizzati.", checked.errors);
      custom = checked.values;
    }
    await getDb().update(crmContacts).set({ ...(body.name ? { name: body.name } : {}), ...(body.phone !== undefined ? { phone: body.phone, phoneNormalized: normalizePhone(body.phone) } : {}), ...(body.language ? { language: body.language } : {}), ...(body.companyId !== undefined ? { companyId: body.companyId } : {}), custom, updatedAt: new Date() }).where(eq(crmContacts.id, id));
    await audit(actor, "contact.updated", "contact", id, { fields: Object.keys(body) });
    return json({ ok: true });
  }
  if (request.method !== "GET") throw notFound();
  const contact = await contactAccess(actor, id);
  const db = getDb();
  const leadRows = await db.select({ lead: leads, ownerId: leadOwnership.assignedTo }).from(leads).leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id)).where(eq(leads.contactId, id)).orderBy(leads.createdAt);
  const leadIds = leadRows.map((r) => r.lead.id);
  const dealRows = await db.select().from(crmDeals).where(eq(crmDeals.contactId, id)).orderBy(desc(crmDeals.createdAt));
  const dealIds = dealRows.map((d) => d.id);
  const facts = await dealFacts(db, dealIds);
  // Le proposte nate prima delle trattative restano raggiungibili dalla richiesta.
  const legacyQuotes = leadIds.length ? await db.select({ quote: quotes, record: quoteRecords }).from(quotes).leftJoin(quoteRecords, eq(quoteRecords.quoteId, quotes.id)).where(and(inArray(quotes.leadId, leadIds), sql`${quoteRecords.dealId} is null`)) : [];
  const quoteIds = [...facts.quotes.map((q) => q.quote.id), ...legacyQuotes.map((q) => q.quote.id)];
  const orders = quoteIds.length ? await db.select().from(paymentOrders).where(inArray(paymentOrders.quoteId, quoteIds)) : [];
  const contractRows = quoteIds.length ? await db.select({ id: contracts.id, quoteId: contracts.quoteId, version: contracts.version, acceptedAt: contracts.acceptedAt }).from(contracts).where(inArray(contracts.quoteId, quoteIds)) : [];
  const projectRows = quoteIds.length ? await db.select().from(projects).where(inArray(projects.quoteId, quoteIds)) : [];
  const projectIds = projectRows.map((p) => p.id);
  const deliveries = projectIds.length ? await db.select({ id: projectFiles.id, projectId: projectFiles.projectId, name: projectFiles.name, createdAt: projectFiles.createdAt, version: projectFiles.version }).from(projectFiles).where(and(inArray(projectFiles.projectId, projectIds), eq(projectFiles.kind, "delivery"))) : [];
  const handoffs = projectIds.length ? await db.select().from(crmHandoffs).where(inArray(crmHandoffs.projectId, projectIds)) : [];
  const support = await db.select().from(supportRequests).where(or(eq(supportRequests.contactId, id), projectIds.length ? inArray(supportRequests.projectId, projectIds) : sql`false`));
  const activities = leadIds.length ? await db.select({ a: leadActivities, name: user.name }).from(leadActivities).leftJoin(user, eq(user.id, leadActivities.actorId)).where(inArray(leadActivities.leadId, leadIds)).orderBy(desc(leadActivities.createdAt)).limit(300) : [];
  // Note private: solo chi le ha scritte.
  const notes = leadIds.length ? await db.select({ n: leadNotes, name: user.name }).from(leadNotes).innerJoin(user, eq(user.id, leadNotes.authorId)).where(and(inArray(leadNotes.leadId, leadIds), or(eq(leadNotes.visibility, "team"), eq(leadNotes.authorId, actor.id)))) : [];
  const assignmentRows = await db.select({ a: crmAssignments, to: user.name }).from(crmAssignments).leftJoin(user, eq(user.id, crmAssignments.toUser)).where(or(leadIds.length ? and(eq(crmAssignments.entityType, "lead"), inArray(crmAssignments.entityId, leadIds)) : sql`false`, dealIds.length ? and(eq(crmAssignments.entityType, "deal"), inArray(crmAssignments.entityId, dealIds)) : sql`false`)).orderBy(crmAssignments.createdAt);
  const people = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...new Set([...dealRows.map((d) => d.ownerId), ...leadRows.map((l) => l.ownerId)].filter(Boolean) as string[])].concat(["-"])));
  const nameOf = (uid: string | null | undefined) => people.find((p) => p.id === uid)?.name ?? null;

  const timeline: TimelineItem[] = [];
  for (const { lead } of leadRows) timeline.push({ at: lead.createdAt.toISOString(), kind: "origin", title: `Richiesta da ${lead.sourceKind ?? lead.fonte}${lead.sourceDetail ? ` · ${lead.sourceDetail}` : ""}`, detail: lead.attribution ? JSON.stringify(lead.attribution) : null, href: `/spazio?lead=${lead.id}` });
  for (const { a, to } of assignmentRows) timeline.push({ at: a.createdAt.toISOString(), kind: "assignment", title: a.toUser ? `Assegnato a ${to ?? "un collega"}` : "Rimesso in coda", detail: `${a.method} · ${a.reason}${a.ruleVersion ? ` · regola ${a.ruleVersion}` : ""}` });
  for (const { a, name } of activities) timeline.push({ at: a.createdAt.toISOString(), kind: a.kind === "call" ? "call" : "activity", title: `${a.kind}${a.channel && a.channel !== a.kind ? ` · ${a.channel}` : ""}${a.outcome ? ` · ${a.outcome}` : ""}`, detail: a.structured?.summary ?? a.body, actor: name });
  for (const { n, name } of notes) timeline.push({ at: n.createdAt.toISOString(), kind: n.visibility === "private" ? "private_note" : "note", title: n.visibility === "private" ? "Nota privata" : "Nota", detail: n.body, actor: name });
  for (const { quote, record } of [...facts.quotes, ...legacyQuotes]) {
    timeline.push({ at: quote.createdAt.toISOString(), kind: "quote", title: `Proposta creata (v${record?.version ?? 1})`, href: `/spazio?preventivo=${quote.id}` });
    if (record?.offeredAt) timeline.push({ at: record.offeredAt.toISOString(), kind: "quote_sent", title: "Proposta inviata / resa acquistabile", href: `/spazio?preventivo=${quote.id}` });
    if (record?.acceptedAt) timeline.push({ at: record.acceptedAt.toISOString(), kind: "quote_accepted", title: `Proposta accettata (${record.selectedTier})`, href: `/spazio?preventivo=${quote.id}` });
  }
  for (const c of contractRows) timeline.push({ at: c.acceptedAt.toISOString(), kind: "contract", title: `Contratto v${c.version} concluso`, href: `/spazio?preventivo=${c.quoteId}` });
  for (const o of orders.filter((o) => PAID_STATUSES.includes(o.status))) timeline.push({ at: o.updatedAt.toISOString(), kind: "payment", title: `${o.kind === "deposit" ? "Acconto" : "Saldo"} incassato`, detail: `€ ${(o.amountCents / 100).toFixed(2)}` });
  for (const p of projectRows) {
    timeline.push({ at: p.createdAt.toISOString(), kind: "project", title: "Progetto aperto", detail: p.title, href: `/spazio?progetto=${p.id}` });
    if (p.startedAt) timeline.push({ at: p.startedAt.toISOString(), kind: "work_start", title: "Lavorazione avviata", href: `/spazio?progetto=${p.id}` });
  }
  for (const h of handoffs) timeline.push({ at: h.createdAt.toISOString(), kind: "handoff", title: `Passaggio alla produzione (${h.status})`, href: `/spazio?progetto=${h.projectId}` });
  for (const d of deliveries) timeline.push({ at: d.createdAt.toISOString(), kind: "delivery", title: `Consegna: ${d.name} v${d.version}`, href: `/spazio?progetto=${d.projectId}` });
  for (const s of support) timeline.push({ at: s.createdAt.toISOString(), kind: "support", title: `Assistenza: ${s.subject} (${s.status})`, detail: s.body });
  timeline.sort((a, b) => b.at.localeCompare(a.at));
  const allPipelines = await pipelines();
  const [company] = contact.companyId ? await db.select().from(crmCompanies).where(eq(crmCompanies.id, contact.companyId)) : [];
  const duplicates = await duplicateCandidates([contact], actor);
  return json({
    contact: { ...contact, company: company ?? null },
    summary: {
      requests: leadRows.length,
      openDeals: dealRows.filter((d) => !d.closedAt).length,
      paidCents: orders.filter((o) => PAID_STATUSES.includes(o.status)).reduce((n, o) => n + o.amountCents, 0),
      projects: projectRows.length,
      firstSource: leadRows[0] ? { kind: leadRows[0].lead.sourceKind ?? leadRows[0].lead.fonte, attribution: leadRows[0].lead.attribution } : null,
      lastSource: leadRows.at(-1) ? { kind: leadRows.at(-1)!.lead.sourceKind ?? leadRows.at(-1)!.lead.fonte, attribution: leadRows.at(-1)!.lead.attribution } : null,
    },
    related: {
      leads: leadRows.map(({ lead, ownerId }) => ({ id: lead.id, createdAt: lead.createdAt, source: lead.sourceKind ?? lead.fonte, priority: lead.priority, assignmentStatus: lead.assignmentStatus, owner: nameOf(ownerId) })),
      deals: dealRows.map((d) => ({ id: d.id, title: d.title, owner: nameOf(d.ownerId), ownerId: d.ownerId, nextAction: d.nextAction, nextActionAt: d.nextActionAt, ...dealStage(d, allPipelines.find((p) => p.key === d.pipelineKey) ?? allPipelines[0]!, facts) })),
      quotes: quoteIds,
      projects: projectRows.map((p) => ({ id: p.id, title: p.title, stage: p.stage, opsStatus: p.opsStatus })),
      support: support.map((s) => ({ id: s.id, subject: s.subject, status: s.status })),
    },
    duplicates,
    timeline,
    fields: await fieldDefinitions("contact"),
  });
}

/** Possibili doppioni: email, telefono, account o partita IVA in comune; il solo nome è un avviso non unibile. */
async function duplicateCandidates(subjects: Array<typeof crmContacts.$inferSelect>, actor: Actor) {
  if (!subjects.length) return [];
  const phones = subjects.map((s) => s.phoneNormalized).filter(Boolean) as string[];
  const firstWords = subjects.map((s) => s.name.split(/\s+/).at(-1)!.toLowerCase()).filter((w) => w.length > 2);
  const others = await getDb()
    .select()
    .from(crmContacts)
    .where(and(isNull(crmContacts.mergedIntoId), contactPredicate(actor), or(phones.length ? inArray(crmContacts.phoneNormalized, phones) : sql`false`, ...firstWords.map((w) => ilike(crmContacts.name, `%${w}%`)), sql`${crmContacts.userId} is not null and ${crmContacts.userId} in (${sql.join(subjects.map((s) => sql`${s.userId ?? "-"}`), sql`, `)})`)))
    .limit(200);
  const asRecord = (c: typeof crmContacts.$inferSelect): DedupRecord => ({ id: c.id, email: c.email, phone: c.phone, userId: c.userId, name: c.name });
  const out: Array<{ a: string; b: string; aName: string; bName: string; reasons: string[]; mergeable: boolean }> = [];
  for (const s of subjects)
    for (const o of others) {
      if (o.id === s.id || out.some((x) => (x.a === o.id && x.b === s.id) || (x.a === s.id && x.b === o.id))) continue;
      const reasons = matchReasons(asRecord(s), asRecord(o));
      if (reasons.length) out.push({ a: s.id, b: o.id, aName: s.name, bName: o.name, reasons, mergeable: mergeable(reasons) });
    }
  return out;
}
export async function duplicateCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "crm.read");
  const recent = await getDb().select().from(crmContacts).where(and(isNull(crmContacts.mergedIntoId), contactPredicate(actor))).orderBy(desc(crmContacts.updatedAt)).limit(300);
  return json({ duplicates: await duplicateCandidates(recent, actor) });
}
/**
 * Unione controllata: solo con un dato identificativo in comune (mai il solo
 * nome), con motivo, da chi ha il permesso. Richieste, trattative e assistenza
 * passano alla scheda che resta; quella unita rimane con il rimando e la fotografia.
 */
export async function contactMerge(request: Request, actor: Actor, targetId: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "crm.merge");
  const body = await readBody(request, z.object({ sourceId: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).strict());
  if (body.sourceId === targetId) throw new PlatformError(422, "SAME_CONTACT", "Scegli due schede diverse.");
  const result = await getDb().transaction(async (tx) => {
    const [target] = await tx.select().from(crmContacts).where(and(eq(crmContacts.id, targetId), isNull(crmContacts.mergedIntoId))).for("update");
    const [source] = await tx.select().from(crmContacts).where(and(eq(crmContacts.id, body.sourceId), isNull(crmContacts.mergedIntoId))).for("update");
    if (!target || !source) throw notFound();
    const companies = [target.companyId, source.companyId].filter(Boolean) as string[];
    const vat = companies.length ? await tx.select({ id: crmCompanies.id, vat: crmCompanies.vatNumber }).from(crmCompanies).where(inArray(crmCompanies.id, companies)) : [];
    const reasons = matchReasons(
      { id: target.id, email: target.email, phone: target.phone, userId: target.userId, name: target.name, vatNumber: vat.find((v) => v.id === target.companyId)?.vat ?? null },
      { id: source.id, email: source.email, phone: source.phone, userId: source.userId, name: source.name, vatNumber: vat.find((v) => v.id === source.companyId)?.vat ?? null },
    );
    if (!mergeable(reasons)) throw new PlatformError(409, "MERGE_NOT_ALLOWED", reasons.includes("name_only") ? "Le due schede hanno solo il nome in comune: non si uniscono. Serve un dato identificativo (email, telefono, account o partita IVA)." : "Le due schede non hanno dati identificativi in comune.");
    if (target.userId && source.userId && target.userId !== source.userId) throw new PlatformError(409, "MERGE_NOT_ALLOWED", "Le schede sono collegate a due account diversi.");
    const moved = {
      leads: (await tx.update(leads).set({ contactId: target.id }).where(eq(leads.contactId, source.id)).returning({ id: leads.id })).length,
      deals: (await tx.update(crmDeals).set({ contactId: target.id }).where(eq(crmDeals.contactId, source.id)).returning({ id: crmDeals.id })).length,
      support: (await tx.update(supportRequests).set({ contactId: target.id }).where(eq(supportRequests.contactId, source.id)).returning({ id: supportRequests.id })).length,
    };
    await tx.update(crmContacts).set({ mergedIntoId: target.id, updatedAt: new Date() }).where(eq(crmContacts.id, source.id));
    await tx.update(crmContacts).set({ phone: target.phone ?? source.phone, phoneNormalized: target.phoneNormalized ?? source.phoneNormalized, userId: target.userId ?? source.userId, identityVerifiedAt: target.identityVerifiedAt ?? source.identityVerifiedAt, companyId: target.companyId ?? source.companyId, custom: { ...source.custom, ...target.custom }, updatedAt: new Date() }).where(eq(crmContacts.id, target.id));
    await tx.insert(crmMerges).values({ targetId: target.id, sourceId: source.id, matchedOn: reasons, reason: body.reason, snapshot: source as unknown as Record<string, unknown>, actorId: actor.id });
    return { matchedOn: reasons, moved };
  });
  await audit(actor, "contact.merged", "contact", targetId, { sourceId: body.sourceId, ...result });
  return json({ ok: true, ...result });
}

export async function companyCollection(request: Request, actor: Actor, id?: string) {
  if (request.method === "GET" && !id) {
    demandAvailable(actor, "crm.read");
    return json({ companies: await getDb().select().from(crmCompanies).orderBy(crmCompanies.name).limit(300) });
  }
  demandAvailable(actor, "crm.write");
  const schema = z.object({ name: z.string().trim().min(2).max(200), vatNumber: z.string().trim().max(40).nullable().optional(), website: z.string().trim().url().max(300).nullable().optional(), custom: z.record(z.unknown()).optional() }).strict();
  if (request.method === "POST" && !id) {
    const body = await readBody(request, schema);
    const checked = validateCustomFields(await fieldDefinitions("company"), body.custom ?? {});
    if (Object.keys(checked.errors).length) throw new PlatformError(422, "VALIDATION_ERROR", "Controlla i campi personalizzati.", checked.errors);
    const [company] = await getDb().insert(crmCompanies).values({ ...body, custom: checked.values }).returning();
    await audit(actor, "company.created", "company", company!.id);
    return json({ company }, 201);
  }
  if (request.method === "PATCH" && id) {
    const body = await readBody(request, schema.partial());
    await getDb().update(crmCompanies).set({ ...body, custom: undefined, updatedAt: new Date() }).where(eq(crmCompanies.id, id));
    return json({ ok: true });
  }
  throw notFound();
}
export async function savedViews(request: Request, actor: Actor, id?: string) {
  demandAvailable(actor, "crm.read");
  if (request.method === "GET" && !id) return json({ views: await getDb().select().from(crmSavedViews).where(eq(crmSavedViews.userId, actor.id)).orderBy(crmSavedViews.name) });
  if (request.method === "POST" && !id) {
    const body = await readBody(request, z.object({ entity: z.enum(["contacts", "deals", "leads", "work"]), name: z.string().trim().min(2).max(80), filters: z.record(z.string().max(100)).refine((f) => Object.keys(f).length <= 12), layout: z.enum(["table", "kanban", "calendar"]).default("table") }).strict());
    const count = await getDb().select({ n: sql<number>`count(*)::int` }).from(crmSavedViews).where(eq(crmSavedViews.userId, actor.id));
    if (Number(count[0]?.n ?? 0) >= 50) throw new PlatformError(409, "TOO_MANY_VIEWS", "Hai già 50 viste salvate.");
    const [view] = await getDb().insert(crmSavedViews).values({ ...body, userId: actor.id }).returning();
    return json({ view }, 201);
  }
  if (request.method === "DELETE" && id) {
    await getDb().delete(crmSavedViews).where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.userId, actor.id)));
    return json({ ok: true });
  }
  throw notFound();
}
