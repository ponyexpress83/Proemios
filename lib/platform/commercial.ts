import { z } from "zod";
import { serviceKeySchema } from "@/lib/validation";
import type { PricingInput } from "@/lib/pricing";

/**
 * Stato commerciale di una proposta. È separato dallo stato del pagamento
 * (ordini Stripe) e da quello del progetto (fasi editoriali).
 *
 * - estimate: stima indicativa dal listino, non acquistabile.
 * - review: l'autore ha chiesto la proposta definitiva, il team la sta valutando.
 * - offer: proposta definitiva, acquistabile; può avere una scadenza.
 * - accepted: accettata con condizioni; da qui in poi contano i pagamenti.
 */
export const COMMERCIAL_STATES = ["estimate", "review", "offer", "accepted"] as const;
export type CommercialState = (typeof COMMERCIAL_STATES)[number];

/**
 * Regola di acquistabilità automatica. Il comportamento prudente è la
 * revisione del team: solo i servizi singoli con prezzo fisso di listino, che
 * non dipendono dalla lettura del manoscritto, diventano proposte acquistabili
 * da soli. Il proprietario la cambia in Regole economiche.
 */
export const purchaseRuleSchema = z.object({
  version: z.string().min(1),
  autoOfferSingleServices: z.array(serviceKeySchema).default([]),
  autoOfferFullPath: z.boolean().default(false),
  validityDays: z.number().int().min(1).max(365).default(30),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
});
export type PurchaseRule = z.infer<typeof purchaseRuleSchema>;
export const defaultPurchaseRule: PurchaseRule = {
  version: "predefinita-2026-10-v1",
  autoOfferSingleServices: ["cover", "epub", "kdp", "isbn", "amazonListing"],
  autoOfferFullPath: false,
  validityDays: 30,
  approvedAt: "2026-10-15T00:00:00.000Z",
  approvedBy: "predefinita",
};

/** Il percorso commerciale che il progetto richiede. */
export type PurchasePath = "standard" | "evaluation" | "complex";
export function purchasePath(input: Pick<PricingInput, "projectType" | "textState" | "singleService">): PurchasePath {
  if (input.textState === "solo-materiali" || input.textState === "bozza-incompleta" || input.projectType === "memoir") return "complex";
  if (input.singleService) return "standard";
  return "evaluation";
}
/** Ghostwriting, memoir e bozze: non esiste un prezzo definitivo senza leggere i materiali. */
export function requiresTeamReview(input: Pick<PricingInput, "projectType" | "textState" | "singleService">): boolean {
  return purchasePath(input) === "complex";
}
export function initialCommercialState(input: PricingInput, rule: PurchaseRule): "estimate" | "offer" {
  if (requiresTeamReview(input)) return "estimate";
  if (input.singleService) return rule.autoOfferSingleServices.includes(input.singleService) ? "offer" : "estimate";
  return rule.autoOfferFullPath ? "offer" : "estimate";
}

/** Lo stato del percorso come lo vede l'autore: commerciale + pagamento, in un'unica etichetta. */
export type JourneyStage =
  | "estimate"
  | "review"
  | "offer"
  | "expired"
  | "accepted"
  | "processing"
  | "deposit_paid"
  | "paid";
export function journeyStage(
  record: { commercialState: string; acceptedAt: Date | string | null; expiresAt: Date | string | null },
  orders: Array<{ kind: string; status: string }>,
): JourneyStage {
  const paid = (kind: string) => orders.some((o) => o.kind === kind && o.status === "paid");
  const pending = orders.some((o) => o.status === "pending" && o.kind);
  if (record.acceptedAt || record.commercialState === "accepted") {
    if (paid("balance")) return "paid";
    if (paid("deposit")) return pending ? "processing" : "deposit_paid";
    return pending ? "processing" : "accepted";
  }
  if (record.commercialState === "offer") {
    const expiry = record.expiresAt ? new Date(record.expiresAt).getTime() : null;
    return expiry !== null && expiry <= Date.now() ? "expired" : "offer";
  }
  if (record.commercialState === "review") return "review";
  return "estimate";
}
export const JOURNEY_LABELS: Record<JourneyStage, { label: string; hint: string }> = {
  estimate: { label: "Stima indicativa", hint: "Calcolata dal listino sui dati inseriti. Diventa una proposta dopo la verifica del team." },
  review: { label: "In valutazione", hint: "Il team sta esaminando il progetto: riceverai la proposta definitiva." },
  offer: { label: "Proposta acquistabile", hint: "Prezzo e condizioni definitivi: puoi confermare e pagare l'acconto." },
  expired: { label: "Proposta scaduta", hint: "La validità è terminata: chiedi al team una nuova versione." },
  accepted: { label: "Accettata, in attesa di pagamento", hint: "Le condizioni sono bloccate. Il passo successivo è l'acconto." },
  processing: { label: "Pagamento in elaborazione", hint: "Stripe sta confermando il pagamento. Non serve ripetere l'operazione." },
  deposit_paid: { label: "Acconto confermato", hint: "Il lavoro può partire. Il saldo si paga alla consegna." },
  paid: { label: "Pagamento completato", hint: "Acconto e saldo confermati." },
};
