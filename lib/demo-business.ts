
/**
 * Isolated browser-only scenario engine for the TEAM SANDBOX.
 *
 * These objects are synthetic. Never import this module into any production
 * checkout, authentication, CRM API, Stripe webhook, or financial ledger.
 */
import { editingCost, proofreadingCost, layoutCost, ghostwritingCost } from "@/lib/pricing";
import { FLAT_SERVICES, PROJECT_MINIMUM } from "@/config/pricing";

export type DemoRole = "autore" | "sales1" | "sales2" | "admin" | "operatore" | "redattore" | "finance" | "affiliato";
export type DemoPlan = "unica" | "acconto" | "tre_rate" | "quattro_rate" | "mensile";
export type DemoKind = "proofreading" | "editing" | "layout" | "epub" | "cover" | "kdp" | "ghostwriting" | "traduzione" | "retainer";
export type DemoStage = "in_attesa_pagamento" | "in_lavorazione" | "in_revisione" | "approvato" | "consegnato";
export type DemoLeadStage = "Nuovo" | "Qualificato" | "Proposta" | "Acquisito";
export type DemoInstallment = { id: string; label: string; amountCents: number; status: "da_pagare" | "pagata" };
export type DemoLead = { id: string; title: string; source: string; seller: "Sales 1" | "Sales 2"; stage: DemoLeadStage; nextAction: string; orderId?: string };
export type DemoOrder = {
  id: string; leadId: string; parentOrderId?: string; title: string; service: DemoKind; words: number;
  totalCents: number; plan: DemoPlan; installments: DemoInstallment[]; stage: DemoStage; seller: "Sales 1" | "Sales 2";
  source: string; createdAt: string; affiliate: boolean;
};
export type DemoEvent = { id: string; label: string; detail: string; orderId?: string; valueCents?: number; eventType: "ordine" | "pagamento" | "rifiuto" | "fase" | "sales" };
export type DemoState = { version: 1; leads: DemoLead[]; orders: DemoOrder[]; events: DemoEvent[] };
export const DEMO_STORAGE_KEY = "proemios-team-sandbox-v1";

export const roles: { id: DemoRole; title: string; description: string }[] = [
  { id: "autore", title: "Autore", description: "Preventivo, ordine e pagamento di prova" },
  { id: "sales1", title: "Venditore 1", description: "Lead assegnati, proposta e follow-up" },
  { id: "sales2", title: "Venditore 2", description: "Lead assegnati, proposta e follow-up" },
  { id: "admin", title: "Amministratore", description: "Panoramica, lead e commesse" },
  { id: "operatore", title: "Operatore", description: "Lavorazioni, revisioni e consegne" },
  { id: "redattore", title: "Redattore", description: "Revisione e approvazione umana" },
  { id: "finance", title: "Finance", description: "Scadenze, incassi e controllo ordini" },
  { id: "affiliato", title: "Affiliato", description: "Referral e commissioni simulate" },
];

export const offerings: { id: DemoKind; name: string; subtitle: string; automated: boolean; requiresWords: boolean }[] = [
  { id: "proofreading", name: "Correzione bozze", subtitle: "Testo già scritto", automated: true, requiresWords: true },
  { id: "editing", name: "Editing", subtitle: "Valutazione del testo prima di confermare l'offerta", automated: false, requiresWords: true },
  { id: "layout", name: "Impaginazione", subtitle: "Produzione cartacea", automated: true, requiresWords: true },
  { id: "epub", name: "Conversione EPUB", subtitle: "Servizio standard", automated: true, requiresWords: false },
  { id: "cover", name: "Copertina", subtitle: "Brief grafico da approvare", automated: true, requiresWords: false },
  { id: "kdp", name: "Pubblicazione KDP", subtitle: "Pubblicazione assistita", automated: true, requiresWords: false },
  { id: "ghostwriting", name: "Ghostwriting", subtitle: "Progetto personalizzato", automated: false, requiresWords: true },
  { id: "traduzione", name: "Traduzione in italiano", subtitle: "Esempio di prezzo storico, non listino generale", automated: false, requiresWords: false },
  { id: "retainer", name: "Supporto editoriale continuativo", subtitle: "Esempio di canone mensile B2B", automated: false, requiresWords: false },
];

