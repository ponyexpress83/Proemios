import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { quotes } from "@/db/schema";
import {
  quoteRecords,
  paymentOrders,
  ledgerEntries,
  webhookEvents,
  commissions,
  affiliateConversions,
  notifications,
  emailOutbox,
  refundRequests,
} from "@/db/platform-schema";
import { user } from "@/db/auth-schema";
import { stripe, stripeConfigurato } from "@/lib/stripe";
import { quoteAccess, ensureQuotePolicy } from "./crm";
import { journeyStage } from "./commercial";
import { demand, demandAvailable, demandRecent, audit, type Actor } from "./access";
import { can } from "./permissions";
import { readBody, json, PlatformError, unavailable, notFound, csvCell } from "./http";
import { paymentPolicySchema, commissionRuleSchema, moneyBreakdown, appOrigin } from "./config";
import { limitRequest } from "./rate-limit";
import type { QuotePackage } from "@/lib/pricing";
import { impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { protectMailHtml } from "./mail";
import { requireBillingProfile, getBillingProfile, type BillingProfile } from "./billing";
import { queueInvoice, invoiceView } from "./invoices";
import { recordFunnel } from "./funnel";
import { billingProfiles, invoices, projects } from "@/db/platform-schema";

/**
 * Metodi di pagamento offerti nel Checkout. Vuoto: decide la Dashboard di
 * Stripe (carte, Klarna, Scalapay, addebito SEPA, bonifico… quelli attivati lì).
 * Impostato (es. "card,klarna,customer_balance"): elenco esplicito.
 */
export function configuredPaymentMethods(): string[] {
  return (process.env.STRIPE_PAYMENT_METHODS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => /^[a-z_]+$/.test(m));
}
/** Il cliente Stripe dell'autore, creato una volta con i dati di fatturazione: serve a bonifico e rate. */
async function stripeCustomerFor(actor: Actor, profile: BillingProfile): Promise<string> {
  if (profile.stripeCustomerId) return profile.stripeCustomerId;
  const customer = await stripe().customers.create(
    {
      email: actor.email,
      name: profile.name,
      address: { line1: profile.street, postal_code: profile.postcode, city: profile.city, state: profile.province ?? undefined, country: profile.country },
      metadata: { userId: actor.id },
    },
    { idempotencyKey: `proemios-customer-${actor.id}` },
  );
  await getDb().update(billingProfiles).set({ stripeCustomerId: customer.id, updatedAt: new Date() }).where(eq(billingProfiles.userId, actor.id));
  return customer.id;
}
export const checkoutBodySchema = z
  .object({
    quoteId: z.string().uuid(),
    kind: z.enum(["deposit", "balance"]).default("deposit"),
  })
  .strict();
export function checkoutAvailable(): boolean {
  if (!stripeConfigurato() || !process.env.STRIPE_WEBHOOK_SECRET) return false;
  if (process.env.VERCEL_ENV === "production" && !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) return false;
  return true;
}
export async function checkout(request: Request, actor: Actor) {
  const body = await readBody(request, checkoutBodySchema);
  return json(await createCheckout(actor, body));
}
/**
 * Apre (o riapre) la sessione di pagamento di una proposta accettata. Un
 * ordine in attesa viene riusato; una sessione scaduta viene chiusa e la
 * chiamata successiva ne apre una nuova. Doppi clic e richieste ripetute
 * producono la stessa sessione grazie alla chiave di idempotenza.
 */
export async function createCheckout(actor: Actor, body: z.infer<typeof checkoutBodySchema>): Promise<{ url: string }> {
  if (!checkoutAvailable()) throw unavailable();
  await limitRequest("checkout", actor.id, 10, 3600);
  const access = await quoteAccess(actor, body.quoteId, "quote.accept");
  if (access.record.acceptedBy !== actor.id || !access.record.acceptedAt)
    throw new PlatformError(409, "ACCEPT_FIRST", "Accetta la proposta prima di pagare.");
  // Senza dati di fatturazione non c'è fattura: si chiedono prima dell'incasso.
  const profile = await requireBillingProfile(actor.id);
  const policy = { success: true as const, data: await ensureQuotePolicy(access.record) };
  const selected = (access.quote.pacchettiGenerati as QuotePackage[]).find(
    (p) => p.tier === access.record.selectedTier,
  );
  if (!selected) throw notFound();
  const total = moneyBreakdown(selected.total, policy.data).grossCents,
    deposit = moneyBreakdown(selected.deposit, policy.data).grossCents;
  const order = await getDb().transaction(async (tx) => {
    await tx
      .select()
      .from(quoteRecords)
      .where(eq(quoteRecords.quoteId, body.quoteId))
      .for("update");
    const existing = await tx
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.quoteId, body.quoteId));
    if (
      existing.some((o) =>
        ["disputed", "refunded", "partially_refunded", "review_required"].includes(o.status),
      )
    )
      throw new PlatformError(409, "FINANCE_REVIEW", "L'ordine richiede una verifica Finance.");
    if (existing.some((o) => o.kind === body.kind && o.status === "paid"))
      throw new PlatformError(409, "ALREADY_PAID", "Questo importo è già stato pagato.");
    if (
      body.kind === "balance" &&
      !existing.some((o) => o.kind === "deposit" && o.status === "paid")
    )
      throw new PlatformError(409, "DEPOSIT_FIRST", "Paga prima l'acconto.");
    const pending = existing.find((o) => o.kind === body.kind && o.status === "pending");
    if (pending) return pending;
    const [saved] = await tx
      .insert(paymentOrders)
      .values({
        quoteId: body.quoteId,
        authorId: actor.id,
        tier: selected.tier,
        kind: body.kind,
        amountCents: body.kind === "deposit" ? deposit : total - deposit,
      })
      .returning();
    return saved!;
  });
  const methods = configuredPaymentMethods();
  const customer = await stripeCustomerFor(actor, profile);
  const session = order.stripeSessionId
    ? await stripe().checkout.sessions.retrieve(order.stripeSessionId)
    : await stripe().checkout.sessions.create(
        {
          mode: "payment",
          locale: "it",
          customer,
          customer_update: { address: "auto", name: "auto" },
          ...(methods.length ? { payment_method_types: methods as Stripe.Checkout.SessionCreateParams.PaymentMethodType[] } : {}),
          // Bonifico tramite Stripe: IBAN virtuale per cliente, riconciliazione
          // automatica, nessuna contestazione possibile.
          ...(methods.includes("customer_balance") || !methods.length
            ? { payment_method_options: { customer_balance: { funding_type: "bank_transfer", bank_transfer: { type: "eu_bank_transfer", eu_bank_transfer: { country: "IT" } } } } }
            : {}),
          client_reference_id: order.id,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: order.amountCents,
                product_data: {
                  name: `${body.kind === "deposit" ? "Acconto" : "Saldo"} · ${selected.name} · Proemios`,
                },
              },
            },
          ],
          metadata: { orderId: order.id, quoteId: order.quoteId },
          // La pagina di ritorno verifica la sessione su Stripe e che appartenga
          // a chi è loggato; la conferma definitiva resta quella del webhook.
          success_url: `${appOrigin()}/preventivo/grazie?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appOrigin()}/area-autore?preventivo=${order.quoteId}&pagamento=annullato`,
        },
        { idempotencyKey: `proemios-order-${order.id}` },
      );
  await getDb()
    .update(paymentOrders)
    .set({ stripeSessionId: session.id, updatedAt: new Date() })
    .where(eq(paymentOrders.id, order.id));
  if (session.status === "expired") {
    await getDb()
      .update(paymentOrders)
      .set({ status: "expired" })
      .where(eq(paymentOrders.id, order.id));
    throw new PlatformError(
      409,
      "CHECKOUT_EXPIRED",
      "Sessione scaduta. Riprova per aprirne una nuova.",
    );
  }
  if (!session.url)
    throw new PlatformError(409, "PAYMENT_PENDING", "Stiamo verificando il pagamento.");
  await audit(actor, "checkout.created", "payment", order.id);
  await recordFunnel(getDb(), "checkout_started", order.quoteId, { kind: body.kind });
  return { url: session.url };
}
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
async function recordPayment(tx: Tx, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId || !z.string().uuid().safeParse(orderId).success) return;
  const [order] = await tx
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, orderId))
    .for("update");
  if (
    !order ||
    order.stripeSessionId !== session.id ||
    session.currency !== order.currency ||
    session.amount_total !== order.amountCents ||
    session.metadata?.quoteId !== order.quoteId ||
    session.client_reference_id !== order.id
  )
    throw new PlatformError(409, "PAYMENT_MISMATCH", "Riferimento o importo non corrispondente.");
  if (session.payment_status !== "paid") return;
  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!intent) throw new Error("Missing intent");
  const inserted = await tx
    .insert(ledgerEntries)
    .values({
      orderId: order.id,
      eventKey: `payment:${intent}`,
      kind: "payment",
      amountCents: order.amountCents,
      reference: intent,
    })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return;
  await tx
    .update(paymentOrders)
    .set({ status: "paid", stripePaymentIntentId: intent, updatedAt: new Date() })
    .where(eq(paymentOrders.id, order.id));
  await tx
    .update(quotes)
    .set({ stato: order.kind === "deposit" ? "deposit_paid" : "won", updatedAt: new Date() })
    .where(eq(quotes.id, order.quoteId));
  const [record] = await tx
    .select()
    .from(quoteRecords)
    .where(eq(quoteRecords.quoteId, order.quoteId));
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, order.quoteId));
  const rule = commissionRuleSchema.safeParse(record?.commissionPolicy),
    tax = paymentPolicySchema.safeParse(record?.taxPolicy);
  if (rule.success && tax.success && quote) {
    const net =
      tax.data.vatMode === "exempt"
        ? order.amountCents
        : Math.round((order.amountCents * 10000) / (10000 + tax.data.vatRateBps));
    const [referral] = await tx
      .select()
      .from(affiliateConversions)
      .where(eq(affiliateConversions.quoteId, quote.id));
    // Vendita assistita o autonoma: la regola congelata sulla proposta decide
    // se la sola assegnazione del contatto dà diritto alla provvigione.
    const sellerEligible = !rule.data.assistedSalesOnly || Boolean(record?.salesAssisted);
    for (const b of [
      { id: sellerEligible ? record?.acceptedSellerId : null, bps: rule.data.sellerBps, kind: "seller" },
      { id: referral?.affiliateId, bps: rule.data.affiliateBps, kind: "affiliate" },
    ])
      if (b.id && b.id !== order.authorId && b.bps > 0)
        await tx
          .insert(commissions)
          .values({
            beneficiaryId: b.id,
            orderId: order.id,
            eventKey: `commission:${intent}:${b.kind}`,
            amountCents: Math.round((net * b.bps) / 10000),
            ruleVersion: rule.data.version,
          })
          .onConflictDoNothing();
  }
  const importo = `€ ${(order.amountCents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
  const cosa = order.kind === "deposit" ? "Acconto" : "Saldo";
  await tx
    .insert(notifications)
    .values({
      userId: order.authorId,
      title: "Pagamento ricevuto",
      body: `${cosa} di ${importo} confermato dal servizio di pagamento.`,
      href: `/area-autore?preventivo=${order.quoteId}`,
    });
  // Chi segue la vendita e il team sanno subito che il lavoro può partire.
  if (record?.acceptedSellerId && record.acceptedSellerId !== order.authorId) {
    await tx.insert(notifications).values({
      userId: record.acceptedSellerId,
      title: `${cosa} ricevuto`,
      body: `${importo} incassati sulla proposta ${order.quoteId.slice(0, 8)}.`,
      href: `/spazio?preventivo=${order.quoteId}`,
    });
    const [seller] = await tx.select({ email: user.email }).from(user).where(eq(user.id, record.acceptedSellerId));
    if (seller)
      await tx.insert(emailOutbox).values({
        eventKey: `receipt:${intent}:seller`,
        recipient: seller.email,
        subject: `${cosa} ricevuto · Proemios`,
        html: await protectMailHtml(impaginaEmail(`${cosa} ricevuto`, `<p>${esc(importo)} incassati sulla proposta ${esc(order.quoteId)}.</p><p><a href="${esc(appOrigin())}/spazio?preventivo=${esc(order.quoteId)}">Apri la proposta</a></p>`)),
      }).onConflictDoNothing();
  }
  await tx.insert(emailOutbox).values({
    eventKey: `receipt:${intent}:team`,
    recipient: destinatarioInterno(),
    subject: `${cosa} ricevuto · ${importo} · Proemios`,
    html: await protectMailHtml(impaginaEmail(`${cosa} ricevuto`, `<p>${esc(importo)} incassati sulla proposta ${esc(order.quoteId)} (${esc(order.tier)}).</p><p><a href="${esc(appOrigin())}/spazio?preventivo=${esc(order.quoteId)}">Apri nello spazio del team</a></p>`)),
  }).onConflictDoNothing();
  const [author] = await tx
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, order.authorId));
  if (author)
    await tx
      .insert(emailOutbox)
      .values({
        eventKey: `receipt:${intent}`,
        recipient: author.email,
        subject: "Pagamento ricevuto · Proemios",
        html: await protectMailHtml(impaginaEmail(
          "Pagamento ricevuto",
          `<p>Abbiamo ricevuto ${esc(importo)} (${cosa.toLowerCase()}).</p><p><a href="${esc(appOrigin())}/area-autore?preventivo=${esc(order.quoteId)}">Apri la tua area autore</a>: da lì carichi i materiali e segui la lavorazione. La ricevuta di pagamento non sostituisce la fattura.</p>`,
        )),
      })
      .onConflictDoNothing();
  // La fattura nasce qui in coda e viene emessa subito dopo la risposta a Stripe.
  await queueInvoice(tx, { ...order, status: "paid", stripePaymentIntentId: intent }, session, tax.success ? tax.data : null);
  await recordFunnel(tx, "payment_confirmed", order.quoteId, { kind: order.kind, amountCents: order.amountCents });
}
async function recordRefund(tx: Tx, refund: Stripe.Refund) {
  if (refund.status !== "succeeded") return;
  const intent =
    typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (!intent) return;
  const [order] = await tx
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.stripePaymentIntentId, intent))
    .for("update");
  if (!order) throw new PlatformError(409, "PAYMENT_NOT_RECONCILED", "Riconcilia l'incasso prima di elaborare il rimborso.");
  if (refund.currency !== order.currency) throw new Error("Refund currency mismatch");
  const inserted = await tx
    .insert(ledgerEntries)
    .values({
      orderId: order.id,
      eventKey: `refund:${refund.id}`,
      kind: "refund",
      amountCents: -refund.amount,
      reference: refund.id,
    })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return;
  const rows = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, order.id));
  const refunded = -rows.filter((r) => r.kind === "refund").reduce((n, r) => n + r.amountCents, 0);
  if (refunded > order.amountCents) throw new Error("Excess refund");
  await tx
    .update(paymentOrders)
    .set({
      status: refunded === order.amountCents ? "refunded" : "partially_refunded",
      updatedAt: new Date(),
    })
    .where(eq(paymentOrders.id, order.id));
  const payouts = await tx.select().from(commissions).where(eq(commissions.orderId, order.id));
  for (const original of payouts.filter((c) => c.amountCents > 0)) {
    const previous = payouts
        .filter((c) => c.eventKey.startsWith(`reverse:${original.id}:`))
        .reduce((n, c) => n - c.amountCents, 0),
      reverse = Math.round((original.amountCents * refunded) / order.amountCents) - previous;
    if (reverse > 0)
      await tx
        .insert(commissions)
        .values({
          beneficiaryId: original.beneficiaryId,
          orderId: order.id,
          eventKey: `reverse:${original.id}:${refund.id}`,
          amountCents: -reverse,
          ruleVersion: original.ruleVersion,
          status: "adjustment",
        })
        .onConflictDoNothing();
    if (original.status !== "paid")
      await tx.update(commissions).set({ status: "held" }).where(eq(commissions.id, original.id));
  }
}
export async function processStripeEvent(event: Stripe.Event) {
  if (!process.env.DATABASE_URL) throw unavailable();
  if (Boolean(event.livemode) !== Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")))
    throw new PlatformError(400, "MODE_MISMATCH", "Modalità non valida.");
  if (event.account) throw new PlatformError(400, "ACCOUNT_MISMATCH", "Account non autorizzato.");
  return getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(webhookEvents)
      .values({ eventId: event.id, type: event.type })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return { received: true, duplicate: true };
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    )
      await recordPayment(tx, event.data.object as Stripe.Checkout.Session);
    else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const s = event.data.object as Stripe.Checkout.Session;
      await tx
        .update(paymentOrders)
        .set({
          status: event.type.endsWith("expired") ? "expired" : "failed",
          updatedAt: new Date(),
        })
        .where(and(eq(paymentOrders.stripeSessionId, s.id), eq(paymentOrders.status, "pending")));
    } else if (event.type === "refund.created" || event.type === "refund.updated")
      await recordRefund(tx, event.data.object as Stripe.Refund);
    else if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
      const d = event.data.object as Stripe.Dispute,
        intent = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
      if (intent) {
        const [order] = await tx
          .select()
          .from(paymentOrders)
          .where(eq(paymentOrders.stripePaymentIntentId, intent))
          .for("update");
        if (order) {
          await tx
            .update(paymentOrders)
            .set({ status: event.type.endsWith("created") ? "disputed" : "review_required" })
            .where(eq(paymentOrders.id, order.id));
          await tx
            .update(commissions)
            .set({ status: "held" })
            .where(and(eq(commissions.orderId, order.id), eq(commissions.status, "pending")));
        }
      }
    }
    return { received: true };
  });
}
export async function financeCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demand(actor, "finance.read");
  const [orders, ledger, payouts] = await Promise.all([
    getDb().select().from(paymentOrders).orderBy(desc(paymentOrders.createdAt)).limit(200),
    getDb().select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt)).limit(500),
    getDb().select().from(commissions).orderBy(desc(commissions.createdAt)).limit(200),
  ]);
  const [totals] = await getDb().select({ balanceCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}),0)::double precision`, entries: sql<number>`count(*)::integer` }).from(ledgerEntries);
  const issued = await getDb().select().from(invoices).orderBy(desc(invoices.createdAt)).limit(200);
  return json({ orders, ledger, commissions: payouts, totals, refunds: await getDb().select().from(refundRequests).orderBy(desc(refundRequests.createdAt)).limit(200), invoices: issued.map((r) => invoiceView(r, true)) });
}
export async function refundPrepare(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "refund.prepare"); demandRecent(actor);
  const body = await readBody(request, z.object({ orderId: z.string().uuid(), amountCents: z.number().int().positive(), reason: z.string().trim().min(10).max(2000) }).strict());
  const result = await getDb().transaction(async tx => {
    const [order] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, body.orderId)).for("update");
    if (!order || !["paid", "partially_refunded"].includes(order.status)) throw new PlatformError(409, "ORDER_NOT_REFUNDABLE", "L'incasso deve essere riconciliato prima di preparare una rettifica.");
    const entries = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, order.id));
    const collected = entries.reduce((sum, entry) => sum + entry.amountCents, 0);
    if (body.amountCents > collected) throw new PlatformError(422, "EXCESS_REFUND", "L'importo supera l'incassato disponibile.");
    const [saved] = await tx.insert(refundRequests).values({ ...body, preparedBy: actor.id }).returning();
    return saved!;
  });
  await audit(actor, "refund.prepared", "refund", result.id, { amountCents: body.amountCents });
  return json({ request: result, moneyMoved: false }, 201);
}
/**
 * Stato dei pagamenti di una proposta, visibile a chi può leggerla (l'autore
 * che l'ha collegata, il venditore assegnato, il team). Importi lordi, perché
 * sono quelli che Stripe addebita.
 */
