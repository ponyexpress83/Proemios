import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { quotes } from "@/db/schema";
import { checkoutSchema } from "@/lib/validation";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { siteUrl } from "@/lib/env";
import type { QuotePackage } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Pagamenti non configurati. Contattaci per completare l'ordine." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi." }, { status: 422 });
  }
  const { quoteId, pacchetto } = parsed.data;

  const db = getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) {
    return NextResponse.json({ error: "Preventivo non trovato." }, { status: 404 });
  }

  const pacchetti = quote.pacchetti as QuotePackage[];
  const scelto = pacchetti.find((p) => p.key === pacchetto);
  if (!scelto) {
    return NextResponse.json({ error: "Pacchetto non valido." }, { status: 422 });
  }

  const base = siteUrl();
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "it",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(scelto.acconto * 100), // acconto 40% in centesimi
            product_data: {
              name: `Acconto pacchetto ${scelto.nome} — Kalamos Studio`,
              description: `Acconto 40% su ${scelto.nome}. Totale progetto stimato: € ${scelto.totale.toLocaleString("it-IT")}.`,
            },
          },
        },
      ],
      metadata: { quoteId, pacchetto, totale: String(scelto.totale) },
      success_url: `${base}/preventivo/grazie?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/preventivo?annullato=1`,
    });

    await db
      .update(quotes)
      .set({ pacchettoScelto: pacchetto, stripeSessionId: session.id })
      .where(eq(quotes.id, quoteId));

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Creazione sessione fallita:", err);
    return NextResponse.json({ error: "Impossibile avviare il pagamento." }, { status: 500 });
  }
}
