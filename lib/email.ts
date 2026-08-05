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
 * Impaginato email coerente col brand: carta, filetti, colophon con la
 * formula sull'AI. Stili inline per compatibilità con i client di posta.
 */
export function impaginaEmail(titolo: string, corpo: string): string {
  return `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f0;color:#1b1a17;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;">
      <span style="color:#22483b;">P</span>roemios
    </div>
    <div style="height:1px;background:rgba(27,26,23,0.28);margin:8px 0 28px;"></div>

    <h1 style="font-size:24px;line-height:1.2;font-weight:500;margin:0 0 18px;">${titolo}</h1>
    <div style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:rgba(27,26,23,0.88);">
      ${corpo}
    </div>

    <div style="height:1px;background:rgba(27,26,23,0.14);margin:32px 0 16px;"></div>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6c6f67;margin:0;">
      ${BRAND.aiDisclaimer}
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a9d96;margin:12px 0 0;letter-spacing:0.08em;text-transform:uppercase;">
      ${BRAND.name} · ${BRAND.domain}
    </p>
  </div>
</body>
</html>`;
}

/** Riga di tabella per i riepiloghi (preventivo). */
export function rigaEmail(etichetta: string, valore: string, forte = false): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid rgba(27,26,23,0.10);font-size:15px;color:#6c6f67;">${etichetta}</td>
    <td style="padding:8px 0;border-bottom:1px solid rgba(27,26,23,0.10);text-align:right;font-size:15px;${forte ? "font-weight:700;" : "font-weight:600;"}">${valore}</td>
  </tr>`;
}
