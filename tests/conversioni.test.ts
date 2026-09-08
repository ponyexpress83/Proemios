import { describe, it, expect } from "vitest";
import {
  CHIAVI_VIETATE_IN_ANALYTICS,
  EVENTI,
  EVENTI_ESITO,
  EVENTI_NAVIGAZIONE,
  EVENTO_PER_STATO_LEAD,
  HA_VALORE,
  payloadDataLayer,
} from "@/lib/analytics/eventi";
import { STATI_LEAD } from "@/lib/crm/pipeline";
import { ConversioniSpente, GoogleAdsOffline } from "@/lib/analytics/piattaforme";

describe("catalogo degli eventi", () => {
  it("copre tutti gli eventi richiesti dalla campagna", () => {
    for (const richiesto of [
      "lead_created",
      "quote_started",
      "quote_generated",
      "consultation_clicked",
      "checkout_started",
      "purchase",
      "qualified_lead",
      "proposal_sent",
      "client_won",
    ]) {
      expect(EVENTI, `manca ${richiesto}`).toContain(richiesto);
    }
  });

  it("tiene separati gli eventi di navigazione da quelli di esito", () => {
    // Sono due mondi: i primi hanno un browser aperto, i secondi no.
    for (const e of EVENTI_NAVIGAZIONE) {
      expect(EVENTI_ESITO).not.toContain(e as never);
    }
    expect(EVENTI_ESITO).toContain("purchase");
    expect(EVENTI_NAVIGAZIONE).toContain("checkout_started");
  });

  it("ogni evento dichiara se porta un valore", () => {
    for (const e of EVENTI) {
      expect(typeof HA_VALORE[e]).toBe("boolean");
    }
    // Un clic su «prenota una call» non vale euro: dargliene uno inventato
    // insegnerebbe alla campagna a comprare il pubblico sbagliato.
    expect(HA_VALORE.consultation_clicked).toBe(false);
    expect(HA_VALORE.purchase).toBe(true);
  });

  it("copre ogni stato del lead, anche quelli che non emettono niente", () => {
    for (const stato of STATI_LEAD) {
      expect(EVENTO_PER_STATO_LEAD, `stato ${stato} non mappato`).toHaveProperty(stato);
    }
    expect(EVENTO_PER_STATO_LEAD.qualificato).toBe("qualified_lead");
    expect(EVENTO_PER_STATO_LEAD.proposta).toBe("proposal_sent");
    expect(EVENTO_PER_STATO_LEAD.cliente).toBe("client_won");
    // «Perso» non è una conversione.
    expect(EVENTO_PER_STATO_LEAD.perso).toBeNull();
  });
});

describe("payload per il dataLayer", () => {
  it("converte i centesimi in euro una volta sola", () => {
    const p = payloadDataLayer("quote_generated", { valoreCent: 249_900 });
    expect(p.value).toBe(2499);
    expect(p.currency).toBe("EUR");
  });

  it("non mette un valore su un evento che non ne ha uno", () => {
    const p = payloadDataLayer("consultation_clicked", { valoreCent: 100_000 });
    expect(p.value).toBeUndefined();
    expect(p.currency).toBeUndefined();
  });

  it("scarta i parametri che somigliano a dati personali", () => {
    // Il dataLayer è leggibile da qualunque script sulla pagina, comprese le
    // estensioni del browser.
    const p = payloadDataLayer("lead_created", {
      extra: {
        email: "anna@x.it",
        nome_cliente: "Anna",
        telefono: "3331234567",
        word_count: 82_000,
      },
    });
    expect(p.word_count).toBe(82_000);
    for (const chiave of ["email", "nome_cliente", "telefono"]) {
      expect(Object.keys(p)).not.toContain(chiave);
    }
    const serializzato = JSON.stringify(p);
    expect(serializzato).not.toContain("anna@x.it");
    expect(serializzato).not.toContain("3331234567");
  });

  it("l'elenco delle chiavi vietate copre i campi identificanti", () => {
    for (const attesa of ["email", "telefono", "codiceFiscale", "partitaIva"]) {
      expect(CHIAVI_VIETATE_IN_ANALYTICS).toContain(attesa);
    }
  });

  it("porta l'identificativo di transazione per la deduplicazione", () => {
    const p = payloadDataLayer("checkout_started", {
      transazioneId: "O-2026-0007",
      quoteId: "q1",
    });
    expect(p.transaction_id).toBe("O-2026-0007");
    expect(p.quote_id).toBe("q1");
  });
});

