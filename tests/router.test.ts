import { describe, it, expect } from "vitest";
import {
  CAPACITA_PER_LIVELLO,
  NessunModelloAmmesso,
  policyConsente,
  scegliModello,
  type RichiestaRouting,
} from "@/lib/ai/router";
import type { DefinizioneModello, PolicyPrivacy } from "@/config/modelli";

function modello(over: Partial<DefinizioneModello> = {}): DefinizioneModello {
  return {
    id: "m-1",
    provider: "anthropic",
    modello: "un-modello",
    capacita: [
      "proofreading",
      "grammar",
      "structured-output",
      "stylistic-editing",
      "narrative-analysis",
      "adjudication",
    ],
    abilitato: true,
    benchmarkStatus: "approved",
    premium: false,
    contestoToken: 200_000,
    costoInputMicroCent: 300,
    costoOutputMicroCent: 1_500,
    ...over,
  };
}

function policy(over: Partial<PolicyPrivacy> = {}): PolicyPrivacy {
  return {
    provider: "anthropic",
    addestramentoConsentito: false,
    zeroDataRetention: true,
    giorniConservazione: 0,
    dpaDisponibile: true,
    regioneDati: "UE",
    subresponsabili: [],
    approvatoManoscrittiInediti: true,
    approvatoProgettiSensibili: true,
    note: "",
    ...over,
  };
}

const RICHIESTA: RichiestaRouting = {
  livelloServizio: "correzione-bozze",
  modalitaRevisione: "controllato",
  manoscrittoInedito: true,
  capacitaRichieste: [],
};

describe("cancello privacy", () => {
  it("esclude un provider senza policy registrata", () => {
    const esito = policyConsente(modello(), [], RICHIESTA);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/nessuna policy/);
  });

  it("esclude un provider senza DPA", () => {
    const esito = policyConsente(modello(), [policy({ dpaDisponibile: false })], RICHIESTA);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/DPA/);
  });

  it("esclude un provider che si addestra sui dati", () => {
    const esito = policyConsente(modello(), [policy({ addestramentoConsentito: true })], RICHIESTA);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/addestramento/);
  });

  it("esclude un provider non approvato per i manoscritti inediti", () => {
    const esito = policyConsente(
      modello(),
      [policy({ approvatoManoscrittiInediti: false })],
      { manoscrittoInedito: true },
    );
    expect(esito.ok).toBe(false);
  });

  it("consente lo stesso provider su un'opera già pubblicata", () => {
    const p = [policy({ approvatoManoscrittiInediti: false })];
    expect(policyConsente(modello(), p, { manoscrittoInedito: false }).ok).toBe(true);
  });

  it("esclude un provider non approvato per i progetti sensibili", () => {
    const p = [policy({ approvatoProgettiSensibili: false })];
    expect(
      policyConsente(modello(), p, { manoscrittoInedito: false, progettoSensibile: true }).ok,
    ).toBe(false);
  });
});

