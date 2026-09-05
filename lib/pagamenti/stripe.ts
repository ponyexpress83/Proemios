/**
 * Apertura dei pagamenti su Stripe.
 *
 * Il modulo fa una cosa sola: prende una rata già verificata dal livello dati e
 * apre la sessione di Checkout corrispondente. Non decide importi, non legge il
 * database per conto suo, non si fida di niente che arrivi dal browser.
 *
 * L'importo passa da `rataDaPagare`, che lo legge dall'ordine. Se un giorno
 * qualcuno aggiungesse qui un parametro `importoCent`, quello sarebbe il punto
 * in cui il prezzo diventa scegliebile dal client — perciò non c'è.
 */
import { stripe, stripeConfigurato } from "@/lib/stripe";
import { assoluto } from "@/lib/seo";
import { BRAND } from "@/config/brand";
import { collegaSessioneStripe, rataDaPagare } from "@/lib/dati/pagamenti";
import type { Attore } from "@/lib/auth/attore";

export class PagamentiNonConfigurati extends Error {
  constructor() {
    super("I pagamenti online non sono attivi.");
    this.name = "PagamentiNonConfigurati";
  }
}

/**
 * Apre la sessione di pagamento di una rata e restituisce l'URL di Stripe.
 *
 * `client_reference_id` e i metadati portano l'id della rata: è così che il
 * webhook ritrova la riga da segnare incassata, senza dover indovinare
 * dall'importo — due rate dello stesso valore sullo stesso ordine sono la
 * norma, non l'eccezione.
 */
export async function apriPagamento(
  attore: Attore,
  pagamentoId: string,
  ritorno: { successo: string; annullato: string },
): Promise<{ url: string; sessionId: string }> {
  if (!stripeConfigurato()) throw new PagamentiNonConfigurati();

  const rata = await rataDaPagare(attore, pagamentoId);

  const sessione = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      locale: "it",
      customer_email: rata.emailCliente ?? undefined,
      client_reference_id: rata.pagamentoId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: rata.valuta.toLowerCase(),
            unit_amount: rata.importoCent,
            product_data: {
              name: `${rata.descrizione} — ${BRAND.name}`,
            },
          },
        },
      ],
      metadata: {
        pagamentoId: rata.pagamentoId,
        organizationId: rata.organizationId,
        ordineCodice: rata.ordineCodice,
      },
      success_url: assoluto(ritorno.successo),
      cancel_url: assoluto(ritorno.annullato),
    },
    {
      // Riaprire la stessa rata due volte di seguito (doppio clic, rete lenta)
      // non deve creare due sessioni: Stripe restituisce la prima.
      idempotencyKey: `pagamento-${rata.pagamentoId}`,
    },
  );

  if (!sessione.url) throw new Error("Stripe non ha restituito un URL di pagamento.");
  await collegaSessioneStripe(rata.pagamentoId, sessione.id);
  return { url: sessione.url, sessionId: sessione.id };
}

/**
 * Chiede a Stripe il rimborso di un incasso.
 *
 * Restituisce l'id del rimborso; la registrazione contabile la fa il livello
 * dati. L'ordine conta: prima si rimborsa davvero, poi lo si scrive. Scriverlo
 * prima significherebbe avere in database un rimborso che la banca non ha mai
 * fatto.
 */
export async function rimborsaSuStripe(
  paymentIntentId: string,
  importoCent: number,
  motivo: string,
): Promise<string> {
  if (!stripeConfigurato()) throw new PagamentiNonConfigurati();
  const rimborso = await stripe().refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: importoCent,
      metadata: { motivo: motivo.slice(0, 300) },
    },
    { idempotencyKey: `rimborso-${paymentIntentId}-${importoCent}` },
  );
  return rimborso.id;
}
