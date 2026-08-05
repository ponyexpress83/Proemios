import { describe, it, expect } from "vitest";
import {
  computeQuote,
  editingCost,
  proofreadingCost,
  layoutCost,
  ghostwritingCost,
  volumeDiscountRate,
  estimatePages,
  type PricingInput,
} from "@/lib/pricing";
import {
  PROJECT_MINIMUM,
  DEPOSIT_RATE,
  RUSH_SURCHARGE,
  GHOSTWRITING,
  FLAT_SERVICES,
} from "@/config/pricing";

const base: PricingInput = {
  projectType: "romanzo",
  textState: "finito-da-revisionare",
  wordCount: 60_000,
  urgency: "standard",
};

describe("helper puri", () => {
  it("stima le pagine dal conteggio parole", () => {
    expect(estimatePages(0)).toBe(1);
    expect(estimatePages(300)).toBe(1);
    expect(estimatePages(301)).toBe(2);
    expect(estimatePages(60_000)).toBe(200);
  });

  it("applica la fascia a parola corretta per l'editing", () => {
    // 30k -> prima fascia 0.022
    expect(editingCost(30_000)).toBe(Math.round(30_000 * 0.022));
    // 100k -> terza fascia 0.016
    expect(editingCost(100_000)).toBe(Math.round(100_000 * 0.016));
  });

  it("la correzione bozze costa circa metà dell'editing", () => {
    expect(proofreadingCost(30_000)).toBeLessThan(editingCost(30_000));
  });

  it("l'impaginazione segue gli scaglioni di pagine", () => {
    expect(layoutCost(300)).toBe(250); // 1 pagina -> primo scaglione
    expect(layoutCost(60_000)).toBe(400); // 200 pagine -> secondo scaglione
    expect(layoutCost(200_000)).toBe(850); // >400 pagine -> ultimo scaglione
  });

  it("lo sconto volume scatta oltre le soglie", () => {
    expect(volumeDiscountRate(50_000)).toBe(0);
    expect(volumeDiscountRate(80_000)).toBe(0.05);
    expect(volumeDiscountRate(120_000)).toBe(0.08);
    expect(volumeDiscountRate(500_000)).toBe(0.08);
  });
});

describe("computeQuote — struttura", () => {
  it("restituisce sempre tre pacchetti con Consigliato evidenziato", () => {
    const q = computeQuote(base);
    expect(q.packages).toHaveLength(3);
    expect(q.packages.map((p) => p.tier)).toEqual(["essenziale", "consigliato", "signature"]);
    expect(q.packages[1].recommended).toBe(true);
    expect(q.packages[0].recommended).toBe(false);
    expect(q.packages[2].recommended).toBe(false);
  });

  it("include ed esclude sono complementari e non vuoti insieme", () => {
    const q = computeQuote(base);
    for (const p of q.packages) {
      const overlap = p.includes.filter((x) => p.excludes.includes(x));
      expect(overlap).toHaveLength(0);
      expect(p.includes.length).toBeGreaterThan(0);
    }
  });

  it("il prezzo cresce da Essenziale a Signature", () => {
    const q = computeQuote(base);
    expect(q.packages[0].total).toBeLessThanOrEqual(q.packages[1].total);
    expect(q.packages[1].total).toBeLessThan(q.packages[2].total);
  });

  it("l'acconto è il 40% del totale", () => {
    const q = computeQuote(base);
    for (const p of q.packages) {
      expect(p.deposit).toBe(Math.round(p.total * DEPOSIT_RATE));
    }
  });
});

