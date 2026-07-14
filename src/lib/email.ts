import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

/**
 * Wrapper Resend con degradazione elegante: se RESEND_API_KEY non è configurata
 * (es. in sviluppo), le email vengono loggate in console invece di fallire.
 */
let _client: Resend | null = null;

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<void> {
  const env = serverEnv();
  const resend = client();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY assente — email non inviata a ${String(to)}: "${subject}"`,
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    replyTo,
  });
  if (error) {
    console.error("[email] Invio fallito:", error);
    throw new Error(`Invio email fallito: ${error.message}`);
  }
}

/** Layout email coerente con il brand (inline styles per compatibilità client). */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="it">
<body style="margin:0;background:#f7f2e8;font-family:Georgia,'Times New Roman',serif;color:#17130f;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:20px;font-weight:600;letter-spacing:-0.02em;">Kalamos <span style="font-style:italic;font-weight:400;">Studio</span></div>
    <div style="height:1px;background:#ded2bd;margin:20px 0;"></div>
    <h1 style="font-size:22px;line-height:1.2;font-weight:500;margin:0 0 16px;">${title}</h1>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#342d25;">
      ${bodyHtml}
    </div>
    <div style="height:1px;background:#ded2bd;margin:28px 0 16px;"></div>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8a8073;margin:0;">
      Processo editoriale assistito dalla tecnologia e sottoposto a controllo professionale:
      ogni consegna viene verificata e approvata da un professionista.
    </p>
  </div>
</body>
</html>`;
}

/** Riga tabella per riepiloghi (usata nelle email di preventivo). */
export function emailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#5c5347;font-size:14px;">${label}</td>
    <td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px;">${value}</td>
  </tr>`;
}
