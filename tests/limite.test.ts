import { describe, it, expect } from "vitest";
import { chiaveLimite, origineRichiesta, REGOLE, valuta } from "@/lib/sicurezza/limite";

const REGOLA = { massimo: 3, finestraSecondi: 60 };

describe("finestra fissa", () => {
  it("ammette fino al massimo e poi rifiuta", () => {
    const t0 = 1_000_000;
    let stato = null as ReturnType<typeof valuta>["stato"] | null;

    for (let i = 1; i <= 3; i += 1) {
      const esito = valuta(stato, REGOLA, t0 + i * 100);
      expect(esito.ammessa, `richiesta ${i}`).toBe(true);
      expect(esito.restanti).toBe(3 - i);
      stato = esito.stato;
    }

    const quarta = valuta(stato, REGOLA, t0 + 400);
    expect(quarta.ammessa).toBe(false);
    expect(quarta.restanti).toBe(0);
    expect(quarta.attendiSecondi).toBeGreaterThan(0);
  });

  it("riapre la finestra quando è scaduta", () => {
    const t0 = 0;
    let stato = valuta(null, REGOLA, t0).stato;
    stato = valuta(stato, REGOLA, t0 + 1).stato;
    stato = valuta(stato, REGOLA, t0 + 2).stato;
    expect(valuta(stato, REGOLA, t0 + 3).ammessa).toBe(false);

    // Al secondo esatto in cui la finestra si chiude, si riapre.
    const dopo = valuta(stato, REGOLA, t0 + 60_000);
    expect(dopo.ammessa).toBe(true);
    expect(dopo.stato.conteggio).toBe(1);
  });

  it("chi insiste non si allunga la punizione", () => {
    // Il conteggio non cresce oltre il massimo: altrimenti bastava martellare
    // per non poter più entrare, e il numero in database diventava illeggibile.
    const t0 = 0;
    let stato = valuta(null, REGOLA, t0).stato;
    stato = valuta(stato, REGOLA, t0).stato;
    stato = valuta(stato, REGOLA, t0).stato;

    const primo = valuta(stato, REGOLA, t0 + 1_000);
    const secondo = valuta(primo.stato, REGOLA, t0 + 2_000);
    expect(primo.stato.conteggio).toBe(3);
    expect(secondo.stato.conteggio).toBe(3);
    // E l'attesa si accorcia col passare del tempo, invece di ricominciare.
    expect(secondo.attendiSecondi).toBeLessThanOrEqual(primo.attendiSecondi);
  });

  it("dice quanti secondi aspettare, non solo che è troppo presto", () => {
    const t0 = 0;
    let stato = valuta(null, REGOLA, t0).stato;
    stato = valuta(stato, REGOLA, t0).stato;
    stato = valuta(stato, REGOLA, t0).stato;
    const rifiutata = valuta(stato, REGOLA, t0 + 30_000);
    expect(rifiutata.attendiSecondi).toBe(30);
  });
});

describe("regole", () => {
  it("l'analisi del manoscritto è la più stretta: costa davvero", () => {
    expect(REGOLE.analisi!.massimo).toBeLessThanOrEqual(REGOLE.contatto!.massimo);
    expect(REGOLE.analisi!.finestraSecondi).toBeGreaterThanOrEqual(3600);
  });

  it("ogni regola ha numeri sensati", () => {
    for (const [nome, r] of Object.entries(REGOLE)) {
      expect(r.massimo, nome).toBeGreaterThan(0);
      expect(r.finestraSecondi, nome).toBeGreaterThan(0);
    }
  });
});

describe("origine della richiesta", () => {
  it("dietro un proxy prende il primo indirizzo, non l'ultimo", () => {
    // Prendere l'ultimo permetterebbe di aggirare il limite mandando
    // un'intestazione costruita a mano.
    const h = new Headers({ "x-forwarded-for": "203.0.113.1, 70.41.3.18, 150.172.238.178" });
    expect(origineRichiesta(h)).toBe("203.0.113.1");
  });

  it("ripiega su x-real-ip e poi su un valore noto", () => {
    expect(origineRichiesta(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(origineRichiesta(new Headers())).toBe("sconosciuto");
  });
});

describe("chiave di conteggio", () => {
  it("non contiene l'indirizzo in chiaro", async () => {
    // Un elenco di IP in chiaro è un dato personale che non serve conservare:
    // per contare basta sapere che due richieste vengono dalla stessa parte.
    const chiave = await chiaveLimite("contatto", "203.0.113.1");
    expect(chiave).not.toContain("203.0.113.1");
    expect(chiave.startsWith("contatto:")).toBe(true);
  });

  it("è stabile per la stessa origine e diversa per origini diverse", async () => {
    const a = await chiaveLimite("contatto", "203.0.113.1");
    const b = await chiaveLimite("contatto", "203.0.113.1");
    const c = await chiaveLimite("contatto", "203.0.113.2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("separa gli endpoint: il limite di uno non consuma quello di un altro", async () => {
    const contatto = await chiaveLimite("contatto", "203.0.113.1");
    const analisi = await chiaveLimite("analisi", "203.0.113.1");
    expect(contatto).not.toBe(analisi);
  });
});
