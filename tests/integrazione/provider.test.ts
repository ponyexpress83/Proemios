/**
 * Le policy dei provider su database vero.
 *
 * La proprietà da difendere: **nessun manoscritto raggiunge un fornitore che
 * una persona non ha approvato**, e l'approvazione lascia il nome di chi se
 * l'è assunta.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { chiudiDatabase, creaScenario, preparaDatabase, svuota, type Scenario } from "./aiuto";
import { elencaPolicy, revocaApprovazione, salvaPolicy } from "@/lib/dati/provider";
import { NonAutorizzato } from "@/lib/auth/errori";
import * as schema from "@/db/schema";

let scenario: Scenario;

const BASE = {
  provider: "anthropic" as const,
  addestramentoConsentito: false,
  zeroDataRetention: true,
  giorniConservazione: 0,
  dpaDisponibile: true,
  regioneDati: "Unione Europea",
  subresponsabili: ["Amazon Web Services"],
  approvatoManoscrittiInediti: true,
  approvatoProgettiSensibili: false,
  note: "Contratto firmato il 1° settembre 2026.",
};

beforeAll(async () => {
  await preparaDatabase();
});

afterAll(async () => {
  await chiudiDatabase();
});

beforeEach(async () => {
  await svuota();
  scenario = await creaScenario();
});

describe("chi può approvare", () => {
  it("l'amministratore approva e lascia il proprio nome", async () => {
    const salvata = await salvaPolicy(scenario.attori.admin!, BASE);
    expect(salvata.approvatoManoscrittiInediti).toBe(true);
    expect(salvata.rivistoDaNome).toBe("Admin");
    expect(salvata.rivistoAt).toBeTruthy();
  });

  it("operations vede ma non approva", async () => {
    await salvaPolicy(scenario.attori.admin!, BASE);
    // Deve poter capire perché un Job non parte…
    const elenco = await elencaPolicy(scenario.attori.operations!);
    expect(elenco).toHaveLength(1);
    // …ma approvare un trattamento dei dati è un altro mestiere.
    await expect(salvaPolicy(scenario.attori.operations!, BASE)).rejects.toBeInstanceOf(
      NonAutorizzato,
    );
  });

  it("il redattore non vede nemmeno l'elenco", async () => {
    await expect(elencaPolicy(scenario.attori.redattore!)).rejects.toBeInstanceOf(NonAutorizzato);
  });
});

describe("coerenza applicata anche dal server", () => {
  it("rifiuta l'approvazione senza DPA", async () => {
    await expect(
      salvaPolicy(scenario.attori.admin!, { ...BASE, dpaDisponibile: false }),
    ).rejects.toThrow(/DPA/);

    // E non lascia nulla scritto a metà.
    const db = await preparaDatabase();
    const righe = await db.select().from(schema.providerPolicies);
    expect(righe).toHaveLength(0);
  });

  it("rifiuta un provider sconosciuto", async () => {
    await expect(
      salvaPolicy(scenario.attori.admin!, { ...BASE, provider: "acme" as never }),
    ).rejects.toThrow(/sconosciuto/);
  });
});

describe("una riga per provider", () => {
  it("salvare due volte aggiorna invece di duplicare", async () => {
    // Due righe per lo stesso fornitore sarebbero due verità sulle stesse
    // condizioni, e il router ne pescherebbe una a caso.
    await salvaPolicy(scenario.attori.admin!, BASE);
    await salvaPolicy(scenario.attori.admin!, { ...BASE, regioneDati: "Stati Uniti" });

    const elenco = await elencaPolicy(scenario.attori.admin!);
    expect(elenco).toHaveLength(1);
    expect(elenco[0]!.regioneDati).toBe("Stati Uniti");
  });
});

describe("revoca", () => {
  it("azzera le approvazioni ma conserva la storia", async () => {
    await salvaPolicy(scenario.attori.admin!, BASE);
    await revocaApprovazione(scenario.attori.admin!, "anthropic", "DPA scaduto");

    const [policy] = await elencaPolicy(scenario.attori.admin!);
    expect(policy!.approvatoManoscrittiInediti).toBe(false);
    // La riga resta: cancellarla perderebbe cosa era stato approvato e da chi.
    expect(policy!.dpaDisponibile).toBe(true);
    expect(policy!.note).toContain("DPA scaduto");
  });

  it("esige un motivo", async () => {
    await salvaPolicy(scenario.attori.admin!, BASE);
    await expect(revocaApprovazione(scenario.attori.admin!, "anthropic", "   ")).rejects.toThrow(
      /motivo/,
    );
  });

  it("operations non revoca", async () => {
    await salvaPolicy(scenario.attori.admin!, BASE);
    await expect(
      revocaApprovazione(scenario.attori.operations!, "anthropic", "x"),
    ).rejects.toBeInstanceOf(NonAutorizzato);
  });
});

describe("traccia in audit", () => {
  it("ogni approvazione lascia un evento", async () => {
    await salvaPolicy(scenario.attori.admin!, BASE);
    const db = await preparaDatabase();
    const eventi = await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.azione, "provider.policy_modificata"));

    expect(eventi).toHaveLength(1);
    expect(eventi[0]!.attoreId).toBe(scenario.attori.admin!.userId);
    // I metadati dicono cosa è stato approvato, non solo che qualcosa è cambiato.
    expect(eventi[0]!.metadati).toMatchObject({
      provider: "anthropic",
      approvatoManoscrittiInediti: true,
    });
  });
});
