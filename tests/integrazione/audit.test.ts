import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { desc, eq } from "drizzle-orm";
import { chiudiDatabase, creaLead, creaScenario, preparaDatabase, svuota, type Scenario } from "./aiuto";
import { cambiaStatoLead, assegnaLead } from "@/lib/dati/lead";
import { creaInvito, disattivaUtente } from "@/lib/dati/utenti";
import { registra } from "@/lib/audit";
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

async function eventi() {
  const db = await preparaDatabase();
  return db.select().from(schema.auditEvents).orderBy(desc(schema.auditEvents.createdAt));
}

describe("registro di audit", () => {
  it("registra il cambio di stato di un lead con attore e ruolo", async () => {
    const lead = await creaLead({
      nome: "Cliente",
      email: "c@x.it",
      organizationId: scenario.studio,
    });
    await cambiaStatoLead(scenario.attori.operations!, lead.id, "qualificato");

    const righe = await eventi();
    const voce = righe.find((r) => r.azione === "lead.stato_cambiato");
    expect(voce).toBeDefined();
    expect(voce!.attoreId).toBe(scenario.attori.operations!.userId);
    expect(voce!.attoreRuolo).toBe("operations_admin");
    expect(voce!.entita).toBe("lead");
    expect(voce!.entitaId).toBe(lead.id);
    expect(voce!.metadati).toMatchObject({ da: "nuovo", a: "qualificato" });
  });

  it("registra assegnazioni, inviti e disattivazioni", async () => {
    const lead = await creaLead({
      nome: "Cliente",
      email: "c@x.it",
      organizationId: scenario.studio,
    });
    await assegnaLead(scenario.attori.operations!, lead.id, scenario.attori.redattore!.userId);
    await creaInvito(scenario.attori.admin!, { email: "nuovo@proemios.it", ruolo: "finance" });
    await disattivaUtente(scenario.attori.admin!, scenario.attori.redattore!.userId, "Fine");

    const azioni = (await eventi()).map((r) => r.azione);
    expect(azioni).toContain("lead.assegnato");
    expect(azioni).toContain("utente.invitato");
    expect(azioni).toContain("utente.disattivato");
  });

  it("non scrive mai testo di manoscritto o segreti nei metadati", async () => {
    await registra(scenario.attori.operations!, {
      azione: "job.creato",
      entita: "job",
      entitaId: null,
      metadati: {
        jobId: "j-1",
        manoscrittoTesto: "Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura",
        apiKey: "sk-segretissima",
        promptSistema: "Sei un correttore di bozze…",
      },
    });

    const [voce] = await eventi();
    const serializzato = JSON.stringify(voce!.metadati);
    expect(serializzato).not.toContain("selva oscura");
    expect(serializzato).not.toContain("sk-segretissima");
    expect(serializzato).not.toContain("correttore di bozze");
    expect(voce!.metadati).toMatchObject({ jobId: "j-1" });
  });

  it("un errore di scrittura dell'audit non fa fallire l'operazione", async () => {
    // Registrare su un'entità con id malformato fa fallire l'insert: l'audit
    // deve assorbire il problema, non propagarlo a chi stava lavorando.
    await expect(
      registra(scenario.attori.operations!, {
        azione: "job.creato",
        entita: "job",
        entitaId: "non-un-uuid",
      }),
    ).resolves.toBeUndefined();
  });

  it("l'audit è legato all'organizzazione di chi agisce", async () => {
    const leadA = await creaLead({
      nome: "A",
      email: "a@x.it",
      organizationId: scenario.agenziaA,
    });
    await cambiaStatoLead(scenario.attori.opsAgenziaA!, leadA.id, "qualificato");

    const db = await preparaDatabase();
    const righe = await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.organizationId, scenario.agenziaA));
    expect(righe.length).toBeGreaterThan(0);
  });
});
