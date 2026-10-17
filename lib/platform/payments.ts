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
import { quoteAccess, ensureQuotePolicy, resolvePurchaseRule } from "./crm";
import { journeyStage, startCondition } from "./commercial";
import { installmentSchedule } from "./schedule";
import { demand, demandAvailable, demandRecent, audit, type Actor } from "./access";
import { can } from "./permissions";
import { readBody, json, PlatformError, unavailable, notFound, csvCell, afterResponse } from "./http";
import { paymentPolicySchema, commissionRuleSchema, moneyBreakdown, appOrigin } from "./config";
import { limitRequest } from "./rate-limit";
import type { QuotePackage } from "@/lib/pricing";
import { impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { protectMailHtml } from "./mail";
import { requireBillingProfile, getBillingProfile, type BillingProfile } from "./billing";
import { queueInvoice, invoiceView, issueQueuedInvoices } from "./invoices";
import { ficConfigured, ficSendsToSdi } from "./fic";
import { recordFunnel } from "./funnel";
import { billingProfiles, invoices, projects, tasks, contracts, leadActivities } from "@/db/platform-schema";
import { crmDeals } from "@/db/crm-schema";
import { commissionBeneficiaries } from "./crm-attribution";
import { createHandoff } from "./crm-handoff";
import { emitEvent } from "./crm-relations";

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
  const [withdrawn] = await getDb().select({ id: contracts.id }).from(contracts).where(and(eq(contracts.quoteId, body.quoteId), sql`${contracts.withdrawalRequestedAt} is not null`)).limit(1);
  if (withdrawn) throw new PlatformError(409, "WITHDRAWN", "Hai esercitato il recesso su questo contratto: nessun nuovo pagamento è dovuto.");
  // Senza dati di fatturazione non c'è fattura: si chiedono prima dell'incasso.
  const profile = await requireBillingProfile(actor.id);
  const policy = { success: true as const, data: await ensureQuotePolicy(access.record) };
  const selected = (access.quote.pacchettiGenerati as QuotePackage[]).find(
    (p) => p.tier === access.record.selectedTier,
  );
  if (!selected) throw notFound();
  const total = moneyBreakdown(selected.total, policy.data).grossCents,
    deposit = moneyBreakdown(selected.deposit, policy.data).grossCents;
  const schedule = installmentSchedule(total, deposit, access.record.paymentPlan ?? null);
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
    const paid = (kind: string, sequence: number) => existing.some((o) => o.kind === kind && o.sequence === sequence && o.status === "paid");
    // La rata da incassare è la prima del tipo richiesto non ancora pagata: il
    // piano (acconto + saldo, o rate concesse dall'azienda) lo decide il server.
    const target = schedule.filter((s) => s.kind === body.kind).find((s) => !paid(s.kind, s.sequence));
    if (!target) throw new PlatformError(409, "ALREADY_PAID", "Questo importo è già stato pagato.");
    if (body.kind === "balance" && !paid("deposit", 1))
      throw new PlatformError(409, "DEPOSIT_FIRST", "Paga prima l'acconto.");
    const pending = existing.find((o) => o.kind === target.kind && o.sequence === target.sequence && o.status === "pending");
    if (pending && pending.amountCents === target.amountCents) return { order: pending, target };
    // Un ordine aperto con un importo diverso da quello dovuto oggi (condizioni
    // cambiate prima del pagamento) viene chiuso: non si incassa mai un importo stantio.
    if (pending) await tx.update(paymentOrders).set({ status: "expired", updatedAt: new Date() }).where(eq(paymentOrders.id, pending.id));
    const [saved] = await tx
      .insert(paymentOrders)
      .values({
        quoteId: body.quoteId,
        authorId: actor.id,
        tier: selected.tier,
        kind: body.kind,
        sequence: target.sequence,
        plan: schedule.filter((s) => s.kind === "balance").length > 1 && body.kind === "balance" ? "company_installment" : "standard",
        amountCents: target.amountCents,
      })
      .returning();
    return { order: saved!, target };
  }).then(({ order, target }) => Object.assign(order, { label: target.label }));
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
                  name: `${order.label} · ${selected.name} · Proemios`,
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
  await recordFunnel(getDb(), "checkout_started", order.quoteId, { kind: body.kind, sequence: order.sequence });
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
    .set({ status: "paid", stripePaymentIntentId: intent, paymentMethod: session.payment_method_types?.length === 1 ? session.payment_method_types[0] : null, updatedAt: new Date() })
    .where(eq(paymentOrders.id, order.id));
  const [record] = await tx
    .select()
    .from(quoteRecords)
    .where(eq(quoteRecords.quoteId, order.quoteId));
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, order.quoteId));
  const rule = commissionRuleSchema.safeParse(record?.commissionPolicy),
    tax = paymentPolicySchema.safeParse(record?.taxPolicy);
  // Tutto pagato solo quando ogni voce del piano (acconto e ogni rata del saldo) è confermata.
  const allOrders = await tx.select().from(paymentOrders).where(eq(paymentOrders.quoteId, order.quoteId));
  const paidItem = (kind: string, sequence: number) => allOrders.some((o) => o.kind === kind && o.sequence === sequence && o.status === "paid");
  const selectedPkg = quote ? (quote.pacchettiGenerati as QuotePackage[]).find((p) => p.tier === order.tier) : undefined;
  const schedule = selectedPkg && tax.success ? installmentSchedule(moneyBreakdown(selectedPkg.total, tax.data).grossCents, moneyBreakdown(selectedPkg.deposit, tax.data).grossCents, record?.paymentPlan ?? null) : [];
  const allPaid = schedule.length > 0 && schedule.every((s) => paidItem(s.kind, s.sequence));
  await tx
    .update(quotes)
    .set({ stato: allPaid ? "won" : "deposit_paid", updatedAt: new Date() })
    .where(eq(quotes.id, order.quoteId));
  // La trattativa è vinta con l'incasso verificato: esce dal carico del venditore.
  if (record?.dealId) {
    await tx.update(crmDeals).set({ closedAt: new Date(), lastActivityAt: new Date(), updatedAt: new Date() }).where(and(eq(crmDeals.id, record.dealId), sql`${crmDeals.closedAt} is null`));
    await emitEvent(tx, "payment.confirmed", intent, order.quoteId, { quoteId: order.quoteId, dealId: record.dealId, kind: order.kind, sequence: order.sequence, amountCents: order.amountCents, currency: order.currency });
  }
  const projectCreated = quote ? await ensureProject(tx, { quoteId: order.quoteId, authorId: order.authorId, input: quote.input as { projectType: string; singleService?: string }, referentId: record?.acceptedSellerId ?? null, depositPaid: paidItem("deposit", 1), allPaid }) : null;
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
    // L'istantanea dell'attribuzione (all'accettazione) prevale: un conflitto sospende la provvigione del venditore.
    const snapshot = await commissionBeneficiaries(tx, quote.id, rule.data.assistedSalesOnly);
    if (snapshot?.status === "conflict" && record?.dealId) {
      const [origin] = await tx.select({ leadId: crmDeals.originLeadId }).from(crmDeals).where(eq(crmDeals.id, record.dealId));
      if (origin?.leadId) await tx.insert(leadActivities).values({ leadId: origin.leadId, dealId: record.dealId, kind: "attribution", body: "Incasso registrato: provvigione del venditore sospesa finché l'attribuzione non viene decisa.", outcome: "withheld", eventKey: `withheld:${intent}` }).onConflictDoNothing();
    }
    for (const b of [
      { id: snapshot ? snapshot.seller : sellerEligible ? record?.acceptedSellerId : null, bps: rule.data.sellerBps, kind: "seller" },
      { id: snapshot ? snapshot.affiliate : referral?.affiliateId, bps: rule.data.affiliateBps, kind: "affiliate" },
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
          `<p>Abbiamo ricevuto ${esc(importo)} (${cosa.toLowerCase()}).</p>${projectCreated ? `<p>Il tuo progetto è aperto: il primo passo è caricare il manoscritto e i materiali. <a href="${esc(appOrigin())}/area-autore?progetto=${esc(projectCreated.id)}">Vai al progetto</a>.</p>` : ""}<p><a href="${esc(appOrigin())}/area-autore?preventivo=${esc(order.quoteId)}">Apri la tua area autore</a>: da lì carichi i materiali e segui la lavorazione. La ricevuta di pagamento non sostituisce la fattura.</p>`,
        )),
      })
      .onConflictDoNothing();
  // La fattura nasce qui in coda e viene emessa subito dopo la risposta a Stripe.
  await queueInvoice(tx, { ...order, status: "paid", stripePaymentIntentId: intent }, session, tax.success ? tax.data : null);
  await recordFunnel(tx, "payment_confirmed", order.quoteId, { kind: order.kind, amountCents: order.amountCents });
}
/**
 * Il progetto nasce una sola volta, con l'acconto verificato dal webhook: il
 * vincolo unico su quote_id fa da rete anche a eventi concorrenti. La
 * lavorazione parte (startedAt) quando l'incasso previsto dalla regola del
 * servizio è confermato; i materiali si possono caricare da subito.
 */
