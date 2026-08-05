import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { quotes, leads } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { inviaEmail, impaginaEmail, esc, destinatarioInterno } from "@/lib/email";
import { euro } from "@/lib/format";
import { BRAND } from "@/config/brand";

export const runtime = "nodejs";

/**
 * Webhook Stripe.
 * La firma è verificata sul corpo grezzo: senza questo, chiunque potrebbe
 * marcare un ordine come pagato.
 */
export async function POST(req: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error(JSON.stringify({ evt: "webhook.non-configurato" }));
    return NextResponse.json({ errore: "Webhook non configurato." }, { status: 503 });
  }

  const firma = req.headers.get("stripe-signature");
  if (!firma) {
    return NextResponse.json({ errore: "Firma mancante." }, { status: 400 });
  }

  const grezzo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(grezzo, firma, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(JSON.stringify({ evt: "webhook.firma-non-valida", err: String(err) }));
    return NextResponse.json({ errore: "Firma non valida." }, { status: 400 });
  }

  if (evento.type !== "checkout.session.completed") {
    return NextResponse.json({ ricevuto: true });
  }

  const sessione = evento.data.object as Stripe.Checkout.Session;
  const quoteId = sessione.metadata?.quoteId;
  if (!quoteId) {
    return NextResponse.json({ ricevuto: true });
  }

  try {
    await db
      .update(quotes)
      .set({ stato: "deposit_paid", stripeSessionId: sessione.id, updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));

    const [preventivo] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!preventivo) return NextResponse.json({ ricevuto: true });

    const [lead] = await db.select().from(leads).where(eq(leads.id, preventivo.leadId)).limit(1);

    if (lead) {
      await inviaEmail({
        to: lead.email,
        subject: `Acconto ricevuto, la data è bloccata — ${BRAND.name}`,
        html: impaginaEmail(
          "Ci siamo: la data è tua",
          `<p>Ciao ${esc(lead.nome)},</p>
           <p>abbiamo ricevuto l'acconto${
             preventivo.acconto ? ` di ${euro(preventivo.acconto)}` : ""
           } per il percorso <strong>${esc(preventivo.pacchettoScelto ?? "concordato")}</strong>.
           La data è bloccata in calendario.</p>
           <p><strong>Cosa succede adesso.</strong></p>
           <ol>
             <li>Entro un giorno lavorativo ti scriviamo per fissare la call di avvio.</li>
             <li>Ci mandi i materiali definitivi (testo, immagini, riferimenti).</li>
             <li>Partiamo, e ogni consegna passa da una tua approvazione.</li>
           </ol>
           <p>Se hai domande, rispondi pure a questa email.</p>
           <p>A presto,<br/>${BRAND.name}</p>`,
        ),
      }).catch((e) =>
        console.error(JSON.stringify({ evt: "webhook.email-cliente", err: String(e) })),
      );
    }

    await inviaEmail({
      to: destinatarioInterno(),
      subject: `Acconto pagato — ${lead?.nome ?? quoteId}`,
      html: impaginaEmail(
        "Acconto incassato",
        `<p>Preventivo <strong>${quoteId}</strong> confermato con acconto.</p>
         <p>Cliente: ${esc(lead?.nome ?? "—")} · ${esc(lead?.email ?? "—")}<br/>
         Pacchetto: ${esc(preventivo.pacchettoScelto ?? "—")}<br/>
         Acconto: ${preventivo.acconto ? euro(preventivo.acconto) : "—"} ·
         Totale: ${preventivo.prezzoTotale ? euro(preventivo.prezzoTotale) : "—"}</p>
         <p style="font-size:13px;color:#6c6f67;">Sessione Stripe: ${esc(sessione.id)}</p>`,
      ),
    }).catch((e) =>
      console.error(JSON.stringify({ evt: "webhook.email-interna", err: String(e) })),
    );
  } catch (err) {
    console.error(
      JSON.stringify({ evt: "webhook.aggiornamento-fallito", quoteId, err: String(err) }),
    );
    // 500: Stripe riproverà la consegna.
    return NextResponse.json({ errore: "Errore interno." }, { status: 500 });
  }

  return NextResponse.json({ ricevuto: true });
}
