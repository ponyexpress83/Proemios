import Stripe from "stripe";

/**
 * Client Stripe lazy: non richiede la chiave a build-time.
 * Modalità "payment" (nessun abbonamento in Fase 1).
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY non configurata.");
  }
  if (!_stripe) {
    // apiVersion omesso di proposito: usa quella predefinita dell'account.
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