async function ensureProject(tx: Tx, input: { quoteId: string; authorId: string; input: { projectType: string; singleService?: string }; referentId: string | null; depositPaid: boolean; allPaid: boolean }) {
  // Dentro la transazione del webhook: ogni lettura passa da tx (una sola connessione).
  const purchaseRule = await resolvePurchaseRule(tx);
  const condition = startCondition(input.input, purchaseRule);
  const started = condition === "deposit" ? input.depositPaid : input.allPaid;
  const [author] = await tx.select({ name: user.name }).from(user).where(eq(user.id, input.authorId));
  const inserted = await tx
    .insert(projects)
    .values({
      authorId: input.authorId,
      title: `Il libro di ${author?.name ?? "autore"}`,
      type: ["romanzo", "saggio", "memoir", "libro-professionale", "solo-grafica"].includes(input.input.projectType) ? input.input.projectType : "romanzo",
      quoteId: input.quoteId,
      stage: "materials",
      referentId: input.referentId,
      startCondition: condition,
      startedAt: started ? new Date() : null,
    })
    .onConflictDoNothing()
    .returning();
  const [project] = inserted.length ? inserted : await tx.select().from(projects).where(eq(projects.quoteId, input.quoteId)).limit(1);
  if (!project) return null;
  if (!inserted.length) {
    if (!project.startedAt && started) await tx.update(projects).set({ startedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, project.id));
    return null;
  }
  // Conferma e primo compito subito: l'autore sa cosa fare senza aspettare il team.
  await tx.insert(tasks).values({ projectId: project.id, assignedTo: input.authorId, createdBy: input.authorId, title: "Carica il manoscritto e i materiali nell'area autore", internal: false, dueAt: new Date(Date.now() + 7 * 86400_000) });
  await tx.insert(notifications).values({ userId: input.authorId, title: "Il tuo progetto è aperto", body: started ? "Carica il manoscritto e i materiali: la lavorazione parte da lì." : "Carica intanto il manoscritto: la lavorazione parte con il saldo, come previsto per questo servizio.", href: `/area-autore?progetto=${project.id}` });
  if (input.referentId) await tx.insert(notifications).values({ userId: input.referentId, title: "Nuovo progetto da seguire", body: `${author?.name ?? "L'autore"} ha pagato: il progetto è aperto in fase materiali.`, href: `/spazio?progetto=${project.id}` });
  // Pacchetto di passaggio alla produzione: una volta sola, dai fatti registrati (contratto, ordine, incasso).
  await createHandoff(tx, project.id);
  return project;
}
async function recordRefund(tx: Tx, refund: Stripe.Refund) {
  if (refund.status === "failed" || refund.status === "canceled") {
    await tx.update(refundRequests).set({ status: "failed", lastError: `Stripe: rimborso ${refund.status}`, updatedAt: new Date() }).where(eq(refundRequests.stripeRefundId, refund.id));
    return;
  }
  if (refund.status !== "succeeded") return;
  await tx.update(refundRequests).set({ status: "executed", executedAt: new Date(), lastError: null, updatedAt: new Date() }).where(and(eq(refundRequests.stripeRefundId, refund.id), sql`${refundRequests.status} <> 'executed'`));
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
          // Contestazione aperta: ordine e commissioni in attesa. Chiusa a nostro
          // favore: l'incasso torna valido; persa o altro: resta da verificare.
          await tx
            .update(paymentOrders)
            .set({ status: event.type.endsWith("created") ? "disputed" : d.status === "won" ? "paid" : "review_required", updatedAt: new Date() })
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
  // Il cron gira una volta al giorno: aprire Finance riprova subito le fatture in attesa.
  if (issued.some((r) => r.status === "queued" || r.status === "retry")) afterResponse(() => issueQueuedInvoices(3).then(() => undefined));
  return json({ orders, ledger, commissions: payouts, totals, invoicing: { configured: ficConfigured(), sendsToSdi: ficSendsToSdi() }, refunds: await getDb().select().from(refundRequests).orderBy(desc(refundRequests.createdAt)).limit(200), invoices: issued.map((r) => invoiceView(r, true)) });
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
 * Autorizzazione ed esecuzione del rimborso: quattro occhi (chi autorizza non è
 * chi ha preparato), MFA recente, chiave di idempotenza per Stripe. Il denaro
 * si muove qui; la contabilità (registro, commissioni, stato dell'ordine) si
 * aggiorna solo all'evento `refund.updated` verificato dal webhook.
 */
export async function refundAuthorize(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "refund.authorize"); demandRecent(actor);
  if (!stripeConfigurato()) throw unavailable();
  const prepared = await getDb().transaction(async (tx) => {
    const [item] = await tx.select().from(refundRequests).where(eq(refundRequests.id, id)).for("update");
    if (!item) throw notFound();
    if (item.preparedBy === actor.id) throw new PlatformError(409, "FOUR_EYES", "Chi prepara una rettifica non può autorizzarla: serve un secondo utente con la delega.");
    if (!["prepared", "failed"].includes(item.status)) throw new PlatformError(409, "REFUND_NOT_PENDING", "La rettifica è già stata autorizzata o eseguita.");
    const [order] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, item.orderId)).for("update");
    if (!order?.stripePaymentIntentId || !["paid", "partially_refunded"].includes(order.status)) throw new PlatformError(409, "ORDER_NOT_REFUNDABLE", "L'incasso non è rimborsabile nello stato attuale.");
    const entries = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, order.id));
    const available = entries.reduce((sum, entry) => sum + entry.amountCents, 0);
    const inFlight = (await tx.select().from(refundRequests).where(and(eq(refundRequests.orderId, order.id), eq(refundRequests.status, "authorized")))).reduce((sum, r) => sum + r.amountCents, 0);
    if (item.amountCents > available - inFlight) throw new PlatformError(422, "EXCESS_REFUND", "L'importo supera l'incassato disponibile.");
    await tx.update(refundRequests).set({ status: "authorized", authorizedBy: actor.id, authorizedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(refundRequests.id, id));
    return { item, order };
  });
  try {
    const refund = await stripe().refunds.create(
      { payment_intent: prepared.order.stripePaymentIntentId!, amount: prepared.item.amountCents, metadata: { refundRequestId: id, orderId: prepared.order.id } },
      { idempotencyKey: `proemios-refund-${id}` },
    );
    await getDb().update(refundRequests).set({ stripeRefundId: refund.id, updatedAt: new Date() }).where(eq(refundRequests.id, id));
    await audit(actor, "refund.authorized", "refund", id, { amountCents: prepared.item.amountCents, stripeRefundId: refund.id });
    return json({ ok: true, stripeRefundId: refund.id, status: "authorized", moneyMoved: true, settled: refund.status === "succeeded" });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Richiesta a Stripe non riuscita";
    await getDb().update(refundRequests).set({ status: "failed", lastError: message, updatedAt: new Date() }).where(eq(refundRequests.id, id));
    await audit(actor, "refund.failed", "refund", id, { error: message });
    throw new PlatformError(502, "REFUND_PROVIDER_ERROR", "Stripe non ha accettato il rimborso: riprova o verifica nella Dashboard.");
  }
}
/**
 * Piano di pagamento concesso dall'azienda (rate del saldo) prima
 * dell'accettazione: entra nella scheda d'ordine. Entro la soglia della regola
 * lo decide il venditore; oltre, serve chi gestisce le regole economiche.
 * Dopo l'accettazione il piano è parte del contratto e non si tocca.
 */