export const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(cents / 100);

export function estimateOffer(kind: DemoKind, words: number): number {
  const w = Math.max(1, Math.min(2_000_000, Math.round(words || 1)));
  const euros = (() => {
    switch (kind) {
      case "proofreading": return proofreadingCost(w);
      case "editing": return editingCost(w);
      case "layout": return layoutCost(w);
      case "epub": return FLAT_SERVICES.epub;
      case "cover": return FLAT_SERVICES.cover;
      case "kdp": return FLAT_SERVICES.kdpPublishing;
      case "ghostwriting": return ghostwritingCost(w, "parziale");
      // Examples informed by source documents; NOT automated commercial offers.
      case "traduzione": return 300;
      case "retainer": return 500;
    }
  })();
  return Math.round(Math.max(kind === "retainer" ? 0 : PROJECT_MINIMUM, euros) * 100);
}

/** Sum amounts exactly in euro cents, adjusting the final installment. */
export function installmentsFor(totalCents: number, plan: DemoPlan): DemoInstallment[] {
  const splits = plan === "acconto" ? [40, 60]
    : plan === "tre_rate" ? [34, 33, 33]
    : plan === "quattro_rate" ? [40, 30, 20, 10]
    : plan === "mensile" ? [100]
    : [100];
  let remaining = totalCents;
  return splits.map((pct, i) => {
    const cents = i === splits.length - 1 ? remaining : Math.round(totalCents * pct / 100);
    remaining -= cents;
    return { id: `rata-${i + 1}`, label: plan === "mensile" ? "Prima mensilità (demo)" : `Rata ${i + 1} · ${pct}%`,
      amountCents: cents, status: "da_pagare" as const };
  });
}

export function paidCents(order: DemoOrder): number {
  return order.installments.filter((x) => x.status === "pagata").reduce((a, b) => a + b.amountCents, 0);
}

export function initialDemoState(): DemoState {
  return {
    version: 1,
    leads: [
      { id: "LEAD-01", title: "Romanzo da revisionare · esempio", source: "Google Ads", seller: "Sales 1", stage: "Qualificato", nextAction: "Call conoscitiva" },
      { id: "LEAD-02", title: "Libro professionale · esempio", source: "LinkedIn", seller: "Sales 2", stage: "Proposta", nextAction: "Confermare proposta" },
      { id: "LEAD-03", title: "Memorie di famiglia · esempio", source: "Meta Ads", seller: "Sales 1", stage: "Nuovo", nextAction: "Primo contatto" },
      { id: "LEAD-04", title: "Accordo agenzia · esempio", source: "Referral", seller: "Sales 2", stage: "Nuovo", nextAction: "Call B2B" },
    ],
    orders: [],
    events: [],
  };
}

