import { describe, it, expect } from "vitest";
import { incoerenzePolicy, type DatiPolicy } from "@/lib/ai/policy-coerenza";
import { policyConsente } from "@/lib/ai/router";
import { POLICY_RIFERIMENTO, PROVIDER } from "@/config/modelli";

const BASE: DatiPolicy = {
  provider: "anthropic",
  addestramentoConsentito: false,
  zeroDataRetention: true,
  giorniConservazione: 0,
  dpaDisponibile: true,
  regioneDati: "Unione Europea",
  subresponsabili: [],
  approvatoManoscrittiInediti: false,
  approvatoProgettiSensibili: false,
  note: "",
};

describe("coerenza della policy", () => {
  it("una policy non approvata non ha vincoli da rispettare", () => {
    // Registrare le condizioni senza approvare dev'essere sempre possibile:
    // è il modo in cui si prende nota di un contratto che non va bene.
    expect(incoerenzePolicy({ ...BASE, dpaDisponibile: false })).toEqual([]);
    expect(incoerenzePolicy({ ...BASE, addestramentoConsentito: true })).toEqual([]);
  });

  it("non si approva senza DPA", () => {
    const problemi = incoerenzePolicy({
      ...BASE,
      dpaDisponibile: false,
      approvatoManoscrittiInediti: true,
    });
    expect(problemi.join(" ")).toMatch(/DPA/);
  });

  it("non si approva un fornitore che addestra sui dati", () => {
    // I manoscritti sono inediti: è il punto per cui il cancello esiste.
    const problemi = incoerenzePolicy({
      ...BASE,
      addestramentoConsentito: true,
      approvatoManoscrittiInediti: true,
    });
    expect(problemi.join(" ")).toMatch(/addestr/);
  });

  it("non si approvano i progetti sensibili senza i manoscritti inediti", () => {
    const problemi = incoerenzePolicy({ ...BASE, approvatoProgettiSensibili: true });
    expect(problemi.join(" ")).toMatch(/manoscritti inediti/);
  });

  it("un progetto sensibile esige che il fornitore non conservi i dati", () => {
    const problemi = incoerenzePolicy({
      ...BASE,
      zeroDataRetention: false,
      giorniConservazione: 30,
      approvatoManoscrittiInediti: true,
      approvatoProgettiSensibili: true,
    });
    expect(problemi.join(" ")).toMatch(/conserv/);
  });

  it("accetta la combinazione corretta", () => {
    expect(
      incoerenzePolicy({
        ...BASE,
        approvatoManoscrittiInediti: true,
        approvatoProgettiSensibili: true,
      }),
    ).toEqual([]);
  });
});

describe("ciò che il form impedisce, il router lo rifiuterebbe comunque", () => {
  // La coerenza del form è comodità; la garanzia sta nel router. Questo test
  // tiene le due cose allineate: se un domani il router allentasse una regola
  // senza che il form la segua, si vedrebbe qui.
  const modello = { provider: "anthropic" as const } as never;

  it("una policy senza DPA non passa il router", () => {
    const esito = policyConsente(
      modello,
      [{ ...BASE, dpaDisponibile: false, approvatoManoscrittiInediti: true } as never],
      { manoscrittoInedito: true },
    );
    expect(esito.ok).toBe(false);
  });

  it("una policy che consente l'addestramento non passa il router", () => {
    const esito = policyConsente(
      modello,
      [{ ...BASE, addestramentoConsentito: true, approvatoManoscrittiInediti: true } as never],
      { manoscrittoInedito: true },
    );
    expect(esito.ok).toBe(false);
  });

  it("una policy coerente e approvata passa", () => {
    const esito = policyConsente(
      modello,
      [{ ...BASE, approvatoManoscrittiInediti: true } as never],
      { manoscrittoInedito: true },
    );
    expect(esito.ok).toBe(true);
  });
});

describe("valori di riferimento", () => {
  it("non approvano nulla: sono un promemoria, non un'approvazione", () => {
    // È il motivo per cui una lavorazione non parte finché una persona non
    // entra in /admin/provider. Se questo test cadesse, il cancello privacy
    // si sarebbe aperto da solo.
    for (const p of POLICY_RIFERIMENTO) {
      expect(p.approvatoManoscrittiInediti, p.provider).toBe(false);
      expect(p.approvatoProgettiSensibili, p.provider).toBe(false);
    }
  });

  it("coprono tutti i provider previsti", () => {
    for (const provider of PROVIDER) {
      expect(POLICY_RIFERIMENTO.map((p) => p.provider)).toContain(provider);
    }
  });
});
