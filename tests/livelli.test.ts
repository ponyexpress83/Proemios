import { describe, it, expect } from "vitest";
import {
  CATEGORIE,
  CATEGORIE_AMMESSE,
  INVASIVITA_MASSIMA,
  LIVELLI,
  SOGLIA_DUBBIO,
  applicaLimiti,
  riclassificaDubbi,
  type InterventoGrezzo,
} from "@/lib/ai/livelli";

function intervento(over: Partial<InterventoGrezzo> = {}): InterventoGrezzo {
  return {
    categoria: "refuso",
    prima: "acuqa",
    dopo: "acqua",
    confidenza: 0.98,
    motivazioneInterna: "trasposizione di lettere",
    ...over,
  };
}

describe("limiti dei livelli — struttura", () => {
  it("le categorie ammesse sono cumulative fra i livelli", () => {
    for (let i = 1; i < LIVELLI.length; i++) {
      const precedente = CATEGORIE_AMMESSE[LIVELLI[i - 1]!];
      const corrente = new Set(CATEGORIE_AMMESSE[LIVELLI[i]!]);
      for (const c of precedente) {
        expect(corrente.has(c), `${LIVELLI[i]} non comprende ${c}`).toBe(true);
      }
    }
  });

  it("l'editing narrativo ammette tutte le categorie", () => {
    expect(new Set(CATEGORIE_AMMESSE["editing-narrativo"])).toEqual(new Set(CATEGORIE));
  });

  it("la correzione bozze non ammette stile, sintassi né ripetizioni", () => {
    const ammesse = CATEGORIE_AMMESSE["correzione-bozze"];
    expect(ammesse).not.toContain("stile");
    expect(ammesse).not.toContain("sintassi");
    expect(ammesse).not.toContain("ripetizione");
  });

  it("l'invasività cresce con il livello", () => {
    expect(INVASIVITA_MASSIMA["correzione-bozze"]).toBeLessThan(
      INVASIVITA_MASSIMA["revisione-linguistica"],
    );
    expect(INVASIVITA_MASSIMA["revisione-linguistica"]).toBeLessThan(
      INVASIVITA_MASSIMA["editing-stilistico"],
    );
  });
});

describe("applicazione dei limiti", () => {
  it("scarta un intervento di stile su una correzione bozze", () => {
    // Chi compra una correzione non deve ricevere un testo riscritto. Il
    // vincolo è applicato qui, non affidato al prompt.
    const esito = applicaLimiti("correzione-bozze", [
      intervento(),
      intervento({ categoria: "stile", prima: "disse piano", dopo: "sussurrò" }),
    ]);
    expect(esito.ammessi).toHaveLength(1);
    expect(esito.scartati).toHaveLength(1);
    expect(esito.scartati[0]!.motivo).toMatch(/fuori dal livello/);
  });

  it("lo stesso intervento passa su un editing stilistico", () => {
    const esito = applicaLimiti("editing-stilistico", [
      intervento({ categoria: "stile", prima: "disse piano", dopo: "sussurrò" }),
    ]);
    expect(esito.ammessi).toHaveLength(1);
  });

  it("scarta una riscrittura travestita da correzione", () => {
    const esito = applicaLimiti("correzione-bozze", [
      intervento({
        categoria: "grammatica",
        prima: "Il cane corse nel prato verde.",
        dopo: "Attraversò di corsa il prato, verde e immenso sotto il sole di maggio.",
      }),
    ]);
    expect(esito.ammessi).toHaveLength(0);
    expect(esito.scartati[0]!.motivo).toMatch(/scostamento|oltre il limite/);
  });

  it("non penalizza gli interventi brevi, dove il rapporto è ingannevole", () => {
    // "e" → "è" è un cambiamento del 100% che nessuno definirebbe invasivo.
    const esito = applicaLimiti("correzione-bozze", [
      intervento({ categoria: "ortografia", prima: "e", dopo: "è" }),
      intervento({ categoria: "punteggiatura", prima: "però ,", dopo: "però," }),
    ]);
    expect(esito.ammessi).toHaveLength(2);
  });

  it("scarta un intervento nullo", () => {
    const esito = applicaLimiti("correzione-bozze", [intervento({ prima: "uguale", dopo: "uguale" })]);
    expect(esito.ammessi).toHaveLength(0);
    expect(esito.scartati[0]!.motivo).toMatch(/nullo/);
  });

  it("scarta una sostituzione oltre la lunghezza massima del livello", () => {
    const esito = applicaLimiti("correzione-bozze", [
      intervento({ prima: "x".repeat(200), dopo: "y".repeat(200) }),
    ]);
    expect(esito.ammessi).toHaveLength(0);
  });

  it("scarta una confidenza fuori intervallo", () => {
    const esito = applicaLimiti("correzione-bozze", [
      intervento({ confidenza: 1.4 }),
      intervento({ confidenza: Number.NaN }),
      intervento({ confidenza: -0.1 }),
    ]);
    expect(esito.ammessi).toHaveLength(0);
    expect(esito.scartati).toHaveLength(3);
  });

  it("motiva ogni scarto", () => {
    const esito = applicaLimiti("correzione-bozze", [
      intervento({ categoria: "stile" }),
      intervento({ prima: "uguale", dopo: "uguale" }),
    ]);
    for (const s of esito.scartati) expect(s.motivo.length).toBeGreaterThan(5);
  });
});

describe("riclassificazione dei dubbi", () => {
  it("un intervento a bassa confidenza diventa un dubbio, non viene buttato", () => {
    // Il redattore vuole vederlo, segnalato: buttarlo gli toglierebbe
    // un'informazione, lasciarlo com'è gli farebbe accettare per buono qualcosa
    // di incerto.
    const riclassificati = riclassificaDubbi([
      intervento({ confidenza: SOGLIA_DUBBIO - 0.1 }),
      intervento({ confidenza: 0.99 }),
    ]);
    expect(riclassificati[0]!.categoria).toBe("dubbio-da-verificare");
    expect(riclassificati[1]!.categoria).toBe("refuso");
  });

  it("i dubbi restano dubbi anche con confidenza alta", () => {
    const riclassificati = riclassificaDubbi([
      intervento({ categoria: "dubbio-da-verificare", confidenza: 0.99 }),
    ]);
    expect(riclassificati[0]!.categoria).toBe("dubbio-da-verificare");
  });

  it("i dubbi sono ammessi a ogni livello", () => {
    for (const livello of LIVELLI) {
      expect(CATEGORIE_AMMESSE[livello], livello).toContain("dubbio-da-verificare");
    }
  });
});
