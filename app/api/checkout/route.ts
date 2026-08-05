import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes } from "@/db/schema";
import { checkoutSchema, primoErrore } from "@/lib/validation";
import { stripe, stripeConfigurato } from "@/lib/stripe";
import { assoluto } from "@/lib/seo";
import { BRAND } from "@/config/brand";
import type { QuotePackage } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!stripeConfigurato()) {
    return NextResponse.json(
      { errore: "I pagamenti online non sono attivi. Scrivici e chiudiamo l'ordine per email." },
      { status: 503 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const esito = checkoutSchema.safeParse(corpo);
  if (!esito.success) {
    return NextResponse.json({ errore: primoErrore(esito.error) }, { status: 422 });
  }
  const { quoteId, pacchetto } = esito.data;

  let scelto: QuotePackage;
  try {
    const [preventivo] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!preventivo) {
      return NextResponse.json({ errore: "Preventivo non trovato." }, { status: 404 });
    }
    // Il prezzo viene sempre dal DB, mai dal client.
    const pacchetti = preventivo.pacchettiGenerati as QuotePackage[];
    const trovato = pacchetti.find((p) => p.tier === pacchetto);
    if (!trovato) {
      return NextResponse.json({ errore: "Pacchetto non valido." }, { status: 422 });
    }
    scelto = trovato;
  } catch (err) {
    console.error(JSON.stringify({ evt: "checkout.db-errore", err: String(err) }));
    return NextResponse.json({ errore: "Errore interno. Riprova fra poco." }, { status: 500 });
  }

  try {
    const sessione = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: "it",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(scelto.deposit * 100),
            product_data: {
              name: `Acconto · pacchetto ${scelto.name} — ${BRAND.name}`,
              description: `Acconto sul percorso ${scelto.name}. Totale del progetto stimato: € ${scelto.total.toLocaleString("it-IT")}. Il saldo è dovuto secondo il preventivo confermato.`,
            },
          },
        },
      ],
      metadata: { quoteId, pacchetto, totale: String(scelto.total) },
      success_url: `${assoluto("/preventivo/grazie")}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${assoluto("/preventivo")}?annullato=1`,
    });

    await db
      .update(quotes)
      .set({
        pacchettoScelto: pacchetto,
        prezzoTotale: scelto.total,
        acconto: scelto.deposit,
        stripeSessionId: sessione.id,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));

    return NextResponse.json({ url: sessione.url });
  } catch (err) {
    console.error(JSON.stringify({ evt: "checkout.stripe-errore", err: String(err) }));
    return NextResponse.json(
      { errore: "Non siamo riusciti ad aprire il pagamento. Riprova o scrivici." },
      { status: 500 },
    );
  }
}
