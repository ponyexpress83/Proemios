import { describe, it, expect } from "vitest";
import {
  raggruppa,
  regolaRiconosciuta,
  risparmio,
  SOGLIA_ATTENZIONE,
  type InterventoDaRaggruppare,
} from "@/lib/produzione/triage";
import { SOGLIA_DUBBIO } from "@/lib/ai/livelli";

let contatore = 0;
function intervento(parziale: Partial<InterventoDaRaggruppare> = {}): InterventoDaRaggruppare {
  contatore += 1;
  return {
    id: `i-${contatore}`,
    categoria: "refuso",
    prima: "acuqa",
    dopo: "acqua",
    confidenza: 0.95,
    stato: "pending",
    ...parziale,
  };
}

describe("riconoscimento della regola", () => {
  it("riconosce la spaziatura", () => {
    expect(regolaRiconosciuta("tornato , ma", "tornato, ma")).toBe("spaziatura");
    expect(regolaRiconosciuta("due  spazi", "due spazi")).toBe("spaziatura");
  });

  it("riconosce apostrofi e virgolette", () => {
    expect(regolaRiconosciuta("l'acqua", "l’acqua")).toBe("apostrofi e virgolette");
    expect(regolaRiconosciuta('"detto"', "«detto»")).toBe("apostrofi e virgolette");
  });

  it("riconosce accenti e maiuscole", () => {
    expect(regolaRiconosciuta("perche", "perché")).toBe("accenti e maiuscole");
    expect(regolaRiconosciuta("ne pane", "né pane")).toBe("accenti e maiuscole");
    expect(regolaRiconosciuta("roma", "Roma")).toBe("accenti e maiuscole");
  });

  it("riconosce la punteggiatura", () => {
    expect(regolaRiconosciuta("Qual'è", "Qual è")).toBe("spaziatura e punteggiatura");
    expect(regolaRiconosciuta("finito.", "finito!")).toBe("punteggiatura");
  });

  it("non inventa una regola dove non c'è", () => {
    // Inventare una somiglianza è peggio che non trovarla: quell'intervento
    // deve restare singolo e finire sotto gli occhi di una persona.
    expect(regolaRiconosciuta("acuqa", "acqua")).toBeNull();
    expect(regolaRiconosciuta("il cane corre", "il gatto dorme")).toBeNull();
    expect(regolaRiconosciuta("uguale", "uguale")).toBeNull();
  });
});

describe("raggruppamento", () => {
  it("quarantasette occorrenze identiche diventano una decisione", () => {
    const interventi = Array.from({ length: 47 }, () => intervento());
    const gruppi = raggruppa(interventi);

    expect(gruppi).toHaveLength(1);
    expect(gruppi[0]).toMatchObject({ tipo: "identico", occorrenze: 47 });
    expect(gruppi[0]!.interventiIds).toHaveLength(47);
  });

  it("un'occorrenza sola non è un gruppo identico", () => {
    const gruppi = raggruppa([intervento({ prima: "acuqa", dopo: "acqua" })]);
    expect(gruppi[0]!.tipo).toBe("singolo");
  });

  it("raggruppa per regola parole diverse che applicano la stessa correzione", () => {
    const gruppi = raggruppa([
      intervento({ categoria: "punteggiatura", prima: "tornato , ma", dopo: "tornato, ma" }),
      intervento({ categoria: "punteggiatura", prima: "detto , poi", dopo: "detto, poi" }),
      intervento({ categoria: "punteggiatura", prima: "visto , quindi", dopo: "visto, quindi" }),
    ]);

    expect(gruppi).toHaveLength(1);
    expect(gruppi[0]).toMatchObject({ tipo: "ricorrente", occorrenze: 3 });
    expect(gruppi[0]!.etichetta).toContain("spaziatura");
  });

  it("sotto il minimo, una regola non diventa un gruppo", () => {
    // Due voci dietro una decisione non fanno risparmiare nulla e nascondono
    // due scelte dietro un clic.
    const gruppi = raggruppa([
      intervento({ categoria: "punteggiatura", prima: "a , b", dopo: "a, b" }),
      intervento({ categoria: "punteggiatura", prima: "c , d", dopo: "c, d" }),
    ]);
    expect(gruppi.every((g) => g.tipo === "singolo")).toBe(true);
    expect(gruppi).toHaveLength(2);
  });

  it("non mescola categorie diverse nello stesso gruppo", () => {
    const gruppi = raggruppa([
      intervento({ categoria: "refuso", prima: "x", dopo: "y" }),
      intervento({ categoria: "stile", prima: "x", dopo: "y" }),
    ]);
    expect(gruppi).toHaveLength(2);
  });

  it("ignora ciò che è già stato deciso", () => {
    const gruppi = raggruppa([
      intervento({ stato: "accepted" }),
      intervento({ stato: "rejected" }),
      intervento({ stato: "pending" }),
    ]);
    // Restano solo le voci da decidere: una, quindi singola.
    expect(risparmio(gruppi).interventi).toBe(1);
  });

  it("non perde nessun intervento da decidere", () => {
    const interventi = [
      ...Array.from({ length: 5 }, () => intervento()),
      ...Array.from({ length: 4 }, (_, n) =>
        intervento({ categoria: "punteggiatura", prima: `p${n} , q`, dopo: `p${n}, q` }),
      ),
      intervento({ categoria: "stile", prima: "un periodo lungo", dopo: "un periodo breve" }),
    ];
    const gruppi = raggruppa(interventi);

    const raccolti = gruppi.flatMap((g) => g.interventiIds).sort();
    expect(raccolti).toEqual(interventi.map((i) => i.id).sort());
    // E nessun intervento compare in due gruppi.
    expect(new Set(raccolti).size).toBe(raccolti.length);
  });
});

