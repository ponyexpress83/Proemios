import { describe, it, expect } from "vitest";
import {
  accordoPerCategoria,
  accordoPerFascia,
  CAMPIONE_MINIMO,
  fascia,
  raccomandazione,
  type DecisionePresa,
} from "@/lib/produzione/calibrazione";
import { SOGLIA_DUBBIO } from "@/lib/ai/livelli";

function decisioni(
  n: number,
  stato: string,
  categoria = "refuso",
  confidenza = 0.95,
): DecisionePresa[] {
  return Array.from({ length: n }, () => ({ categoria, confidenza, stato }));
}

describe("modificato non è rifiutato", () => {
  it("distingue il successo parziale dall'errore pieno", () => {
    // «Hai visto il problema ma l'hai risolto male» vale molto più di «non hai
    // visto niente»: confonderli sottostima il modello in modo grossolano.
    const [a] = accordoPerCategoria([
      ...decisioni(50, "accepted"),
      ...decisioni(30, "modified"),
      ...decisioni(20, "rejected"),
    ]);

    expect(a!.accordoPieno).toBeCloseTo(0.5);
    expect(a!.accordoSulPunto).toBeCloseTo(0.8);
  });

  it("non conta ciò che nessuno ha ancora deciso", () => {
    const [a] = accordoPerCategoria([...decisioni(10, "accepted"), ...decisioni(90, "pending")]);
    expect(a!.proposti).toBe(10);
  });

  it("su nessuna decisione non produce una categoria fantasma", () => {
    expect(accordoPerCategoria(decisioni(5, "pending"))).toEqual([]);
    expect(accordoPerCategoria([])).toEqual([]);
  });
});

describe("aggregazione per categoria", () => {
  it("tiene le categorie separate", () => {
    const righe = [...decisioni(80, "accepted", "refuso"), ...decisioni(20, "rejected", "stile")];
    const per = accordoPerCategoria(righe);
    expect(per.map((a) => a.categoria)).toEqual(["refuso", "stile"]);
    expect(per[0]!.accordoPieno).toBe(1);
    expect(per[1]!.accordoPieno).toBe(0);
  });

  it("mette in cima ciò su cui c'è più materiale", () => {
    // Una categoria con tre voci non dice niente: metterla in cima
    // inviterebbe a decidere su un campione vuoto.
    const per = accordoPerCategoria([
      ...decisioni(3, "accepted", "stile"),
      ...decisioni(200, "accepted", "refuso"),
    ]);
    expect(per[0]!.categoria).toBe("refuso");
  });
});

describe("fasce di confidenza", () => {
  it("il confine basso è quello del motore", () => {
    // Misurare con un confine diverso da quello che governa il comportamento
    // renderebbe i numeri incomparabili con ciò che succede davvero.
    expect(fascia(SOGLIA_DUBBIO)).toBe("media");
    expect(fascia(SOGLIA_DUBBIO - 0.01)).toBe("bassa");
  });

  it("classifica alta, media e bassa", () => {
    expect(fascia(0.99)).toBe("alta");
    expect(fascia(0.8)).toBe("media");
    expect(fascia(0.3)).toBe("bassa");
  });

  it("aggrega per fascia e salta quelle vuote", () => {
    const per = accordoPerFascia([
      ...decisioni(10, "accepted", "refuso", 0.99),
      ...decisioni(10, "rejected", "refuso", 0.5),
    ]);
    expect(per.map((a) => a.fascia)).toEqual(["alta", "bassa"]);
  });
});

describe("raccomandazione", () => {
  it("con poche decisioni dichiara il campione insufficiente", () => {
    // Difesa contro la tentazione di allentare dopo dieci casi andati bene.
    const a = accordoPerCategoria(decisioni(10, "accepted"))[0]!;
    const r = raccomandazione(a);
    expect(r.azione).toBe("campione-insufficiente");
    if (r.azione === "campione-insufficiente") {
      expect(r.mancanti).toBe(CAMPIONE_MINIMO - 10);
    }
  });

  it("propone di allentare solo con accordo pieno altissimo su un campione ampio", () => {
    const a = accordoPerCategoria(decisioni(200, "accepted"))[0]!;
    expect(raccomandazione(a).azione).toBe("puoi-allentare");
  });

  it("non propone di allentare se il modello viene spesso corretto", () => {
    // Accordo sul punto altissimo, accordo pieno mediocre: il modello trova i
    // problemi ma li risolve a modo suo. Non è un candidato all'automatismo.
    const a = accordoPerCategoria([
      ...decisioni(50, "accepted"),
      ...decisioni(150, "modified"),
    ])[0]!;
    expect(a.accordoSulPunto).toBe(1);
    expect(raccomandazione(a).azione).toBe("continua-a-controllare");
  });

  it("segnala quando il modello sbaglia bersaglio troppo spesso", () => {
    const a = accordoPerCategoria([
      ...decisioni(150, "accepted"),
      ...decisioni(50, "rejected"),
    ])[0]!;
    const r = raccomandazione(a);
    expect(r.azione).toBe("continua-a-controllare");
    if (r.azione === "continua-a-controllare") {
      expect(r.motivo).toMatch(/respinte/);
    }
  });

  it("la soglia è alta di proposito", () => {
    // Il 95% di accordo pieno significa un errore ogni venti: su un
    // manoscritto sono decine di correzioni sbagliate consegnate.
    const a = accordoPerCategoria([
      ...decisioni(190, "accepted"),
      ...decisioni(10, "rejected"),
    ])[0]!;
    expect(a.accordoPieno).toBe(0.95);
    expect(raccomandazione(a).azione).toBe("continua-a-controllare");
  });
});
