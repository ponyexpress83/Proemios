import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { quotes } from "@/db/schema";
import { invoices, paymentOrders, billingProfiles, notifications, quoteRecords } from "@/db/platform-schema";
import { user } from "@/db/auth-schema";
import { stripe, stripeConfigurato } from "@/lib/stripe";
import { impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { paymentPolicySchema, appOrigin, type PaymentPolicy } from "./config";
import { ficConfigured, ficCreateInvoice, ficInvoicePdf, ficSendInvoice, ficSendsToSdi, type FicEntity } from "./fic";
import { enqueueMail } from "./mail";
import { json, notFound, PlatformError } from "./http";
import { demand, demandRecent, audit, type Actor } from "./access";
import { can } from "./permissions";
import type { QuotePackage } from "@/lib/pricing";
import type { BillingProfile } from "./billing";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Order = typeof paymentOrders.$inferSelect;
const euros = (cents: number) => Math.round(cents) / 100;
const short = (id: string) => id.slice(0, 8).toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);
const dateIt = (iso: string) => new Date(iso).toLocaleDateString("it-IT");
/** Codici SdI del metodo di pagamento: carta, addebito SEPA, bonifico. */
const SDI_METHOD: Record<string, string> = { card: "MP08", sepa_debit: "MP19", customer_balance: "MP05", paypal: "MP08", klarna: "MP08", scalapay: "MP08" };

/**
 * Mette in coda la fattura di un incasso appena confermato. Gira dentro la
 * transazione del webhook: nessuna chiamata esterna, solo la riga che il
 * cron (o la risposta stessa, subito dopo) trasformerà in fattura.
 */
