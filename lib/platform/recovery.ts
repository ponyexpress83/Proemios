import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { createHmac } from "node:crypto";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { quoteRecords, leadOwnership, leadActivities, paymentOrders, emailOutbox, notifications, tasks, contracts } from "@/db/platform-schema";
import { impaginaEmail, esc } from "@/lib/email";
import { appOrigin } from "./config";
import { protectMailHtml } from "./mail";
import { getSetting } from "./crm";
import { pipelineState, type PipelineState } from "./pipeline";
import { syncBrevoContact } from "./brevo";

/**
 * Recuperi configurabili dei checkout abbandonati o falliti.
 *
 * Ogni passo ha un ritardo (ore), un canale e uno scopo. Prima di ogni invio
 * si rilegge lo stato: pagato, risposto, preso in carico da un venditore,
 * chiuso o consenso revocato fermano tutto. La chiave evento evita i doppioni;
 * il limite di frequenza vale per tutti i messaggi automatici al contatto.
 * I passi su canale «task» non inviano nulla: creano un'attività per il
 * venditore (telefonata, WhatsApp, SMS), che registra l'esito a mano.
 */
export const RECOVERY_PURPOSES = ["assistance", "contractual", "cart", "marketing"] as const;
export type RecoveryPurpose = (typeof RECOVERY_PURPOSES)[number];
export const recoveryStepSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,30}$/),
  afterHours: z.number().min(1).max(24 * 60),
  channel: z.enum(["email", "task"]),
  purpose: z.enum(RECOVERY_PURPOSES),
  subject: z.string().min(3).max(120).optional(),
  body: z.string().min(10).max(2000).optional(),
});
export const recoveryRulesSchema = z.object({
  version: z.string().min(1),
  enabled: z.boolean().default(true),
  /** Quali situazioni rientrano nel recupero. */
  triggers: z.array(z.enum(["checkout_started", "payment_failed"])).default(["checkout_started", "payment_failed"]),
  steps: z.array(recoveryStepSchema).max(6).default([]),
  /** Messaggi automatici massimi per contatto in 7 giorni, tutte le sequenze comprese. */
  maxPerWeek: z.number().int().min(1).max(10).default(3),
  /** Un venditore che registra un'attività dopo l'abbandono prende in carico il contatto: le automazioni si fermano. */
  stopOnSellerActivity: z.boolean().default(true),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
});
export type RecoveryRules = z.infer<typeof recoveryRulesSchema>;
export const defaultRecoveryRules: RecoveryRules = {
  version: "predefinita-2026-10-v1",
  enabled: true,
  triggers: ["checkout_started", "payment_failed"],
  steps: [
    { key: "reminder", afterHours: 2, channel: "email", purpose: "cart", subject: "Il tuo pagamento è rimasto in sospeso · Proemios", body: "il pagamento della tua proposta non è andato a buon fine o è rimasto a metà. Nessun importo è stato addebitato: puoi riprenderlo dalla tua area quando vuoi." },
    { key: "clarify", afterHours: 24, channel: "email", purpose: "assistance", subject: "Serve una mano con il pagamento? · Proemios", body: "se qualcosa non ha funzionato o hai un dubbio su importi, rate o tempi, rispondi a questa email: ti aiutiamo noi, senza impegno." },
    { key: "sales", afterHours: 60, channel: "task", purpose: "assistance" },
  ],
  maxPerWeek: 3,
  stopOnSellerActivity: true,
  approvedAt: "2026-10-16T00:00:00.000Z",
  approvedBy: "predefinita",
};
export async function resolveRecoveryRules(): Promise<RecoveryRules> {
  const saved = recoveryRulesSchema.safeParse(await getSetting("recovery-rules"));
  return saved.success ? saved.data : defaultRecoveryRules;
}
const HOUR = 3600_000, DAY = 86400_000;
type Lead = typeof leads.$inferSelect;
/**
 * Un'email si può mandare solo se lo scopo lo consente per questo contatto:
 * - assistance/contractual/cart: pratica aperta chiesta dalla persona, con
 *   informativa accettata (consensoPrivacy) e canale email non escluso;
 * - marketing: serve il consenso esplicito, non revocato.
 * L'indirizzo email da solo non basta mai.
 */