describe("scelta del modello", () => {
  it("lancia con l'elenco dei motivi quando nessun modello passa", () => {
    try {
      scegliModello(RICHIESTA, [modello()], [policy({ dpaDisponibile: false })]);
      expect.unreachable("doveva lanciare");
    } catch (e) {
      expect(e).toBeInstanceOf(NessunModelloAmmesso);
      expect((e as NessunModelloAmmesso).motivi.join(" ")).toMatch(/DPA/);
    }
  });

  it("la privacy vince sulla qualità e sul costo", () => {
    // Il modello migliore e più economico, ma senza policy adatta, perde.
    const decisione = scegliModello(
      RICHIESTA,
      [
        modello({ id: "bravo-ma-vietato", provider: "openai", benchmarkStatus: "approved", costoInputMicroCent: 1 }),
        modello({ id: "ammesso", benchmarkStatus: "unverified", costoInputMicroCent: 9_000 }),
      ],
      [policy(), policy({ provider: "openai", approvatoManoscrittiInediti: false })],
    );
    expect(decisione.primaria.id).toBe("ammesso");
  });

  it("preferisce il modello approvato dal benchmark", () => {
    const decisione = scegliModello(
      RICHIESTA,
      [
        modello({ id: "non-verificato", benchmarkStatus: "unverified" }),
        modello({ id: "approvato", benchmarkStatus: "approved" }),
      ],
      [policy()],
    );
    expect(decisione.primaria.id).toBe("approvato");
  });

  it("il costo non ribalta una differenza di qualità", () => {
    const decisione = scegliModello(
      RICHIESTA,
      [
        modello({ id: "scadente-economico", benchmarkStatus: "unverified", costoInputMicroCent: 1, costoOutputMicroCent: 1 }),
        modello({ id: "buono-caro", benchmarkStatus: "approved", costoInputMicroCent: 20_000, costoOutputMicroCent: 40_000 }),
      ],
      [policy()],
    );
    expect(decisione.primaria.id).toBe("buono-caro");
  });

  it("esclude chi non ha le capacità del livello", () => {
    const decisione = scegliModello(
      { ...RICHIESTA, livelloServizio: "editing-narrativo" },
      [
        modello({ id: "solo-bozze", capacita: ["proofreading", "structured-output"] }),
        modello({ id: "completo" }),
      ],
      [policy()],
    );
    expect(decisione.primaria.id).toBe("completo");
  });

  it("esclude chi non ha contesto sufficiente", () => {
    const decisione = scegliModello(
      { ...RICHIESTA, tokenStimati: 150_000 },
      [
        modello({ id: "corto", contestoToken: 128_000 }),
        modello({ id: "lungo", contestoToken: 400_000 }),
      ],
      [policy()],
    );
    expect(decisione.primaria.id).toBe("lungo");
  });

  it("esclude i modelli disabilitati e quelli scartati dal benchmark", () => {
    expect(() =>
      scegliModello(
        RICHIESTA,
        [modello({ id: "spento", abilitato: false }), modello({ id: "bocciato", benchmarkStatus: "rejected" })],
        [policy()],
      ),
    ).toThrow(NessunModelloAmmesso);
  });

  it("registra le motivazioni della scelta", () => {
    const decisione = scegliModello(RICHIESTA, [modello({ id: "scelto" })], [policy()]);
    expect(decisione.motivazioni).toContain("primaria:scelto");
    expect(decisione.motivazioni).toContain("livello:correzione-bozze");
    expect(decisione.motivazioni).toContain("benchmark:approved");
  });
});

describe("modalità premium", () => {
  const premium: RichiestaRouting = { ...RICHIESTA, modalitaRevisione: "premium" };

  it("in modalità controllata non sceglie una seconda run", () => {
    const decisione = scegliModello(
      RICHIESTA,
      [modello({ id: "a" }), modello({ id: "b", provider: "openai" })],
      [policy(), policy({ provider: "openai" })],
    );
    expect(decisione.secondaria).toBeUndefined();
  });

  it("sceglie una seconda run di un provider diverso", () => {
    // Due modelli dello stesso fornitore tendono a sbagliare nello stesso modo:
    // il loro accordo non è una conferma.
    const decisione = scegliModello(
      premium,
      [
        modello({ id: "anthropic-1" }),
        modello({ id: "anthropic-2" }),
        modello({ id: "openai-1", provider: "openai" }),
      ],
      [policy(), policy({ provider: "openai" })],
    );
    expect(decisione.secondaria?.provider).toBe("openai");
  });

  it("segnala quando la seconda run non è indipendente", () => {
    const decisione = scegliModello(
      premium,
      [modello({ id: "a" }), modello({ id: "b" })],
      [policy()],
    );
    expect(decisione.secondaria?.id).toBe("b");
    expect(decisione.motivazioni).toContain("attenzione:seconda-run-stesso-provider");
  });

  it("segnala quando manca del tutto una seconda run", () => {
    const decisione = scegliModello(premium, [modello({ id: "unico" })], [policy()]);
    expect(decisione.secondaria).toBeUndefined();
    expect(decisione.motivazioni).toContain("attenzione:nessuna-seconda-run-indipendente");
  });

  it("sceglie un adjudicator con la capacità di arbitrato", () => {
    const decisione = scegliModello(
      premium,
      [
        modello({ id: "a" }),
        modello({ id: "b", provider: "openai" }),
        modello({ id: "arbitro", capacita: [...modello().capacita] }),
      ],
      [policy(), policy({ provider: "openai" })],
    );
    expect(decisione.adjudicator).toBeDefined();
    expect(decisione.adjudicator!.capacita).toContain("adjudication");
  });

  it("permette di escludere modelli, per una run davvero indipendente", () => {
    const decisione = scegliModello(
      { ...RICHIESTA, escludi: ["primo"] },
      [modello({ id: "primo" }), modello({ id: "secondo" })],
      [policy()],
    );
    expect(decisione.primaria.id).toBe("secondo");
  });
});

describe("capacità per livello", () => {
  it("ogni livello richiede structured output", () => {
    for (const capacita of Object.values(CAPACITA_PER_LIVELLO)) {
      expect(capacita).toContain("structured-output");
    }
  });
});
