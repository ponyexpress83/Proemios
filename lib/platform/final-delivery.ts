import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { quotes } from "@/db/schema";
import type { projects } from "@/db/platform-schema";
import { PlatformError } from "./http";

type ProjectRef = Pick<typeof projects.$inferSelect, "quoteId">;

/**
 * La consegna finale (fase «consegnato» o versione Definitiva dello Studio)
 * richiede il saldo confermato quando la regola d'acquisto approvata lo
 * prevede. I progetti senza proposta non sono vincolati. Nessuna eccezione per
 * ruolo: il controllo dipende solo dai fatti del pagamento.
 */
export async function finalDeliveryAllowed(project: ProjectRef): Promise<boolean> {
  if (!project.quoteId) return true;
  const { resolvePurchaseRule } = await import("./crm");
  const rule = await resolvePurchaseRule();
  if (!rule.balanceBeforeDelivery) return true;
  const [quoteRow] = await getDb().select({ stato: quotes.stato }).from(quotes).where(eq(quotes.id, project.quoteId));
  return quoteRow?.stato === "won";
}

export async function assertBalanceForFinalDelivery(project: ProjectRef) {
  if (!(await finalDeliveryAllowed(project))) throw new PlatformError(409, "BALANCE_REQUIRED", "La consegna finale avviene dopo il saldo confermato. Il cliente trova il pagamento nella sua area.");
}
