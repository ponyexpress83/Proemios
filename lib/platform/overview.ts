import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { quoteRecords, leadOwnership, paymentOrders, projects, projectMembers, projectFiles, approvals, tasks, invoices, commissions, refundRequests, platformSettings } from "@/db/platform-schema";
import { json, notFound } from "./http";
import { leadPredicate, projectPredicate, type Actor } from "./access";
import { can, hasPermission } from "./permissions";
import { journeyStage } from "./commercial";
import { funnelSummary } from "./funnel";

/**
 * "Oggi" per ogni ruolo: poche righe operative, calcolate dallo stato reale e
 * limitate ai dati che la persona può già vedere. Il venditore vede i suoi
 * contatti, l'editor i suoi progetti, Finance le anomalie, il proprietario le
 * priorità e le decisioni che aspettano lui.
 */
export type TodayItem = { kind: string; title: string; detail: string; href?: string; urgency: "high" | "normal" | "info"; at?: string };
const DAY = 86400_000;
const daysAgo = (d: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / DAY) : 0);
const money = (cents: number) => `€ ${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
export async function overviewCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  if (!actor.staff) throw notFound();
  const items: TodayItem[] = [];
  const result: Record<string, unknown> = {};
  if (hasPermission(actor.grants, "crm.read")) {
    const rows = await getDb()
      .select({ lead: leads, quote: quotes, record: quoteRecords, ownership: leadOwnership })
      .from(leads)
      .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
      .leftJoin(quotes, eq(quotes.leadId, leads.id))
      .leftJoin(quoteRecords, eq(quoteRecords.quoteId, quotes.id))
      .where(and(leadPredicate(actor, "crm.read"), sql`${leads.stage} not in ('won','lost','unreachable')`))
      .orderBy(desc(leads.createdAt))
      .limit(300);
    const quoteIds = rows.map((r) => r.quote?.id).filter((x): x is string => Boolean(x));
    const orders = quoteIds.length ? await getDb().select({ quoteId: paymentOrders.quoteId, kind: paymentOrders.kind, status: paymentOrders.status }).from(paymentOrders).where(inArray(paymentOrders.quoteId, quoteIds)) : [];
    const seen = new Set<string>();
    for (const r of rows) {
      const key = r.quote?.id ?? `lead:${r.lead.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const href = r.quote ? `/spazio?preventivo=${r.quote.id}` : `/spazio?lead=${r.lead.id}`;
      const who = r.lead.nome;
      // Prossima azione concordata sul contatto: scaduta o in scadenza viene prima di tutto.
      if (r.lead.nextActionAt && r.lead.nextActionAt.getTime() < Date.now() + DAY) items.push({ kind: "next-action", title: `${r.lead.nextAction ?? "Prossima azione"}: ${who}`, detail: `${r.lead.nextActionAt.getTime() < Date.now() ? "Scaduta il" : "Entro il"} ${r.lead.nextActionAt.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}${r.lead.sourceDetail ? ` · ${r.lead.sourceDetail}` : ""}`, href: `/spazio?lead=${r.lead.id}`, urgency: r.lead.nextActionAt.getTime() < Date.now() ? "high" : "normal", at: r.lead.nextActionAt.toISOString() });
      if (r.lead.stage === "recovery") items.push({ kind: "recovery", title: `Da recuperare: ${who}`, detail: `Pagamento non concluso. Canali ammessi: ${r.lead.contactPreferences ? ["phone", "whatsapp", "sms", "email"].filter((c) => r.lead.contactPreferences?.[c as "phone"]).join(", ") || "nessuno" : "da verificare"}.`, href: `/spazio?lead=${r.lead.id}`, urgency: "high", at: r.lead.updatedAt.toISOString() });
      else if (r.lead.stage === "negotiation") items.push({ kind: "negotiation", title: `In negoziazione: ${who}`, detail: r.lead.nextAction ?? "Proposta in trattativa: ogni variazione è una nuova versione.", href, urgency: "normal", at: r.lead.updatedAt.toISOString() });
      if (!r.quote || !r.record) {
        items.push({ kind: "lead", title: `Crea la proposta per ${who}`, detail: `Contatto del ${r.lead.createdAt.toLocaleDateString("it-IT")}${r.lead.note ? ` · ${r.lead.note.slice(0, 80)}` : ""}`, href, urgency: daysAgo(r.lead.createdAt) >= 2 ? "high" : "normal", at: r.lead.createdAt.toISOString() });
        continue;
      }
      const stage = journeyStage(r.record, orders.filter((o) => o.quoteId === r.quote!.id));
      if (stage === "review") items.push({ kind: "review", title: `Valuta e rendi acquistabile: ${who}`, detail: `Richiesta del ${r.record.reviewRequestedAt?.toLocaleDateString("it-IT") ?? "oggi"}${r.record.reviewNote ? ` · "${r.record.reviewNote.slice(0, 100)}"` : ""}`, href, urgency: "high", at: r.record.reviewRequestedAt?.toISOString() });
      else if (stage === "estimate" && daysAgo(r.quote.createdAt) >= 2) items.push({ kind: "estimate", title: `Proponi la proposta definitiva a ${who}`, detail: `Stima di ${daysAgo(r.quote.createdAt)} giorni fa, nessuna richiesta dall'autore.`, href, urgency: "normal", at: r.quote.createdAt.toISOString() });
      else if (stage === "offer") {
        const expiry = r.record.expiresAt ? Math.ceil((r.record.expiresAt.getTime() - Date.now()) / DAY) : null;
        if (expiry !== null && expiry <= 2) items.push({ kind: "expiring", title: `La proposta di ${who} scade ${expiry <= 0 ? "oggi" : `tra ${expiry} giorni`}`, detail: "Ricontatta o estendi la validità con una nuova offerta.", href, urgency: "high", at: r.record.expiresAt?.toISOString() });
        else if (daysAgo(r.record.offeredAt ?? r.quote.createdAt) >= 3) items.push({ kind: "followup", title: `Ricontatta ${who}`, detail: `Proposta acquistabile da ${daysAgo(r.record.offeredAt ?? r.quote.createdAt)} giorni, non ancora confermata.`, href, urgency: "normal", at: (r.record.offeredAt ?? r.quote.createdAt).toISOString() });
      } else if (stage === "expired") items.push({ kind: "expired", title: `Proposta scaduta: ${who}`, detail: "Rinnova l'offerta se il contatto è ancora interessato.", href, urgency: "normal" });
      else if (stage === "accepted") items.push({ kind: "unpaid", title: `Sollecita l'acconto di ${who}`, detail: `Accettata il ${r.record.acceptedAt?.toLocaleDateString("it-IT")}, acconto non ancora confermato.${r.record.remindersPausedAt ? " Promemoria in pausa." : ""}`, href, urgency: daysAgo(r.record.acceptedAt) >= 3 ? "high" : "normal", at: r.record.acceptedAt?.toISOString() });
      else if (stage === "processing") items.push({ kind: "processing", title: `Pagamento in elaborazione: ${who}`, detail: "Stripe deve ancora confermare. Nessuna azione.", href, urgency: "info" });
      else if (stage === "deposit_paid") items.push({ kind: "handover", title: `In carico al team: ${who}`, detail: "Acconto confermato: il progetto è nella produzione.", href, urgency: "info" });
    }
  }
  if (hasPermission(actor.grants, "project.read")) {
    const rows = await getDb().select().from(projects).where(and(await projectPredicate(actor), sql`${projects.stage} <> 'delivered'`)).orderBy(desc(projects.updatedAt)).limit(200);
    const ids = rows.map((p) => p.id);
    const [files, members, decided, due] = ids.length
      ? await Promise.all([
          getDb().select({ projectId: projectFiles.projectId, kind: projectFiles.kind, status: projectFiles.status, id: projectFiles.id, name: projectFiles.name, version: projectFiles.version, createdAt: projectFiles.createdAt }).from(projectFiles).where(and(inArray(projectFiles.projectId, ids), sql`${projectFiles.status} <> 'deleted'`)),
          getDb().select({ projectId: projectMembers.projectId, userId: projectMembers.userId, name: user.name }).from(projectMembers).innerJoin(user, eq(user.id, projectMembers.userId)).where(inArray(projectMembers.projectId, ids)),
          getDb().select({ fileId: approvals.fileId }).from(approvals).where(inArray(approvals.projectId, ids)),
          getDb().select({ id: tasks.id, projectId: tasks.projectId, title: tasks.title, dueAt: tasks.dueAt, assignedTo: tasks.assignedTo }).from(tasks).where(and(inArray(tasks.projectId, ids), eq(tasks.done, false), lt(tasks.dueAt, new Date(Date.now() + 3 * DAY)))),
        ])
      : [[], [], [], []];
    const decidedIds = new Set(decided.map((d) => d.fileId));
    const authors = ids.length ? await getDb().select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...new Set(rows.map((p) => p.authorId))])) : [];
    const authorName = (id: string) => authors.find((a) => a.id === id)?.name ?? "autore";
    for (const p of rows) {
      const own = files.filter((f) => f.projectId === p.id);
      const team = members.filter((m) => m.projectId === p.id);
      const href = `/spazio?progetto=${p.id}`;
      if (can(actor.grants, "project.assign") && !team.length) items.push({ kind: "assign", title: `Da assegnare: ${p.title}`, detail: `Progetto di ${authorName(p.authorId)} senza editor.`, href, urgency: "high", at: p.updatedAt.toISOString() });
      if (p.stage === "materials" && !own.some((f) => f.kind === "manuscript")) items.push({ kind: "waiting-materials", title: `In attesa dei materiali: ${p.title}`, detail: `${authorName(p.authorId)} non ha ancora caricato il manoscritto${daysAgo(p.updatedAt) >= 7 ? ` da ${daysAgo(p.updatedAt)} giorni: bloccato` : ""}.`, href, urgency: daysAgo(p.updatedAt) >= 7 ? "high" : "info", at: p.updatedAt.toISOString() });
      if (own.some((f) => f.kind === "manuscript" && f.status === "quarantine")) items.push({ kind: "quarantine", title: `Materiali in controllo: ${p.title}`, detail: "Un file aspetta la verifica di sicurezza prima di essere aperto.", href, urgency: "info" });
      if (p.stage === "editing") items.push({ kind: "editing", title: `In lavorazione: ${p.title}`, detail: p.dueAt ? `Consegna confermata il ${p.dueAt.toLocaleDateString("it-IT")}.` : "Nessuna data di consegna confermata: impostala nel progetto.", href, urgency: p.dueAt && p.dueAt.getTime() < Date.now() + 3 * DAY ? "high" : "normal", at: p.dueAt?.toISOString() });
      const awaiting = own.filter((f) => f.kind === "delivery" && f.status === "ready" && !decidedIds.has(f.id));
      if (awaiting.length) items.push({ kind: "awaiting-approval", title: `In attesa dell'autore: ${p.title}`, detail: `${awaiting.length} ${awaiting.length === 1 ? "consegna aspetta" : "consegne aspettano"} l'approvazione di ${authorName(p.authorId)}${daysAgo(awaiting[0]!.createdAt) >= 5 ? ` da ${daysAgo(awaiting[0]!.createdAt)} giorni` : ""}.`, href, urgency: daysAgo(awaiting[0]!.createdAt) >= 5 ? "normal" : "info" });
      for (const t of due.filter((t) => t.projectId === p.id && (!t.assignedTo || t.assignedTo === actor.id))) items.push({ kind: "task", title: `Attività in scadenza: ${t.title}`, detail: `${p.title} · ${t.dueAt ? t.dueAt.toLocaleDateString("it-IT") : "senza data"}`, href, urgency: t.dueAt && t.dueAt.getTime() < Date.now() ? "high" : "normal", at: t.dueAt?.toISOString() });
    }
    if (can(actor.grants, "project.assign")) {
      const load = new Map<string, { name: string; count: number }>();
      for (const m of members) load.set(m.userId, { name: m.name, count: (load.get(m.userId)?.count ?? 0) + 1 });
      result.capacity = [...load.values()].sort((a, b) => b.count - a.count);
    }
  }
  if (hasPermission(actor.grants, "finance.read")) {
    const [failedInvoices, troubledOrders, pendingCommissions, refunds] = await Promise.all([
      getDb().select().from(invoices).where(inArray(invoices.status, ["retry", "failed"])).limit(50),
      getDb().select().from(paymentOrders).where(inArray(paymentOrders.status, ["disputed", "review_required"])).limit(50),
      getDb().select({ count: sql<number>`count(*)::integer`, total: sql<number>`coalesce(sum(${commissions.amountCents}),0)::integer` }).from(commissions).where(eq(commissions.status, "pending")),
      getDb().select().from(refundRequests).where(eq(refundRequests.status, "prepared")).limit(50),
    ]);
    for (const f of failedInvoices) items.push({ kind: "invoice", title: `Fattura ${f.status === "failed" ? "non emessa" : "in nuovo tentativo"}: ${f.kind === "deposit" ? "acconto" : "saldo"} ${money(f.grossCents)}`, detail: f.error?.slice(0, 120) ?? "Errore di emissione.", href: "/spazio", urgency: f.status === "failed" ? "high" : "normal", at: f.updatedAt.toISOString() });
    for (const o of troubledOrders) items.push({ kind: "order", title: `Ordine ${o.status === "disputed" ? "contestato" : "da verificare"}: ${money(o.amountCents)}`, detail: `${o.kind === "deposit" ? "Acconto" : "Saldo"} · proposta ${o.quoteId.slice(0, 8)}`, href: `/spazio?preventivo=${o.quoteId}`, urgency: "high", at: o.updatedAt.toISOString() });
    if (pendingCommissions[0]?.count) items.push({ kind: "commissions", title: `${pendingCommissions[0].count} commissioni da liquidare`, detail: `${money(pendingCommissions[0].total)} maturati su incassi confermati. La liquidazione richiede la delega "commission.pay".`, href: "/spazio", urgency: "info" });
    for (const r of refunds) items.push({ kind: "refund", title: `Rettifica preparata: ${money(r.amountCents)}`, detail: r.reason.slice(0, 120), href: "/spazio", urgency: "normal", at: r.createdAt.toISOString() });
  }
  if (hasPermission(actor.grants, "settings.manage")) {
    const since = new Date(Date.now() - DAY);
    const [newLeads] = await getDb().select({ count: sql<number>`count(*)::integer` }).from(leads).where(gte(leads.createdAt, since));
    const [reviews] = await getDb().select({ count: sql<number>`count(*)::integer` }).from(quoteRecords).where(eq(quoteRecords.commercialState, "review"));
    const [offers] = await getDb().select({ count: sql<number>`count(*)::integer` }).from(quoteRecords).where(and(eq(quoteRecords.commercialState, "offer"), isNull(quoteRecords.acceptedAt)));
    const accepted = await getDb().select({ quoteId: quoteRecords.quoteId, acceptedAt: quoteRecords.acceptedAt }).from(quoteRecords).where(eq(quoteRecords.commercialState, "accepted"));
    const paidDeposits = accepted.length ? await getDb().select({ quoteId: paymentOrders.quoteId }).from(paymentOrders).where(and(inArray(paymentOrders.quoteId, accepted.map((a) => a.quoteId)), eq(paymentOrders.kind, "deposit"), eq(paymentOrders.status, "paid"))) : [];
    const unpaid = accepted.filter((a) => !paidDeposits.some((p) => p.quoteId === a.quoteId));
    const [blocked] = await getDb().select({ count: sql<number>`count(*)::integer` }).from(projects).where(and(eq(projects.stage, "materials"), lt(projects.updatedAt, new Date(Date.now() - 7 * DAY))));
    const [failedInvoices] = await getDb().select({ count: sql<number>`count(*)::integer` }).from(invoices).where(eq(invoices.status, "failed"));
    const settings = await getDb().select({ key: platformSettings.key }).from(platformSettings);
    const has = (k: string) => settings.some((s) => s.key === k);
    result.summary = { newLeads24h: newLeads?.count ?? 0, awaitingReview: reviews?.count ?? 0, openOffers: offers?.count ?? 0, acceptedUnpaid: unpaid.length, blockedProjects: blocked?.count ?? 0, failedInvoices: failedInvoices?.count ?? 0 };
    result.decisions = [
      ...(has("payment-policy") ? [] : [{ title: "Conferma la policy IVA", detail: "Le proposte usano la policy predefinita (IVA 22% esclusa). Salvane una in Regole economiche per renderla tua.", href: "/spazio" }]),
      ...(has("commission-rule") ? [] : [{ title: "Decidi la regola delle commissioni", detail: "Senza regola, venditori e affiliati non maturano provvigioni.", href: "/spazio" }]),
      ...(has("purchase-rule") ? [] : [{ title: "Conferma quali servizi sono acquistabili subito", detail: "Oggi vale la regola prudente: solo i servizi singoli a prezzo fisso; tutto il resto passa dal team.", href: "/spazio" }]),
      ...(has("reminder-rules") ? [] : [{ title: "Rivedi i promemoria automatici", detail: "Attivi con le soglie predefinite (3/7 giorni, 2/5 giorni dopo l'accettazione). Puoi cambiarle o spegnerli.", href: "/spazio" }]),
    ];
    result.funnel = await funnelSummary(30);
  }
  const rank = { high: 0, normal: 1, info: 2 };
  items.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.at ?? "").localeCompare(b.at ?? ""));
  return json({ today: items.slice(0, 60), ...result });
}
