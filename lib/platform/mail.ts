import { and, eq, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { emailOutbox } from "@/db/platform-schema";
import { inviaEmail, type Messaggio } from "@/lib/email";
import { CompactEncrypt, compactDecrypt } from "jose";
import { createHash } from "node:crypto";
import { unavailable, afterResponse } from "./http";
import { readPrivate } from "./storage";

function encryptionKey() {
  if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) throw unavailable();
  return createHash("sha256").update(process.env.BETTER_AUTH_SECRET!).digest();
}
export async function protectMailHtml(html: string) {
  return `jwe:${await new CompactEncrypt(new TextEncoder().encode(html)).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).encrypt(encryptionKey())}`;
}
export async function revealMailHtml(html: string) {
  if (!html.startsWith("jwe:")) return html;
  const result = await compactDecrypt(html.slice(4), encryptionKey());
  return new TextDecoder().decode(result.plaintext);
}

export async function enqueueMail(eventKey: string, message: Messaggio) {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  for (const recipient of recipients)
    await getDb()
      .insert(emailOutbox)
      .values({
        eventKey: `${eventKey}:${recipient}`,
        recipient,
        subject: message.subject,
        html: await protectMailHtml(message.html),
        replyTo: message.replyTo,
      })
      .onConflictDoNothing();
}
export async function flushMail(limit = 20) {
  let accepted = 0,
    failed = 0;
  for (let i = 0; i < limit; i++) {
    const item = await getDb().transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(emailOutbox)
        .where(
          and(
            or(eq(emailOutbox.status, "pending"), eq(emailOutbox.status, "retry")),
            lt(emailOutbox.availableAt, new Date()),
            or(sql`${emailOutbox.lockedUntil} is null`, lt(emailOutbox.lockedUntil, new Date())),
          ),
        )
        .orderBy(emailOutbox.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return null;
      await tx
        .update(emailOutbox)
        .set({ lockedUntil: new Date(Date.now() + 120_000), attempts: candidate.attempts + 1 })
        .where(eq(emailOutbox.id, candidate.id));
      return candidate;
    });
    if (!item) break;
    try {
      // Gli allegati (es. contratto) si leggono dallo storage privato al momento
      // dell'invio: nell'outbox restano solo i riferimenti.
      const attachments = [] as Array<{ filename: string; content: Buffer; mime: string }>;
      for (const a of item.attachments ?? []) {
        const chunks: Uint8Array[] = [];
        const reader = (await readPrivate(a.storageKey)).getReader();
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        attachments.push({ filename: a.filename, content: Buffer.concat(chunks), mime: a.mime });
      }
      await inviaEmail({
        to: item.recipient,
        subject: item.subject,
        html: await revealMailHtml(item.html),
        replyTo: item.replyTo ?? undefined,
        idempotencyKey: `proemios-mail-${item.id}`,
        attachments: attachments.length ? attachments : undefined,
      });
      await getDb()
        .update(emailOutbox)
        .set({ status: "accepted", lockedUntil: null, lastError: null })
        .where(eq(emailOutbox.id, item.id));
      accepted++;
    } catch {
      const attempts = item.attempts + 1;
      await getDb()
        .update(emailOutbox)
        .set({
          status: attempts >= 5 ? "failed" : "retry",
          lockedUntil: null,
          lastError: "Invio non accettato dal provider",
          availableAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** attempts * 60_000)),
        })
        .where(eq(emailOutbox.id, item.id));
      failed++;
    }
  }
  return { accepted, failed };
}
/**
 * Fa partire la posta in coda appena la risposta è stata inviata, senza
 * trattenerla. Fuori da una richiesta Next (test, script) non fa nulla: lì la
 * coda si svuota con una chiamata esplicita a flushMail o con il cron.
 */
export function flushMailAfterResponse(limit = 10) {
  afterResponse(() => flushMail(limit));
}