export function emailAllowed(lead: Pick<Lead, "consensoPrivacy" | "consensoMarketing" | "marketingRevokedAt" | "contactPreferences">, purpose: RecoveryPurpose): boolean {
  if (lead.contactPreferences && lead.contactPreferences.email === false) return false;
  if (purpose === "marketing") return lead.consensoMarketing && !lead.marketingRevokedAt;
  return lead.consensoPrivacy;
}
export function unsubscribeToken(leadId: string): string {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "").update(`unsubscribe:${leadId}`).digest("base64url").slice(0, 32);
}
export function unsubscribeLink(leadId: string): string {
  return `${appOrigin()}/api/consensi/revoca?lead=${leadId}&t=${unsubscribeToken(leadId)}`;
}
export type RecoveryResult = { sent: number; tasks: number; stopped: number; skipped?: boolean };
export async function runRecovery(now = new Date()): Promise<RecoveryResult> {
  const rules = await resolveRecoveryRules();
  const result: RecoveryResult = { sent: 0, tasks: 0, stopped: 0 };
  if (!rules.enabled || !rules.steps.length) return { ...result, skipped: true };
  const minDelay = Math.min(...rules.steps.map((s) => s.afterHours));
  // Candidati: ordini avviati o falliti da almeno il primo ritardo, nessun incasso sulla proposta.
  const candidates = await getDb()
    .select({ order: paymentOrders, quote: quotes, record: quoteRecords, lead: leads, ownership: leadOwnership })
    .from(paymentOrders)
    .innerJoin(quotes, eq(quotes.id, paymentOrders.quoteId))
    .innerJoin(quoteRecords, eq(quoteRecords.quoteId, quotes.id))
    .innerJoin(leads, eq(leads.id, quotes.leadId))
    .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
    .where(and(inArray(paymentOrders.status, ["pending", "failed", "expired"]), lte(paymentOrders.createdAt, new Date(now.getTime() - minDelay * HOUR)), isNull(quoteRecords.remindersPausedAt)))
    .orderBy(desc(paymentOrders.createdAt))
    .limit(200);
  const seenQuotes = new Set<string>();
  for (const row of candidates) {
    if (seenQuotes.has(row.quote.id)) continue;
    seenQuotes.add(row.quote.id);
    const orders = await getDb().select().from(paymentOrders).where(eq(paymentOrders.quoteId, row.quote.id));
    const state = pipelineState({ stage: row.lead.stage, quote: row.quote, record: row.record, orders });
    if (!rules.triggers.includes(state as "checkout_started" | "payment_failed")) continue;
    const [withdrawn] = await getDb().select({ id: contracts.id }).from(contracts).where(and(eq(contracts.quoteId, row.quote.id), sql`${contracts.withdrawalRequestedAt} is not null`)).limit(1);
    if (withdrawn) continue;
    const abandonedAt = orders.filter((o) => ["pending", "failed", "expired"].includes(o.status)).map((o) => o.createdAt).sort((a, b) => a.getTime() - b.getTime())[0] ?? row.order.createdAt;
    const since = await getDb().select().from(leadActivities).where(and(eq(leadActivities.leadId, row.lead.id), gte(leadActivities.createdAt, abandonedAt))).orderBy(leadActivities.createdAt);
    // Fermi: risposta della persona, presa in carico del venditore, stato manuale chiuso o in negoziazione.
    if (since.some((a) => a.direction === "inbound")) { result.stopped++; continue; }
    if (rules.stopOnSellerActivity && since.some((a) => a.actorId && a.kind !== "automation")) { result.stopped++; continue; }
    if (["negotiation", "lost", "unreachable"].includes(row.lead.stage)) { result.stopped++; continue; }
    const weekAutomations = await getDb().select({ count: sql<number>`count(*)::integer` }).from(leadActivities).where(and(eq(leadActivities.leadId, row.lead.id), eq(leadActivities.kind, "automation"), eq(leadActivities.channel, "email"), gte(leadActivities.createdAt, new Date(now.getTime() - 7 * DAY))));
    let weekly = weekAutomations[0]?.count ?? 0;
    for (const step of rules.steps) {
      if (now.getTime() - abandonedAt.getTime() < step.afterHours * HOUR) continue;
      const eventKey = `recovery:${row.quote.id}:${abandonedAt.getTime()}:${step.key}`;
      const [done] = await getDb().select({ id: leadActivities.id }).from(leadActivities).where(eq(leadActivities.eventKey, eventKey)).limit(1);
      if (done) continue;
      // Controllo dello stato subito prima dell'azione: un pagamento arrivato nel frattempo ferma tutto.
      const fresh = await getDb().select().from(paymentOrders).where(eq(paymentOrders.quoteId, row.quote.id));
      if (fresh.some((o) => o.status === "paid")) { result.stopped++; break; }
      if (step.channel === "email") {
        if (weekly >= rules.maxPerWeek) { result.stopped++; break; }
        if (!emailAllowed(row.lead, step.purpose)) {
          await getDb().insert(leadActivities).values({ leadId: row.lead.id, kind: "automation", channel: "email", purpose: step.purpose, body: `Passo «${step.key}» non inviato: consenso o canale non disponibile.`, outcome: "skipped", eventKey }).onConflictDoNothing();
          continue;
        }
        const href = row.ownership?.authorId ? `/area-autore/conferma/${row.quote.id}` : `/area-autore?preventivo=${row.quote.id}`;
        const footer = step.purpose === "marketing" ? `<p><small>Ricevi questo messaggio perché hai acconsentito alle comunicazioni di Proemios. <a href="${esc(unsubscribeLink(row.lead.id))}">Non ricevere più comunicazioni facoltative</a>.</small></p>` : `<p><small>Messaggio relativo alla tua richiesta aperta. Se hai già concluso, ignoralo: non riceverai altri promemoria.</small></p>`;
        const inserted = await getDb().insert(emailOutbox).values({
          eventKey: `${eventKey}:${row.lead.email}`,
          recipient: row.lead.email,
          subject: step.subject ?? "La tua proposta ti aspetta · Proemios",
          html: await protectMailHtml(impaginaEmail(step.subject?.replace(" · Proemios", "") ?? "La tua proposta ti aspetta", `<p>Ciao ${esc(row.lead.nome)}, ${esc(step.body ?? "il pagamento della tua proposta è rimasto in sospeso. Puoi riprenderlo dalla tua area quando vuoi.")}</p><p><a href="${esc(appOrigin())}${esc(href)}">Riprendi dalla tua area</a></p>${footer}`)),
        }).onConflictDoNothing().returning({ id: emailOutbox.id });
        await getDb().insert(leadActivities).values({ leadId: row.lead.id, kind: "automation", channel: "email", purpose: step.purpose, body: `Email di recupero «${step.key}» (${step.purpose}).`, outcome: inserted.length ? "sent" : "duplicate", eventKey }).onConflictDoNothing();
        if (inserted.length) { result.sent++; weekly++; }
        if (row.ownership?.authorId && inserted.length) await getDb().insert(notifications).values({ userId: row.ownership.authorId, title: "Il tuo pagamento è in sospeso", body: "Puoi riprenderlo dalla tua area quando vuoi.", href });
      } else {
        const seller = row.ownership?.assignedTo ?? null;
        const created = await getDb().insert(leadActivities).values({ leadId: row.lead.id, kind: "automation", channel: "task", purpose: step.purpose, body: seller ? `Attività manuale «${step.key}» assegnata al venditore.` : `Attività manuale «${step.key}»: nessun venditore assegnato, in coda al team.`, outcome: seller ? "assigned" : "unassigned", eventKey }).onConflictDoNothing().returning({ id: leadActivities.id });
        if (created.length && seller) {
          const prefs = row.lead.contactPreferences;
          const channels = prefs ? ["phone", "whatsapp", "sms"].filter((c) => prefs[c as "phone" | "whatsapp" | "sms"]).join(", ") || "email" : "canali da verificare con la persona";
          await getDb().insert(tasks).values({ leadId: row.lead.id, assignedTo: seller, createdBy: seller, title: `Recupera ${row.lead.nome}: pagamento ${state === "payment_failed" ? "fallito" : "in sospeso"} (${channels})`, internal: true, dueAt: new Date(now.getTime() + DAY) });
          await getDb().insert(notifications).values({ userId: seller, title: "Contatto da recuperare", body: `${row.lead.nome}: pagamento ${state === "payment_failed" ? "fallito" : "in sospeso"}. Canali ammessi: ${channels}. Nessun messaggio automatico su WhatsApp o SMS.`, href: `/spazio?lead=${row.lead.id}` });
          await getDb().update(leads).set({ stage: "recovery", nextAction: `Recupero: ${channels}`, nextActionAt: new Date(now.getTime() + DAY), updatedAt: now }).where(and(eq(leads.id, row.lead.id), sql`${leads.stage} not in ('negotiation','lost','unreachable','won')`));
          result.tasks++;
        }
      }
    }
  }
  return result;
}
/** Revoca del consenso alle comunicazioni facoltative tramite link firmato (nessun accesso richiesto). */
export async function revokeMarketingConsent(leadId: string, token: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(leadId).success || token !== unsubscribeToken(leadId)) return false;
  const [updated] = await getDb().update(leads).set({ consensoMarketing: false, marketingRevokedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId)).returning({ id: leads.id });
  if (updated) {
    await getDb().insert(leadActivities).values({ leadId, kind: "consent", channel: "email", direction: "inbound", purpose: "marketing", body: "Consenso alle comunicazioni facoltative revocato dal link.", outcome: "revoked" });
    await syncBrevoContact(leadId).catch(() => undefined);
  }
  return Boolean(updated);
}
export type { PipelineState };
