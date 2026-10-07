import { describe, it, expect } from "vitest";
import {
  ACCONTO_PUNTI_BASE,
  applicaPuntiBase,
  conIva,
  ordineSaldato,
  pianoPagamenti,
  residuoDaIncassare,
} from "@/lib/commercio/piano";
import { DEPOSIT_RATE } from "@/config/pricing";

describe("acconto", () => {
  it("usa il tasso del listino, non un valore proprio", () => {
    // Il 40% è una decisione commerciale già presa: se cambia, cambia lì.
    expect(ACCONTO_PUNTI_BASE).toBe(Math.round(DEPOSIT_RATE * 10_000));
    expect(DEPOSIT_RATE).toBe(0.4);
  });

  it("calcola l'acconto sul totale", () => {
    const rate = pianoPagamenti({ totaleCent: 250_000, modalita: "acconto_saldo" });
    expect(rate[0]).toMatchObject({ tipo: "acconto", importoCent: 100_000 });
    expect(rate[1]).toMatchObject({ tipo: "saldo", importoCent: 150_000 });
  });
});

describe("gli importi quadrano sempre", () => {
  it("acconto e saldo sommano al totale su qualunque importo", () => {
    // Le percentuali arrotondate non tornano da sole: è il caso in cui un
    // errore da un centesimo arriva in fattura.
    for (let totale = 1; totale <= 20_000; totale += 7) {
      const rate = pianoPagamenti({ totaleCent: totale, modalita: "acconto_saldo" });
      const somma = rate.reduce((t, r) => t + r.importoCent, 0);
      expect(somma).toBe(totale);
      expect(rate.every((r) => r.importoCent >= 0)).toBe(true);
    }
  });

  it("le rate a milestone sommano al totale", () => {
    const tappe = [
      { id: "m1", nome: "Prima stesura", puntiBase: 3_333 },
      { id: "m2", nome: "Revisione", puntiBase: 3_333 },
      { id: "m3", nome: "Consegna", puntiBase: 3_334 },
    ];
    for (let totale = 100; totale <= 500_000; totale += 977) {
      const rate = pianoPagamenti({ totaleCent: totale, modalita: "milestone", milestone: tappe });
      expect(rate.reduce((t, r) => t + r.importoCent, 0)).toBe(totale);
    }
  });

  it("mette la differenza di arrotondamento sull'ultima rata", () => {
    // 40% di 3333 fa 1333,2 → 1333. Il saldo dev'essere 2000, non 1999,8.
    const rate = pianoPagamenti({ totaleCent: 3_333, modalita: "acconto_saldo" });
    expect(rate[0]!.importoCent).toBe(1_333);
    expect(rate[1]!.importoCent).toBe(2_000);
  });
});

describe("modalità", () => {
  it("il pagamento unico è una rata sola", () => {
    const rate = pianoPagamenti({ totaleCent: 49_900, modalita: "unica" });
    expect(rate).toHaveLength(1);
    expect(rate[0]).toMatchObject({ tipo: "saldo", importoCent: 49_900 });
  });

  it("un acconto a zero non produce una rata vuota", () => {
    const rate = pianoPagamenti({
      totaleCent: 50_000,
      modalita: "acconto_saldo",
      accontoPuntiBase: 0,
    });
    expect(rate).toHaveLength(1);
    expect(rate[0]!.importoCent).toBe(50_000);
  });

  it("un acconto al 100% non lascia un saldo da zero", () => {
    const rate = pianoPagamenti({
      totaleCent: 50_000,
      modalita: "acconto_saldo",
      accontoPuntiBase: 10_000,
    });
    expect(rate.reduce((t, r) => t + r.importoCent, 0)).toBe(50_000);
    expect(rate.find((r) => r.tipo === "saldo")?.importoCent).toBe(0);
  });

  it("un piano a milestone comincia comunque con l'acconto", () => {
    const rate = pianoPagamenti({
      totaleCent: 100_000,
      modalita: "milestone",
      milestone: [
        { id: "m1", nome: "Metà", puntiBase: 5_000 },
        { id: "m2", nome: "Consegna", puntiBase: 5_000 },
      ],
    });
    expect(rate[0]!.tipo).toBe("acconto");
    expect(rate[0]!.importoCent).toBe(40_000);
    expect(rate[1]).toMatchObject({ importoCent: 30_000, riferimentoMilestone: "m1" });
    expect(rate[2]).toMatchObject({ importoCent: 30_000, riferimentoMilestone: "m2" });
  });
});

