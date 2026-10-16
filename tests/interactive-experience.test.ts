import { describe, it, expect } from "vitest";
import { computeQuote, type ServiceKey } from "@/lib/pricing";
import {
  projectFromText,
  stateFromText,
  wordsFromText,
  quoteWizardUrl,
  briefFromText,
} from "@/lib/quote-assistant";
import {
  validDemoSession,
  initialDemoState,
  restoreDemoState,
  addDemoMessage,
} from "@/lib/author-demo";

describe("pacchetti e servizi richiesti", () => {
  it("la correzione bozze richiesta sostituisce l’editing di base, non si somma", () => {
    const q = computeQuote({
      projectType: "romanzo",
      textState: "finito-da-revisionare",
      wordCount: 50000,
      requestedServices: ["proofreading"],
    });
    // Essenziale: solo correzione + produzione; Consigliato: editing (livello superiore); Signature: entrambe.
    expect(q.packages.map((p) => p.total)).toEqual([1260, 2260, 4260]);
    const keys = (i: number) => q.packages[i]!.lineItems.map((li) => li.key);
    expect(keys(0)).toContain("proofreading");
    expect(keys(0)).not.toContain("editing");
    expect(keys(1)).toContain("editing");
    expect(keys(1)).not.toContain("proofreading");
    expect(keys(2)).toEqual(expect.arrayContaining(["editing", "proofreading"]));
    for (const p of q.packages)
      expect(p.lineItems.filter((i) => i.key === "proofreading").length).toBeLessThanOrEqual(1);
  });
  it("il servizio singolo dell’assistente arriva al configuratore come acquisto singolo", () => {
    const single = new URL(
      quoteWizardUrl({ projectType: "romanzo", textState: "finito-da-revisionare", wordCount: 50000, singleService: "proofreading", requestedServices: [] }),
      "https://proemios.it",
    );
    expect(single.searchParams.get("servizi")).toBe("proofreading");
    expect(single.searchParams.get("singolo")).toBe("1");
    const full = new URL(
      quoteWizardUrl({ projectType: "romanzo", textState: "finito-da-revisionare", wordCount: 50000, requestedServices: ["cover"] }),
      "https://proemios.it",
    );
    expect(full.searchParams.get("singolo")).toBe("0");
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
  it("precompila il brief italiano e distingue parole, anni e servizi negati", () => {
    expect(
      briefFromText("Ho finito un romanzo di cinquantamila parole, vorrei editing e copertina."),
    ).toEqual({
      projectType: "romanzo",
      textState: "finito-da-revisionare",
      wordCount: 50000,
      requestedServices: ["editing", "cover"],
    });
    const brief = briefFromText(
      "Un memoir ambientato nel 1980. Sono 50 mila parole. Non voglio copertina. Vorrei impaginazione.",
    );
    expect(brief.wordCount).toBe(50000);
    expect(brief.requestedServices).toEqual(["layout"]);
    expect(briefFromText("Ho 42 anni e vorrei un romanzo").wordCount).toBeUndefined();
    expect(briefFromText("Vorrei editing").textState).toBeUndefined();
    expect(briefFromText("Un romanzo di -5000 parole").wordCount).toBeUndefined();
  });
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
