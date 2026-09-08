import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { chiudiDatabase, creaScenario, preparaDatabase, svuota, type Scenario } from "./aiuto";
import {
  accettaInvito,
  cambiaRuolo,
  creaInvito,
  disattivaUtente,
  elencaStaff,
  esigiRuoloAssegnabile,
  revocaInvito,
  riattivaUtente,
  sessioniProprie,
} from "@/lib/dati/utenti";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import * as schema from "@/db/schema";

let scenario: Scenario;

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

describe("inviti", () => {
  it("crea l'invito conservando solo l'hash del token", async () => {
    const db = await preparaDatabase();
    const invito = await creaInvito(scenario.attori.admin!, {
      email: "nuovo@proemios.it",
      ruolo: "editor_reviewer",
    });

    const [riga] = await db
      .select()
      .from(schema.inviti)
      .where(eq(schema.inviti.id, invito.id));

    expect(riga!.tokenHash).not.toBe(invito.token);
    expect(riga!.tokenHash).toHaveLength(64); // SHA-256 in esadecimale
    expect(invito.token.length).toBeGreaterThan(20);
  });

  it("crea l'account solo con il token corretto", async () => {
    const invito = await creaInvito(scenario.attori.admin!, {
      email: "philippe2@proemios.it",
      ruolo: "editor_reviewer",
    });

    await expect(accettaInvito("token-sbagliato", "Tizio")).rejects.toThrow(NonTrovato);

    const utente = await accettaInvito(invito.token, "Philippe II");
    expect(utente.email).toBe("philippe2@proemios.it");
    expect(utente.ruolo).toBe("editor_reviewer");
  });

  it("non riusa un invito già accettato", async () => {
    const invito = await creaInvito(scenario.attori.admin!, {
      email: "unavolta@proemios.it",
      ruolo: "finance",
    });
    await accettaInvito(invito.token, "Unica");
    await expect(accettaInvito(invito.token, "Bis")).rejects.toThrow(NonTrovato);
  });

  it("non accetta un invito revocato", async () => {
    const invito = await creaInvito(scenario.attori.admin!, {
      email: "revocato@proemios.it",
      ruolo: "finance",
    });
    await revocaInvito(scenario.attori.admin!, invito.id);
    await expect(accettaInvito(invito.token, "Nessuno")).rejects.toThrow(NonTrovato);
  });

  it("non consente di invitare un ruolo pari o superiore al proprio", async () => {
    // Senza questa regola, chi può invitare può crearsi un super_admin.
    await expect(
      creaInvito(scenario.attori.operations!, {
        email: "scalata@proemios.it",
        ruolo: "super_admin",
      }),
    ).rejects.toThrow(NonAutorizzato);

    await expect(
      creaInvito(scenario.attori.operations!, {
        email: "pari@proemios.it",
        ruolo: "operations_admin",
      }),
    ).rejects.toThrow(NonAutorizzato);

    // Un ruolo più basso invece sì.
    await expect(
      creaInvito(scenario.attori.operations!, {
        email: "sotto@proemios.it",
        ruolo: "editor_reviewer",
      }),
    ).resolves.toBeDefined();
  });

  it("il redattore non può invitare nessuno", async () => {
    await expect(
      creaInvito(scenario.attori.redattore!, { email: "x@y.it", ruolo: "client" }),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("non consente di invitare in un'altra organizzazione se non si è super_admin", async () => {
    await expect(
      creaInvito(scenario.attori.opsAgenziaA!, {
        email: "infiltrato@agenzia-b.it",
        ruolo: "editor_reviewer",
        organizationId: scenario.agenziaB,
      }),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("rifiuta un invito per un indirizzo che ha già un account", async () => {
    await expect(
      creaInvito(scenario.attori.admin!, { email: "philippe@proemios.it", ruolo: "finance" }),
    ).rejects.toThrow(/già un account/);
  });
});

describe("gestione degli account", () => {
  it("l'elenco dello staff è limitato alla propria organizzazione", async () => {
    const perStudio = await elencaStaff(scenario.attori.admin!);
    const email = perStudio.map((u) => u.email);
    expect(email).toContain("philippe@proemios.it");
    expect(email).not.toContain("ops@agenzia-a.it");

    const perAgenziaA = await elencaStaff(scenario.attori.opsAgenziaA!);
    expect(perAgenziaA.map((u) => u.email).sort()).toEqual([
      "admin@agenzia-a.it",
      "ops@agenzia-a.it",
    ]);
    expect(JSON.stringify(perAgenziaA)).not.toContain("proemios.it");
    expect(JSON.stringify(perAgenziaA)).not.toContain("agenzia-b.it");
  });

  it("il redattore non può elencare lo staff", async () => {
    await expect(elencaStaff(scenario.attori.redattore!)).rejects.toThrow(NonAutorizzato);
  });

  it("cambiare ruolo chiude le sessioni aperte", async () => {
    const db = await preparaDatabase();
    const redattore = scenario.attori.redattore!;

    await db.insert(schema.sessions).values({
      sessionToken: "sessione-di-prova",
      userId: redattore.userId,
      expires: new Date(Date.now() + 86_400_000),
    });
    expect(await sessioniProprie(redattore)).toHaveLength(1);

    await cambiaRuolo(scenario.attori.admin!, redattore.userId, "editorial_manager");

    // Un ruolo cambiato con una sessione ancora aperta è un ruolo non cambiato.
    expect(await sessioniProprie(redattore)).toHaveLength(0);

    const [dopo] = await db.select().from(schema.users).where(eq(schema.users.id, redattore.userId));
    expect(dopo!.ruolo).toBe("editorial_manager");
  });

  it("nessuno può cambiare il proprio ruolo", async () => {
    await expect(
      cambiaRuolo(scenario.attori.admin!, scenario.attori.admin!.userId, "client"),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("nemmeno un amministratore di agenzia esce dal proprio tenant", async () => {
    // `adminAgenziaA` ha il ruolo più alto, ma dentro la propria organizzazione:
    // il potere di ruolo non scavalca il confine di tenant.
    await expect(
      cambiaRuolo(scenario.attori.adminAgenziaA!, scenario.attori.opsAgenziaB!.userId, "finance"),
    ).rejects.toThrow(NonTrovato);

    await expect(
      disattivaUtente(scenario.attori.adminAgenziaA!, scenario.attori.redattore!.userId, "no"),
    ).rejects.toThrow(NonTrovato);
  });

  it("operations_admin non può cambiare ruoli: non è una sua facoltà", async () => {
    await expect(
      cambiaRuolo(scenario.attori.operations!, scenario.attori.redattore!.userId, "finance"),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("la disattivazione chiude le sessioni e registra il motivo", async () => {
    const db = await preparaDatabase();
    const redattore = scenario.attori.redattore!;
    await db.insert(schema.sessions).values({
      sessionToken: "altra-sessione",
      userId: redattore.userId,
      expires: new Date(Date.now() + 86_400_000),
    });

    await disattivaUtente(scenario.attori.admin!, redattore.userId, "Fine collaborazione");

    const [dopo] = await db.select().from(schema.users).where(eq(schema.users.id, redattore.userId));
    expect(dopo!.attivo).toBe(false);
    expect(dopo!.motivoDisattivazione).toBe("Fine collaborazione");
    expect(await sessioniProprie(redattore)).toHaveLength(0);

    await riattivaUtente(scenario.attori.admin!, redattore.userId);
    const [riattivato] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, redattore.userId));
    expect(riattivato!.attivo).toBe(true);
    expect(riattivato!.motivoDisattivazione).toBeNull();
  });

  it("nessuno può disattivare sé stesso", async () => {
    await expect(
      disattivaUtente(scenario.attori.admin!, scenario.attori.admin!.userId, "boh"),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("la gerarchia dei ruoli è applicata anche fuori dagli inviti", () => {
    expect(() => esigiRuoloAssegnabile(scenario.attori.operations!, "super_admin")).toThrow();
    expect(() => esigiRuoloAssegnabile(scenario.attori.admin!, "super_admin")).not.toThrow();
    expect(() => esigiRuoloAssegnabile(scenario.attori.operations!, "editor_reviewer")).not.toThrow();
  });
});
