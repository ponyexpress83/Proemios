import { describe, it, expect } from "vitest";
import {
  journeyReducer,
  initialJourney,
  editorialStages,
  editorialScene,
} from "@/lib/editorial-journey";
import { quotePrefill, quoteStep, applyAnalysisWords, hasManuscript } from "@/lib/quote-brief";
import { quoteWizardUrl } from "@/lib/quote-assistant";
import { computeQuote } from "@/lib/pricing";
import { paths } from "@/lib/editorial-content";
import { AUTHOR_SECTIONS, authorSection } from "@/components/author/navigation";

describe("narrazione editoriale", () => {
  it("compie un solo ciclo e resta sulla pubblicazione", () => {
    let state = initialJourney;
    for (let i = 0; i < 6; i++) state = journeyReducer(state, { type: "tick" });
    expect(state).toEqual({ phase: 5, mode: "finished" });
    expect(journeyReducer(state, { type: "tick" })).toEqual(state);
    expect(journeyReducer(state, { type: "replay" })).toEqual(initialJourney);
  });
  it("la scelta manuale sospende finché non si riprende esplicitamente", () => {
    const state = journeyReducer(initialJourney, { type: "select", phase: 3 });
    expect(journeyReducer(state, { type: "tick" })).toEqual(state);
    expect(journeyReducer(journeyReducer(state, { type: "toggle" }), { type: "tick" }).phase).toBe(
      4,
    );
  });
  it("le sei fasi hanno composizioni riconoscibili e distinte", () => {
    const scenes = editorialStages.map((_, i) => decodeURIComponent(editorialScene(i)));
    expect(new Set(scenes).size).toBe(6);
    [
      "CAPITOLO UNO",
      "UNA NUOVA LETTURA",
      "APPROVATO",
      "PROPOSTA B",
      "LA GABBIA EDITORIALE",
      "EPUB",
    ].forEach((text, i) => expect(scenes[i]).toContain(text));
  });
});
describe("brief e passaggio facoltativo", () => {
  it("trasferisce materiali, servizi e prezzi senza divergenze", () => {
    const input = {
      projectType: "memoir" as const,
      textState: "solo-materiali" as const,
      wordCount: 80000,
      materialAmount: "scarso" as const,
      requestedServices: ["cover" as const, "editing" as const],
      urgency: "prioritaria" as const,
    };
    const prefill = quotePrefill(
      Object.fromEntries(new URL(quoteWizardUrl(input), "https://example.test").searchParams),
    );
    const restored = {
      projectType: prefill.tipo!,
      textState: prefill.statoTesto!,
      wordCount: prefill.parole!,
      materialAmount: prefill.materiale,
      requestedServices: prefill.servizi,
      urgency: prefill.tempi,
    };
    expect(computeQuote(restored)).toEqual(computeQuote(input));
  });
  it("salta l’upload per un’idea, anche tornando indietro", () => {
    expect(hasManuscript({ projectType: "memoir", textState: "solo-materiali" })).toBe(false);
    expect(quoteStep(2, 1, false)).toBe(4);
    expect(quoteStep(4, -1, false)).toBe(2);
    expect(quoteStep(2, 1, true)).toBe(3);
    expect(quoteStep(3, 1, true)).toBe(4);
  });
  it("applica il report solo al conteggio e conserva tutto il brief", () => {
    const brief = {
      parole: 50000,
      tipo: "saggio",
      servizi: ["cover"],
      note: "Storia di lavoro",
      nome: "",
    };
    expect(applyAnalysisWords(brief, 1200)).toEqual({ ...brief, parole: 1200 });
    expect(brief.parole).toBe(50000);
    expect(applyAnalysisWords(brief, -1)).toBe(brief);
  });
  it("mappa la quinta pagina a un prezzo supportato conservandone il contesto", () => {
    expect(paths).toHaveLength(5);
    expect(paths.map((p) => p.slug)).toEqual([
      "libro-gia-scritto",
      "idea-da-sviluppare",
      "memoir",
      "libro-professionale",
      "storia-impresa",
    ]);
    expect(quotePrefill({ percorso: paths[4]!.slug })).toMatchObject({
      tipo: "libro-professionale",
      contesto: expect.stringContaining("impresa"),
    });
  });
  it("sette sezioni condivise, con fallback sicuro", () => {
    expect(AUTHOR_SECTIONS.map((s) => s.name)).toEqual([
      "Panoramica",
      "Il mio libro",
      "Messaggi",
      "File e revisioni",
      "Approvazioni",
      "Pagamenti",
      "Consegne",
    ]);
    expect(authorSection("payments")).toBe("payments");
    expect(authorSection("admin")).toBe("overview");
  });
});
