import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  chiudiDatabase,
  creaLead,
  creaScenario,
  preparaDatabase,
  svuota,
  type Scenario,
} from "./aiuto";
import {
  aggiungiNotaLead,
  assegnaLead,
  cambiaStatoLead,
  cronologiaLead,
  elencaLead,
  funnel,
  leggiAttribuzione,
  leggiLead,
} from "@/lib/dati/lead";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";

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

describe("isolamento fra tenant — lead", () => {
  it("l'agenzia A non vede i lead dell'agenzia B nell'elenco", async () => {
    await creaLead({ nome: "Cliente A", email: "a@x.it", organizationId: scenario.agenziaA });
    await creaLead({ nome: "Cliente B", email: "b@x.it", organizationId: scenario.agenziaB });

    const perA = await elencaLead(scenario.attori.opsAgenziaA!, {}, { organizzazioneStudio: false });
    expect(perA.voci).toHaveLength(1);
    expect(perA.voci[0]!.nome).toBe("Cliente A");
    expect(JSON.stringify(perA)).not.toContain("Cliente B");
    expect(JSON.stringify(perA)).not.toContain("b@x.it");
  });

  it("l'agenzia A non può leggere un lead dell'agenzia B conoscendone l'id", async () => {
    const leadB = await creaLead({
      nome: "Cliente B",
      email: "b@x.it",
      organizationId: scenario.agenziaB,
    });

    await expect(
      leggiLead(scenario.attori.opsAgenziaA!, leadB.id, { organizzazioneStudio: false }),
    ).rejects.toThrow(NonTrovato);
  });

  it("risponde «non trovato», non «non autorizzato», su un lead di altro tenant", async () => {
    // Distinguere i due casi permetterebbe di scoprire quali id esistono.
    const leadB = await creaLead({
      nome: "Cliente B",
      email: "b@x.it",
      organizationId: scenario.agenziaB,
    });
    const inesistente = "00000000-0000-4000-8000-000000000000";

    const erroreAltrui = await leggiLead(scenario.attori.opsAgenziaA!, leadB.id, {
      organizzazioneStudio: false,
    }).catch((e) => e);
    const erroreInesistente = await leggiLead(scenario.attori.opsAgenziaA!, inesistente, {
      organizzazioneStudio: false,
    }).catch((e) => e);

    expect(erroreAltrui).toBeInstanceOf(NonTrovato);
    expect(erroreInesistente).toBeInstanceOf(NonTrovato);
    expect(erroreAltrui.message).toBe(erroreInesistente.message);
  });

  it("l'agenzia A non può modificare un lead dell'agenzia B", async () => {
    const leadB = await creaLead({
      nome: "Cliente B",
      email: "b@x.it",
      organizationId: scenario.agenziaB,
    });

    await expect(
      cambiaStatoLead(scenario.attori.opsAgenziaA!, leadB.id, "qualificato"),
    ).rejects.toThrow(NonTrovato);
    await expect(assegnaLead(scenario.attori.opsAgenziaA!, leadB.id, null)).rejects.toThrow(
      NonTrovato,
    );
    await expect(aggiungiNotaLead(scenario.attori.opsAgenziaA!, leadB.id, "ciao")).rejects.toThrow(
      NonTrovato,
    );
  });

  it("l'agenzia A non può leggere la cronologia di un lead dell'agenzia B", async () => {
    const leadB = await creaLead({
      nome: "Cliente B",
      email: "b@x.it",
      organizationId: scenario.agenziaB,
    });
    await expect(
      cronologiaLead(scenario.attori.opsAgenziaA!, leadB.id, { organizzazioneStudio: false }),
    ).rejects.toThrow(NonTrovato);
  });

  it("il funnel dell'agenzia A conta solo i propri lead", async () => {
    await creaLead({ nome: "A1", email: "a1@x.it", organizationId: scenario.agenziaA });
    await creaLead({ nome: "A2", email: "a2@x.it", organizationId: scenario.agenziaA });
    await creaLead({ nome: "B1", email: "b1@x.it", organizationId: scenario.agenziaB });
    await creaLead({ nome: "B2", email: "b2@x.it", organizationId: scenario.agenziaB });
    await creaLead({ nome: "B3", email: "b3@x.it", organizationId: scenario.agenziaB });

    const perA = await funnel(scenario.attori.opsAgenziaA!);
    const totaleA = perA.reduce((s, r) => s + r.conteggio, 0);
    expect(totaleA).toBe(2);
  });

  it("il filtro di tenant regge anche con la paginazione", async () => {
    // Il rischio reale: filtrare dopo aver letto una pagina. Con più lead
    // dell'altro tenant che dei propri, un filtro applicato a valle
    // restituirebbe una pagina vuota o mista.
    for (let i = 0; i < 30; i++) {
      await creaLead({ nome: `B${i}`, email: `b${i}@x.it`, organizationId: scenario.agenziaB });
    }
    await creaLead({ nome: "Solo A", email: "solo-a@x.it", organizationId: scenario.agenziaA });

    const perA = await elencaLead(
      scenario.attori.opsAgenziaA!,
      { perPagina: 10 },
      { organizzazioneStudio: false },
    );
    expect(perA.totale).toBe(1);
    expect(perA.voci).toHaveLength(1);
    expect(perA.voci[0]!.nome).toBe("Solo A");
  });

  it("i lead senza organizzazione restano allo studio, non alle agenzie", async () => {
    // I lead del sito pubblico nascono senza tenant: devono essere visibili
    // allo studio e a nessun'altra organizzazione.
    await creaLead({ nome: "Dal sito", email: "sito@x.it", organizationId: null });

    const perStudio = await elencaLead(scenario.attori.operations!, {});
    expect(perStudio.voci.map((l) => l.nome)).toContain("Dal sito");

    const perA = await elencaLead(scenario.attori.opsAgenziaA!, {}, { organizzazioneStudio: false });
    expect(perA.voci).toHaveLength(0);
  });
});