describe("piani che non stanno in piedi", () => {
  it("rifiuta un piano personalizzato che non quadra", () => {
    // Non si aggiusta da solo: un piano che non torna è un errore di chi lo ha
    // scritto, e va corretto prima di arrivare al cliente.
    expect(() =>
      pianoPagamenti({
        totaleCent: 100_000,
        modalita: "personalizzato",
        rate: [
          { importoCent: 40_000, descrizione: "Prima" },
          { importoCent: 50_000, descrizione: "Seconda" },
        ],
      }),
    ).toThrow(/non quadra/);
  });

  it("accetta un piano personalizzato che quadra", () => {
    const rate = pianoPagamenti({
      totaleCent: 100_000,
      modalita: "personalizzato",
      rate: [
        { importoCent: 30_000, descrizione: "Alla firma" },
        { importoCent: 30_000, descrizione: "A metà" },
        { importoCent: 40_000, descrizione: "Alla consegna" },
      ],
    });
    expect(rate).toHaveLength(3);
    expect(rate.every((r) => r.tipo === "personalizzato")).toBe(true);
  });

  it("rifiuta milestone che non coprono il cento per cento", () => {
    expect(() =>
      pianoPagamenti({
        totaleCent: 100_000,
        modalita: "milestone",
        milestone: [{ id: "m1", nome: "Unica", puntiBase: 9_000 }],
      }),
    ).toThrow(/10000/);
  });

  it("rifiuta importi non interi e totali non positivi", () => {
    expect(() => pianoPagamenti({ totaleCent: 100.5, modalita: "unica" })).toThrow();
    expect(() => pianoPagamenti({ totaleCent: 0, modalita: "unica" })).toThrow();
    expect(() => applicaPuntiBase(10.5, 4_000)).toThrow(/centesimi interi/);
  });

  it("rifiuta un acconto fuori scala", () => {
    expect(() =>
      pianoPagamenti({ totaleCent: 100, modalita: "acconto_saldo", accontoPuntiBase: 12_000 }),
    ).toThrow();
  });
});

describe("IVA", () => {
  it("scorpora al ventidue per cento", () => {
    expect(conIva(100_000)).toEqual({
      imponibileCent: 100_000,
      ivaCent: 22_000,
      totaleCent: 122_000,
    });
  });
});

describe("residuo e saldo", () => {
  const totale = 100_000;

  it("conta solo i pagamenti riusciti", () => {
    expect(
      residuoDaIncassare(totale, [
        { stato: "pagato", importoCent: 40_000 },
        { stato: "in_attesa", importoCent: 60_000 },
        { stato: "fallito", importoCent: 60_000 },
      ]),
    ).toBe(60_000);
  });

  it("un rimborso riapre il dovuto", () => {
    // Un rimborso non è un pagamento con il segno meno da aggiungere: è un
    // incasso che non c'è più.
    expect(
      residuoDaIncassare(totale, [
        { stato: "pagato", importoCent: 100_000, importoRimborsatoCent: 30_000 },
      ]),
    ).toBe(30_000);
  });

  it("non produce un residuo negativo se si è incassato più del dovuto", () => {
    expect(residuoDaIncassare(totale, [{ stato: "pagato", importoCent: 150_000 }])).toBe(0);
  });

  it("riconosce un ordine saldato", () => {
    expect(ordineSaldato(totale, [{ stato: "pagato", importoCent: 100_000 }])).toBe(true);
    expect(ordineSaldato(totale, [{ stato: "pagato", importoCent: 99_999 }])).toBe(false);
  });
});
