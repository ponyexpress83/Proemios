import { describe, it, expect } from "vitest";
import { SERVIZI, SLUG_SERVIZI, AREE, getServizio, type PrezzoPubblico } from "@/config/catalogo";
import { PERCORSI, SLUG_PERCORSI, getPercorso } from "@/config/percorsi";
import {
  EDITING_BANDS,
  PROOFREADING_BANDS,
  FLAT_SERVICES,
  GHOSTWRITING,
  SIGNATURE_EXTRAS,
} from "@/config/pricing";

describe("catalogo — integrità", () => {
  it("non ha slug di servizio duplicati", () => {
    expect(new Set(SLUG_SERVIZI).size).toBe(SLUG_SERVIZI.length);
  });

  it("non ha slug di percorso duplicati", () => {
    expect(new Set(SLUG_PERCORSI).size).toBe(SLUG_PERCORSI.length);
  });

  it("usa solo slug in forma kebab-case minuscola", () => {
    for (const slug of [...SLUG_SERVIZI, ...SLUG_PERCORSI]) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("assegna ogni servizio a un'area dichiarata", () => {
    for (const s of SERVIZI) expect(AREE[s.area]).toBeDefined();
  });

  it("copre tutte le aree previste con almeno un servizio", () => {
    for (const area of Object.keys(AREE)) {
      expect(SERVIZI.some((s) => s.area === area)).toBe(true);
    }
  });

  it("non lascia percorsi che puntano a servizi inesistenti", () => {
    for (const p of PERCORSI) {
      for (const slug of p.servizi) {
        expect(SLUG_SERVIZI, `percorso ${p.slug} → servizio ${slug}`).toContain(slug);
      }
    }
  });

  it("non lascia correlati che puntano a servizi inesistenti", () => {
    for (const s of SERVIZI) {
      for (const slug of s.correlati ?? []) {
        expect(SLUG_SERVIZI, `servizio ${s.slug} → correlato ${slug}`).toContain(slug);
      }
    }
  });

  it("risolve ogni slug con il getter e restituisce undefined su slug ignoti", () => {
    for (const slug of SLUG_SERVIZI) expect(getServizio(slug)?.slug).toBe(slug);
    for (const slug of SLUG_PERCORSI) expect(getPercorso(slug)?.slug).toBe(slug);
    expect(getServizio("non-esiste")).toBeUndefined();
    expect(getPercorso("non-esiste")).toBeUndefined();
  });

  it("dà a ogni servizio i contenuti minimi per generare la sua pagina", () => {
    for (const s of SERVIZI) {
      expect(s.nome.length, s.slug).toBeGreaterThan(2);
      expect(s.sommario.length, s.slug).toBeGreaterThan(10);
      expect(s.problema.length, s.slug).toBeGreaterThan(30);
      expect(s.include.length, s.slug).toBeGreaterThanOrEqual(3);
      expect(s.variabili.length, s.slug).toBeGreaterThan(5);
    }
  });

  it("dà a ogni percorso tappe, servizi e FAQ", () => {
    for (const p of PERCORSI) {
      expect(p.tappe.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.servizi.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.faq.length, p.slug).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("catalogo — prezzi", () => {
  /**
   * Il vincolo commerciale: nessun prezzo pubblico può esistere se non deriva
   * da una tariffa già approvata in config/pricing.ts. Il test elenca i valori
   * ammessi e verifica che ogni prezzo del catalogo sia uno di quelli.
   */
  const importiApprovati = new Set<number>([
    ...Object.values(FLAT_SERVICES),
    ...Object.values(SIGNATURE_EXTRAS),
    GHOSTWRITING.minimum,
    149,
    349, // fascia pubblica della scheda di valutazione, già in uso
    250,
    850, // estremi degli scaglioni di impaginazione
  ]);

  const tariffeApprovate = new Set<number>([
    ...EDITING_BANDS.map((b) => b.ratePerWord),
    ...PROOFREADING_BANDS.map((b) => b.ratePerWord),
    ...Object.values(GHOSTWRITING.materialMultiplier).map(
      (m) => GHOSTWRITING.baseRatePerFinalWord * m,
    ),
  ]);

  function verifica(prezzo: PrezzoPubblico, contesto: string) {
    switch (prezzo.tipo) {
      case "preventivo":
        expect(prezzo.motivo.length, contesto).toBeGreaterThan(10);
        break;
      case "forfait":
        expect(importiApprovati.has(prezzo.importo), `${contesto}: ${prezzo.importo}`).toBe(true);
        break;
      case "fascia":
        expect(importiApprovati.has(prezzo.da), `${contesto}: da ${prezzo.da}`).toBe(true);
        expect(importiApprovati.has(prezzo.a), `${contesto}: a ${prezzo.a}`).toBe(true);
        expect(prezzo.da).toBeLessThanOrEqual(prezzo.a);
        break;
      case "a-parola":
        expect(tariffeApprovate.has(prezzo.da), `${contesto}: da ${prezzo.da}`).toBe(true);
        expect(tariffeApprovate.has(prezzo.a), `${contesto}: a ${prezzo.a}`).toBe(true);
        expect(prezzo.da).toBeLessThanOrEqual(prezzo.a);
        break;
    }
  }

  it("non espone nessun prezzo che non derivi da config/pricing.ts", () => {
    for (const s of SERVIZI) verifica(s.prezzo, `servizio ${s.slug}`);
    for (const p of PERCORSI) verifica(p.prezzo, `percorso ${p.slug}`);
  });

  it("motiva sempre il passaggio dal preventivo", () => {
    const senzaPrezzo = SERVIZI.filter((s) => s.prezzo.tipo === "preventivo");
    expect(senzaPrezzo.length).toBeGreaterThan(0);
    for (const s of senzaPrezzo) {
      expect(s.prezzo.tipo === "preventivo" && s.prezzo.motivo).toBeTruthy();
    }
  });
});