describe("permessi sui lead — ruoli", () => {
  it("il redattore non può leggere nessun lead", async () => {
    const lead = await creaLead({
      nome: "Cliente",
      email: "c@x.it",
      organizationId: scenario.studio,
    });

    await expect(elencaLead(scenario.attori.redattore!, {})).rejects.toThrow(NonAutorizzato);
    await expect(leggiLead(scenario.attori.redattore!, lead.id)).rejects.toThrow(NonAutorizzato);
    await expect(funnel(scenario.attori.redattore!)).rejects.toThrow(NonAutorizzato);
  });

  it("il responsabile editoriale non vede i lead", async () => {
    await expect(elencaLead(scenario.attori.responsabile!, {})).rejects.toThrow(NonAutorizzato);
  });

  it("finance non vede l'attribuzione di campagna", async () => {
    const lead = await creaLead({
      nome: "Cliente",
      email: "c@x.it",
      organizationId: scenario.studio,
    });
    await expect(leggiAttribuzione(scenario.attori.finance!, lead.id)).rejects.toThrow(
      NonAutorizzato,
    );
    // Operations invece sì: è chi valuta le campagne.
    const attribuzione = await leggiAttribuzione(scenario.attori.operations!, lead.id);
    expect(attribuzione.gclid).toBe("click-123");
  });

  it("un account disattivato non legge nulla", async () => {
    const spento = { ...scenario.attori.operations!, attivo: false };
    await expect(elencaLead(spento, {})).rejects.toThrow(NonAutorizzato);
  });
});

describe("transizioni di stato", () => {
  it("rifiuta un salto non previsto e non modifica il lead", async () => {
    const lead = await creaLead({
      nome: "Cliente",
      email: "c@x.it",
      organizationId: scenario.studio,
      stato: "nuovo",
    });

    await expect(
      cambiaStatoLead(scenario.attori.operations!, lead.id, "cliente"),
    ).rejects.toThrow(/Transizione non ammessa/);

    const dopo = await leggiLead(scenario.attori.operations!, lead.id);
    expect(dopo.stato).toBe("nuovo");
  });

  it("registra ogni cambio di stato nella cronologia", async () => {
    const lead = await creaLead({
      nome: "Cliente",
      email: "c@x.it",
      organizationId: scenario.studio,
    });

    await cambiaStatoLead(scenario.attori.operations!, lead.id, "qualificato");
    await cambiaStatoLead(scenario.attori.operations!, lead.id, "call");

    const eventi = await cronologiaLead(scenario.attori.operations!, lead.id);
    const descrizioni = eventi.map((e) => e.descrizione);
    expect(descrizioni).toContain("nuovo → qualificato");
    expect(descrizioni).toContain("qualificato → call");
  });

  it("perde un lead con il motivo, e lo azzera se viene riaperto", async () => {
    const lead = await creaLead({
      nome: "Cliente",
      email: "c@x.it",
      organizationId: scenario.studio,
    });

    await cambiaStatoLead(scenario.attori.operations!, lead.id, "perso", "Budget insufficiente");
    let dopo = await leggiLead(scenario.attori.operations!, lead.id);
    expect(dopo.stato).toBe("perso");
    expect(dopo.persoMotivo).toBe("Budget insufficiente");

    await cambiaStatoLead(scenario.attori.operations!, lead.id, "nuovo");
    dopo = await leggiLead(scenario.attori.operations!, lead.id);
    expect(dopo.stato).toBe("nuovo");
    expect(dopo.persoMotivo).toBeNull();
  });
});