describe("ordine di lavorazione", () => {
  it("mette le meccaniche prima delle editoriali", () => {
    // Si smaltiscono in blocco e liberano attenzione per ciò che la richiede.
    const gruppi = raggruppa([
      intervento({ categoria: "stile", prima: "a", dopo: "b" }),
      intervento({ categoria: "refuso", prima: "c", dopo: "d" }),
      intervento({ categoria: "grammatica", prima: "e", dopo: "f" }),
    ]);
    expect(gruppi.map((g) => g.categoria)).toEqual(["refuso", "grammatica", "stile"]);
  });

  it("a parità di rango, prima ciò che fa risparmiare di più", () => {
    const gruppi = raggruppa([
      intervento({ categoria: "refuso", prima: "raro", dopo: "raro!" }),
      ...Array.from({ length: 10 }, () =>
        intervento({ categoria: "refuso", prima: "frequente", dopo: "frequente!" }),
      ),
    ]);
    expect(gruppi[0]!.occorrenze).toBe(10);
  });
});

describe("attenzione", () => {
  it("è allineata alla soglia del motore", () => {
    // Il triage non deve essere più permissivo di chi ha prodotto gli
    // interventi: sotto quella soglia il motore li ha già chiamati dubbi.
    expect(SOGLIA_ATTENZIONE).toBe(SOGLIA_DUBBIO);
  });

  it("basta una voce sotto soglia perché il gruppo vada guardato", () => {
    // Una media che nasconde un dubbio è peggio di nessuna media.
    const gruppi = raggruppa([
      intervento({ confidenza: 0.99 }),
      intervento({ confidenza: 0.99 }),
      intervento({ confidenza: 0.4 }),
    ]);
    expect(gruppi[0]!.richiedeAttenzione).toBe(true);
    expect(gruppi[0]!.confidenzaMinima).toBe(0.4);
  });

  it("le categorie editoriali richiedono attenzione anche ad alta confidenza", () => {
    const gruppi = raggruppa([
      intervento({ categoria: "stile", prima: "a", dopo: "b", confidenza: 1 }),
      intervento({ categoria: "stile", prima: "a", dopo: "b", confidenza: 1 }),
    ]);
    expect(gruppi[0]!.richiedeAttenzione).toBe(true);
  });

  it("un gruppo meccanico ad alta confidenza non richiede attenzione", () => {
    const gruppi = raggruppa([intervento({ confidenza: 0.98 }), intervento({ confidenza: 0.97 })]);
    expect(gruppi[0]!.richiedeAttenzione).toBe(false);
  });
});

describe("risparmio", () => {
  it("misura quante decisioni restano", () => {
    const interventi = [
      ...Array.from({ length: 40 }, () => intervento()),
      ...Array.from({ length: 10 }, () =>
        intervento({ prima: "tornato , ma", dopo: "tornato, ma", categoria: "punteggiatura" }),
      ),
    ];
    const esito = risparmio(raggruppa(interventi));

    expect(esito.interventi).toBe(50);
    expect(esito.decisioni).toBe(2);
    expect(esito.fattore).toBe(25);
  });

  it("su un insieme senza ripetizioni non promette un risparmio che non c'è", () => {
    const interventi = Array.from({ length: 5 }, (_, n) =>
      intervento({ categoria: "stile", prima: `frase ${n}`, dopo: `frase ${n} rivista` }),
    );
    const esito = risparmio(raggruppa(interventi));
    expect(esito.decisioni).toBe(5);
    expect(esito.fattore).toBe(1);
  });

  it("su un insieme vuoto non divide per zero", () => {
    expect(risparmio([])).toMatchObject({ decisioni: 0, interventi: 0, fattore: 1 });
  });
});