export async function queueInvoice(tx: Tx, order: Order, session: Stripe.Checkout.Session, policy: PaymentPolicy | null) {
  const gross = order.amountCents;
  const net = !policy || policy.vatMode === "exempt" ? gross : Math.round((gross * 10000) / (10000 + policy.vatRateBps));
  await tx
    .insert(invoices)
    .values({
      orderId: order.id,
      authorId: order.authorId,
      quoteId: order.quoteId,
      kind: order.kind,
      grossCents: gross,
      netCents: net,
      taxCents: gross - net,
      paymentMethod: session.payment_method_types?.[0] ?? null,
    })
    .onConflictDoNothing();
}
function entityFor(profile: BillingProfile, email: string): FicEntity {
  const italian = profile.country === "IT";
  return {
    name: profile.name,
    ...(profile.taxCode ? { tax_code: profile.taxCode } : {}),
    ...(profile.vatNumber ? { vat_number: profile.vatNumber } : {}),
    address_street: profile.street,
    address_postal_code: profile.postcode,
    address_city: profile.city,
    ...(profile.province ? { address_province: profile.province } : {}),
    country: italian ? "Italia" : profile.country,
    country_iso: profile.country,
    email,
    ...(profile.pec ? { certified_email: profile.pec } : {}),
    ei_code: italian ? (profile.kind === "business" && profile.sdiCode ? profile.sdiCode : "0000000") : "XXXXXXX",
  };
}
/** Il metodo con cui Stripe ha incassato davvero, letto dall'addebito; senza Stripe resta l'indizio della sessione. */
async function paidWith(order: Order, hint: string | null): Promise<string> {
  if (stripeConfigurato() && order.stripePaymentIntentId && process.env.PROEMIOS_TEST_RUN !== "1") {
    try {
      const intent = await stripe().paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ["latest_charge"] }, { timeout: 8000, maxNetworkRetries: 0 });
      const charge = intent.latest_charge;
      const type = typeof charge === "object" && charge ? charge.payment_method_details?.type : undefined;
      if (type) return type;
    } catch {
      /* l'indizio della sessione basta per il codice SdI */
    }
  }
  return hint ?? "card";
}
async function issueOne(row: typeof invoices.$inferSelect) {
  const [order] = await getDb().select().from(paymentOrders).where(eq(paymentOrders.id, row.orderId));
  const [profile] = await getDb().select().from(billingProfiles).where(eq(billingProfiles.userId, row.authorId));
  const [person] = await getDb().select({ email: user.email, name: user.name }).from(user).where(eq(user.id, row.authorId));
  const [quote] = await getDb().select().from(quotes).where(eq(quotes.id, row.quoteId));
  if (!order || !person || !quote) throw new PlatformError(409, "INVOICE_CONTEXT", "Ordine o proposta non trovati.");
  if (!profile) throw new PlatformError(409, "BILLING_REQUIRED", "Dati di fatturazione mancanti: l'autore deve completarli nella sua area.");
  const [policyRow] = await getDb().select({ taxPolicy: quoteRecords.taxPolicy }).from(quoteRecords).where(eq(quoteRecords.quoteId, row.quoteId));
  const policy = paymentPolicySchema.safeParse(policyRow?.taxPolicy);
  const exempt = policy.success && policy.data.vatMode === "exempt";
  const vatId = exempt ? process.env.FIC_VAT_ID_EXEMPT : (process.env.FIC_VAT_ID ?? "0");
  if (!vatId || !/^\d+$/.test(vatId)) throw new PlatformError(409, "FIC_VAT_ID", exempt ? "Aliquota esente non configurata (FIC_VAT_ID_EXEMPT)." : "Aliquota IVA non configurata (FIC_VAT_ID).");
  const pkg = (quote.pacchettiGenerati as QuotePackage[]).find((p) => p.tier === order.tier);
  const tierName = pkg?.name ?? order.tier;
  const reference = `proposta ${short(order.quoteId)} del ${dateIt(quote.createdAt.toISOString())}`;
  const method = await paidWith(order, row.paymentMethod);
  let name: string, description: string;
  if (row.kind === "deposit") {
    name = `Acconto · ${tierName}`;
    description = `Acconto sul percorso editoriale "${tierName}" (${reference}). Saldo alla consegna.`;
  } else {
    const [deposit] = await getDb()
      .select({ number: invoices.number, issuedOn: invoices.issuedOn, grossCents: invoices.grossCents })
      .from(invoices)
      .where(and(eq(invoices.quoteId, row.quoteId), eq(invoices.kind, "deposit")));
    name = `Saldo · ${tierName}`;
    description = `Saldo del percorso editoriale "${tierName}" (${reference})${deposit?.number ? `, al netto dell'acconto di € ${euros(deposit.grossCents).toLocaleString("it-IT", { minimumFractionDigits: 2 })} fatturato con fattura n. ${deposit.number}${deposit.issuedOn ? ` del ${dateIt(deposit.issuedOn)}` : ""}` : ""}.`;
  }
  const document = await ficCreateInvoice({
    entity: entityFor(profile, person.email),
    date: today(),
    subject: `${row.kind === "deposit" ? "Acconto" : "Saldo"} percorso editoriale · ${reference}`,
    item: { name, description, grossEuros: euros(row.grossCents), vatId: Number(vatId) },
    payment: { grossEuros: euros(row.grossCents), paidOn: today(), accountId: process.env.FIC_PAYMENT_ACCOUNT_ID ? Number(process.env.FIC_PAYMENT_ACCOUNT_ID) : undefined },
    eiPaymentMethod: SDI_METHOD[method] ?? "MP08",
  });
  const number = document.number !== undefined && document.number !== null ? `${document.number}${document.numeration ?? ""}` : null;
  await getDb()
    .update(invoices)
    .set({ ficDocumentId: document.id, number, issuedOn: document.date ?? today(), paymentMethod: method, status: "created", error: null, updatedAt: new Date() })
    .where(eq(invoices.id, row.id));
  let status = "created";
  if (ficSendsToSdi()) {
    await ficSendInvoice(document.id);
    status = "sent";
    await getDb().update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, row.id));
  }
  const label = number ? `Fattura n. ${number}` : "La tua fattura";
  await getDb().insert(notifications).values({
    userId: row.authorId,
    title: `${label} è disponibile`,
    body: `${row.kind === "deposit" ? "Acconto" : "Saldo"} di € ${euros(row.grossCents).toLocaleString("it-IT", { minimumFractionDigits: 2 })}: la fattura è nella sezione Pagamenti.`,
    href: `/area-autore?preventivo=${row.quoteId}&vista=pagamenti`,
  });
  await enqueueMail(`invoice:${row.id}`, {
    to: person.email,
    subject: `${label} · Proemios`,
    html: impaginaEmail(label, `<p>Ciao ${esc(person.name)}, la fattura per ${row.kind === "deposit" ? "l'acconto" : "il saldo"} del tuo percorso editoriale è pronta${status === "sent" ? " ed è stata trasmessa al Sistema di Interscambio" : ""}.</p><p><a href="${esc(appOrigin())}/area-autore?preventivo=${esc(row.quoteId)}&vista=pagamenti">Scaricala dalla tua area</a>.</p>`),
  });
  await enqueueMail(`invoice:${row.id}:team`, {
    to: destinatarioInterno(),
    subject: `${label} emessa${status === "sent" ? " e inviata allo SdI" : " (da inviare allo SdI)"} · Proemios`,
    html: impaginaEmail(label, `<p>${esc(person.name)} · ${row.kind === "deposit" ? "acconto" : "saldo"} di € ${euros(row.grossCents).toLocaleString("it-IT", { minimumFractionDigits: 2 })} · ${esc(reference)}.</p><p>Documento Fatture in Cloud ${document.id}${status === "sent" ? "" : ": non ancora trasmesso allo SdI, invialo da Fatture in Cloud o attiva FIC_SEND_TO_SDI"}.</p>`),
  });
  return status;
}
/**
 * Emette le fatture in coda, una alla volta, fuori da ogni transazione. Un
 * errore di Fatture in Cloud riprogramma il tentativo con attesa crescente;
 * dopo otto tentativi la riga resta "failed" e la vede Finance.
 */
