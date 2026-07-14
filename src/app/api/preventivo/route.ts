import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { leads, quotes } from "@/db/schema";
import { preventivoSubmitSchema } from "@/lib/validation";
import { calcolaPreventivo } from "@/lib/pricing";
import { sendEmail, emailLayout, emailRow } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { euro } from "@/lib/format";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = preventivoSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi.", dettagli: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { input, contatto } = parsed.data;

  // Ricalcolo autoritativo lato server (non ci si fida del client).
  const result = calcolaPreventivo(input);

  let quoteId: string;
  try {
    const db = getDb();
    const [lead] = await db
      .insert(leads)
      .values({
        nome: contatto.nome,
        email: contatto.email,
        telefono: contatto.telefono || null,
        fonte: "preventivo",
        note: contatto.note || null,
      })
      .returning();

    if (!lead) throw new Error("Inserimento lead fallito.");

    const [quote] = await db
      .insert(quotes)
      .values({
        leadId: lead.id,
        input,
        pacchetti: result.pacchetti,
        stato: "sent",
      })
      .returning();

    if (!quote) throw new Error("Inserimento preventivo fallito.");
    quoteId = quote.id;
  } catch (err) {
    console.error("[preventivo] Salvataggio fallito:", err);
    return NextResponse.json({ error: "Errore interno. Riprova più tardi." }, { status: 500 });
  }

  // Email al cliente con riepilogo (best-effort).
  const rows = result.pacchetti
    .map((p) => emailRow(`${p.nome}${p.inEvidenza ? " (consigliato)" : ""}`, euro(p.totale)))
    .join("");
  try {
    await sendEmail({
      to: contatto.email,
      subject: "Il tuo preventivo — Kalamos Studio",
      html: emailLayout(
        "Il tuo preventivo editoriale",
        `<p>Ciao ${escapeHtml(contatto.nome)},</p>
         <p>ecco i tre pacchetti che abbiamo calcolato per il tuo progetto
         (${result.paroleEffettive.toLocaleString("it-IT")} parole stimate):</p>
         <table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows}</table>
         <p>Puoi confermare e bloccare la data con un acconto del 40% direttamente dal sito.
         I prezzi sono indicativi e vengono confermati dopo la valutazione di un professionista.</p>
         <p>A presto,<br/>Kalamos Studio</p>`,
      ),
    });
  } catch (err) {
    console.error("[preventivo] Email cliente fallita:", err);
  }

  // Notifica interna.
  try {
    const env = serverEnv();
    await sendEmail({
      to: env.EMAIL_INTERNAL_NOTIFY,
      replyTo: contatto.email,
      subject: `Nuovo preventivo: ${contatto.nome} — ${euro(result.pacchetti[1].totale)}`,
      html: emailLayout(
        "Nuovo preventivo dal configuratore",
        `<p><strong>${escapeHtml(contatto.nome)}</strong> · ${escapeHtml(contatto.email)} · ${escapeHtml(
          contatto.telefono || "—",
        )}</p>
         <p>Progetto: ${input.projectType} · Stato: ${input.statoTesto} · Tempistica: ${input.tempistica}</p>
         <table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows}</table>
         ${contatto.note ? `<p><strong>Note:</strong> ${escapeHtml(contatto.note)}</p>` : ""}
         <p>ID preventivo: ${quoteId}</p>`,
      ),
    });
  } catch (err) {
    console.error("[preventivo] Notifica interna fallita:", err);
  }

  return NextResponse.json({ quoteId, pacchetti: result });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
