/**
 * Notifiche configurabili per persona: ogni evento ha un canale (interno,
 * email, entrambi, nessuno). Le email vanno sempre in coda (outbox cifrata);
 * nei test finiscono in una cartella temporanea.
 */
import { eq, and } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { notificationPreferences } from "@/db/crm-schema";
import { emailOutbox, notifications } from "@/db/platform-schema";
import { impaginaEmail, esc } from "@/lib/email";
import { appOrigin } from "./config";
import { protectMailHtml } from "./mail";
import type { Tx } from "./crm-relations";

export const NOTIFICATION_EVENTS = {
  lead_assigned: { label: "Nuovo contatto assegnato", default: "both" },
  lead_queued: { label: "Richiesta senza responsabile (coda monitorata)", default: "both" },
  sla_breach: { label: "Risposta oltre il tempo previsto", default: "both" },
  pool_new: { label: "Nuova richiesta nella coda libera", default: "in_app" },
  approval_requested: { label: "Eccezione da approvare", default: "both" },
  approval_decided: { label: "Eccezione approvata o respinta", default: "in_app" },
  client_message: { label: "Domanda o richiesta di modifica del cliente", default: "both" },
  handoff_ready: { label: "Progetto pronto per la produzione", default: "both" },
  handoff_question: { label: "Domanda della produzione sul passaggio", default: "both" },
  task_assigned: { label: "Compito assegnato", default: "in_app" },
  support_request: { label: "Richiesta di assistenza", default: "both" },
  morning_summary: { label: "Riepilogo del mattino", default: "in_app" },
  attribution_conflict: { label: "Conflitto di attribuzione", default: "both" },
  ai_review_ready: { label: "Revisione AI completata: controllo umano richiesto", default: "both" },
  ai_job_problem: { label: "Lavorazione AI ferma o fallita", default: "both" },
  revision_requested: { label: "Richiesta di revisione del cliente", default: "both" },
  quality_check: { label: "Documento da controllare in qualità", default: "both" },
} as const;
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;
export const CHANNELS = ["in_app", "email", "both", "off"] as const;

export async function notify(tx: Tx, userId: string, event: NotificationEvent, message: { title: string; body: string; href?: string; key: string }) {
  const [pref] = await tx.select().from(notificationPreferences).where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.event, event)));
  const channel = pref?.channel ?? NOTIFICATION_EVENTS[event].default;
  if (channel === "off") return;
  if (channel === "in_app" || channel === "both") await tx.insert(notifications).values({ userId, title: message.title, body: message.body, href: message.href ?? null });
  if (channel === "email" || channel === "both") {
    const [person] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (person)
      await tx
        .insert(emailOutbox)
        .values({
          eventKey: `crm:${event}:${message.key}:${userId}`,
          recipient: person.email,
          subject: message.title,
          html: await protectMailHtml(impaginaEmail(message.title, `<p>${esc(message.body)}</p>${message.href ? `<p><a href="${esc(appOrigin())}${esc(message.href)}">Apri nello spazio del team</a></p>` : ""}`)),
        })
        .onConflictDoNothing();
  }
}
