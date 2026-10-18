import type { PaymentPlan } from "@/db/platform-schema";

export type ScheduledPayment = { kind: "deposit" | "balance"; sequence: number; amountCents: number; label: string };
/**
 * Piano dei pagamenti di una proposta: acconto, poi il saldo in una o più rate
 * concesse dall'azienda. Gli importi sono interi in centesimi e la somma
 * torna sempre al totale: l'ultima rata assorbe l'arrotondamento. Le rate
 * offerte da Klarna/Scalapay dentro Stripe non compaiono qui: per noi sono
 * un incasso unico.
 */
export function installmentSchedule(grossCents: number, depositCents: number, plan: PaymentPlan | null | undefined): ScheduledPayment[] {
  const balance = grossCents - depositCents, count = Math.max(1, Math.min(12, plan?.installments ?? 1));
  const items: ScheduledPayment[] = [{ kind: "deposit", sequence: 1, amountCents: depositCents, label: "Acconto" }];
  if (balance <= 0) return items;
  if (count === 1) return [...items, { kind: "balance", sequence: 1, amountCents: balance, label: "Saldo alla consegna" }];
  const base = Math.floor(balance / count);
  for (let i = 1; i <= count; i++) items.push({ kind: "balance", sequence: i, amountCents: i === count ? balance - base * (count - 1) : base, label: `Rata ${i} di ${count} del saldo` });
  return items;
}
