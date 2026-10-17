/**
 * Attribuzione delle vendite: istantanea all'accettazione (contratto), con
 * percorso, motivi, prove e versione della regola. Il cambio di responsabile
 * dopo la vendita non tocca l'istantanea; le correzioni sono nuove versioni,
 * autorizzate e motivate, e le provvigioni già maturate si correggono con
 * storni e nuove righe, mai cancellando la storia.
 */
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { crmAttributions, crmContacts, crmDeals, crmShareLinks } from "@/db/crm-schema";
import { affiliateConversions, commissions, leadActivities, memberships, paymentOrders, quoteRecords } from "@/db/platform-schema";
import { decideAttribution, type ContactDeal, type SalePath } from "@/lib/crm-core/attribution";
import { attributionRulesSchema, defaultAttributionRules } from "@/lib/crm-core/rules";
import { normalizeEmail } from "@/lib/crm-core/dedup";
import { commissionRuleSchema, paymentPolicySchema } from "./config";
import { can } from "./permissions";
import { demand, demandAvailable, demandRecent, audit, type Actor } from "./access";
import { json, notFound, PlatformError, readBody } from "./http";
import { dealFacts, dealStage, emitEvent, pipelines, readSetting, type Reader, type Tx } from "./crm-relations";
import { notify } from "./crm-notify";
import { PAID_STATUSES } from "./pipeline";

export const attributionRules = (db: Reader = getDb()) => readSetting("attribution-rules", attributionRulesSchema, defaultAttributionRules, db);

