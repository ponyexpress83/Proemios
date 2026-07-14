import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { quotes, leads } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { sendEmail, emailLayout } from "@/lib/email";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Webhook Stripe. Verifica la firma e, alla conferma del pagamento
 * dell'acconto, marca l'ordine come `deposit_paid` e invia le email.
 * Il body grezzo è necessario per la verifica della firma.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET non configurato.");
    return NextResponse.json({ error: "Webhook non configurato." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Firma mancante." }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[webhook] Firma non valida:", err);
    return NextResponse.json({ error: "Firma non valida." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quoteId;
    if (quoteId) {
      try {
        const db = getDb();
        await db
          .update(quotes)
          .set({ stato: "deposit_paid", stripeSessionId: session.id })
          .where(eq(quotes.id, quoteId));

        // Recupera il lead per la conferma.
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
        if (quote) {
          const [lead] = await db.select().from(leads).where(eq(leads.id, quote.leadId)).limit(1);
          const env = serverEnv();

          if (lead) {
            await sendEmail({
              to: lead.email,
              subject: "Acconto ricevuto — la tua data è bloccata · Kalamos Studio",
              html: emailLayout(
                "Grazie, abbiamo ricevuto il tuo acconto",
                `<p>Ciao ${escapeHtml(lead.nome)},</p>
                 <p>abbiamo ricevuto l'acconto per il pacchetto
                 <strong>${escapeHtml(quote.pacchettoScelto ?? "scelto")}</strong>: la tua data è
                 ufficialmente bloccata.</p>
                 <p>Ti contatteremo a breve per avviare la lavorazione e raccogliere i materiali.</p>
                 <p>A presto,<br/>Kalamos Studio</p>`,
              ),
            }).catch((e) => console.error("[webhook] Email cliente fallita:", e));
          }

          await sendEmail({
            to: env.EMAIL_INTERNAL_NOTIFY,
            subject: `Acconto pagato — ordine ${quoteId}`,
            html: emailLayout(
              "Acconto pagato",
              `<p>Il preventivo <strong>${quoteId}</strong> è stato confermato con acconto.</p>
               <p>Pacchetto: ${escapeHtml(quote.pacchettoScelto ?? "—")}</p>
               <p>Sessione Stripe: ${session.id}</p>`,
            ),
          }).catch((e) => console.error("[webhook] Notifica interna fallita:", e));
        }
      } catch (err) {
        console.error("[webhook] Aggiornamento ordine fallito:", err);
        return NextResponse.json({ error: "Errore interno." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
