import { describe, it, expect } from "vitest";
import { ancora, applicaAlParagrafo, trovaSovrapposizioni, type Ancora } from "@/lib/produzione/ancoraggio";
import {
  contaParole,
  componiTesto,
  paragrafiDaTesto,
  segmenta,
  stimaToken,
  type Paragrafo,
} from "@/lib/produzione/segmentazione";

const PARAGRAFI: Paragrafo[] = [
  { indice: 0, testo: "Nel mezzo del cammin di nostra vita." },
  { indice: 1, testo: "La casa era la casa di sempre, con l'acuqa nel pozzo." },
  { indice: 2, testo: "Poi venne l'inverno." },
];

describe("ancoraggio degli interventi", () => {
  it("trova un frammento nel paragrafo indicato", () => {
    const esito = ancora(PARAGRAFI, { paragrafo: 1, prima: "acuqa" });
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.ancora.indiceParagrafo).toBe(1);
      expect(PARAGRAFI[1]!.testo.slice(esito.ancora.inizio, esito.ancora.fine)).toBe("acuqa");
    }
  });

  it("rifiuta un frammento che il modello si è inventato", () => {
    // È la difesa contro l'allucinazione: un frammento che non esiste non
    // viene applicato altrove, viene scartato.
    const esito = ancora(PARAGRAFI, { paragrafo: 1, prima: "un testo mai scritto" });
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/non presente/);
  });

  it("rifiuta un paragrafo inesistente", () => {
    const esito = ancora(PARAGRAFI, { paragrafo: 99, prima: "acuqa" });
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/inesistente/);
  });

  it("distingue le occorrenze ripetute", () => {
    const prima = ancora(PARAGRAFI, { paragrafo: 1, prima: "casa", occorrenza: 0 });
    const seconda = ancora(PARAGRAFI, { paragrafo: 1, prima: "casa", occorrenza: 1 });
    expect(prima.ok && seconda.ok).toBe(true);
    if (prima.ok && seconda.ok) {
      expect(seconda.ancora.inizio).toBeGreaterThan(prima.ancora.inizio);
    }
  });

  it("rifiuta un'occorrenza che non esiste invece di ripiegare sulla prima", () => {
    // Applicare l'intervento a un'altra occorrenza è peggio che non applicarlo.
    const esito = ancora(PARAGRAFI, { paragrafo: 1, prima: "casa", occorrenza: 5 });
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/occorrenza/);
  });

  it("cerca in tutto il testo se il paragrafo non è indicato", () => {
    const esito = ancora(PARAGRAFI, { prima: "inverno" });
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.ancora.indiceParagrafo).toBe(2);
  });
});

describe("sovrapposizioni", () => {
  function conAncora(indiceParagrafo: number, inizio: number, fine: number) {
    return { ancora: { indiceParagrafo, inizio, fine } as Ancora, dopo: "x" };
  }

  it("rileva due interventi che insistono sugli stessi caratteri", () => {
    const esito = trovaSovrapposizioni([conAncora(0, 5, 15), conAncora(0, 10, 20)]);
    expect(esito.conflitti).toHaveLength(1);
    expect(esito.indipendenti).toHaveLength(0);
  });

  it("non segnala interventi adiacenti ma distinti", () => {
    const esito = trovaSovrapposizioni([conAncora(0, 0, 10), conAncora(0, 10, 20)]);
    expect(esito.conflitti).toHaveLength(0);
    expect(esito.indipendenti).toHaveLength(2);
  });

  it("non confonde paragrafi diversi", () => {
    const esito = trovaSovrapposizioni([conAncora(0, 5, 15), conAncora(1, 5, 15)]);
    expect(esito.conflitti).toHaveLength(0);
  });
});

describe("applicazione degli interventi", () => {
  it("applica dal fondo, così gli offset restano validi", () => {
    // Applicando dall'inizio, la prima sostituzione sposterebbe le posizioni
    // di tutte le successive.
    const testo = "aaa bbb ccc";
    const risultato = applicaAlParagrafo(testo, [
      { ancora: { indiceParagrafo: 0, inizio: 0, fine: 3 }, dopo: "PRIMO" },
      { ancora: { indiceParagrafo: 0, inizio: 8, fine: 11 }, dopo: "TERZO" },
    ]);
    expect(risultato).toBe("PRIMO bbb TERZO");
  });

  it("gestisce sostituzioni di lunghezza diversa", () => {
    const risultato = applicaAlParagrafo("l'acuqa del pozzo", [
      { ancora: { indiceParagrafo: 0, inizio: 2, fine: 7 }, dopo: "acqua" },
    ]);
    expect(risultato).toBe("l'acqua del pozzo");
  });

  it("una cancellazione è una sostituzione con stringa vuota", () => {
    const risultato = applicaAlParagrafo("però , disse", [
      { ancora: { indiceParagrafo: 0, inizio: 4, fine: 6 }, dopo: "," },
    ]);
    expect(risultato).toBe("però, disse");
  });
});

