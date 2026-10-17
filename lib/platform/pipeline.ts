/**
 * Stati dell'opportunità commerciale, unificati per tutte le origini (sito,
 * marketplace, importazioni). Lo stato non è mai dedotto a mano dal pagamento:
 * «acquisto concluso» esiste solo con un incasso verificato dal webhook.
 *
 * Parte degli stati è derivata dai fatti (proposta, contratto, ordini); gli
 * altri (recupero, negoziazione, perso, non contattabile) li imposta il team e
 * restano in `leads.stage`. I valori storici (new, contacted, qualified,
 * proposal) vengono letti come sinonimi e non richiedono migrazione dei dati.
 */
export const PIPELINE_STATES = [
  "received", // lead ricevuto
  "quote_in_progress", // preventivo in compilazione (stima, valutazione)
  "quote_ready", // proposta definitiva pronta, non ancora inviata
  "quote_sent", // proposta inviata o resa acquistabile
  "accepted", // contratto accettato, nessun incasso
  "checkout_started", // pagamento avviato, in attesa del provider
  "payment_failed", // pagamento fallito o sessione scaduta
  "recovery", // contatto da recuperare (impostato dal team o dall'automazione)
  "negotiation", // trattativa in corso con il venditore
  "won", // acquisto concluso (incasso verificato)
  "lost", // perso
  "unreachable", // non contattabile
] as const;
export type PipelineState = (typeof PIPELINE_STATES)[number];
export const MANUAL_STATES: PipelineState[] = ["received", "recovery", "negotiation", "lost", "unreachable"];
export const CLOSED_STATES: PipelineState[] = ["won", "lost", "unreachable"];
export const PIPELINE_LABELS: Record<PipelineState, string> = {
  received: "Lead ricevuto",
  quote_in_progress: "Preventivo in compilazione",
  quote_ready: "Proposta pronta",
  quote_sent: "Proposta inviata",
  accepted: "Accettata, da pagare",
  checkout_started: "Checkout avviato",
  payment_failed: "Pagamento fallito",
  recovery: "Da recuperare",
  negotiation: "In negoziazione",
  won: "Acquisto concluso",
  lost: "Perso",
  unreachable: "Non contattabile",
};
/** Valori storici di leads.stage letti come stati attuali. */
export const LEGACY_STAGES: Record<string, PipelineState> = { new: "received", contacted: "received", qualified: "quote_in_progress", proposal: "quote_sent", won: "won", lost: "lost" };
export function normalizeStage(stage: string): PipelineState {
  return (PIPELINE_STATES as readonly string[]).includes(stage) ? (stage as PipelineState) : (LEGACY_STAGES[stage] ?? "received");
}
export const PAID_STATUSES = ["paid", "partially_refunded", "refunded", "disputed", "review_required"];
export type PipelineFacts = {
  stage: string;
  quote?: { stato: string; createdAt: Date } | null;
  record?: { commercialState: string; acceptedAt: Date | null; offeredAt: Date | null; expiresAt: Date | null } | null;
  orders?: Array<{ kind: string; status: string; updatedAt?: Date }>;
};
export function pipelineState(facts: PipelineFacts): PipelineState {
  const manual = normalizeStage(facts.stage);
  if (CLOSED_STATES.includes(manual)) return manual;
  const orders = facts.orders ?? [];
  // Un incasso verificato, anche se poi rimborsato o contestato, resta un acquisto concluso: il seguito è di Finance.
  if (orders.some((o) => PAID_STATUSES.includes(o.status))) return "won";
  // Scelte del team (recupero, negoziazione) prevalgono sugli stati derivati non chiusi.
  if (manual === "negotiation" || manual === "recovery") return manual;
  if (orders.some((o) => o.status === "pending")) return "checkout_started";
  if (orders.some((o) => ["failed", "expired"].includes(o.status))) return "payment_failed";
  if (facts.record?.acceptedAt || facts.record?.commercialState === "accepted") return "accepted";
  if (!facts.quote || !facts.record) return "received";
  if (facts.record.commercialState === "offer") return facts.quote.stato === "sent" || facts.record.offeredAt ? "quote_sent" : "quote_ready";
  return "quote_in_progress";
}
/**
 * Transizioni manuali ammesse. Gli stati derivati non si impostano a mano;
 * «won» mai (lo decide l'incasso). «lost» e «unreachable» richiedono un motivo.
 */
export function manualTransitionAllowed(current: PipelineState, next: PipelineState): boolean {
  if (!MANUAL_STATES.includes(next)) return false;
  if (current === "won") return false;
  return true;
}
