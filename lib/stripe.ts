import Stripe from "stripe";
import { env } from "./env";

/**
 * Client Stripe, istanziato lazy: la build non richiede la chiave.
 * Fase 1: solo Checkout in modalità `payment` (acconti). Nessuna subscription
 * (vedi config/plans.ts → SUBSCRIPTIONS_LIVE per la Fase 2).
 */
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY non configurata.");
  }
  if (!client) {
    // apiVersion omessa di proposito: usa quella predefinita dell'account.
    client = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return client;
}

export function stripeConfigurato(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
