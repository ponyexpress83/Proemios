import { randomBytes, createHash } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { sanitizeAttribution, scoreLead } from "@/lib/attribution";
import { getDb } from "@/db";
import { leads, quotes, agencyLeads } from "@/db/schema";
import {
  quoteRecords,
  quoteClaims,
  operationKeys,
  affiliateProfiles,
  affiliateConversions,
  emailOutbox,
  notifications,
  funnelEvents,
} from "@/db/platform-schema";
import { user } from "@/db/auth-schema";
import { preventivoSchema, contattoSchema, agenziaSchema, waitlistSchema } from "@/lib/validation";
import { computeQuote } from "@/lib/pricing";
import { impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { json, readBody, checkMutationOrigin, hashToken, unavailable, PlatformError } from "./http";
import { limitRequest, requestIdentity } from "./rate-limit";
import {
  mailConfigured,
  authConfigured,
  pricingVersion,
  commissionRuleSchema,
  appOrigin,
} from "./config";
import { getSetting, resolvePaymentPolicy, resolvePurchaseRule } from "./crm";
import { initialCommercialState } from "./commercial";
import { recordFunnel } from "./funnel";
import { assignInboundLead } from "./inbound-routing";
import { protectMailHtml } from "./mail";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
/** Il venditore assegnato lo sa subito: notifica nello spazio e email con il link. */
async function notifySeller(tx: Tx, sellerId: string | null, leadId: string, title: string, body: string) {
  if (!sellerId) return;
  await tx.insert(notifications).values({ userId: sellerId, title, body, href: `/spazio?lead=${leadId}` });
  const [seller] = await tx.select({ email: user.email }).from(user).where(eq(user.id, sellerId));
  if (seller)
    await tx
      .insert(emailOutbox)
      .values({
        eventKey: `lead:${leadId}:seller`,
        recipient: seller.email,
        subject: `${title} · Proemios`,
        html: await protectMailHtml(impaginaEmail(title, `<p>${esc(body)}</p><p><a href="${esc(appOrigin())}/spazio?lead=${esc(leadId)}">Apri il contatto nello spazio del team</a></p>`)),
      })
      .onConflictDoNothing();
}
export function publicFormReady() {
  return Boolean(
    process.env.DATABASE_URL &&
    authConfigured() &&
    mailConfigured() &&
    (process.env.VERCEL_ENV !== "production" || process.env.CRON_SECRET),
  );
}
export async function publicQuote(request: Request) {
  checkMutationOrigin(request);
  if (!publicFormReady() || !authConfigured()) throw unavailable();
  await limitRequest("public-quote", requestIdentity(request), 10, 3600);
  const body = await readBody(
    request,
    preventivoSchema.extend({
      ref: z
        .string()
        .regex(/^[a-z0-9]{16}$/)
        .optional(),
    }),
  );
  const key = request.headers.get("idempotency-key");
  if (!key || !z.string().uuid().safeParse(key).success)
    throw new PlatformError(400, "IDEMPOTENCY_REQUIRED", "Aggiorna la pagina e riprova.");
  const result = computeQuote(body.input),
    selected = result.packages.find((p) => p.recommended)!;
  const tax = await resolvePaymentPolicy(),
    rule = commissionRuleSchema.safeParse(await getSetting("commission-rule")),
    purchase = await resolvePurchaseRule();
  // Stima o proposta acquistabile: lo decide la regola, mai il browser.
  const commercialState = initialCommercialState(body.input, purchase);
  const token = randomBytes(32).toString("base64url"),
    requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const response = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`quote:${key}`}))`);
    const [previous] = await tx
      .select()
      .from(operationKeys)
      .where(eq(operationKeys.key, `public-quote:${key}`));
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new PlatformError(
          409,
          "REQUEST_CHANGED",
          "Questa richiesta è cambiata. Aggiorna la pagina e riprova.",
        );
      return previous.result;
    }
    const { ricontatto, ...contatto } = body.contatto;
    const attribution = sanitizeAttribution(body.attribution);
    const [lead] = await tx
      .insert(leads)
      .values({
        ...contatto,
        note: [ricontatto ? `[Chiede di essere ricontattato${contatto.telefono ? ` al ${contatto.telefono}` : ""}]` : "", contatto.note ?? ""].filter(Boolean).join(" ") || null,
        email: body.contatto.email.toLowerCase(),
        fonte: "preventivo",
        stage: "new",
        attribution,
        sourceDetail: attribution?.utmCampaign ?? attribution?.utmSource ?? null,
        marketingConsentAt: contatto.consensoMarketing ? new Date() : null,
        contactPreferences: { email: true, phone: ricontatto && Boolean(contatto.telefono), whatsapp: false, sms: false },
        leadScore: scoreLead({ hasPhone: Boolean(contatto.telefono), wordCount: body.input.wordCount, projectType: body.input.projectType, urgency: body.input.urgency, requestedServices: body.input.requestedServices.length, noteLength: contatto.note?.length }),
      })
      .returning();
    const seller = await assignInboundLead(tx, lead!.id);
    const [quote] = await tx
      .insert(quotes)
      .values({
        leadId: lead!.id,
        input: body.input,
        pacchettiGenerati: result.packages,
        prezzoTotale: selected.total,
        acconto: selected.deposit,
        stato: "draft",
      })
      .returning();
    await tx
      .insert(quoteRecords)
      .values({
        quoteId: quote!.id,
        pricingVersion,
        taxPolicy: tax,
        commissionPolicy: rule.success ? rule.data : null,
        commercialState,
        offeredAt: commercialState === "offer" ? new Date() : null,
        expiresAt: commercialState === "offer" ? new Date(Date.now() + purchase.validityDays * 86400_000) : null,
      });
    await recordFunnel(tx, "quote_saved", quote!.id, { state: commercialState, path: body.input.singleService ? "single" : "full" });
    await tx
      .insert(quoteClaims)
      .values({
        quoteId: quote!.id,
        email: body.contatto.email.toLowerCase(),
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 86400_000),
      });
    if (body.ref && rule.success) {
      const [referral] = await tx
        .select({ id: affiliateProfiles.userId, email: user.email })
        .from(affiliateProfiles)
        .innerJoin(user, eq(user.id, affiliateProfiles.userId))
        .where(and(eq(affiliateProfiles.code, body.ref), eq(affiliateProfiles.active, true)));
      if (referral && referral.email.toLowerCase() !== body.contatto.email.toLowerCase())
        await tx
          .insert(affiliateConversions)
          .values({ affiliateId: referral.id, quoteId: quote!.id, ruleVersion: rule.data.version });
    }
    await notifySeller(tx, seller, lead!.id, "Nuovo preventivo da seguire", `${body.contatto.nome} (${body.contatto.email}) ha chiesto un preventivo: ${result.packages.map((p) => `${p.name} € ${p.total.toLocaleString("it-IT")}`).join(", ")}. ${body.contatto.note ? `Nota: ${body.contatto.note}` : ""}`.trim());
    const link = `${appOrigin()}/collega-preventivo?token=${token}`;
    await tx.insert(emailOutbox).values(await Promise.all([
      {
        eventKey: `quote:${quote!.id}:author`,
        recipient: body.contatto.email,
        subject: "Il tuo preventivo · Proemios",
        html: impaginaEmail(
          "Tre percorsi per il tuo libro",
          `<p>Ciao ${esc(body.contatto.nome)}, abbiamo ricevuto la tua richiesta.</p><p>Le stime sono ${result.packages.map((p) => `${esc(p.name)}: € ${p.total.toLocaleString("it-IT")}`).join(" · ")}. Il team confermerà condizioni e servizi dopo aver esaminato il progetto.</p><p><a href="${esc(link)}">Collega il preventivo al tuo account</a></p><p>Usa questo indirizzo verificato. Il collegamento vale 30 giorni. Se crei l’account con lo stesso indirizzo, il preventivo compare da solo nella tua area autore.</p>`,
        ),
      },
      {
        eventKey: `quote:${quote!.id}:team`,
        recipient: destinatarioInterno(),
        subject: "Nuova richiesta di preventivo · Proemios",
        html: impaginaEmail(
          "Nuova richiesta",
          `<p>${esc(body.contatto.nome)} · ${esc(body.contatto.email)}${body.contatto.telefono ? ` · ${esc(body.contatto.telefono)}` : ""}</p><p>${esc(body.contatto.note ?? "")}</p><p>${result.packages.map((p) => `${esc(p.name)}: € ${p.total.toLocaleString("it-IT")}`).join(" · ")} (IVA esclusa, ${result.wordCount.toLocaleString("it-IT")} parole).</p><p>${seller ? "Assegnata a un venditore." : "Nessun venditore attivo: resta nella coda del team."} <a href="${esc(appOrigin())}/spazio?preventivo=${esc(quote!.id)}">Apri la proposta</a></p>`,
        ),
      },
    ].map(async m => ({ ...m, html: await protectMailHtml(m.html) }))));
    const saved = { quoteId: quote!.id, preventivo: result, emailStatus: "queued", commercialState, expiresAt: commercialState === "offer" ? new Date(Date.now() + purchase.validityDays * 86400_000).toISOString() : null };
    await tx
      .insert(operationKeys)
      .values({
        key: `public-quote:${key}`,
        requestHash,
        result: saved,
        expiresAt: new Date(Date.now() + 86400_000),
      });
    return saved;
  });
  return json(response, 201);
}
export async function publicContact(request: Request, agency = false) {
  checkMutationOrigin(request);
  if (!publicFormReady()) throw unavailable();
  await limitRequest(
    agency ? "public-agency" : "public-contact",
    requestIdentity(request),
    5,
    3600,
  );
  const body = agency
    ? await readBody(request, agenziaSchema)
    : await readBody(request, contattoSchema);
  const agencyBody = agenziaSchema.safeParse(body),
    contact = contattoSchema.safeParse(body);
  const name = agencyBody.success
      ? agencyBody.data.referente
      : contact.success
        ? contact.data.nome
        : "",
    message = agencyBody.success
      ? (agencyBody.data.serviziEsternalizzati ?? "")
      : contact.success
        ? contact.data.messaggio
        : "";
  const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const suppliedKey = request.headers.get("idempotency-key");
  if (suppliedKey && !z.string().uuid().safeParse(suppliedKey).success) throw new PlatformError(400, "INVALID_KEY", "Richiesta non valida.");
  const key = `contact:${agency}:${suppliedKey ?? `${Math.floor(Date.now() / 3600_000)}:${requestHash}`}`;
  const result = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const [previous] = await tx.select().from(operationKeys).where(eq(operationKeys.key, key));
    if (previous) {
      if (previous.requestHash !== requestHash) throw new PlatformError(409, "REQUEST_CHANGED", "La richiesta è cambiata. Aggiorna e riprova.");
      return previous.result;
    }
    const [lead] = await tx
      .insert(leads)
      .values({
        nome: name,
        email: body.email.toLowerCase(),
        telefono: body.telefono,
        fonte: agency ? "agenzie" : "contatto",
        consensoPrivacy: true,
        consensoMarketing: contact.success ? contact.data.consensoMarketing : false,
        marketingConsentAt: contact.success && contact.data.consensoMarketing ? new Date() : null,
        attribution: contact.success ? sanitizeAttribution(contact.data.attribution) : null,
        sourceDetail: contact.success ? sanitizeAttribution(contact.data.attribution)?.utmCampaign ?? null : null,
        note: message,
      })
      .returning();
    const seller = await assignInboundLead(tx, lead!.id);
    if (agencyBody.success)
      await tx.insert(agencyLeads).values({ ...agencyBody.data, leadId: lead!.id });
    await notifySeller(tx, seller, lead!.id, agency ? "Nuova richiesta da un'agenzia" : "Nuovo contatto da seguire", `${name} (${body.email}${body.telefono ? `, ${body.telefono}` : ""}): ${message}`);
    await tx.insert(emailOutbox).values(await Promise.all([
      {
        eventKey: `contact:${lead!.id}:author`,
        recipient: body.email,
        subject: "Richiesta ricevuta · Proemios",
        html: impaginaEmail(
          "Richiesta ricevuta",
          `<p>Ciao ${esc(name)}, abbiamo registrato il tuo messaggio. Il team ti risponderà appena possibile.</p>`,
        ),
      },
      {
        eventKey: `contact:${lead!.id}:team`,
        recipient: destinatarioInterno(),
        replyTo: body.email,
        subject: "Nuovo contatto · Proemios",
        html: impaginaEmail(
          "Nuovo contatto",
          `<p>${esc(name)} · ${esc(body.email)}${body.telefono ? ` · ${esc(body.telefono)}` : ""}</p>${agencyBody.success ? `<p>Agenzia: ${esc(agencyBody.data.nomeAgenzia)}${agencyBody.data.sito ? ` · ${esc(agencyBody.data.sito)}` : ""}${agencyBody.data.volumeStimato ? ` · volume: ${esc(agencyBody.data.volumeStimato)}` : ""}</p>` : ""}<p>${esc(message)}</p><p><a href="${esc(appOrigin())}/spazio?lead=${esc(lead!.id)}">Apri il contatto</a></p>`,
        ),
      },
    ].map(async m => ({ ...m, html: await protectMailHtml(m.html) }))));
    const saved = { ok: true, requestId: lead!.id, emailStatus: "queued" };
    await tx.insert(operationKeys).values({ key, requestHash, result: saved, expiresAt: new Date(Date.now() + 86400_000) });
    return saved;
  });
  return json(result, 201);
}

/** An interest request is not a subscription or a general marketing consent. */
export async function publicWaitlist(request: Request) {
  checkMutationOrigin(request);
  if (!publicFormReady()) throw unavailable();
  await limitRequest("public-waitlist", requestIdentity(request), 5, 3600);
  const body = await readBody(request, waitlistSchema);
  const email = body.email.toLowerCase();
  const key = `waitlist:${createHash("sha256").update(`${email}:${body.piano}:${body.periodo}`).digest("hex")}`;
  const result = await getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const [previous] = await tx.select().from(operationKeys).where(eq(operationKeys.key, key));
    if (previous) return previous.result;
    const [saved] = await tx.insert(leads).values({ nome: "Richiesta strumenti AI", email, fonte: "contatto", consensoPrivacy: true, consensoMarketing: false, note: `Interesse strumenti AI: ${body.piano} / ${body.periodo}` }).returning();
    await tx.insert(emailOutbox).values({ eventKey: key, recipient: email, subject: "Interesse registrato · Proemios", html: await protectMailHtml(impaginaEmail("Interesse registrato", "<p>Abbiamo registrato il tuo interesse per gli strumenti AI. Non è stato attivato un abbonamento e non è previsto alcun addebito. Ti contatteremo per questa richiesta quando saranno definite disponibilità e condizioni.</p>")) });
    const response = { ok: true, requestId: saved!.id, emailStatus: "queued" };
    await tx.insert(operationKeys).values({ key, requestHash: key, result: response, expiresAt: new Date(Date.now() + 365 * 86400_000) });
    return response;
  });
  return json(result, 201);
}

/**
 * POST /api/preventivo/scelta: il pacchetto scelto nella pagina del risultato,
 * prima di avere un account. Si conserva sulla proposta e viene riproposto
 * dopo registrazione o accesso. Nessun dato personale, nessuna conseguenza
 * economica: è una preferenza.
 */
export async function publicQuotePreference(request: Request) {
  checkMutationOrigin(request);
  if (!process.env.DATABASE_URL) throw unavailable();
  await limitRequest("quote-preference", requestIdentity(request), 60, 3600);
  const body = await readBody(request, z.object({ quoteId: z.string().uuid(), tier: z.enum(["essenziale", "consigliato", "signature"]) }).strict());
  // Solo un pacchetto che esiste davvero su quella proposta (un servizio singolo ne ha uno).
  const [quote] = await getDb().select({ packages: quotes.pacchettiGenerati }).from(quotes).where(eq(quotes.id, body.quoteId));
  if (!quote || !(quote.packages as Array<{ tier: string }>).some((p) => p.tier === body.tier))
    throw new PlatformError(422, "INVALID_PACKAGE", "Seleziona un pacchetto valido.");
  const rows = await getDb()
    .update(quoteRecords)
    .set({ preferredTier: body.tier })
    .where(and(eq(quoteRecords.quoteId, body.quoteId), sql`${quoteRecords.acceptedAt} is null`))
    .returning({ quoteId: quoteRecords.quoteId });
  await getDb().insert(funnelEvents).values({ name: "package_chosen", kind: "ui", quoteId: body.quoteId, meta: { tier: body.tier } });
  return json({ ok: true, stored: rows.length > 0 });
}