describe("consegna alle piattaforme", () => {
  it("spenta non manda e non finge", async () => {
    const p = new ConversioniSpente();
    expect(p.configurato()).toBe(false);
    expect(await p.invia()).toEqual({ inviate: 0 });
  });

  it("Google Ads resta spento senza credenziali complete", () => {
    expect(new GoogleAdsOffline().configurato()).toBe(false);
    expect(new GoogleAdsOffline({ token: "t", developerToken: "d" }).configurato()).toBe(false);
    expect(
      new GoogleAdsOffline({ token: "t", developerToken: "d", customerId: "1" }).configurato(),
    ).toBe(true);
  });

  it("non manda le conversioni senza gclid: Google le scarterebbe", async () => {
    let chiamato = false;
    const f = (async () => {
      chiamato = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new GoogleAdsOffline({
      token: "t",
      developerToken: "d",
      customerId: "1",
      azioniPerEvento: { purchase: "customers/1/conversionActions/2" },
      fetch: f,
    });

    const esito = await provider.invia([
      {
        evento: "purchase",
        valoreCent: 10_000,
        valuta: "EUR",
        avvenutaAt: new Date(),
        chiaveDedup: "x",
        gclid: null,
      },
    ]);
    expect(esito.inviate).toBe(0);
    expect(chiamato).toBe(false);
  });

  it("manda solo gli eventi per cui esiste un'azione configurata", async () => {
    let corpo: { conversions: unknown[] } | null = null;
    const f = (async (_u: string | URL | Request, init?: RequestInit) => {
      corpo = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new GoogleAdsOffline({
      token: "t",
      developerToken: "d",
      customerId: "1",
      azioniPerEvento: { purchase: "customers/1/conversionActions/2" },
      fetch: f,
    });

    const esito = await provider.invia([
      {
        evento: "purchase",
        valoreCent: 12_200,
        valuta: "EUR",
        avvenutaAt: new Date("2026-09-05T10:00:00Z"),
        chiaveDedup: "pagamento-1-purchase",
        gclid: "gclid-1",
      },
      // Senza azione configurata: non si inventa una destinazione.
      {
        evento: "qualified_lead",
        valoreCent: null,
        valuta: "EUR",
        avvenutaAt: new Date(),
        chiaveDedup: "lead-1-qualified_lead",
        gclid: "gclid-2",
      },
    ]);

    expect(esito.inviate).toBe(1);
    const inviate = corpo!.conversions as Record<string, unknown>[];
    expect(inviate).toHaveLength(1);
    expect(inviate[0]!.conversion_value).toBe(122);
    expect(inviate[0]!.order_id).toBe("pagamento-1-purchase");
    expect(inviate[0]!.conversion_date_time).toBe("2026-09-05 10:00:00+00:00");
  });

  it("non inventa un valore per un evento che non ne ha uno", async () => {
    let corpo: { conversions: Record<string, unknown>[] } | null = null;
    const f = (async (_u: string | URL | Request, init?: RequestInit) => {
      corpo = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await new GoogleAdsOffline({
      token: "t",
      developerToken: "d",
      customerId: "1",
      azioniPerEvento: { qualified_lead: "customers/1/conversionActions/9" },
      fetch: f,
    }).invia([
      {
        evento: "qualified_lead",
        valoreCent: null,
        valuta: "EUR",
        avvenutaAt: new Date(),
        chiaveDedup: "k",
        gclid: "g",
      },
    ]);

    expect(corpo!.conversions[0]).not.toHaveProperty("conversion_value");
  });
});