/** Lega il contatto all'account solo se l'email verificata della sessione coincide. */
export async function verifyContactIdentity(tx: Tx, contactId: string, buyer: { id: string; email: string }) {
  const [contact] = await tx.select().from(crmContacts).where(eq(crmContacts.id, contactId));
  if (!contact || contact.emailNormalized !== normalizeEmail(buyer.email)) return false;
  if (contact.userId && contact.userId !== buyer.id) return false;
  if (!contact.userId) await tx.update(crmContacts).set({ userId: buyer.id, identityVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(crmContacts.id, contactId));
  return true;
}
/** Istantanea dell'attribuzione: una volta per proposta (idempotente). */
export async function snapshotAttribution(tx: Tx, quoteId: string, buyer: { id: string; email: string }) {
  const [existing] = await tx.select().from(crmAttributions).where(and(eq(crmAttributions.quoteId, quoteId), eq(crmAttributions.current, true)));
  if (existing) return existing;
  const [record] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, quoteId));
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!record || !quote) return null;
  const [lead] = await tx.select().from(leads).where(eq(leads.id, quote.leadId));
  const dealId = record.dealId ?? lead?.dealId ?? null;
  const [deal] = dealId ? await tx.select().from(crmDeals).where(eq(crmDeals.id, dealId)) : [];
  const contactId = deal?.contactId ?? lead?.contactId ?? null;
  const identityVerified = contactId ? await verifyContactIdentity(tx, contactId, buyer) : false;
  const rules = await attributionRules(tx);
  const commissionRule = commissionRuleSchema.safeParse(record.commissionPolicy);
  // Altre trattative dello stesso cliente, con lo stato calcolato dai fatti.
  const others = contactId ? await tx.select().from(crmDeals).where(and(eq(crmDeals.contactId, contactId), dealId ? ne(crmDeals.id, dealId) : sql`true`)) : [];
  const facts = await dealFacts(tx, others.map((d) => d.id));
  const allPipelines = await pipelines(tx);
  const owners = others.map((d) => d.ownerId).filter(Boolean) as string[];
  const activeOwners = owners.length ? await tx.select({ userId: memberships.userId }).from(memberships).where(and(inArray(memberships.userId, owners), eq(memberships.active, true))) : [];
  const otherDeals: ContactDeal[] = others.map((d) => {
    const state = dealStage(d, allPipelines.find((p) => p.key === d.pipelineKey) ?? allPipelines[0]!, facts);
    const paidAt = facts.orders.filter((o) => facts.quotes.some((q) => q.record.dealId === d.id && q.quote.id === o.quoteId) && PAID_STATUSES.includes(o.status)).map((o) => o.updatedAt.getTime());
    return { dealId: d.id, ownerId: d.ownerId, ownerActive: activeOwners.some((a) => a.userId === d.ownerId), status: state.status, lastActivityAt: d.lastActivityAt, closedAt: state.status === "open" ? null : d.closedAt ?? (paidAt.length ? new Date(Math.max(...paidAt)) : d.updatedAt) };
  });
  const [link] = record.originLinkId ? await tx.select().from(crmShareLinks).where(eq(crmShareLinks.id, record.originLinkId)) : [];
  const [contact] = contactId ? await tx.select().from(crmContacts).where(eq(crmContacts.id, contactId)) : [];
  const [referral] = await tx.select().from(affiliateConversions).where(eq(affiliateConversions.quoteId, quoteId));
  const contactLeads = contactId ? await tx.select({ attribution: leads.attribution, sourceKind: leads.sourceKind, createdAt: leads.createdAt }).from(leads).where(eq(leads.contactId, contactId)).orderBy(leads.createdAt) : [];
  const path: SalePath = link?.kind === "package" ? "package_link" : record.createdBy ? "custom_quote" : otherDeals.some((d) => d.status === "won") ? "later_purchase" : "self_serve";
  const decision = decideAttribution(
    {
      path,
      now: new Date(),
      buyerUserId: buyer.id,
      identityVerified,
      dealId,
      dealOwnerId: deal?.ownerId ?? null,
      salesAssisted: record.salesAssisted,
      link: link ? { createdBy: link.createdBy, dealId: link.dealId, buyerEmailMatchesContact: Boolean(contact && contact.emailNormalized === normalizeEmail(buyer.email)) } : null,
      otherDeals,
      affiliateId: referral?.affiliateId ?? null,
      sourcerId: lead?.sourcedBy ?? null,
      marketing: { first: (contactLeads[0]?.attribution as Record<string, unknown>) ?? null, last: (lead?.attribution as Record<string, unknown>) ?? null, campaignId: ((lead?.attribution as { campaignId?: string } | null)?.campaignId as string) ?? null, channel: lead?.sourceKind ?? lead?.fonte ?? null },
    },
    rules,
  );
  const [saved] = await tx
    .insert(crmAttributions)
    .values({ quoteId, version: 1, current: true, dealId, contactId, path: decision.path, marketing: { first: contactLeads[0]?.attribution ?? null, last: lead?.attribution ?? null, firstSource: contactLeads[0]?.sourceKind ?? null, lastSource: lead?.sourceKind ?? lead?.fonte ?? null }, affiliateId: decision.affiliateId, sourcerId: decision.sourcerId, ownerAtSale: decision.ownerAtSale, creditedSellerId: decision.creditedSellerId, closing: decision.closing, status: decision.status, reasons: decision.reasons, conflicts: decision.conflicts, beneficiaries: decision.beneficiaries, ruleVersion: decision.ruleVersion, commissionRuleVersion: commissionRule.success ? commissionRule.data.version : null })
    .onConflictDoNothing()
    .returning();
  if (saved && decision.status === "conflict") {
    const managers = await tx.select({ userId: memberships.userId, role: memberships.role }).from(memberships).where(and(eq(memberships.active, true), inArray(memberships.role, ["owner", "admin", "finance"])));
    for (const m of [...new Set(managers.map((x) => x.userId))]) await notify(tx, m, "attribution_conflict", { key: quoteId, title: "Attribuzione da decidere", body: "Una vendita ha più venditori con una relazione recente con il cliente: la provvigione del venditore resta sospesa finché non viene decisa.", href: `/spazio?preventivo=${quoteId}` });
    if (lead) await tx.insert(leadActivities).values({ leadId: lead.id, dealId, kind: "attribution", body: `Conflitto di attribuzione: ${decision.conflicts.map((c) => c.detail).join(" ")}`, outcome: "conflict" });
  }
  return saved ?? null;
}
/** Beneficiari di provvigione per un incasso, dall'istantanea corrente (o null se non esiste). */
export async function commissionBeneficiaries(tx: Tx, quoteId: string, assistedSalesOnly: boolean) {
  const [current] = await tx.select().from(crmAttributions).where(and(eq(crmAttributions.quoteId, quoteId), eq(crmAttributions.current, true)));
  if (!current) return null;
  const seller = current.status === "final" && current.beneficiaries.seller && (!assistedSalesOnly || current.closing === "assisted") ? current.beneficiaries.seller : null;
  return { seller, affiliate: current.beneficiaries.affiliate, status: current.status, version: current.version };
}
const net = (amount: number, vatMode: string, vatRateBps: number) => (vatMode === "exempt" ? amount : Math.round((amount * 10000) / (10000 + vatRateBps)));

