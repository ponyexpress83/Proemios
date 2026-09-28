import { describe, it, expect } from "vitest";
import { urlAppuntamento } from "@/lib/comunicazione/calendario";
import {
  linkConversazione,
  numeroWhatsApp,
  WhatsAppCloud,
  WhatsAppSpento,
} from "@/lib/comunicazione/whatsapp";

describe("numeri WhatsApp", () => {
  it("normalizza le forme che scrivono le persone", () => {
    expect(numeroWhatsApp("+39 333 123 4567")).toBe("393331234567");
    expect(numeroWhatsApp("0039-333-1234567")).toBe("393331234567");
    expect(numeroWhatsApp("333 1234567")).toBe("393331234567");
    expect(numeroWhatsApp("+44 20 7946 0958")).toBe("442079460958");
  });

  it("rifiuta ciò che non è un numero invece di inventarne uno", () => {
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp("pronto?")).toBeNull();
    expect(numeroWhatsApp("+1")).toBeNull();
    expect(numeroWhatsApp("+3912345678901234567")).toBeNull();
  });
});

describe("link alla conversazione", () => {
  it("costruisce un wa.me con il testo codificato", () => {
    const url = linkConversazione("+39 333 1234567", "Ciao, scrivo per il preventivo & basta");
    expect(url).toBe(
      "https://wa.me/393331234567?text=Ciao%2C%20scrivo%20per%20il%20preventivo%20%26%20basta",
    );
  });

  it("restituisce null su un numero non valido, non un link rotto", () => {
    expect(linkConversazione("non un numero")).toBeNull();
  });

  it("tronca i testi lunghi: la barra degli indirizzi non è un canale", () => {
    const url = linkConversazione("+393331234567", "a".repeat(5000))!;
    expect(url.length).toBeLessThan(1200);
  });
});

describe("provider WhatsApp", () => {
  it("spento dichiara di non poter mandare", async () => {
    const p = new WhatsAppSpento();
    expect(p.configurato()).toBe(false);
    await expect(p.invia()).rejects.toThrow(/non è configurato/);
  });

  it("non è configurato senza credenziali complete", () => {
    expect(new WhatsAppCloud().configurato()).toBe(false);
    expect(new WhatsAppCloud({ token: "t" }).configurato()).toBe(false);
    expect(new WhatsAppCloud({ token: "t", numeroId: "1" }).configurato()).toBe(true);
  });

  it("manda solo template, come impone Meta", async () => {
    const chiamate: unknown[] = [];
    const f = (async (_url: string | URL | Request, init?: RequestInit) => {
      chiamate.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const esito = await new WhatsAppCloud({ token: "t", numeroId: "9", fetch: f }).invia({
      a: "+39 333 1234567",
      template: "consegna_pronta",
      parametri: ["Il mare d'inverno"],
    });

    expect(esito.id).toBe("wamid.1");
    const corpo = chiamate[0] as { type: string; to: string; template: { name: string } };
    expect(corpo.type).toBe("template");
    expect(corpo.to).toBe("393331234567");
    expect(corpo.template.name).toBe("consegna_pronta");
  });

  it("non inventa un id quando la risposta non ne ha uno", async () => {
    const f = (async () =>
      new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    await expect(
      new WhatsAppCloud({ token: "t", numeroId: "9", fetch: f }).invia({
        a: "+393331234567",
        template: "x",
      }),
    ).rejects.toThrow(/identificativo/);
  });
});

describe("calendario", () => {
  it("precompila i dati che già conosciamo", () => {
    const url = urlAppuntamento(
      { nome: "Anna Rossi", email: "anna@x.it", riferimento: "O-1" },
      "https://cal.com/proemios/call",
    )!;
    expect(url).toContain("name=Anna+Rossi");
    expect(url).toContain("email=anna%40x.it");
    expect(url).toContain("rif=O-1");
  });

  it("restituisce null senza calendario configurato, invece di un link al nulla", () => {
    expect(urlAppuntamento({ nome: "Anna" }, undefined)).toBeNull();
    expect(urlAppuntamento({ nome: "Anna" }, "")).toBeNull();
  });

  it("rifiuta un calendario servito in chiaro: ci passerebbero nome ed email", () => {
    // Nome ed email finirebbero in query string su una connessione leggibile.
    expect(urlAppuntamento({ email: "anna@x.it" }, "http://cal.example/booking")).toBeNull();
  });

  it("rifiuta un URL malformato", () => {
    expect(urlAppuntamento({}, "non-un-url")).toBeNull();
  });

  it("tronca le note lunghe", () => {
    const url = urlAppuntamento({ note: "n".repeat(3000) }, "https://cal.com/x")!;
    expect(url.length).toBeLessThan(1200);
  });
});
