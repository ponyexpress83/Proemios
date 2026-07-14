import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { contattoSchema } from "@/lib/validation";
import { sendEmail, emailLayout } from "@/lib/email";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = contattoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi.", dettagli: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // Honeypot: se compilato, fingi successo senza salvare.
  if (data.website && data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    const db = getDb();
    await db.insert(leads).values({
      nome: data.nome,
      email: data.email,
      telefono: data.telefono || null,
      fonte: data.fonte,
      note: data.messaggio,
    });
  } catch (err) {
    console.error("[contatto] Salvataggio lead fallito:", err);
    return NextResponse.json({ error: "Errore interno. Riprova più tardi." }, { status: 500 });
  }

  const env = serverEnv();
  const isAgenzia = data.fonte === "agenzie";

  // Email di conferma al cliente (best-effort).
  try {
    await sendEmail({
      to: data.email,
      subject: isAgenzia
        ? "Abbiamo ricevuto la tua richiesta partner — Kalamos Studio"
        : "Abbiamo ricevuto il tuo messaggio — Kalamos Studio",
      html: emailLayout(
        "Grazie, ti risponderemo presto",
        `<p>Ciao ${escapeHtml(data.nome)},</p>
         <p>abbiamo ricevuto la tua richiesta e ti risponderemo al più presto${
           isAgenzia
             ? ", con le informazioni per attivare la collaborazione white label e l'NDA"
             : ""
         }.</p>
         <p>A presto,<br/>Kalamos Studio</p>`,
      ),
    });
  } catch (err) {
    console.error("[contatto] Email cliente fallita:", err);
  }

  // Notifica interna.
  try {
    await sendEmail({
      to: env.EMAIL_INTERNAL_NOTIFY,
      replyTo: data.email,
      subject: `Nuovo contatto (${data.fonte}): ${data.nome}`,
      html: emailLayout(
        `Nuovo contatto — ${data.fonte}`,
        `<p><strong>Nome:</strong> ${escapeHtml(data.nome)}<br/>
         <strong>Email:</strong> ${escapeHtml(data.email)}<br/>
         <strong>Telefono:</strong> ${escapeHtml(data.telefono || "—")}</p>
         <p><strong>Messaggio:</strong><br/>${escapeHtml(data.messaggio).replace(/\n/g, "<br/>")}</p>`,
      ),
    });
  } catch (err) {
    console.error("[contatto] Notifica interna fallita:", err);
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
