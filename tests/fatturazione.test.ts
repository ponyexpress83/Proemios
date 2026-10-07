import { describe, it, expect } from "vitest";
import { FattureInCloud } from "@/lib/fatturazione/fatture-in-cloud";
import { ErroreFatturazione, ProviderManuale } from "@/lib/fatturazione/provider";
import { datiSufficientiPerFattura } from "@/lib/dati/fatture";

/** Costruisce un fetch finto che registra la richiesta e risponde a comando. */
function fetchFinto(risposta: { stato?: number; corpo?: unknown }) {
  const chiamate: { url: string; corpo: unknown }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    chiamate.push({
      url: String(url),
      corpo: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const stato = risposta.stato ?? 200;
    return new Response(JSON.stringify(risposta.corpo ?? {}), {
      status: stato,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { f, chiamate };
}

const CLIENTE = {
  denominazione: "Edizioni Aurora S.r.l.",
  indirizzo: "Via Mazzini 4",
  cap: "20121",
  citta: "Milano",
  provincia: "MI",
  paese: "Italia",
  partitaIva: "01234567890",
  codiceDestinatario: "ABCDEFG",
};

describe("provider manuale", () => {
  it("dichiara di non poter emettere invece di fingere", () => {
    const p = new ProviderManuale();
    expect(p.configurato()).toBe(false);
    return expect(p.emetti()).rejects.toBeInstanceOf(ErroreFatturazione);
  });
});

describe("Fatture in Cloud", () => {
  it("non è configurato senza credenziali", () => {
    expect(new FattureInCloud().configurato()).toBe(false);
    expect(new FattureInCloud({ token: "t" }).configurato()).toBe(false);
    expect(new FattureInCloud({ token: "t", aziendaId: "1" }).configurato()).toBe(true);
  });

  it("converte i centesimi in euro solo al confine", async () => {
    // Dentro la piattaforma i soldi sono interi. L'API vuole decimali: la
    // conversione avviene qui e solo qui.
    const { f, chiamate } = fetchFinto({
      corpo: {
        data: {
          id: 991,
          number: 7,
          numeration: "2026",
          date: "2026-09-05",
          amount_net: 1000,
          amount_vat: 220,
          amount_gross: 1220,
        },
      },
    });

    const provider = new FattureInCloud({ token: "t", aziendaId: "42", fetch: f });
    const documento = await provider.emetti({
      riferimento: "rif-1",
      cliente: CLIENTE,
      righe: [
        { descrizione: "Editing", quantita: 1, prezzoUnitarioCent: 100_000, ivaPuntiBase: 2_200 },
      ],
    });

    const inviato = chiamate[0]!.corpo as {
      data: { items_list: { net_price: number; vat: { value: number } }[] };
    };
    expect(inviato.data.items_list[0]!.net_price).toBe(1000);
    expect(inviato.data.items_list[0]!.vat.value).toBe(22);

    // E torna in centesimi interi.
    expect(documento).toMatchObject({
      providerDocumentoId: "991",
      numeroDocumento: "7/2026",
      imponibileCent: 100_000,
      ivaCent: 22_000,
      totaleCent: 122_000,
    });
  });

  it("non forza la numerazione: il riferimento interno va nelle note", async () => {
    const { f, chiamate } = fetchFinto({
      corpo: { data: { id: 1, number: 1, date: "2026-01-01" } },
    });
    await new FattureInCloud({ token: "t", aziendaId: "1", fetch: f }).emetti({
      riferimento: "fatt-abc",
      cliente: CLIENTE,
      righe: [{ descrizione: "X", quantita: 1, prezzoUnitarioCent: 100, ivaPuntiBase: 0 }],
    });
    const inviato = chiamate[0]!.corpo as { data: { notes: string; number?: unknown } };
    expect(inviato.data.notes).toContain("fatt-abc");
    expect(inviato.data.number).toBeUndefined();
  });

  it("distingue gli errori che vale la pena riprovare da quelli che no", async () => {
    // 5xx: il documento probabilmente non esiste, riprovare è giusto.
    const server = new FattureInCloud({
      token: "t",
      aziendaId: "1",
      fetch: fetchFinto({ stato: 503 }).f,
    });
    await expect(
      server.emetti({ riferimento: "r", cliente: CLIENTE, righe: [] }),
    ).rejects.toMatchObject({ ritentabile: true });

    // 422 sui dati: riprovare produrrebbe lo stesso rifiuto, o un doppione.
    const dati = new FattureInCloud({
      token: "t",
      aziendaId: "1",
      fetch: fetchFinto({ stato: 422, corpo: { error: "partita iva non valida" } }).f,
    });
    await expect(
      dati.emetti({ riferimento: "r", cliente: CLIENTE, righe: [] }),
    ).rejects.toMatchObject({ ritentabile: false });
  });

  it("tratta un problema di rete come ritentabile", async () => {
    const rotto = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    await expect(
      new FattureInCloud({ token: "t", aziendaId: "1", fetch: rotto }).emetti({
        riferimento: "r",
        cliente: CLIENTE,
        righe: [],
      }),
    ).rejects.toMatchObject({ ritentabile: true });
  });

  it("rifiuta una risposta senza documento invece di inventarne uno", async () => {
    const { f } = fetchFinto({ corpo: { data: {} } });
    await expect(
      new FattureInCloud({ token: "t", aziendaId: "1", fetch: f }).emetti({
        riferimento: "r",
        cliente: CLIENTE,
        righe: [],
      }),
    ).rejects.toBeInstanceOf(ErroreFatturazione);
  });
});

describe("completezza dei dati di fatturazione", () => {
  it("accetta un'anagrafica completa", () => {
    expect(datiSufficientiPerFattura(CLIENTE).ok).toBe(true);
  });

  it("dice cosa manca invece di limitarsi a rifiutare", () => {
    const esito = datiSufficientiPerFattura({ denominazione: "Mario Rossi" });
    expect(esito.ok).toBe(false);
    expect(esito.mancanti).toContain("partita IVA o codice fiscale");
    expect(esito.mancanti).toContain("indirizzo completo");
    expect(esito.mancanti).toContain("codice destinatario o PEC");
  });

  it("il codice fiscale basta per un privato", () => {
    expect(
      datiSufficientiPerFattura({
        denominazione: "Mario Rossi",
        codiceFiscale: "RSSMRA80A01H501U",
        indirizzo: "Via Roma 1",
        cap: "00100",
        citta: "Roma",
        pec: "mario@pec.it",
      }).ok,
    ).toBe(true);
  });
});
