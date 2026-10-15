import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { billingProfiles } from "@/db/platform-schema";
import { readBody, json, notFound, PlatformError } from "./http";
import { audit, type Actor } from "./access";

/**
 * Dati di fatturazione dell'autore. Una fattura elettronica richiede codice
 * fiscale e indirizzo per i privati, partita IVA e codice destinatario (o PEC)
 * per le aziende: qui si raccolgono una volta e si riusano a ogni incasso.
 */
const taxCode = z.string().trim().toUpperCase().regex(/^(?:[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]|[0-9]{11})$/, "Codice fiscale non valido.");
const vatNumber = z.string().trim().regex(/^[0-9]{11}$/, "Partita IVA non valida (11 cifre).");
export const billingProfileSchema = z
  .object({
    kind: z.enum(["private", "business"]).default("private"),
    name: z.string().trim().min(2).max(200),
    taxCode: taxCode.optional().or(z.literal("")),
    vatNumber: vatNumber.optional().or(z.literal("")),
    street: z.string().trim().min(3).max(200),
    postcode: z.string().trim().min(3).max(12),
    city: z.string().trim().min(2).max(120),
    province: z.string().trim().toUpperCase().length(2).optional().or(z.literal("")),
    country: z.string().trim().toUpperCase().length(2).default("IT"),
    sdiCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,7}$/).optional().or(z.literal("")),
    pec: z.string().trim().toLowerCase().email().max(320).optional().or(z.literal("")),
  })
  .strict()
  .superRefine((value, context) => {
    const italian = value.country === "IT";
    if (italian && !/^[0-9]{5}$/.test(value.postcode))
      context.addIssue({ code: "custom", path: ["postcode"], message: "CAP di cinque cifre." });
    if (italian && !value.province)
      context.addIssue({ code: "custom", path: ["province"], message: "Indica la provincia (sigla)." });
    if (value.kind === "private" && italian && !value.taxCode)
      context.addIssue({ code: "custom", path: ["taxCode"], message: "Il codice fiscale serve per la fattura." });
    if (value.kind === "business" && !value.vatNumber)
      context.addIssue({ code: "custom", path: ["vatNumber"], message: "Indica la partita IVA." });
    if (value.kind === "business" && italian && !value.sdiCode && !value.pec)
      context.addIssue({ code: "custom", path: ["sdiCode"], message: "Per le aziende serve il codice destinatario o la PEC." });
  });
export type BillingProfile = typeof billingProfiles.$inferSelect;
const clean = (v: string | undefined) => (v ? v : null);
export async function getBillingProfile(userId: string): Promise<BillingProfile | null> {
  const [row] = await getDb().select().from(billingProfiles).where(eq(billingProfiles.userId, userId));
  return row ?? null;
}
export async function requireBillingProfile(userId: string): Promise<BillingProfile> {
  const profile = await getBillingProfile(userId);
  if (!profile) throw new PlatformError(409, "BILLING_REQUIRED", "Inserisci i dati di fatturazione prima di pagare.");
  return profile;
}
export function publicBillingProfile(profile: BillingProfile | null) {
  if (!profile) return null;
  const { stripeCustomerId: _omit, ...rest } = profile;
  void _omit;
  return rest;
}
/** GET/PUT /me/billing: solo i propri dati, mai quelli di altri. */
export async function billingProfile(request: Request, actor: Actor) {
  if (request.method === "GET") return json({ billing: publicBillingProfile(await getBillingProfile(actor.id)) });
  if (request.method !== "PUT") throw notFound();
  const body = await readBody(request, billingProfileSchema);
  const values = {
    kind: body.kind,
    name: body.name,
    taxCode: clean(body.taxCode) ?? (body.kind === "business" ? clean(body.vatNumber) : null),
    vatNumber: body.kind === "business" ? clean(body.vatNumber) : null,
    street: body.street,
    postcode: body.postcode,
    city: body.city,
    province: clean(body.province),
    country: body.country,
    sdiCode: body.kind === "business" ? clean(body.sdiCode) : null,
    pec: body.kind === "business" ? clean(body.pec) : null,
    updatedAt: new Date(),
  };
  const [saved] = await getDb()
    .insert(billingProfiles)
    .values({ userId: actor.id, ...values })
    .onConflictDoUpdate({ target: billingProfiles.userId, set: values })
    .returning();
  await audit(actor, "billing.updated", "user", actor.id);
  return json({ billing: publicBillingProfile(saved!) });
}
