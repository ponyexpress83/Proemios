import { describe, it, expect } from "vitest";
import { computeQuote, type ServiceKey } from "@/lib/pricing";
import {
  projectFromText,
  stateFromText,
  wordsFromText,
  quoteWizardUrl,
} from "@/lib/quote-assistant";
import {
  validDemoSession,
  initialDemoState,
  restoreDemoState,
  addDemoMessage,
} from "@/lib/author-demo";

describe("pacchetti e servizi richiesti", () => {
  it("rispetta la correzione bozze in tutti i pacchetti del caso segnalato nell’audit", () => {
    const q = computeQuote({
      projectType: "romanzo",
      textState: "finito-da-revisionare",
      wordCount: 50000,
      requestedServices: ["proofreading"],
    });
    expect(q.packages.map((p) => p.total)).toEqual([2210, 2710, 4260]);
    for (const p of q.packages)
      expect(p.lineItems.filter((i) => i.key === "proofreading")).toHaveLength(1);
  });
  it("deduplica i servizi mantenendo la stessa composizione e gli stessi costi", () => {
    const requested: ServiceKey[] = ["editing", "proofreading", "cover", "epub"];
    const input = {
      projectType: "romanzo" as const,
      textState: "finito-da-revisionare" as const,
      wordCount: 80000,
      requestedServices: requested,
    };
    expect(computeQuote({ ...input, requestedServices: [...requested, ...requested] })).toEqual(
      computeQuote(input),
    );
    for (const p of computeQuote(input).packages)
      for (const key of requested) expect(p.lineItems.filter((i) => i.key === key)).toHaveLength(1);
  });
});
describe("assistente guidato", () => {
  it("riconosce risposte italiane senza inventare il genere quando manca", () => {
    expect(projectFromText("Voglio raccontare una storia vera")).toBe("memoir");
    expect(projectFromText("Non so da dove partire")).toBeUndefined();
    expect(stateFromText("Ho solo un’idea")).toBe("solo-materiali");
  });
  it("interpreta conteggi digitati e dettati, rifiutando valori fuori limite", () => {
    expect(wordsFromText("50.000 parole")).toBe(50000);
    expect(wordsFromText("50 mila parole")).toBe(50000);
    expect(wordsFromText("cinquantamila parole")).toBe(50000);
    expect(wordsFromText("0 parole")).toBeUndefined();
    expect(wordsFromText("-5000 parole")).toBeUndefined();
    expect(wordsFromText("50,5 mila parole")).toBe(50500);
    expect(wordsFromText("3000000 parole")).toBeUndefined();
  });
  it("trasferisce tutte le scelte nel configuratore, senza contatti personali", () => {
    const url = new URL(
      quoteWizardUrl({
        projectType: "memoir",
        textState: "solo-materiali",
        wordCount: 20000,
        requestedServices: ["editing", "cover"],
        urgency: "prioritaria",
      }),
      "https://proemios.it",
    );
    expect(url.searchParams.get("stato")).toBe("solo-materiali");
    expect(url.searchParams.get("servizi")).toBe("editing,cover");
    expect(url.searchParams.get("tempi")).toBe("prioritaria");
    expect(url.searchParams.has("email")).toBe(false);
  });
});
describe("area autore demo isolata", () => {
  it("accetta solo sessioni demo valide, non scadute e non future", () => {
    const now = 100000000;
    expect(
      validDemoSession(JSON.stringify({ user: "demo-author", createdAt: now - 1000 }), now),
    ).toBe(true);
    expect(
      validDemoSession(JSON.stringify({ user: "demo-author", createdAt: now - 9 * 3600000 }), now),
    ).toBe(false);
    expect(validDemoSession(JSON.stringify({ user: "demo-author", createdAt: now + 1 }), now)).toBe(
      false,
    );
    expect(validDemoSession("{", now)).toBe(false);
  });
  it("ripristina dati corrotti e limita i messaggi alla demo", () => {
    expect(restoreDemoState('{"approved":true,"messages":[{"text":null}]}')).toEqual(
      initialDemoState(),
    );
    const next = addDemoMessage(initialDemoState(), "  Vorrei rivedere l’inizio. ", "test");
    expect(next.messages.at(-2)?.text).toBe("Vorrei rivedere l’inizio.");
    expect(next.messages.at(-1)?.text).toContain("Risposta simulata");
    expect(initialDemoState().messages).toHaveLength(1);
  });
});