function nextId(state: DemoState): number {
  return state.orders.length + 1;
}
function log(state: DemoState, event: Omit<DemoEvent, "id">): DemoEvent[] {
  return [{ id: `EV-${state.events.length + 1}`, ...event }, ...state.events].slice(0, 100);
}
function sellerForLead(state: DemoState): "Sales 1" | "Sales 2" {
  const a = state.leads.filter((l) => l.seller === "Sales 1" && l.stage !== "Acquisito").length;
  const b = state.leads.filter((l) => l.seller === "Sales 2" && l.stage !== "Acquisito").length;
  return a <= b ? "Sales 1" : "Sales 2";
}
export function createOrder(state: DemoState, data: {
  kind: DemoKind; words: number; plan: DemoPlan; parentOrderId?: string; affiliate?: boolean;
}): DemoState {
  const offering = offerings.find((x) => x.id === data.kind);
  if (!offering) return state;
  const parent = data.parentOrderId ? state.orders.find((o) => o.id === data.parentOrderId) : undefined;
  if (data.parentOrderId && !parent) return state;
  const serial = nextId(state);
  const id = `DEMO-${String(serial).padStart(4, "0")}`;
  const seller = parent?.seller ?? sellerForLead(state);
  const leadId = parent?.leadId ?? `LEAD-${String(state.leads.length + 1).padStart(2, "0")}`;
  const totalCents = estimateOffer(data.kind, data.words);
  const order: DemoOrder = {
    id, leadId, parentOrderId: parent?.id, title: offering.name + " · progetto dimostrativo",
    service: data.kind, words: data.words, totalCents, plan: data.plan,
    installments: installmentsFor(totalCents, data.plan), stage: "in_attesa_pagamento",
    seller, source: parent ? "Servizio aggiuntivo" : data.affiliate ? "Affiliato (demo)" : "Landing / Ads (demo)",
    createdAt: new Date().toISOString(), affiliate: Boolean(data.affiliate),
  };
  const leads = parent ? state.leads : [{ id: leadId, title: order.title, source: order.source,
    seller, stage: "Proposta" as DemoLeadStage, nextAction: "Accettazione e pagamento", orderId: id }, ...state.leads];
  return { ...state, orders: [order, ...state.orders], leads,
    events: log(state, { label: "Nuovo ordine", detail: `${offering.name} · ${seller}`, orderId: id, eventType: "ordine", valueCents: totalCents }) };
}
export function paymentAction(state: DemoState, orderId: string, installmentId: string, approved: boolean): DemoState {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return state;
  const installment = order.installments.find((i) => i.id === installmentId);
  if (!installment || installment.status === "pagata") return state;
  const nextUnpaid = order.installments.find((x) => x.status === "da_pagare");
  if (nextUnpaid?.id !== installmentId) return state;
  if (!approved) return { ...state, events: log(state,
    { label: "Pagamento rifiutato (simulazione)", detail: `${orderId}: nessun importo registrato`, orderId, eventType: "rifiuto" }) };
  const orders = state.orders.map((o): DemoOrder => o.id === orderId ? {
    ...o, installments: o.installments.map((i) => i.id === installmentId ? { ...i, status: "pagata" } : i),
    stage: o.stage === "in_attesa_pagamento" ? "in_lavorazione" : o.stage,
  } : o);
  const leads = state.leads.map(l => l.id === order.leadId ? { ...l, stage: "Acquisito" as DemoLeadStage, nextAction: "Handoff alla produzione" } : l);
  return { ...state, orders, leads, events: log(state,
    { label: "Rata pagata (simulazione)", detail: `${orderId} · ${installment.label}`, orderId, eventType: "pagamento", valueCents: installment.amountCents }) };
}
export function leadAction(state: DemoState, leadId: string, stage: DemoLeadStage): DemoState {
  if (!state.leads.some(l => l.id === leadId)) return state;
  return { ...state, leads: state.leads.map(l => l.id === leadId ? { ...l, stage, nextAction: stage === "Qualificato" ? "Organizzare call" : stage === "Proposta" ? "Inviare offerta" : stage === "Acquisito" ? "Handoff" : "Primo contatto" } : l),
    events: log(state, { label: "Trattativa aggiornata", detail: `${leadId}: ${stage}`, eventType: "sales" }) };
}
export function progressAction(state: DemoState, orderId: string, actor: "operatore" | "redattore"): DemoState {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return state;
  const next: DemoStage | undefined = actor === "operatore"
    ? order.stage === "in_lavorazione" ? "in_revisione" : order.stage === "approvato" && paidCents(order) === order.totalCents ? "consegnato" : undefined
    : order.stage === "in_revisione" ? "approvato" : undefined;
  if (!next) return state;
  return { ...state, orders: state.orders.map(o => o.id === orderId ? { ...o, stage: next } : o),
    events: log(state, { label: "Fase aggiornata", detail: `${orderId}: ${next}`, eventType: "fase", orderId }) };
}
export function demoStats(state: DemoState) {
  return { leads: state.leads.length, orders: state.orders.length,
    contracted: state.orders.reduce((v, o) => v + o.totalCents, 0),
    collected: state.orders.reduce((v, o) => v + paidCents(o), 0),
    outstanding: state.orders.reduce((v, o) => v + o.totalCents - paidCents(o), 0),
    ready: state.orders.filter((o) => o.stage === "approvato").length,
  };
}
