/**
 * WhatsApp.
 *
 * Due modi, e la differenza conta.
 *
 * `linkConversazione` costruisce un `wa.me`: apre WhatsApp sul dispositivo di
 * chi clicca, con un messaggio già scritto. Non manda niente, non richiede
 * account business, non tocca la rete. È quello che serve a un pulsante
 * «scrivici su WhatsApp».
 *
 * `ProviderWhatsApp` è l'interfaccia per l'invio vero tramite la Cloud API, che
 * richiede un numero verificato e **template approvati** da Meta: un messaggio
 * fuori template a un utente che non ha scritto per primo viene semplicemente
 * rifiutato. L'implementazione è pronta ma resta spenta finché non ci sono
 * credenziali, e in quel caso `configurato()` è falso e nessuno prova a
 * mandare.
 */
import { env } from "@/lib/env";

/** Normalizza un numero in formato internazionale senza segni. */
export function numeroWhatsApp(numero: string, prefissoPredefinito = "39"): string | null {
  const pulito = numero.replace(/[^\d+]/g, "");
  if (!pulito) return null;

  if (pulito.startsWith("+")) {
    const cifre = pulito.slice(1);
    return /^\d{8,15}$/.test(cifre) ? cifre : null;
  }
  if (pulito.startsWith("00")) {
    const cifre = pulito.slice(2);
    return /^\d{8,15}$/.test(cifre) ? cifre : null;
  }
  // Un numero senza prefisso è italiano per contesto: è il mercato del prodotto.
  const cifre = `${prefissoPredefinito}${pulito}`;
  return /^\d{8,15}$/.test(cifre) ? cifre : null;
}

/**
 * Link a una conversazione WhatsApp con testo precompilato.
 *
 * Il testo non deve contenere niente di riservato: finisce nella cronologia del
 * browser, nei log del proxy e nella barra degli indirizzi.
 */
export function linkConversazione(numero: string, testo?: string): string | null {
  const destinatario = numeroWhatsApp(numero);
  if (!destinatario) return null;
  const query = testo ? `?text=${encodeURIComponent(testo.slice(0, 1000))}` : "";
  return `https://wa.me/${destinatario}${query}`;
}

export type MessaggioWhatsApp = {
  a: string;
  /** Nome del template approvato da Meta. Fuori template non si manda. */
  template: string;
  lingua?: string;
  /** Variabili del template, in ordine. */
  parametri?: readonly string[];
};

export interface ProviderWhatsApp {
  readonly nome: string;
  configurato(): boolean;
  invia(messaggio: MessaggioWhatsApp): Promise<{ id: string }>;
}

/** Provider spento: dichiara di non poter mandare, invece di fingere. */
export class WhatsAppSpento implements ProviderWhatsApp {
  readonly nome = "spento";
  configurato() {
    return false;
  }
  async invia(): Promise<{ id: string }> {
    throw new Error("WhatsApp non è configurato: nessun messaggio è stato inviato.");
  }
}

/** Cloud API di Meta. */
export class WhatsAppCloud implements ProviderWhatsApp {
  readonly nome = "whatsapp-cloud";

  constructor(
    private readonly opzioni: {
      token?: string;
      numeroId?: string;
      fetch?: typeof fetch;
    } = {},
  ) {}

  configurato(): boolean {
    return Boolean(this.opzioni.token && this.opzioni.numeroId);
  }

  async invia(messaggio: MessaggioWhatsApp): Promise<{ id: string }> {
    if (!this.configurato()) throw new Error("Credenziali WhatsApp mancanti.");
    const destinatario = numeroWhatsApp(messaggio.a);
    if (!destinatario) throw new Error(`Numero non valido: ${messaggio.a}`);

    const esegui = this.opzioni.fetch ?? fetch;
    const risposta = await esegui(
      `https://graph.facebook.com/v21.0/${this.opzioni.numeroId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.opzioni.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destinatario,
          type: "template",
          template: {
            name: messaggio.template,
            language: { code: messaggio.lingua ?? "it" },
            components: messaggio.parametri?.length
              ? [
                  {
                    type: "body",
                    parameters: messaggio.parametri.map((p) => ({ type: "text", text: p })),
                  },
                ]
              : undefined,
          },
        }),
      },
    );

    if (!risposta.ok) {
      const corpo = await risposta.text().catch(() => "");
      throw new Error(`WhatsApp ha risposto ${risposta.status}: ${corpo.slice(0, 300)}`);
    }

    const dati = (await risposta.json()) as { messages?: { id?: string }[] };
    const id = dati.messages?.[0]?.id;
    if (!id) throw new Error("WhatsApp non ha restituito un identificativo di messaggio.");
    return { id };
  }
}

export function providerWhatsApp(): ProviderWhatsApp {
  const cloud = new WhatsAppCloud({
    token: env.WHATSAPP_TOKEN,
    numeroId: env.WHATSAPP_NUMERO_ID,
  });
  return cloud.configurato() ? cloud : new WhatsAppSpento();
}
