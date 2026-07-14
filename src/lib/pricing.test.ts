import { describe, it, expect } from "vitest";
import { calcolaPreventivo, stimaFasciaCosto, type QuoteInput } from "./pricing";
import { PRICING } from "@/config/pricing";

function baseInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    projectType: "romanzo",
    statoTesto: "scritto-da-revisionare",
    parole: 50000,
    servizi: [],
    tempistica: "standard",
    ...overrides,
  };
}

describe("calcolaPreventivo — struttura di output", () => {
  it("restituisce sempre tre pacchetti nell'ordine atteso", () => {
    const r = calcolaPreventivo(baseInput());
    expect(r.pacchetti).toHaveLength(3);
    expect(r.pacchetti.map((p) => p.key)).toEqual(["essenziale", "consigliato", "signature"]);
  });

  it("evidenzia solo il pacchetto Consigliato", () => {
    const r = calcolaPreventivo(baseInput());
    expect(r.pacchetti.filter((p) => p.inEvidenza).map((p) => p.key)).toEqual(["consigliato"]);
  });

  it("i tre pacchetti hanno prezzi crescenti e diversi", () => {
    const [e, c, s] = calcolaPreventivo(baseInput()).pacchetti;
    expect(e.totale).toBeLessThan(c.totale);
    expect(c.totale).toBeLessThan(s.totale);
    expect(new Set([e.totale, c.totale, s.totale]).size).toBe(3);
  });

  it("l'acconto è il 40% del totale", () => {
    const r = calcolaPreventivo(baseInput());
    for (const p of r.pacchetti) {
      expect(p.acconto).toBe(Math.round(p.totale * PRICING.accontoFrazione));
    }
  });
});

describe("calcolaPreventivo — calcolo componenti", () => {
  it("l'editing è calcolato a parola secondo la tariffa", () => {
    const r = calcolaPreventivo(baseInput({ parole: 50000, statoTesto: "scritto-da-revisionare" }));
    const consigliato = r.pacchetti[1];
    const editing = consigliato.componenti.find((c) => c.servizio === "editing");
    expect(editing?.prezzo).toBe(Math.round(50000 * PRICING.perParola.editing));
  });

  it("Essenziale usa la correzione bozze, non l'editing", () => {
    const essenziale = calcolaPreventivo(baseInput()).pacchetti[0];
    expect(essenziale.componenti.some((c) => c.servizio === "correzioneBozze")).toBe(true);
    expect(essenziale.componenti.some((c) => c.servizio === "editing")).toBe(false);
  });

  it("un testo già revisionato usa la correzione bozze anche nel Consigliato", () => {
    const r = calcolaPreventivo(baseInput({ statoTesto: "scritto-revisionato" }));
    const consigliato = r.pacchetti[1];
    expect(consigliato.componenti.some((c) => c.servizio === "correzioneBozze")).toBe(true);
    expect(consigliato.componenti.some((c) => c.servizio === "editing")).toBe(false);
  });

  it("Signature include ISBN e scheda Amazon, Essenziale no", () => {
    const [essenziale, , signature] = calcolaPreventivo(baseInput()).pacchetti;
    expect(signature.componenti.some((c) => c.servizio === "isbnEsterno")).toBe(true);
    expect(signature.componenti.some((c) => c.servizio === "schedaAmazon")).toBe(true);
    expect(essenziale.componenti.some((c) => c.servizio === "isbnEsterno")).toBe(false);
  });
});

describe("calcolaPreventivo — tempistica prioritaria", () => {
  it("applica la maggiorazione del 25% al totale", () => {
    const standard = calcolaPreventivo(baseInput({ tempistica: "standard" })).pacchetti[1];
    const prioritaria = calcolaPreventivo(baseInput({ tempistica: "prioritaria" })).pacchetti[1];
    expect(prioritaria.totale).toBe(Math.round(standard.subtotale * (1 + PRICING.prioritaria)));
    expect(prioritaria.totale).toBeGreaterThan(standard.totale);
  });
});

describe("calcolaPreventivo — ghostwriting (solo materiali)", () => {
  it("include il ghostwriting e converte le pagine in parole", () => {
    const r = calcolaPreventivo(
      baseInput({
        projectType: "memoir",
        statoTesto: "solo-materiali",
        pagineStimate: 200,
        parole: 0,
      }),
    );
    expect(r.paroleEffettive).toBe(200 * PRICING.parolePerPagina);
    for (const p of r.pacchetti) {
      expect(p.componenti.some((c) => c.servizio === "ghostwriting")).toBe(true);
    }
  });

  it("con ghostwriting non aggiunge editing né correzione", () => {
    const r = calcolaPreventivo(
      baseInput({
        projectType: "memoir",
        statoTesto: "solo-materiali",
        pagineStimate: 150,
        servizi: ["editing", "correzioneBozze", "schedaAmazon"],
      }),
    );
    const consigliato = r.pacchetti[1];
    expect(consigliato.componenti.some((c) => c.servizio === "editing")).toBe(false);
    expect(consigliato.componenti.some((c) => c.servizio === "correzioneBozze")).toBe(false);
  });
});

describe("calcolaPreventivo — solo grafica", () => {
  it("include solo servizi di design con scope crescente", () => {
    const [e, c, s] = calcolaPreventivo(
      baseInput({ projectType: "grafica", statoTesto: "scritto-revisionato" }),
    ).pacchetti;
    expect(e.componenti.map((x) => x.servizio)).toEqual(["copertina"]);
    expect(c.componenti.some((x) => x.servizio === "impaginazioneCartacea")).toBe(true);
    expect(s.componenti.some((x) => x.servizio === "epub")).toBe(true);
    // nessun servizio testuale o di pubblicazione
    for (const p of [e, c, s]) {
      expect(p.componenti.some((x) => x.servizio === "editing")).toBe(false);
      expect(p.componenti.some((x) => x.servizio === "pubblicazioneKdp")).toBe(false);
    }
  });
});

describe("calcolaPreventivo — servizi selezionati dall'utente", () => {
  it("aggiunge i servizi scelti a Consigliato ma non a Essenziale", () => {
    const r = calcolaPreventivo(baseInput({ servizi: ["schedaAmazon"] }));
    const [essenziale, consigliato] = r.pacchetti;
    expect(consigliato.componenti.some((c) => c.servizio === "schedaAmazon")).toBe(true);
    expect(essenziale.componenti.some((c) => c.servizio === "schedaAmazon")).toBe(false);
  });
});

describe("calcolaPreventivo — minimo di progetto", () => {
  it("non scende sotto il minimo configurato", () => {
    const r = calcolaPreventivo(
      baseInput({ projectType: "grafica", parole: 100, statoTesto: "scritto-revisionato" }),
    );
    for (const p of r.pacchetti) {
      expect(p.totale).toBeGreaterThanOrEqual(PRICING.minimoProgetto);
    }
  });
});

describe("stimaFasciaCosto", () => {
  it("restituisce un intervallo coerente (min <= max)", () => {
    for (const livello of ["correzione", "editing-leggero", "editing-profondo"] as const) {
      const f = stimaFasciaCosto(50000, livello);
      expect(f.livello).toBe(livello);
      expect(f.min).toBeLessThanOrEqual(f.max);
      expect(f.min).toBeGreaterThanOrEqual(PRICING.minimoProgetto);
    }
  });

  it("l'editing profondo costa più della sola correzione", () => {
    const correzione = stimaFasciaCosto(50000, "correzione");
    const profondo = stimaFasciaCosto(50000, "editing-profondo");
    expect(profondo.min).toBeGreaterThan(correzione.min);
  });
});
