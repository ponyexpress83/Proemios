import { randomBytes, createHash } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes, agencyLeads } from "@/db/schema";
import {
  quoteRecords,
  quoteClaims,
  operationKeys,
  affiliateProfiles,
  affiliateConversions,
  emailOutbox,
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
  paymentPolicySchema,
  commissionRuleSchema,
  appOrigin,
} from "./config";
import { getSetting } from "./crm";
import { protectMailHtml } from "./mail";

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
  const tax = paymentPolicySchema.safeParse(await getSetting("payment-policy")),
    rule = commissionRuleSchema.safeParse(await getSetting("commission-rule"));
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
    const [lead] = await tx
      .insert(leads)
      .values({
        ...body.contatto,
        email: body.contatto.email.toLowerCase(),
        fonte: "preventivo",
        stage: "new",
      })
      .returning();
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
        taxPolicy: tax.success ? tax.data : null,
        commissionPolicy: rule.success ? rule.data : null,
      });
    await tx
      .insert(quoteClaims)
      .values({
        quoteId: quote!.id,
        email: body.contatto.email.toLowerCase(),
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 48 * 3600_000),
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
    const link = `${appOrigin()}/collega-preventivo?token=${token}`;
    await tx.insert(emailOutbox).values(await Promise.all([
      {
        eventKey: `quote:${quote!.id}:author`,
        recipient: body.contatto.email,
        subject: "Il tuo preventivo · Proemios",
        html: impaginaEmail(
          "Tre percorsi per il tuo libro",
          `<p>Ciao ${esc(body.contatto.nome)}, abbiamo ricevuto la tua richiesta.</p><p>Le stime sono ${result.packages.map((p) => `${esc(p.name)}: € ${p.total.toLocaleString("it-IT")}`).join(" · ")}. Il team confermerà condizioni e servizi dopo aver esaminato il progetto.</p><p><a href="${esc(link)}">Collega il preventivo al tuo account</a></p><p>Usa questo indirizzo verificato. Il collegamento scade tra 48 ore.</p>`,
        ),
      },
      {
        eventKey: `quote:${quote!.id}:team`,
        recipient: destinatarioInterno(),
        subject: "Nuova richiesta di preventivo · Proemios",
        html: impaginaEmail(
          "Nuova richiesta",
          `<p>${esc(body.contatto.nome)} · ${esc(body.contatto.email)}</p><p>${esc(body.contatto.note ?? "")}</p><p>Proposta ${quote!.id}. Apri lo spazio del team per assegnare il contatto.</p>`,
        ),
      },
    ].map(async m => ({ ...m, html: await protectMailHtml(m.html) }))));
    const saved = { quoteId: quote!.id, preventivo: result, emailStatus: "queued" };
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
        note: message,
      })
      .returning();
    if (agencyBody.success)
      await tx.insert(agencyLeads).values({ ...agencyBody.data, leadId: lead!.id });
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
          `<p>${esc(name)} · ${esc(body.email)}</p><p>${esc(message)}</p>`,
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
