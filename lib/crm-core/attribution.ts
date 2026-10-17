/**
 * Attribuzione di una vendita, separata in fatti distinti: origine di
 * marketing (prima e ultima nota), affiliato, chi ha portato il contatto,
 * responsabile al momento della vendita, venditore accreditato, chiusura
 * autonoma o assistita. Ogni decisione porta motivo, prova e versione della
 * regola. Un conflitto si segnala, non si risolve in silenzio.
 */
import type { AttributionRules } from "./rules";

export type SalePath = "custom_quote" | "package_link" | "later_purchase" | "self_serve";
export type ContactDeal = { dealId: string; ownerId: string | null; ownerActive: boolean; status: "open" | "won" | "lost"; lastActivityAt: Date | null; closedAt: Date | null };
export type AttributionInput = {
  path: SalePath;
  now: Date;
  buyerUserId: string;
  /** La sessione dell'acquirente ha l'email verificata che corrisponde al contatto. */
  identityVerified: boolean;
  dealId: string | null;
  dealOwnerId: string | null;
  salesAssisted: boolean;
  link?: { createdBy: string; dealId: string | null; buyerEmailMatchesContact: boolean } | null;
  /** Altre trattative dello stesso cliente (esclusa quella della proposta). */
  otherDeals: ContactDeal[];
  affiliateId: string | null;
  sourcerId: string | null;
  marketing: { first: Record<string, unknown> | null; last: Record<string, unknown> | null; campaignId: string | null; channel: string | null };
};
export type Reason = { code: string; detail: string };
export type AttributionDecision = {
  path: SalePath;
  ownerAtSale: string | null;
  creditedSellerId: string | null;
  closing: "assisted" | "autonomous";
  affiliateId: string | null;
  sourcerId: string | null;
  status: "final" | "conflict";
  reasons: Reason[];
  conflicts: Array<Reason & { candidates: string[] }>;
  /** Chi riceve provvigione per questa vendita, dopo la regola di cumulo. */
  beneficiaries: { seller: string | null; affiliate: string | null };
  ruleVersion: string;
};

export function decideAttribution(input: AttributionInput, rules: AttributionRules): AttributionDecision {
  const reasons: Reason[] = [], conflicts: AttributionDecision["conflicts"] = [];
  let credited: string | null = null, closing: "assisted" | "autonomous" = "autonomous";
  const windowMs = rules.relationshipWindowDays * 86400_000;
  const recent = (d: ContactDeal) => d.status === "open" || (d.status === "won" && d.closedAt !== null && input.now.getTime() - d.closedAt.getTime() <= windowMs);

  if (input.path === "custom_quote") {
    credited = input.dealOwnerId;
    closing = "assisted";
    reasons.push({ code: "custom_quote", detail: "Proposta personalizzata preparata dal team sulla trattativa: accredito al responsabile della trattativa all'accettazione." });
  } else if (input.path === "package_link" && input.link) {
    credited = input.link.dealId && input.link.dealId === input.dealId ? input.dealOwnerId ?? input.link.createdBy : input.link.createdBy;
    closing = "assisted";
    reasons.push({ code: "package_link", detail: "Acquisto da link di pacchetto standard generato dalla trattativa." });
    if (!input.link.buyerEmailMatchesContact) reasons.push({ code: "email_differs", detail: "L'email verificata dell'acquirente è diversa da quella del contatto della trattativa: vale il link, non l'email." });
  } else {
    if (input.salesAssisted && input.dealOwnerId) {
      credited = input.dealOwnerId;
      closing = "assisted";
      reasons.push({ code: "assisted_deal", detail: "Il responsabile ha lavorato la proposta (revisione, invio o offerta)." });
    } else if (!input.identityVerified) {
      reasons.push({ code: "identity_not_verified", detail: "Identità non verificata: nessun accredito per relazione precedente." });
    } else if (rules.laterPurchase === "credit_recent_owner") {
      const pool = [...new Set(input.otherDeals.filter((d) => recent(d) && d.ownerId && d.ownerActive).map((d) => d.ownerId!))];
      if (pool.length === 1) {
        credited = pool[0]!;
        reasons.push({ code: "relationship_window", detail: `Cliente seguito da questo venditore negli ultimi ${rules.relationshipWindowDays} giorni o con trattativa aperta; acquisto concluso in autonomia.` });
      } else if (pool.length > 1) {
        conflicts.push({ code: "multiple_owners", detail: "Più venditori hanno una relazione recente con il cliente: serve una decisione autorizzata.", candidates: pool });
      } else {
        reasons.push({ code: "autonomous", detail: "Nessuna relazione commerciale recente: acquisto autonomo." });
      }
    } else {
      reasons.push({ code: "autonomous", detail: "La regola non accredita acquisti successivi senza link." });
    }
    if (input.path === "later_purchase") reasons.push({ code: "later_purchase", detail: "Acquisto successivo dal sito o dall'account, con identità verificata." });
  }
  // Trattative aperte concorrenti con responsabili diversi: sempre segnalate.
  const rivals = [...new Set(input.otherDeals.filter((d) => d.status === "open" && d.ownerId && d.ownerId !== credited).map((d) => d.ownerId!))];
  if (credited && rivals.length && !conflicts.length)
    conflicts.push({ code: "concurrent_deals", detail: "Lo stesso cliente ha altre trattative aperte con responsabili diversi.", candidates: [credited, ...rivals] });
  if (credited === input.buyerUserId) {
    reasons.push({ code: "self_purchase", detail: "Il venditore è anche l'acquirente: nessun accredito." });
    credited = null;
  }
  let affiliate = input.affiliateId && input.affiliateId !== input.buyerUserId ? input.affiliateId : null;
  let seller = conflicts.length ? null : credited;
  if (affiliate && affiliate === seller) {
    reasons.push({ code: "same_person", detail: "Affiliato e venditore sono la stessa persona: una sola provvigione, come venditore." });
    affiliate = null;
  }
  if (affiliate && seller && rules.affiliateAndSeller !== "both") {
    reasons.push({ code: "stacking_rule", detail: `Regola di cumulo «${rules.affiliateAndSeller}».` });
    if (rules.affiliateAndSeller === "seller_only") affiliate = null;
    else seller = null;
  }
  return {
    path: input.path,
    ownerAtSale: input.dealOwnerId,
    creditedSellerId: conflicts.length ? null : credited,
    closing,
    affiliateId: input.affiliateId,
    sourcerId: input.sourcerId,
    status: conflicts.length ? "conflict" : "final",
    reasons,
    conflicts,
    beneficiaries: { seller, affiliate },
    ruleVersion: rules.version,
  };
}
