import { describe, it, expect } from "vitest";
import { AZIONI_AUDIT, sanitizza } from "@/lib/audit";

describe("sanitizzazione dell'audit", () => {
  it("rimuove le chiavi che possono contenere testo dell'opera", () => {
    const pulito = sanitizza({
      jobId: "j-1",
      manoscrittoTesto: "Nel mezzo del cammin di nostra vita…",
      testoOriginale: "…mi ritrovai per una selva oscura",
      contenuto: "…",
      corpoMessaggio: "…",
    }) as Record<string, unknown>;

    expect(pulito.jobId).toBe("j-1");
    expect(pulito.manoscrittoTesto).toBe("[rimosso]");
    expect(pulito.testoOriginale).toBe("[rimosso]");
    expect(pulito.contenuto).toBe("[rimosso]");
    expect(pulito.corpoMessaggio).toBe("[rimosso]");
  });

  it("rimuove segreti e credenziali comunque si chiamino", () => {
    const pulito = sanitizza({
      apiKey: "sk-vero",
      API_KEY: "sk-vero",
      stripeSecretKey: "sk_live_x",
      authorizationHeader: "Bearer abc",
      cookieSessione: "authjs...",
      passwordUtente: "hunter2",
      accessToken: "t",
      chiaveStorage: "s3://bucket/x",
    }) as Record<string, unknown>;

    for (const v of Object.values(pulito)) expect(v).toBe("[rimosso]");
  });

  it("tronca le stringhe lunghe invece di registrarle", () => {
    const lunga = "a".repeat(5_000);
    const pulito = sanitizza({ nota: lunga }) as { nota: string };
    expect(pulito.nota.length).toBeLessThan(300);
    expect(pulito.nota).toContain("[troncato 5000]");
  });

  it("limita la profondità invece di seguire strutture arbitrarie", () => {
    const profondo = { a: { b: { c: { d: { e: "in fondo" } } } } };
    const pulito = JSON.stringify(sanitizza(profondo));
    expect(pulito).not.toContain("in fondo");
    expect(pulito).toContain("troncato");
  });

  it("limita la lunghezza degli array", () => {
    const pulito = sanitizza(Array.from({ length: 200 }, (_, i) => i)) as unknown[];
    expect(pulito.length).toBe(20);
  });

  it("conserva identificativi, numeri, booleani e date", () => {
    const pulito = sanitizza({
      progettoId: "p-1",
      interventi: 1427,
      prioritaria: true,
      quando: new Date("2026-01-01T00:00:00Z"),
    }) as Record<string, unknown>;

    expect(pulito.progettoId).toBe("p-1");
    expect(pulito.interventi).toBe(1427);
    expect(pulito.prioritaria).toBe(true);
    expect(pulito.quando).toBe("2026-01-01T00:00:00.000Z");
  });

  it("gestisce null, undefined e valori non serializzabili", () => {
    expect(sanitizza(null)).toBeNull();
    expect(sanitizza(undefined)).toBeUndefined();
    expect(sanitizza(() => {})).toBe("[non serializzabile]");
  });
});

describe("elenco delle azioni", () => {
  it("non ha duplicati", () => {
    expect(new Set(AZIONI_AUDIT).size).toBe(AZIONI_AUDIT.length);
  });

  it("copre gli eventi richiesti dal capitolato", () => {
    const richiesti = [
      "accesso.riuscito",
      "file.accesso",
      "file.scaricato",
      "job.assegnato",
      "intervento.modificato",
      "approvazione.editoriale",
      "approvazione.respinta",
      "consegna.effettuata",
      "utente.ruolo_cambiato",
      "job.modello_cambiato",
      "pagamento.registrato",
      "pagamento.rimborsato",
      "contratto.modificato",
      "progetto.modificato",
    ];
    for (const a of richiesti) expect(AZIONI_AUDIT, a).toContain(a);
  });
});
