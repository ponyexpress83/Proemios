import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { reportAiSchema } from "@/lib/ai";
import { calcolaMetriche } from "@/lib/metrics";
import {
  demoAttiva,
  reportDemo,
  livelloDaMetriche,
  registraPreventivo,
  segnaAccontoPagato,
  trovaPreventivo,
  datiAdminDemo,
} from "@/lib/demo";
import { computeQuote } from "@/lib/pricing";

/**
 * La demo è l'unica configurazione in cui il sito accetta dati senza avere
 * dove scriverli: conviene che le sue condizioni di attivazione e il report
 * che produce restino sotto test come il resto dei confini.
 */

const ambiente = { ...process.env };

beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.DEMO_MODE;
});

afterEach(() => {
  process.env = { ...ambiente };
});

describe("attivazione", () => {
  it("si accende da sola quando manca il database", () => {
    expect(demoAttiva()).toBe(true);
  });

  it("resta spenta quando il database è configurato", () => {
    process.env.DATABASE_URL = "postgresql://utente:segreto@host/db";
    expect(demoAttiva()).toBe(false);
  });

  it("DEMO_MODE=off vince sull'assenza di database", () => {
    process.env.DEMO_MODE = "off";
    expect(demoAttiva()).toBe(false);
  });

  it("DEMO_MODE=on vince sulla presenza del database", () => {
    process.env.DATABASE_URL = "postgresql://utente:segreto@host/db";
    process.env.DEMO_MODE = "on";
    expect(demoAttiva()).toBe(true);
  });
});

describe("report simulato", () => {
  const testoScorrevole = Array.from(
    { length: 40 },
    (_, i) => `La barca rientrò al molo numero ${i}. Il vento era caduto. Nessuno parlava.`,
  ).join(" ");

  const testoDenso = Array.from(
    { length: 20 },
    () =>
      "Nella prospettiva di una ricostruzione complessiva del fenomeno considerato, " +
      "l'analisi delle determinanti strutturali che ne hanno accompagnato l'evoluzione " +
      "nel corso dei decenni successivi impone una riconsiderazione critica degli " +
      "strumenti interpretativi finora adoperati dalla letteratura specialistica.",
  ).join(" ");

  it("produce un giudizio conforme allo schema del report vero", () => {
    const report = reportDemo(calcolaMetriche(testoScorrevole));
    const { metriche, fasciaCosto, generatoIl, ...giudizio } = report;
    expect(reportAiSchema.safeParse(giudizio).success).toBe(true);
    expect(metriche.parole).toBeGreaterThan(0);
    expect(fasciaCosto.max).toBeGreaterThanOrEqual(fasciaCosto.min);
    expect(Number.isNaN(Date.parse(generatoIl))).toBe(false);
  });

  it("riporta le metriche reali del testo, non valori fissi", () => {
    const metriche = calcolaMetriche(testoScorrevole);
    const report = reportDemo(metriche);
    expect(report.metriche).toEqual(metriche);
    expect(report.sintesi).toContain(String(metriche.gulpease));
  });

  it("chiede più lavoro su un testo difficile che su uno scorrevole", () => {
    const facile = livelloDaMetriche(calcolaMetriche(testoScorrevole));
    const difficile = livelloDaMetriche(calcolaMetriche(testoDenso));
    expect(facile).toBe("correzione-bozze");
    expect(difficile).toBe("editing-profondo");
  });

  it("segnala il periodare lungo solo quando le frasi lo sono davvero", () => {
    expect(reportDemo(calcolaMetriche(testoScorrevole)).ritmo.periodareLungo).toBe(false);
    expect(reportDemo(calcolaMetriche(testoDenso)).ritmo.periodareLungo).toBe(true);
  });
});

describe("archivio di sessione", () => {
  it("ritrova un preventivo appena registrato e ne segue il passaggio ad acconto pagato", () => {
    const preventivo = computeQuote({
      projectType: "romanzo",
      textState: "finito-da-revisionare",
      wordCount: 60_000,
    });
    const consigliato = preventivo.packages.find((p) => p.recommended) ?? preventivo.packages[1];

    const salvato = registraPreventivo({
      pacchetti: [...preventivo.packages],
      prezzoTotale: consigliato.total,
      acconto: consigliato.deposit,
    });

    expect(trovaPreventivo(salvato.id)?.stato).toBe("sent");

    segnaAccontoPagato(salvato.id, "signature");
    const dopo = trovaPreventivo(salvato.id);
    const signature = preventivo.packages.find((p) => p.tier === "signature");

    expect(dopo?.stato).toBe("deposit_paid");
    expect(dopo?.pacchettoScelto).toBe("signature");
    expect(dopo?.prezzoTotale).toBe(signature?.total);
  });

  it("non esplode su un preventivo inesistente", () => {
    expect(() => segnaAccontoPagato("demo-prev-9999", "essenziale")).not.toThrow();
    expect(trovaPreventivo("demo-prev-9999")).toBeNull();
  });

  it("marca ogni riga d'esempio del cruscotto come demo", () => {
    const dati = datiAdminDemo();
    expect(dati.preventivi.length).toBeGreaterThan(0);
    for (const riga of [...dati.lead, ...dati.preventivi, ...dati.agenzie]) {
      expect(riga.id.startsWith("demo-")).toBe(true);
    }
  });

  it("i preventivi d'esempio hanno prezzi coerenti con il motore di prezzo", () => {
    for (const p of datiAdminDemo().preventivi) {
      const scelto =
        p.pacchettiGenerati.find((x) => x.tier === p.pacchettoScelto) ??
        p.pacchettiGenerati.find((x) => x.recommended);
      expect(p.prezzoTotale).toBe(scelto?.total);
      expect(p.acconto).toBe(scelto?.deposit);
    }
  });
});
