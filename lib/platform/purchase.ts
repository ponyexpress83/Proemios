import { z } from "zod";
import { getDb } from "@/db";
import { quoteRecords } from "@/db/platform-schema";
import { eq } from "drizzle-orm";
import { acceptQuote, acceptBodySchema, quoteAccess } from "./crm";
import { acceptanceEvidence } from "./contracts";
import { createCheckout, checkoutAvailable } from "./payments";
import { billingProfileSchema, saveBillingProfile, getBillingProfile } from "./billing";
import { readBody, json, notFound, PlatformError } from "./http";
import type { Actor } from "./access";

/**
 * Un solo passaggio dalla proposta al pagamento: dati di fatturazione (se
 * servono), accettazione con condizioni e apertura del checkout. Ogni parte è
 * idempotente, così un doppio clic o una ripresa dopo un errore non ripete
 * nulla e non crea un secondo ordine.
 */
export async function quoteConfirm(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const body = await readBody(
    request,
    acceptBodySchema.extend({ kind: z.enum(["deposit", "balance"]).default("deposit"), billing: billingProfileSchema.optional() }),
  );
  if (body.billing) await saveBillingProfile(actor, body.billing);
  else if (!(await getBillingProfile(actor.id)))
    throw new PlatformError(409, "BILLING_REQUIRED", "Inserisci i dati di fatturazione per completare la conferma.");
  const { kind, billing: _billing, ...acceptance } = body;
  void _billing;
  const access = await quoteAccess(actor, id, "quote.accept");
  if (!access.record.acceptedAt) await acceptQuote(actor, id, acceptance, acceptanceEvidence(request));
  else if (access.record.selectedTier !== acceptance.tier)
    throw new PlatformError(409, "ALREADY_ACCEPTED", "La proposta è già stata accettata con un altro pacchetto.");
  if (!checkoutAvailable())
    return json({ accepted: true, url: null, checkoutAvailable: false, message: "Proposta accettata. Il pagamento online non è ancora attivo: il team ti indica come procedere." });
  const { url } = await createCheckout(actor, { quoteId: id, kind });
  return json({ accepted: true, url, checkoutAvailable: true });
}
/** Scelta del pacchetto da parte dell'autore collegato, prima di confermare. */
export async function quotePrefer(request: Request, actor: Actor, id: string) {
  if (request.method !== "POST") throw notFound();
  const access = await quoteAccess(actor, id, "quote.read");
  const body = await readBody(request, z.object({ tier: z.enum(["essenziale", "consigliato", "signature"]) }).strict());
  if (access.record.acceptedAt) throw new PlatformError(409, "ALREADY_ACCEPTED", "La proposta è già stata accettata.");
  if (!(access.quote.pacchettiGenerati as Array<{ tier: string }>).some((p) => p.tier === body.tier))
    throw new PlatformError(422, "INVALID_PACKAGE", "Seleziona un pacchetto valido.");
  await getDb().update(quoteRecords).set({ preferredTier: body.tier }).where(eq(quoteRecords.quoteId, id));
  return json({ ok: true, preferredTier: body.tier });
}
