/**
 * Invio delle conversioni offline alle piattaforme pubblicitarie.
 *
 * Un evento di esito non ha un browser aperto quando accade: si registra in
 * database e poi si consegna, con la sua attribuzione congelata. Questa è
 * l'interfaccia della consegna.
 *
 * Senza credenziali il provider è spento: le conversioni restano registrate e
 * non inviate, visibili nel cruscotto. Meglio un numero che dice «non
 * consegnato» di uno che finge di esserlo.
 */

export type ConversioneDaInviare = {
  evento: string;
  /** Valore in centesimi. Nullo quando l'evento non ha un importo reale. */
  valoreCent: number | null;
  valuta: string;
  avvenutaAt: Date;
  /** Deduplicazione presso la piattaforma. */
  chiaveDedup: string;
  /** Identificativo del clic, quando c'è. Senza, la conversione non è attribuibile. */
  gclid?: string | null;
  fbclid?: string | null;
};

export interface ProviderConversioni {
  readonly nome: string;
  configurato(): boolean;
  invia(conversioni: readonly ConversioneDaInviare[]): Promise<{ inviate: number }>;
}

/** Provider spento. Dichiara di non poter inviare, invece di fingere. */
export class ConversioniSpente implements ProviderConversioni {
  readonly nome = "spento";
  configurato() {
    return false;
  }
  async invia(): Promise<{ inviate: number }> {
    return { inviate: 0 };
  }
}

/**
 * Google Ads — caricamento delle conversioni offline.
 *
 * L'API di Google Ads richiede OAuth, un developer token e un `customer_id`;
 * l'implementazione qui costruisce la richiesta e la manda, ma resta spenta
 * finché quelle credenziali non ci sono, perché una campagna alimentata con
 * conversioni sbagliate è peggio di una campagna senza conversioni.
 *
 * Una conversione **senza `gclid` non si manda**: Google non saprebbe a quale
 * clic attribuirla, e la scarterebbe. Registrarla comunque lato nostro serve al
 * funnel interno, che non dipende da Google.
 */
export class GoogleAdsOffline implements ProviderConversioni {
  readonly nome = "google-ads";

  constructor(
    private readonly opzioni: {
      token?: string;
      developerToken?: string;
      customerId?: string;
      /** Nome della azione di conversione configurata in Google Ads, per evento. */
      azioniPerEvento?: Record<string, string>;
      fetch?: typeof fetch;
    } = {},
  ) {}

  configurato(): boolean {
    return Boolean(this.opzioni.token && this.opzioni.developerToken && this.opzioni.customerId);
  }

  async invia(conversioni: readonly ConversioneDaInviare[]): Promise<{ inviate: number }> {
    if (!this.configurato()) return { inviate: 0 };

    const attribuibili = conversioni.filter((c) => c.gclid);
    if (attribuibili.length === 0) return { inviate: 0 };

    const azioni = this.opzioni.azioniPerEvento ?? {};
    const operazioni = attribuibili
      .filter((c) => azioni[c.evento])
      .map((c) => ({
        gclid: c.gclid,
        conversion_action: azioni[c.evento],
        // Google vuole "yyyy-MM-dd HH:mm:ss+|-HH:mm": si manda in UTC.
        conversion_date_time: `${c.avvenutaAt.toISOString().slice(0, 19).replace("T", " ")}+00:00`,
        ...(c.valoreCent !== null
          ? { conversion_value: c.valoreCent / 100, currency_code: c.valuta }
          : {}),
        order_id: c.chiaveDedup,
      }));

    if (operazioni.length === 0) return { inviate: 0 };

    const esegui = this.opzioni.fetch ?? fetch;
    const risposta = await esegui(
      `https://googleads.googleapis.com/v18/customers/${this.opzioni.customerId}:uploadClickConversions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.opzioni.token}`,
          "developer-token": this.opzioni.developerToken!,
          "content-type": "application/json",
        },
        body: JSON.stringify({ conversions: operazioni, partial_failure: true }),
      },
    );

    if (!risposta.ok) {
      const corpo = await risposta.text().catch(() => "");
      throw new Error(`Google Ads ha risposto ${risposta.status}: ${corpo.slice(0, 300)}`);
    }

    return { inviate: operazioni.length };
  }
}