describe("segmentazione", () => {
  function paragrafiFinti(quanti: number, lunghezza = 500): Paragrafo[] {
    return Array.from({ length: quanti }, (_, i) => ({
      indice: i,
      testo: `Paragrafo ${i}. ${"x".repeat(lunghezza)}`,
    }));
  }

  it("non spezza mai un paragrafo", () => {
    const segmenti = segmenta(paragrafiFinti(50), { caratteriPerSegmento: 2_000 });
    const tutti = segmenti.flatMap((s) => s.paragrafi);
    expect(tutti).toHaveLength(50);
    // Ogni paragrafo compare una volta sola come testo da lavorare.
    expect(new Set(tutti.map((p) => p.indice)).size).toBe(50);
  });

  it("conserva gli indici originali, che sono le ancore", () => {
    const segmenti = segmenta(paragrafiFinti(20), { caratteriPerSegmento: 2_000 });
    const ultimo = segmenti.at(-1)!;
    // Gli indici non ripartono da zero a ogni blocco: se lo facessero, gli
    // interventi del secondo blocco finirebbero all'inizio del documento.
    expect(ultimo.paragrafi.at(-1)!.indice).toBe(19);
  });

  it("dà a ogni blocco il contesto immediato precedente", () => {
    const segmenti = segmenta(paragrafiFinti(20), {
      caratteriPerSegmento: 2_000,
      paragrafiDiContesto: 2,
    });
    expect(segmenti[0]!.contestoPrecedente).toHaveLength(0);
    expect(segmenti[1]!.contestoPrecedente).toHaveLength(2);
    // Il contesto è davvero ciò che precede.
    const primoDelSecondo = segmenti[1]!.paragrafi[0]!.indice;
    expect(segmenti[1]!.contestoPrecedente.at(-1)!.indice).toBe(primoDelSecondo - 1);
  });

  it("isola un paragrafo più lungo del limite invece di troncarlo", () => {
    const paragrafi: Paragrafo[] = [
      { indice: 0, testo: "corto" },
      { indice: 1, testo: "y".repeat(5_000) },
      { indice: 2, testo: "corto" },
    ];
    const segmenti = segmenta(paragrafi, { caratteriPerSegmento: 1_000 });
    const soloLungo = segmenti.find((s) => s.paragrafi.some((p) => p.indice === 1));
    expect(soloLungo!.paragrafi).toHaveLength(1);
    expect(soloLungo!.paragrafi[0]!.testo).toHaveLength(5_000);
  });

  it("ignora i paragrafi vuoti", () => {
    const segmenti = segmenta([
      { indice: 0, testo: "uno" },
      { indice: 1, testo: "   " },
      { indice: 2, testo: "due" },
    ]);
    expect(segmenti[0]!.paragrafi).toHaveLength(2);
  });

  it("su testo vuoto non produce blocchi", () => {
    expect(segmenta([])).toEqual([]);
    expect(segmenta([{ indice: 0, testo: "" }])).toEqual([]);
  });

  it("il testo composto numera i paragrafi con l'indice reale", () => {
    const segmenti = segmenta(paragrafiFinti(6, 100), { caratteriPerSegmento: 400 });
    const testo = componiTesto(segmenti[1]!);
    expect(testo).toContain("### Testo da lavorare");
    expect(testo).toMatch(/\[\d+\] Paragrafo/);
    expect(testo).toContain("### Contesto precedente (non correggere)");
  });
});

describe("conteggi", () => {
  it("conta le parole", () => {
    expect(contaParole(PARAGRAFI)).toBe(7 + 11 + 3);
  });

  it("stima i token con margine", () => {
    // Non deve essere esatta: deve non sottostimare.
    expect(stimaToken("x".repeat(300))).toBeGreaterThanOrEqual(100);
  });

  it("divide un testo semplice in paragrafi con indici consecutivi", () => {
    const p = paragrafiDaTesto("uno\n\ndue\n   \ntre");
    expect(p.map((x) => x.testo)).toEqual(["uno", "due", "tre"]);
    expect(p.map((x) => x.indice)).toEqual([0, 1, 2]);
  });
});