export async function quotePlan(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.write");
  const body = await readBody(request, z.object({ installments: z.number().int().min(1).max(12), note: z.string().trim().max(500).optional() }).strict());
  const rule = await resolvePurchaseRule();
  const exception = body.installments > rule.maxInstallments;
  if (exception && !can(actor.grants, "settings.manage")) throw new PlatformError(409, "APPROVAL_REQUIRED", `Fino a ${rule.maxInstallments} ${rule.maxInstallments === 1 ? "rata" : "rate"} puoi decidere tu; oltre serve l'approvazione di chi gestisce le regole economiche.`);
  await getDb().transaction(async (tx) => {
    const [record] = await tx.select().from(quoteRecords).where(eq(quoteRecords.quoteId, id)).for("update");
    if (!record) throw notFound();
    if (record.acceptedAt) throw new PlatformError(409, "ACCEPTED_QUOTE", "Il piano fa parte del contratto accettato: per cambiarlo serve un nuovo accordo.");
    const plan = body.installments === 1 ? null : { installments: body.installments, grantedBy: actor.id, grantedAt: new Date().toISOString(), approvedBy: exception ? actor.id : null, note: body.note ?? null };
    await tx.update(quoteRecords).set({ paymentPlan: plan, salesAssisted: true }).where(eq(quoteRecords.quoteId, id));
  });
  await audit(actor, "quote.plan-set", "quote", id, { installments: body.installments, exception });
  return json({ ok: true, installments: body.installments, exception, quoteId: access.quote.id });
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
  // Prima dell'accettazione il piano si mostra sul pacchetto preferito (o consigliato).
  const packages = access.quote.pacchettiGenerati as QuotePackage[];
  const selected = packages.find((p) => p.tier === access.record.selectedTier) ?? (access.record.acceptedAt ? undefined : packages.find((p) => p.tier === access.record.preferredTier) ?? packages.find((p) => p.recommended) ?? packages[0]);
  const total = selected ? moneyBreakdown(selected.total, policy).grossCents : null,
    deposit = selected ? moneyBreakdown(selected.deposit, policy).grossCents : null;
  const paid = (kind: string) => orders.some((o) => o.kind === kind && o.status === "paid");
  const issued = await getDb().select().from(invoices).where(eq(invoices.quoteId, id)).orderBy(desc(invoices.createdAt));
  const [project] = await getDb().select({ id: projects.id, stage: projects.stage, startedAt: projects.startedAt, startCondition: projects.startCondition }).from(projects).where(eq(projects.quoteId, id)).limit(1);
  const [contract] = await getDb().select({ id: contracts.id, withdrawalRequestedAt: contracts.withdrawalRequestedAt }).from(contracts).where(eq(contracts.quoteId, id)).orderBy(desc(contracts.version)).limit(1);
  const schedule = total !== null && deposit !== null ? installmentSchedule(total, deposit, access.record.paymentPlan ?? null) : [];
  const balancePaid = schedule.length > 0 && schedule.filter((s) => s.kind === "balance").every((s) => orders.some((o) => o.kind === "balance" && o.sequence === s.sequence && o.status === "paid"));
  return json({
    project: project ?? null,
    contract: contract ? { id: contract.id, withdrawn: Boolean(contract.withdrawalRequestedAt), pdfUrl: `/api/platform/contracts/${contract.id}/pdf` } : null,
    plan: access.record.paymentPlan ? { installments: access.record.paymentPlan.installments, kind: "company_installment" } : { installments: 1, kind: "standard" },
    schedule: schedule.map((s) => {
      const order = orders.find((o) => o.kind === s.kind && o.sequence === s.sequence && o.status === "paid") ?? orders.find((o) => o.kind === s.kind && o.sequence === s.sequence && o.status === "pending");
      return { ...s, status: order?.status ?? "due", orderId: order?.id ?? null };
    }),
    accepted: Boolean(access.record.acceptedAt),
    journey: journeyStage(access.record, orders),
    checkoutAvailable: checkoutAvailable(),
    vatMode: policy.vatMode,
    vatRateBps: policy.vatRateBps,
    methods: configuredPaymentMethods(),
    billingReady: Boolean(await getBillingProfile(access.record.acceptedBy ?? actor.id)),
    invoices: issued.map((r) => invoiceView(r, can(actor.grants, "finance.read"))),
    deposit: { grossCents: deposit, paid: paid("deposit") },
    balance: { grossCents: total !== null && deposit !== null ? total - deposit : null, paid: balancePaid || (schedule.length === 0 && paid("balance")) },
    orders: orders.map((o) => ({ id: o.id, kind: o.kind, sequence: o.sequence, plan: o.plan, amountCents: o.amountCents, status: o.status, createdAt: o.createdAt })),
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
