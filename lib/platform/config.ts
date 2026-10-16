import { z } from "zod";

const empty = (value: string | undefined) => value?.trim() || undefined;
export function applicationOrigins(): string[] {
  const candidates = [empty(process.env.APP_URL), empty(process.env.BETTER_AUTH_URL)];
  for (const key of ["VERCEL_URL", "VERCEL_BRANCH_URL"] as const) {
    if (process.env[key]) candidates.push(`https://${process.env[key]}`);
  }
  return [
    ...new Set(
      candidates.filter(Boolean).map((value) => {
        const url = new URL(value!);
        if (
          url.protocol !== "https:" &&
          !(["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:")
        )
          throw new Error("APP_URL deve usare HTTPS.");
        return url.origin;
      }),
    ),
  ];
}
export function appOrigin(): string {
  return applicationOrigins()[0] ?? "http://localhost:3000";
}
export function authConfigured(): boolean {
  return Boolean(
    empty(process.env.DATABASE_URL) &&
    (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 &&
    applicationOrigins().length,
  );
}
export function mailConfigured(): boolean {
  return Boolean(
    (empty(process.env.RESEND_API_KEY) && empty(process.env.EMAIL_FROM)) ||
    (process.env.PROEMIOS_TEST_RUN === "1" &&
      !process.env.VERCEL &&
      process.env.PROEMIOS_TEST_MAIL_DIR),
  );
}
export function explicitDemo(): boolean {
  return process.env.DEMO_MODE === "on" && process.env.VERCEL_ENV !== "production";
}
export const pricingVersion = "listino-2026-10-v1";
export const termsVersion = "2026-10-v1";
export const commissionRuleSchema = z.object({
  version: z.string().min(1),
  sellerBps: z.number().int().min(0).max(10000),
  affiliateBps: z.number().int().min(0).max(10000),
  base: z.literal("collected-excluding-tax"),
  attributionDays: z.number().int().min(1).max(365),
  attribution: z.literal("code-on-quote"),
  /** Provvigione al venditore solo con un intervento commerciale tracciato (revisione, invio, offerta), non per la sola assegnazione. */
  assistedSalesOnly: z.boolean().default(false),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
});
export type CommissionRule = z.infer<typeof commissionRuleSchema>;
export const paymentPolicySchema = z
  .object({
    version: z.string().min(1),
    vatMode: z.enum(["included", "excluded", "exempt"]),
    vatRateBps: z.number().int().min(0).max(3000),
    termsVersion: z.string().min(1),
    approvedAt: z.string().datetime(),
    approvedBy: z.string().min(1),
  })
  .refine((p) => p.vatMode !== "exempt" || p.vatRateBps === 0);
export type PaymentPolicy = z.infer<typeof paymentPolicySchema>;
/**
 * Policy predefinita, in vigore finché l'owner non ne approva una in
 * Regole economiche: IVA ordinaria al 22 %, esclusa dai prezzi del listino
 * (`config/pricing.ts` li dichiara IVA esclusa). Senza una policy i preventivi
 * pubblici nascevano senza condizioni fiscali e non si potevano né accettare
 * né pagare. La versione esplicita «predefinita» resta visibile nello snapshot
 * di ogni proposta, così si sa quali condizioni valevano al momento.
 */
export const defaultPaymentPolicy: PaymentPolicy = {
  version: "predefinita-2026-10-v1",
  vatMode: "excluded",
  vatRateBps: 2200,
  termsVersion,
  approvedAt: "2026-10-14T00:00:00.000Z",
  approvedBy: "predefinita",
};
export function moneyBreakdown(euros: number, policy: PaymentPolicy) {
  const original = Math.round(euros * 100);
  const gross =
    policy.vatMode === "excluded"
      ? Math.round((original * (10000 + policy.vatRateBps)) / 10000)
      : original;
  const net =
    policy.vatMode === "included"
      ? Math.round((gross * 10000) / (10000 + policy.vatRateBps))
      : original;
  return { grossCents: gross, netCents: net, taxCents: gross - net };
}
