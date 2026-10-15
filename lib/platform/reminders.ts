import { and, eq, isNull, lte, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { quoteRecords, leadOwnership, paymentOrders, projects, projectFiles, approvals, accountPreferences, emailOutbox, notifications } from "@/db/platform-schema";
import { user } from "@/db/auth-schema";
import { impaginaEmail, esc } from "@/lib/email";
import { appOrigin } from "./config";
import { protectMailHtml } from "./mail";
import { getSetting } from "./crm";

/**
 * Promemoria automatici del percorso di acquisto. Ogni regola guarda lo stato
 * attuale: se lo stato è cambiato, il promemoria non parte. La chiave evento
 * (tipo + proposta + soglia) evita i doppioni; la pausa del responsabile e la
 * preferenza dell'autore fermano la sequenza. Nessun marketing: solo la
 * pratica aperta della persona.
 */
export const reminderRulesSchema = z.object({
  version: z.string().min(1),
  enabled: z.boolean().default(true),
  /** Proposta (stima o acquistabile) senza accettazione: giorni dalla creazione. */
  unconfirmedDays: z.array(z.number().int().min(1).max(90)).max(5).default([3, 7]),
  /** Proposta acquistabile vicina alla scadenza: giorni prima. */
  expiryDays: z.number().int().min(1).max(30).default(2),
  /** Accettata senza acconto: giorni dall'accettazione. */
  unpaidDays: z.array(z.number().int().min(1).max(90)).max(5).default([2, 5]),
  /** Acconto pagato ma nessun materiale caricato: giorni dall'incasso. */
  materialsDays: z.array(z.number().int().min(1).max(90)).max(5).default([3, 10]),
  /** Consegna disponibile senza decisione: giorni dalla consegna. */
  approvalDays: z.array(z.number().int().min(1).max(90)).max(5).default([3, 7]),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
});
export type ReminderRules = z.infer<typeof reminderRulesSchema>;
export const defaultReminderRules: ReminderRules = {
  version: "predefinita-2026-10-v1",
  enabled: true,
  unconfirmedDays: [3, 7],
  expiryDays: 2,
  unpaidDays: [2, 5],
  materialsDays: [3, 10],
  approvalDays: [3, 7],
  approvedAt: "2026-10-15T00:00:00.000Z",
  approvedBy: "predefinita",
};
export async function resolveReminderRules(): Promise<ReminderRules> {
  const saved = reminderRulesSchema.safeParse(await getSetting("reminder-rules"));
  return saved.success ? saved.data : defaultReminderRules;
}
const DAY = 86400_000;
type Candidate = { eventKey: string; recipient: string; name: string; subject: string; title: string; body: string; href: string; userId: string | null; first: boolean };
async function optionalMailAllowed(userId: string | null): Promise<boolean> {
  if (!userId) return true;
  const [pref] = await getDb().select({ optionalEmail: accountPreferences.optionalEmail }).from(accountPreferences).where(eq(accountPreferences.userId, userId));
  return pref?.optionalEmail ?? false;
}
async function deliver(c: Candidate) {
  // Il primo promemoria di una pratica è operativo; i successivi rispettano la
  // preferenza "notifiche facoltative" dell'account collegato.
  if (!c.first && !(await optionalMailAllowed(c.userId))) return false;
  const inserted = await getDb()
    .insert(emailOutbox)
    .values({
      eventKey: c.eventKey,
      recipient: c.recipient,
      subject: c.subject,
      html: await protectMailHtml(impaginaEmail(c.title, `<p>Ciao ${esc(c.name)}, ${esc(c.body)}</p><p><a href="${esc(appOrigin())}${esc(c.href)}">Apri la tua area</a></p><p>Se hai già fatto, ignora questo messaggio: i promemoria si fermano da soli.</p>`)),
    })
    .onConflictDoNothing()
    .returning({ id: emailOutbox.id });
  if (inserted.length && c.userId) await getDb().insert(notifications).values({ userId: c.userId, title: c.title, body: c.body, href: c.href });
  return inserted.length > 0;
}
export async function runReminders(now = new Date()) {
  const rules = await resolveReminderRules();
  if (!rules.enabled) return { sent: 0, skipped: true };
  let sent = 0;
  const age = (from: Date | null, days: number) => from !== null && now.getTime() - from.getTime() >= days * DAY;
  // 1. Proposte senza accettazione (stima o acquistabile), non in valutazione.
  const open = await getDb()
    .select({ quote: quotes, record: quoteRecords, lead: leads, ownership: leadOwnership })
    .from(quoteRecords)
    .innerJoin(quotes, eq(quotes.id, quoteRecords.quoteId))
    .innerJoin(leads, eq(leads.id, quotes.leadId))
    .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
    .where(and(isNull(quoteRecords.acceptedAt), isNull(quoteRecords.remindersPausedAt), inArray(quoteRecords.commercialState, ["estimate", "offer"]), lte(quotes.createdAt, new Date(now.getTime() - Math.min(...rules.unconfirmedDays, rules.expiryDays) * DAY))))
    .limit(200);
  for (const row of open) {
    if (!row.lead.consensoPrivacy) continue;
    const expired = row.record.expiresAt && row.record.expiresAt.getTime() <= now.getTime();
    if (expired) continue;
    const href = row.ownership?.authorId ? `/area-autore/conferma/${row.quote.id}` : `/area-autore?preventivo=${row.quote.id}`;
    const offer = row.record.commercialState === "offer";
    for (const [i, days] of rules.unconfirmedDays.entries())
      if (age(row.quote.createdAt, days) && (await deliver({
        eventKey: `reminder:unconfirmed:${row.quote.id}:${days}d`, recipient: row.lead.email, name: row.lead.nome, userId: row.ownership?.authorId ?? null, first: i === 0,
        subject: offer ? "La tua proposta ti aspetta · Proemios" : "La tua stima è pronta · Proemios",
        title: offer ? "La proposta ti aspetta" : "La stima è pronta",
        body: offer ? "la proposta definitiva per il tuo libro è ancora disponibile: puoi confermarla e pagare l'acconto quando vuoi." : "la stima del tuo libro è pronta. Quando vuoi, chiedi la proposta definitiva: il team verifica il progetto e ti conferma prezzo e condizioni.",
        href,
      }))) sent++;
    if (offer && row.record.expiresAt && row.record.expiresAt.getTime() - now.getTime() <= rules.expiryDays * DAY && (await deliver({
      eventKey: `reminder:expiry:${row.quote.id}:${row.record.version}`, recipient: row.lead.email, name: row.lead.nome, userId: row.ownership?.authorId ?? null, first: true,
      subject: "La proposta scade tra poco · Proemios", title: "La proposta scade tra poco",
      body: `la proposta definitiva vale fino al ${row.record.expiresAt.toLocaleDateString("it-IT")}. Dopo quella data chiedi al team una nuova versione.`, href,
    }))) sent++;
  }
  // 2. Accettate senza acconto confermato.
  const accepted = await getDb()
    .select({ quote: quotes, record: quoteRecords, lead: leads, ownership: leadOwnership })
    .from(quoteRecords)
    .innerJoin(quotes, eq(quotes.id, quoteRecords.quoteId))
    .innerJoin(leads, eq(leads.id, quotes.leadId))
    .leftJoin(leadOwnership, eq(leadOwnership.leadId, leads.id))
    .where(and(isNull(quoteRecords.remindersPausedAt), lte(quoteRecords.acceptedAt, new Date(now.getTime() - Math.min(...rules.unpaidDays) * DAY))))
    .limit(200);
  for (const row of accepted) {
    const paid = await getDb().select({ id: paymentOrders.id }).from(paymentOrders).where(and(eq(paymentOrders.quoteId, row.quote.id), eq(paymentOrders.kind, "deposit"), eq(paymentOrders.status, "paid"))).limit(1);
    if (paid.length) continue;
    for (const [i, days] of rules.unpaidDays.entries())
      if (age(row.record.acceptedAt, days) && (await deliver({
        eventKey: `reminder:unpaid:${row.quote.id}:${days}d`, recipient: row.lead.email, name: row.lead.nome, userId: row.ownership?.authorId ?? null, first: i === 0,
        subject: "Manca solo l'acconto · Proemios", title: "Manca solo l'acconto",
        body: "hai accettato la proposta: il lavoro parte quando l'acconto è confermato. Puoi pagarlo dalla tua area in pochi minuti.",
        href: `/area-autore/conferma/${row.quote.id}`,
      }))) sent++;
  }
  // 3. Acconto pagato, materiali mancanti.
  const waitingMaterials = await getDb()
    .select({ project: projects, paidAt: paymentOrders.updatedAt, email: user.email, name: user.name })
    .from(projects)
    .innerJoin(paymentOrders, and(eq(paymentOrders.quoteId, projects.quoteId), eq(paymentOrders.kind, "deposit"), eq(paymentOrders.status, "paid")))
    .innerJoin(user, eq(user.id, projects.authorId))
    .where(and(eq(projects.stage, "materials"), isNull(projects.remindersPausedAt)))
    .limit(200);
  for (const row of waitingMaterials) {
    const [material] = await getDb().select({ id: projectFiles.id }).from(projectFiles).where(and(eq(projectFiles.projectId, row.project.id), eq(projectFiles.kind, "manuscript"), sql`${projectFiles.status} <> 'deleted'`)).limit(1);
    if (material) continue;
    for (const [i, days] of rules.materialsDays.entries())
      if (age(row.paidAt, days) && (await deliver({
        eventKey: `reminder:materials:${row.project.id}:${days}d`, recipient: row.email, name: row.name, userId: row.project.authorId, first: i === 0,
        subject: "Aspettiamo il tuo manoscritto · Proemios", title: "Aspettiamo il tuo materiale",
        body: "l'acconto è confermato e il team è pronto: carica il manoscritto o i materiali dalla tua area per far partire la lavorazione.",
        href: `/area-autore?progetto=${row.project.id}`,
      }))) sent++;
  }
  // 4. Consegne pronte senza decisione.
  const deliveries = await getDb()
    .select({ file: projectFiles, project: projects, email: user.email, name: user.name })
    .from(projectFiles)
    .innerJoin(projects, eq(projects.id, projectFiles.projectId))
    .innerJoin(user, eq(user.id, projects.authorId))
    .where(and(eq(projectFiles.kind, "delivery"), eq(projectFiles.status, "ready"), isNull(projects.remindersPausedAt), lte(projectFiles.createdAt, new Date(now.getTime() - Math.min(...rules.approvalDays) * DAY))))
    .limit(200);
  for (const row of deliveries) {
    const [decided] = await getDb().select({ id: approvals.id }).from(approvals).where(eq(approvals.fileId, row.file.id)).limit(1);
    if (decided) continue;
    const [newer] = await getDb().select({ id: projectFiles.id }).from(projectFiles).where(and(eq(projectFiles.projectId, row.project.id), eq(projectFiles.name, row.file.name), sql`${projectFiles.version} > ${row.file.version}`)).limit(1);
    if (newer) continue;
    for (const [i, days] of rules.approvalDays.entries())
      if (age(row.file.createdAt, days) && (await deliver({
        eventKey: `reminder:approval:${row.file.id}:${days}d`, recipient: row.email, name: row.name, userId: row.project.authorId, first: i === 0,
        subject: "Una consegna aspetta la tua lettura · Proemios", title: "Una consegna aspetta la tua lettura",
        body: `"${row.file.name}" (versione ${row.file.version}) è pronta: leggila e approvala, oppure chiedi una revisione.`,
        href: `/area-autore?progetto=${row.project.id}`,
      }))) sent++;
  }
  return { sent, skipped: false };
}
