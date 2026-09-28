/**
 * Adattatore per Fatture in Cloud.
 *
 * Parla con l'API v2 via `fetch`, senza SDK: le tre chiamate che servono sono
 * poche righe, e un SDK avrebbe portato con sé un aggiornamento da inseguire
 * per il resto della vita del prodotto.
 *
 * Gli importi di Fatture in Cloud sono **euro decimali**, i nostri sono
 * centesimi interi. La conversione avviene solo qui, ai due bordi: dentro la
 * piattaforma i decimali sui soldi non entrano mai.
 */
import {
  ErroreFatturazione,
  type DocumentoEmesso,
  type ProviderFatturazione,
  type RichiestaEmissione,
} from "./provider";

const BASE = "https://api-v2.fattureincloud.it";

/** Centesimi → euro con due decimali, come li vuole l'API. */
function inEuro(cent: number): number {
  return Math.round(cent) / 100;
}

/** Euro decimali → centesimi interi, arrotondando una volta sola. */
function inCentesimi(euro: number | string | null | undefined): number {
  const n = typeof euro === "string" ? Number(euro) : (euro ?? 0);
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export class FattureInCloud implements ProviderFatturazione {
  readonly nome = "fatture-in-cloud";

  constructor(
    private readonly opzioni: {
      token?: string;
      aziendaId?: string;
      /** Iniettabile nei test: nessuna chiamata di rete vera. */
      fetch?: typeof fetch;
    } = {},
  ) {}

  configurato(): boolean {
    return Boolean(this.opzioni.token && this.opzioni.aziendaId);
  }

  private async chiama(percorso: string, init: RequestInit): Promise<unknown> {
    if (!this.configurato()) {
      throw new ErroreFatturazione("Credenziali di Fatture in Cloud mancanti.", false);
    }
    const esegui = this.opzioni.fetch ?? fetch;

    let risposta: Response;
    try {
      risposta = await esegui(`${BASE}${percorso}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.opzioni.token}`,
          "content-type": "application/json",
          accept: "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch (errore) {
      // Un problema di rete è ritentabile: il documento quasi certamente non è
      // stato creato, e se lo fosse la ricerca per riferimento lo ritroverebbe.
      throw new ErroreFatturazione("Fatture in Cloud non raggiungibile.", true, String(errore));
    }

    if (!risposta.ok) {
      const corpo = await risposta.text().catch(() => "");
      // 5xx e 429: riprovare ha senso. 4xx sui dati: no — riprovare con gli
      // stessi dati produrrebbe lo stesso rifiuto, o peggio un doppione.
      const ritentabile = risposta.status >= 500 || risposta.status === 429;
      throw new ErroreFatturazione(
        `Fatture in Cloud ha risposto ${risposta.status}.`,
        ritentabile,
        corpo.slice(0, 500),
      );
    }

    return risposta.json();
  }

  async emetti(richiesta: RichiestaEmissione): Promise<DocumentoEmesso> {
    const corpo = {
      data: {
        type: "invoice",
        entity: {
          name: richiesta.cliente.denominazione,
          vat_number: richiesta.cliente.partitaIva ?? undefined,
          tax_code: richiesta.cliente.codiceFiscale ?? undefined,
          address_street: richiesta.cliente.indirizzo ?? undefined,
          address_postal_code: richiesta.cliente.cap ?? undefined,
          address_city: richiesta.cliente.citta ?? undefined,
          address_province: richiesta.cliente.provincia ?? undefined,
          country: richiesta.cliente.paese ?? "Italia",
          certified_email: richiesta.cliente.pec ?? undefined,
          email: richiesta.cliente.email ?? undefined,
          ei_code: richiesta.cliente.codiceDestinatario ?? undefined,
        },
        date: (richiesta.data ?? new Date()).toISOString().slice(0, 10),
        items_list: richiesta.righe.map((r) => ({
          name: r.descrizione,
          qty: r.quantita,
          net_price: inEuro(r.prezzoUnitarioCent),
          vat: { value: r.ivaPuntiBase / 100 },
        })),
        // Il riferimento interno va nelle note, non nel numero: la numerazione
        // è del provider e non si forza dall'esterno.
        notes: [richiesta.note, `Rif. ${richiesta.riferimento}`].filter(Boolean).join(" — "),
      },
    };

    const risposta = (await this.chiama(`/c/${this.opzioni.aziendaId}/issued_documents`, {
      method: "POST",
      body: JSON.stringify(corpo),
    })) as {
      data?: {
        id?: number | string;
        number?: number | string;
        numeration?: string;
        date?: string;
        amount_net?: number;
        amount_vat?: number;
        amount_gross?: number;
        url?: string;
      };
    };

    const documento = risposta.data;
    if (!documento?.id) {
      throw new ErroreFatturazione(
        "Fatture in Cloud non ha restituito un documento.",
        false,
        JSON.stringify(risposta).slice(0, 500),
      );
    }

    return {
      providerDocumentoId: String(documento.id),
      numeroDocumento:
        [documento.number, documento.numeration].filter(Boolean).join("/") || String(documento.id),
      dataDocumento: documento.date ? new Date(documento.date) : new Date(),
      imponibileCent: inCentesimi(documento.amount_net),
      ivaCent: inCentesimi(documento.amount_vat),
      totaleCent: inCentesimi(documento.amount_gross),
      urlDocumento: documento.url ?? null,
    };
  }
}