export async function quotePayments(request: Request, actor: Actor, id: string) {
  if (request.method !== "GET") throw notFound();
  const access = await quoteAccess(actor, id, "quote.read");
  const policy = await ensureQuotePolicy(access.record);
  const orders = await getDb()
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.quoteId, id))
    .orderBy(desc(paymentOrders.createdAt));
  const selected = (access.quote.pacchettiGenerati as QuotePackage[]).find(
    (p) => p.tier === access.record.selectedTier,
  );
  const total = selected ? moneyBreakdown(selected.total, policy).grossCents : null,
    deposit = selected ? moneyBreakdown(selected.deposit, policy).grossCents : null;
  const paid = (kind: string) => orders.some((o) => o.kind === kind && o.status === "paid");
  const issued = await getDb().select().from(invoices).where(eq(invoices.quoteId, id)).orderBy(desc(invoices.createdAt));
  const [project] = await getDb().select({ id: projects.id, stage: projects.stage }).from(projects).where(eq(projects.quoteId, id)).limit(1);
  return json({
    project: project ?? null,
    accepted: Boolean(access.record.acceptedAt),
    journey: journeyStage(access.record, orders),
    checkoutAvailable: checkoutAvailable(),
    vatMode: policy.vatMode,
    vatRateBps: policy.vatRateBps,
    methods: configuredPaymentMethods(),
    billingReady: Boolean(await getBillingProfile(access.record.acceptedBy ?? actor.id)),
    invoices: issued.map((r) => invoiceView(r, can(actor.grants, "finance.read"))),
    deposit: { grossCents: deposit, paid: paid("deposit") },
    balance: { grossCents: total !== null && deposit !== null ? total - deposit : null, paid: paid("balance") },
    orders: orders.map((o) => ({ id: o.id, kind: o.kind, amountCents: o.amountCents, status: o.status, createdAt: o.createdAt })),
  });
}
export async function commissionCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  demandAvailable(actor, "commission.read");
  return json({
    commissions: await getDb()
      .select()
      .from(commissions)
      .where(
        can(actor.grants, "commission.read") ? sql`true` : eq(commissions.beneficiaryId, actor.id),
      )
      .orderBy(desc(commissions.createdAt))
      .limit(200),
  });
}
export async function commissionPaid(request: Request, actor: Actor, id: string) {
  if (request.method !== "PATCH") throw notFound();
  demand(actor, "commission.pay");
  demandRecent(actor);
  const body = await readBody(
    request,
    z.object({ reference: z.string().trim().min(5).max(200) }).strict(),
  );
  await getDb().transaction(async (tx) => {
    const [item] = await tx.select().from(commissions).where(eq(commissions.id, id)).for("update");
    if (!item) throw notFound();
    const [order] = await tx
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.id, item.orderId))
      .for("update");
    if (item.status !== "pending" || item.amountCents <= 0 || order?.status !== "paid")
      throw new PlatformError(409, "PAYOUT_HELD", "Commissione non disponibile per il pagamento.");
    await tx
      .update(commissions)
      .set({ status: "paid", paymentReference: body.reference })
      .where(eq(commissions.id, id));
  });
  await audit(actor, "commission.payment-recorded", "commission", id);
  return json({ ok: true });
}
export async function reconcile(request: Request, actor: Actor) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "finance.record");
  demandRecent(actor);
  if (!stripeConfigurato()) throw unavailable();
  const pending = await getDb()
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.status, "pending"))
    .limit(30);
  let verified = 0;
  for (const order of pending)
    if (order.stripeSessionId) {
      const s = await stripe().checkout.sessions.retrieve(order.stripeSessionId);
      if (s.payment_status === "paid") {
        await getDb().transaction((tx) => recordPayment(tx, s));
        verified++;
      }
    }
  await audit(actor, "finance.reconciled", "payment", undefined, { verified });
  return json({ verified });
}
export async function financeExport(actor: Actor) {
  demand(actor, "finance.read");
  demand(actor, "export");
  const rows = await getDb()
    .select()
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(5000);
  await audit(actor, "finance.exported", "ledger", undefined, { rows: rows.length });
  return new Response(
    [
      "id,ordine,tipo,centesimi,valuta,riferimento,data",
      ...rows.map((r) =>
        [r.id, r.orderId, r.kind, r.amountCents, r.currency, r.reference, r.createdAt.toISOString()]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": "attachment; filename=registro-proemios.csv",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