/** Correzione autorizzata: nuova versione + rettifiche delle provvigioni già maturate. */
export async function attributionCorrect(request: Request, actor: Actor, quoteId: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "attribution.correct");
  demandRecent(actor);
  const body = await readBody(request, z.object({ creditedSellerId: z.string().min(1).max(100).nullable(), closing: z.enum(["assisted", "autonomous"]), affiliateId: z.string().min(1).max(100).nullable().optional(), reason: z.string().trim().min(10).max(1000) }).strict());
  const result = await getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(crmAttributions).where(and(eq(crmAttributions.quoteId, quoteId), eq(crmAttributions.current, true))).for("update");
    if (!current) throw notFound();
    if (body.creditedSellerId) {
      const [seller] = await tx.select().from(memberships).where(and(eq(memberships.userId, body.creditedSellerId), eq(memberships.role, "seller")));
      if (!seller) throw new PlatformError(422, "INVALID_SELLER", "Scegli un venditore.");
    }
    const [record] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, quoteId));
    const rule = commissionRuleSchema.safeParse(record?.commissionPolicy), tax = paymentPolicySchema.safeParse(record?.taxPolicy);
    const affiliate = body.affiliateId !== undefined ? body.affiliateId : current.beneficiaries.affiliate;
    const seller = body.creditedSellerId && rule.success && (!rule.data.assistedSalesOnly || body.closing === "assisted") ? body.creditedSellerId : null;
    const version = current.version + 1;
    await tx.update(crmAttributions).set({ current: false }).where(eq(crmAttributions.id, current.id));
    const [next] = await tx
      .insert(crmAttributions)
      .values({ ...current, id: undefined, version, current: true, creditedSellerId: body.creditedSellerId, closing: body.closing, status: "final", affiliateId: affiliate, beneficiaries: { seller: body.creditedSellerId, affiliate: affiliate && affiliate !== body.creditedSellerId ? affiliate : null }, reasons: [...current.reasons, { code: "correction", detail: body.reason }], conflicts: current.conflicts, correctedBy: actor.id, correctionReason: body.reason, createdAt: new Date() })
      .returning();
    // Provvigioni già maturate sugli incassi: storno di chi non spetta più, nuova riga per chi spetta.
    let adjusted = 0;
    if (rule.success && tax.success) {
      const orders = await tx.select().from(paymentOrders).where(and(eq(paymentOrders.quoteId, quoteId), inArray(paymentOrders.status, PAID_STATUSES)));
      for (const order of orders) {
        const rows = await tx.select().from(commissions).where(eq(commissions.orderId, order.id));
        const intent = order.stripePaymentIntentId ?? order.id;
        for (const [kind, who, bps] of [["seller", seller, rule.data.sellerBps], ["affiliate", next!.beneficiaries.affiliate, rule.data.affiliateBps]] as const) {
          const originals = rows.filter((c) => c.amountCents > 0 && (c.eventKey === `commission:${intent}:${kind}` || c.eventKey.startsWith(`commission:${intent}:${kind}:v`)));
          for (const original of originals) {
            const reversed = rows.filter((c) => c.eventKey.startsWith(`reverse:${original.id}:`)).reduce((n, c) => n - c.amountCents, 0);
            if (original.beneficiaryId !== who && reversed < original.amountCents) {
              await tx.insert(commissions).values({ beneficiaryId: original.beneficiaryId, orderId: order.id, eventKey: `reverse:${original.id}:attribution-v${version}`, amountCents: -(original.amountCents - reversed), ruleVersion: original.ruleVersion, status: "adjustment" }).onConflictDoNothing();
              adjusted++;
            }
          }
          const alreadyFor = originals.some((c) => c.beneficiaryId === who && rows.filter((r) => r.eventKey.startsWith(`reverse:${c.id}:`)).reduce((n, r) => n - r.amountCents, 0) < c.amountCents);
          if (who && who !== order.authorId && bps > 0 && !alreadyFor) {
            await tx.insert(commissions).values({ beneficiaryId: who, orderId: order.id, eventKey: `commission:${intent}:${kind}:v${version}`, amountCents: Math.round((net(order.amountCents, tax.data.vatMode, tax.data.vatRateBps) * bps) / 10000), ruleVersion: rule.data.version }).onConflictDoNothing();
            adjusted++;
          }
        }
      }
    }
    return { version, adjusted };
  });
  await audit(actor, "attribution.corrected", "quote", quoteId, { ...result, reason: body.reason, creditedSellerId: body.creditedSellerId });
  return json({ ok: true, ...result });
}
export async function attributionDetail(request: Request, actor: Actor, quoteId: string) {
  if (request.method === "POST") return attributionCorrect(request, actor, quoteId);
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "quote.read");
  const versions = await getDb().select().from(crmAttributions).where(eq(crmAttributions.quoteId, quoteId)).orderBy(desc(crmAttributions.version));
  if (!versions.length) throw notFound();
  // Chi non ha la lettura di tutte le proposte vede solo le vendite in cui compare.
  if (!can(actor.grants, "quote.read") && !versions.some((v) => [v.creditedSellerId, v.ownerAtSale, v.affiliateId, v.sourcerId].includes(actor.id))) throw notFound();
  const ids = [...new Set(versions.flatMap((v) => [v.creditedSellerId, v.ownerAtSale, v.affiliateId, v.sourcerId, v.correctedBy]).filter(Boolean) as string[])];
  const people = ids.length ? await getDb().select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids)) : [];
  return json({ versions, people });
}
/**
 * Prospetto provvigioni: previsto (proposte accettate non ancora incassate,
 * secondo la regola congelata), maturato sugli incassi (righe in attesa o
 * sospese, rettifiche comprese) e liquidato.
 */
