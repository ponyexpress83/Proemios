import { describe, it, expect } from "vitest";
import { isolaJson, parseReport, AiError, reportAiSchema } from "@/lib/ai";
import { costBandForAnalysis } from "@/lib/pricing";
import { calcolaMetriche, gulpease } from "@/lib/metrics";

/** Report valido minimo, riusato dai casi. */
const reportValido = {
  sintesi:
    "Un romanzo di formazione ambientato in provincia, scritto con voce sicura ma ancora da sfoltire.",
  ritmo: {
    giudizio: "Procede bene nei dialoghi, rallenta nelle descrizioni.",
    periodareLungo: true,
  },
  ripetizioni: ["«in realtà» ricorre 14 volte", "«sospirò» come verbo di dialogo"],
  cliche: ["«un brivido lungo la schiena»"],
  coerenza: {
    tempiVerbali: "Passato remoto costante, con qualche scivolata al presente nei capitoli 4 e 7.",
    puntoDiVista: "Terza persona limitata, coerente.",
  },
  genere: "Narrativa di formazione",
  lettoreTipo: "Lettori adulti di narrativa italiana contemporanea.",
  puntiForza: ["Dialoghi credibili", "Ambientazione concreta", "Incipit efficace"],
  areeIntervento: [
    "Sfoltire le descrizioni",
    "Uniformare i tempi verbali",
    "Tagliare il capitolo 9",
  ],
  livelloIntervento: "editing-leggero",
};

describe("isolaJson", () => {
  it("estrae il JSON da un blocco con fence markdown", () => {
    const grezzo = '```json\n{"a":1}\n```';
    expect(isolaJson(grezzo)).toBe('{"a":1}');
  });

  it("estrae il JSON da una fence senza linguaggio", () => {
    expect(isolaJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("isola l'oggetto quando il modello aggiunge testo attorno", () => {
    const grezzo = 'Ecco il report richiesto:\n{"a":1}\nSpero sia utile.';
    expect(isolaJson(grezzo)).toBe('{"a":1}');
  });

  it("restituisce il testo ripulito se non trova un oggetto", () => {
    expect(isolaJson("  nessun json qui  ")).toBe("nessun json qui");
  });
});

describe("parseReport", () => {
  it("valida un report ben formato", () => {
    const r = parseReport(JSON.stringify(reportValido));
    expect(r.livelloIntervento).toBe("editing-leggero");
    expect(r.puntiForza).toHaveLength(3);
  });

  it("accetta il report anche dentro una fence markdown", () => {
    const r = parseReport("```json\n" + JSON.stringify(reportValido) + "\n```");
    expect(r.genere).toBe("Narrativa di formazione");
  });

  it("segnala JSON non valido con codice dedicato", () => {
    try {
      parseReport("{non è json}");
      expect.unreachable("doveva lanciare");
    } catch (e) {
      expect(e).toBeInstanceOf(AiError);
      expect((e as AiError).codice).toBe("risposta-non-json");
    }
  });

  it("rifiuta un report che non rispetta lo schema", () => {
    const rotto = { ...reportValido, livelloIntervento: "editing-medio" };
    try {
      parseReport(JSON.stringify(rotto));
      expect.unreachable("doveva lanciare");
    } catch (e) {
      expect((e as AiError).codice).toBe("schema-non-conforme");
    }
  });

  it("rifiuta un report con più di tre punti di forza", () => {
    const rotto = { ...reportValido, puntiForza: ["a lungo", "b lungo", "c lungo", "d lungo"] };
    expect(reportAiSchema.safeParse(rotto).success).toBe(false);
  });

  it("rifiuta un report a cui manca un campo", () => {
    const { genere: _genere, ...senzaGenere } = reportValido;
    expect(reportAiSchema.safeParse(senzaGenere).success).toBe(false);
  });
});

describe("costBandForAnalysis", () => {
  it("restituisce un intervallo coerente per ogni livello", () => {
    for (const livello of ["correzione-bozze", "editing-leggero", "editing-profondo"] as const) {
      const b = costBandForAnalysis(50_000, livello);
      expect(b.min).toBeLessThanOrEqual(b.max);
      expect(b.min).toBeGreaterThan(0);
    }
  });

  it("l'editing profondo costa più della sola correzione", () => {
    const correzione = costBandForAnalysis(50_000, "correzione-bozze");
    const profondo = costBandForAnalysis(50_000, "editing-profondo");
    expect(profondo.min).toBeGreaterThan(correzione.min);
  });

  it("non scende mai sotto il minimo di progetto", () => {
    const b = costBandForAnalysis(200, "correzione-bozze");
    expect(b.min).toBeGreaterThanOrEqual(149);
  });
});

describe("metriche locali", () => {
  it("conta parole e frasi", () => {
    const m = calcolaMetriche("Questa è una frase. E questa è la seconda frase.");
    expect(m.parole).toBe(10);
    expect(m.frasi).toBe(2);
  });

  it("Gulpease resta nell'intervallo 0-100", () => {
    expect(gulpease(1000, 50, 5000)).toBeGreaterThanOrEqual(0);
    expect(gulpease(1000, 50, 5000)).toBeLessThanOrEqual(100);
    expect(gulpease(10, 1, 900)).toBe(0);
  });

  it("un testo con frasi brevi è più leggibile di uno con frasi lunghe", () => {
    const breve = calcolaMetriche(
      "Il cane corre. Il gatto dorme. La casa è bella. Il sole splende.",
    );
    const lungo = calcolaMetriche(
      "Il cane che correva lungo il viale alberato incontrò per caso il gatto che dormiva placidamente sul davanzale della casa che apparteneva alla famiglia che abitava in fondo alla strada principale del paese.",
    );
    expect(breve.gulpease).toBeGreaterThan(lungo.gulpease);
  });

  it("stima le pagine sul conteggio parole", () => {
    expect(calcolaMetriche(Array(600).fill("parola").join(" ")).pagineStimate).toBe(2);
  });

  it("gestisce il testo vuoto senza esplodere", () => {
    const m = calcolaMetriche("");
    expect(m.parole).toBe(0);
    expect(m.gulpease).toBe(0);
  });
});
