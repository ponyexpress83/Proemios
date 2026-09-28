/**
 * Interpretazione degli eventi Stripe.
 *
 * Separato dalla rotta di proposito: la rotta verifica la firma sul corpo
 * grezzo — quella è l'unica cosa che deve fare — e qui si decide cosa
 * significa un evento. Così la logica si può provare con eventi costruiti a
 * mano, senza rete e senza chiavi.
 *
 * Tre principi:
 *
 *  1. **Idempotenza.** Stripe riconsegna gli eventi, e li consegna anche fuori
 *     ordine. Ogni operazione qui è scrivibile più volte con lo stesso esito.
 *  2. **Nessuna fiducia sull'importo del payload.** L'importo incassato è
 *     quello della rata in database; il payload dice *quale* rata, non quanto.
 *  3. **Un evento sconosciuto non è un errore.** Rispondere 500 a un evento
 *     che non ci interessa farebbe riprovare Stripe all'infinito.
 */
import type Stripe from "stripe";
import {
  pagamentoDaRiferimentoStripe,
  segnaFallita,
  segnaIncassata,
  sincronizzaRimborsoStripe,
} from "@/lib/dati/pagamenti";

export type EsitoWebhook = {
  /** Cosa è stato fatto, per il log e per i test. */
  azione:
    | "incassato"
    | "gia_incassato"
    | "fallito"
    | "scaduto"
    | "rimborso_allineato"
    | "ignorato"
    | "non_trovato";
  pagamentoId?: string;
};

/** Estrae l'id della rata dai metadati o dal riferimento cliente. */
function idRata(sessione: Stripe.Checkout.Session): string | null {
  return sessione.metadata?.pagamentoId ?? sessione.client_reference_id ?? null;
}

function idStringa(valore: string | { id: string } | null | undefined): string | null {
  if (!valore) return null;
  return typeof valore === "string" ? valore : valore.id;
}

/**
 * Applica un evento Stripe al piano di pagamento.
 *
 * Restituisce `ignorato` per tutto ciò che riguarda il vecchio flusso dei
 * preventivi pubblici, che la rotta gestisce a parte: i due percorsi
 * convivono, e distinguerli dai metadati è più solido che dedurli.
 */
export async function applicaEventoStripe(evento: Stripe.Event): Promise<EsitoWebhook> {
  switch (evento.type) {
    case "checkout.session.completed": {
      const sessione = evento.data.object as Stripe.Checkout.Session;
      const pagamentoId = idRata(sessione);
      if (!pagamentoId) return { azione: "ignorato" };

      // Una sessione completata ma non pagata (bonifico differito) non è un
      // incasso: lo diventa con payment_intent.succeeded.
      if (sessione.payment_status !== "paid") return { azione: "ignorato", pagamentoId };

      const esito = await segnaIncassata(pagamentoId, {
        stripePaymentIntentId: idStringa(sessione.payment_intent),
      });
      return {
        azione: esito.aggiornata ? "incassato" : "gia_incassato",
        pagamentoId,
      };
    }

    case "checkout.session.expired": {
      const sessione = evento.data.object as Stripe.Checkout.Session;
      const pagamentoId = idRata(sessione);
      if (!pagamentoId) return { azione: "ignorato" };
      // La rata resta dovuta: una sessione scaduta è un pagamento non fatto,
      // non un pagamento fallito. Si potrà riaprire.
      return { azione: "scaduto", pagamentoId };
    }

    case "payment_intent.succeeded": {
      const intent = evento.data.object as Stripe.PaymentIntent;
      const rata = await pagamentoDaRiferimentoStripe({
        paymentIntentId: intent.id,
        sessionId: null,
      });
      if (!rata) return { azione: "non_trovato" };
      const esito = await segnaIncassata(rata.id, {
        stripePaymentIntentId: intent.id,
        stripeChargeId: idStringa(intent.latest_charge),
      });
      return { azione: esito.aggiornata ? "incassato" : "gia_incassato", pagamentoId: rata.id };
    }

    case "payment_intent.payment_failed": {
      const intent = evento.data.object as Stripe.PaymentIntent;
      const rata = await pagamentoDaRiferimentoStripe({
        paymentIntentId: intent.id,
        sessionId: null,
      });
      if (!rata) return { azione: "non_trovato" };
      await segnaFallita(rata.id);
      return { azione: "fallito", pagamentoId: rata.id };
    }

    case "charge.refunded": {
      const addebito = evento.data.object as Stripe.Charge;
      const esito = await sincronizzaRimborsoStripe(
        { paymentIntentId: idStringa(addebito.payment_intent), chargeId: addebito.id },
        addebito.amount_refunded,
      );
      return { azione: esito.aggiornata ? "rimborso_allineato" : "non_trovato" };
    }

    default:
      return { azione: "ignorato" };
  }
}