export async function commissionSummary(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "commission.read");
  const all = can(actor.grants, "commission.read");
  const rows = await getDb().select().from(commissions).where(all ? sql`true` : eq(commissions.beneficiaryId, actor.id));
  const snapshots = await getDb().select({ a: crmAttributions, record: quoteRecords, quote: quotes }).from(crmAttributions).innerJoin(quoteRecords, eq(quoteRecords.quoteId, crmAttributions.quoteId)).innerJoin(quotes, eq(quotes.id, crmAttributions.quoteId)).where(and(eq(crmAttributions.current, true), all ? sql`true` : sql`(${crmAttributions.beneficiaries}->>'seller' = ${actor.id} or ${crmAttributions.beneficiaries}->>'affiliate' = ${actor.id})`));
  const orderRows = snapshots.length ? await getDb().select().from(paymentOrders).where(inArray(paymentOrders.quoteId, snapshots.map((s) => s.a.quoteId))) : [];
  const people = new Map<string, { expectedCents: number; accruedCents: number; paidCents: number; withheldSales: number }>();
  const get = (id: string) => people.get(id) ?? (people.set(id, { expectedCents: 0, accruedCents: 0, paidCents: 0, withheldSales: 0 }), people.get(id)!);
  for (const c of rows) {
    if (c.status === "paid") get(c.beneficiaryId).paidCents += c.amountCents;
    else get(c.beneficiaryId).accruedCents += c.amountCents;
  }
  for (const { a, record, quote } of snapshots) {
    const rule = commissionRuleSchema.safeParse(record.commissionPolicy), tax = paymentPolicySchema.safeParse(record.taxPolicy);
    if (!rule.success || !tax.success || !quote.prezzoTotale) continue;
    const grossTotal = Math.round(quote.prezzoTotale * 100 * (tax.data.vatMode === "exempt" ? 1 : (10000 + tax.data.vatRateBps) / 10000));
    const collected = orderRows.filter((o) => o.quoteId === a.quoteId && PAID_STATUSES.includes(o.status)).reduce((n, o) => n + o.amountCents, 0);
    const remainingNet = net(Math.max(0, grossTotal - collected), tax.data.vatMode, tax.data.vatRateBps);
    const seller = a.status === "final" && a.beneficiaries.seller && (!rule.data.assistedSalesOnly || a.closing === "assisted") ? a.beneficiaries.seller : null;
    if (seller && (all || seller === actor.id)) get(seller).expectedCents += Math.round((remainingNet * rule.data.sellerBps) / 10000);
    if (a.beneficiaries.affiliate && (all || a.beneficiaries.affiliate === actor.id)) get(a.beneficiaries.affiliate).expectedCents += Math.round((remainingNet * rule.data.affiliateBps) / 10000);
    if (a.status === "conflict" && all) for (const c of a.conflicts.flatMap((x) => x.candidates)) get(c).withheldSales++;
  }
  return json({ people: Object.fromEntries(people), definitions: { expected: "Provvigioni attese sulle proposte accettate e non ancora incassate, con la regola congelata sulla proposta.", accrued: "Maturate sugli incassi verificati, in attesa o sospese, comprese le rettifiche.", paid: "Liquidate con riferimento di pagamento." } });
}
export { emitEvent };