export async function issueQueuedInvoices(limit = 5) {
  if (!ficConfigured()) return { issued: 0, failed: 0, skipped: true };
  let issued = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    const [row] = await getDb()
      .update(invoices)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        and(
          inArray(invoices.id, getDb().select({ id: invoices.id }).from(invoices).where(and(inArray(invoices.status, ["queued", "retry"]), lte(invoices.availableAt, new Date()))).orderBy(invoices.createdAt).limit(1)),
          inArray(invoices.status, ["queued", "retry"]),
        ),
      )
      .returning();
    if (!row) break;
    try {
      await issueOne(row);
      issued++;
    } catch (error) {
      failed++;
      const attempts = row.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Errore sconosciuto";
      await getDb()
        .update(invoices)
        .set({
          status: attempts >= 8 ? "failed" : "retry",
          attempts,
          error: message,
          availableAt: new Date(Date.now() + Math.min(6 * 3600_000, 5 * 60_000 * 2 ** (attempts - 1))),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, row.id));
    }
  }
  return { issued, failed, skipped: false };
}
const visible = (row: typeof invoices.$inferSelect) => ({
  id: row.id, orderId: row.orderId, quoteId: row.quoteId, kind: row.kind, grossCents: row.grossCents, netCents: row.netCents, taxCents: row.taxCents,
  number: row.number, issuedOn: row.issuedOn, status: row.status, paymentMethod: row.paymentMethod, createdAt: row.createdAt, attempts: row.attempts, error: row.error,
});
export function invoiceView(row: typeof invoices.$inferSelect, staff = false) {
  const base = visible(row);
  if (staff) return base;
  const { attempts: _a, error: _e, ...own } = base;
  void _a; void _e;
  return own;
}
/** GET /invoices: le proprie per l'autore, tutte per chi legge la contabilità. */
export async function invoiceCollection(request: Request, actor: Actor) {
  if (request.method !== "GET") throw notFound();
  const finance = can(actor.grants, "finance.read");
  const rows = await getDb()
    .select()
    .from(invoices)
    .where(finance ? sql`true` : eq(invoices.authorId, actor.id))
    .orderBy(desc(invoices.createdAt))
    .limit(200);
  return json({ invoices: rows.map((r) => invoiceView(r, finance)), configured: ficConfigured(), sendsToSdi: ficSendsToSdi() });
}
/** GET /invoices/:id/pdf: il PDF di Fatture in Cloud, servito dalla piattaforma, mai con un link pubblico. */
export async function invoicePdf(actor: Actor, id: string) {
  const [row] = await getDb().select().from(invoices).where(eq(invoices.id, id));
  if (!row || (row.authorId !== actor.id && !can(actor.grants, "finance.read"))) throw notFound();
  if (!row.ficDocumentId) throw new PlatformError(409, "INVOICE_PENDING", "La fattura è in emissione: riprova tra poco.");
  const pdf = await ficInvoicePdf(row.ficDocumentId);
  return new Response(pdf.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fattura-${(row.number ?? row.id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
/** POST /invoices/:id/retry: Finance rimette in coda una fattura in errore e la riprova subito. */
export async function invoiceRetry(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  demand(actor, "finance.read");
  demandRecent(actor);
  const rows = await getDb()
    .update(invoices)
    .set({ status: "retry", attempts: 0, availableAt: new Date(), error: null, updatedAt: new Date() })
    .where(and(eq(invoices.id, id), inArray(invoices.status, ["retry", "failed"])))
    .returning({ id: invoices.id });
  if (!rows.length) throw notFound();
  await audit(actor, "invoice.retried", "invoice", id);
  const result = await issueQueuedInvoices(1);
  const [row] = await getDb().select().from(invoices).where(eq(invoices.id, id));
  return json({ invoice: row ? invoiceView(row, true) : null, ...result });
}