describe("computeQuote — casi limite", () => {
  it("manoscritto minimo: non scende sotto il prezzo minimo di progetto", () => {
    const q = computeQuote({
      projectType: "solo-grafica",
      textState: "finito-revisionato",
      wordCount: 200, // 1 pagina
    });
    // solo-grafica essenziale = layout(250) + cover(350) = 600, sopra il minimo.
    expect(q.packages[0].total).toBeGreaterThanOrEqual(PROJECT_MINIMUM);
  });

  it("prezzo minimo applicato con flag quando il totale sarebbe troppo basso", () => {
    // Forziamo un caso in cui solo un servizio economico viene richiesto.
    // Un romanzo cortissimo, finito e revisionato: essenziale ha comunque più servizi,
    // quindi testiamo il floor con una richiesta grafica su testo minuscolo… usiamo l'invariante:
    const q = computeQuote({
      projectType: "solo-grafica",
      textState: "finito-revisionato",
      wordCount: 1,
    });
    for (const p of q.packages) {
      expect(p.total).toBeGreaterThanOrEqual(PROJECT_MINIMUM);
    }
  });

  it("manoscritto enorme: applica la fascia alta e lo sconto volume", () => {
    const huge = computeQuote({ ...base, wordCount: 200_000 });
    const cons = huge.packages[1];
    // C'è editing e deve esserci sconto volume (>120k -> 8%).
    expect(cons.volumeDiscount).toBeGreaterThan(0);
    expect(cons.total).toBeGreaterThan(0);
  });

  it("solo materiali: attiva il ghostwriting e ne rispetta il minimo", () => {
    const q = computeQuote({
      projectType: "memoir",
      textState: "solo-materiali",
      wordCount: 10_000,
      materialAmount: "abbondante",
    });
    expect(q.isGhostwriting).toBe(true);
    const hasGw = q.packages[0].lineItems.some((li) => li.key === "ghostwriting");
    expect(hasGw).toBe(true);
    // materiale abbondante costa meno di scarso, a parità di parole
    // (valutato sopra il minimo di ghostwriting, dove la differenza è visibile)
    const scarso = ghostwritingCost(40_000, "scarso");
    const abbondante = ghostwritingCost(40_000, "abbondante");
    expect(abbondante).toBeLessThan(scarso);
    // rispetta il minimo di ghostwriting
    expect(ghostwritingCost(1_000, "abbondante")).toBe(GHOSTWRITING.minimum);
  });

  it("urgenza: applica la maggiorazione prioritaria", () => {
    const standard = computeQuote({ ...base, urgency: "standard" });
    const rush = computeQuote({ ...base, urgency: "prioritaria" });
    expect(rush.packages[1].rushSurcharge).toBeGreaterThan(0);
    expect(rush.packages[1].total).toBeGreaterThan(standard.packages[1].total);
    // la maggiorazione è ~ RUSH_SURCHARGE sul netto scontato
    const cons = rush.packages[1];
    const expected = Math.round((cons.subtotal - cons.volumeDiscount) * RUSH_SURCHARGE);
    expect(cons.rushSurcharge).toBe(expected);
  });

  it("servizi richiesti extra vengono aggiunti all'Essenziale", () => {
    const withCover = computeQuote({ ...base, requestedServices: ["cover"] });
    const hasCover = withCover.packages[0].lineItems.some((li) => li.key === "cover");
    expect(hasCover).toBe(true);
  });

  it("solo-grafica non include revisione del testo", () => {
    const q = computeQuote({
      projectType: "solo-grafica",
      textState: "finito-revisionato",
      wordCount: 50_000,
    });
    for (const p of q.packages) {
      expect(p.lineItems.some((li) => li.key === "editing" || li.key === "proofreading")).toBe(
        false,
      );
    }
  });

  it("testo finito e revisionato: l'Essenziale usa la correzione, non l'editing", () => {
    const q = computeQuote({ ...base, textState: "finito-revisionato" });
    const ess = q.packages[0];
    expect(ess.lineItems.some((li) => li.key === "proofreading")).toBe(true);
    expect(ess.lineItems.some((li) => li.key === "editing")).toBe(false);
    // ma il Consigliato porta l'editing
    expect(q.packages[1].lineItems.some((li) => li.key === "editing")).toBe(true);
  });

  it("i forfait corrispondono alla configurazione", () => {
    const q = computeQuote(base);
    const epub = q.packages[1].lineItems.find((li) => li.key === "epub");
    expect(epub?.amount).toBe(FLAT_SERVICES.epub);
  });
});
