import { Resend } from "resend";
import { env } from "./env";
import { BRAND } from "@/config/brand";

/**
 * Email transazionali via Resend.
 * Se la chiave non è configurata (sviluppo locale), l'email viene registrata
 * a log invece di fallire: il flusso utente non si interrompe mai per questo.
 */

let client: Resend | null = null;

function resend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export interface Messaggio {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function inviaEmail({ to, subject, html, replyTo }: Messaggio): Promise<void> {
  const api = resend();
  if (!api) {
    console.warn(
      JSON.stringify({ evt: "email.saltata", motivo: "RESEND_API_KEY assente", to, subject }),
    );
    return;
  }
  const { error } = await api.emails.send({
    from: env.EMAIL_FROM ?? `${BRAND.name} <noreply@${BRAND.domain}>`,
    to,
    subject,
    html,
    replyTo,
  });
  if (error) {
    console.error(JSON.stringify({ evt: "email.errore", to, subject, error: error.message }));
    throw new Error(`Invio email fallito: ${error.message}`);
  }
}

/** Destinatario delle notifiche interne. */
export function destinatarioInterno(): string {
  return env.EMAIL_INTERNAL ?? BRAND.email.quotes;
}

/** Escape HTML per interpolare dati utente nei template. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Impaginato email coerente col brand.
 *
 * L'email resta **chiara** anche se il prodotto è scuro, e non è una svista:
 * molti client di posta ricolorano o invertono i fondali scuri, e il risultato
 * è testo grigio su grigio in metà delle caselle. L'identità arriva dal viola
 * degli accenti, che sopravvive a quel trattamento.
 *
 * Stili inline, perché i fogli di stile esterni non arrivano quasi da nessuna
 * parte.
 */
export function impaginaEmail(titolo: string, corpo: string): string {
  return `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f4f8;color:#15141c;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;">
      <span style="color:#5b3df5;">P</span>roemios
    </div>
    <div style="height:1px;background:rgba(21,20,28,0.22);margin:8px 0 28px;"></div>

    <h1 style="font-size:24px;line-height:1.2;font-weight:500;margin:0 0 18px;">${titolo}</h1>
    <div style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:rgba(21,20,28,0.86);">
      ${corpo}
    </div>

    <div style="height:1px;background:rgba(21,20,28,0.10);margin:32px 0 16px;"></div>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5f5b72;margin:0;">
      ${BRAND.aiDisclaimer}
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8c87a0;margin:12px 0 0;letter-spacing:0.08em;text-transform:uppercase;">
      ${BRAND.name} · ${BRAND.domain}
    </p>
  </div>
</body>
</html>`;
}

/** Riga di tabella per i riepiloghi (preventivo). */
export function rigaEmail(etichetta: string, valore: string, forte = false): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid rgba(21,20,28,0.10);font-size:15px;color:#5f5b72;">${etichetta}</td>
    <td style="padding:8px 0;border-bottom:1px solid rgba(21,20,28,0.10);text-align:right;font-size:15px;${forte ? "font-weight:700;" : "font-weight:600;"}">${valore}</td>
  </tr>`;
}
