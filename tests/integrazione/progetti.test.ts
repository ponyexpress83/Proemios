import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  chiudiDatabase,
  creaAttoreCliente,
  creaCliente,
  creaProgettoDiretto,
  creaScenario,
  preparaDatabase,
  svuota,
  type Scenario,
} from "./aiuto";
import { elencaProgetti, leggiProgetto, creaProgetto, aggiungiMembro } from "@/lib/dati/progetti";
import {
  decidiApprovazione,
  elencaMessaggi,
  richiediApprovazione,
  scriviMessaggio,
} from "@/lib/dati/comunicazioni";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import type { Attore } from "@/lib/auth/attore";

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

describe("visibilità dei progetti", () => {
  it("il redattore vede solo i progetti di cui è membro", async () => {
    const cliente = await creaCliente({
      nome: "Mario Rossi",
      email: "mario@x.it",
      organizationId: scenario.studio,
      alias: "Autore 12",
    });

    const assegnato = await creaProgettoDiretto({
      codice: "P-101",
      titolo: "Assegnato",
      organizationId: scenario.studio,
      clientId: cliente.id,
      membri: [{ userId: scenario.attori.redattore!.userId, ruolo: "editor_reviewer" }],
    });
    await creaProgettoDiretto({
      codice: "P-102",
      titolo: "Non assegnato",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });

    const elenco = await elencaProgetti(scenario.attori.redattore!);
    expect(elenco.voci).toHaveLength(1);
    expect(elenco.totale).toBe(1);
    expect(JSON.stringify(elenco)).toContain("P-101");
    expect(JSON.stringify(elenco)).not.toContain("P-102");

    // Nemmeno conoscendo l'id.
    await expect(leggiProgetto(scenario.attori.redattore!, assegnato.id)).resolves.toBeDefined();
  });

  it("il redattore non legge un progetto di cui non è membro, nemmeno con l'id", async () => {
    const cliente = await creaCliente({
      nome: "Mario",
      email: "m@x.it",
      organizationId: scenario.studio,
    });
    const altrui = await creaProgettoDiretto({
      codice: "P-103",
      titolo: "Altrui",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });
    await expect(leggiProgetto(scenario.attori.redattore!, altrui.id)).rejects.toThrow(NonTrovato);
  });

  it("il cliente A non vede il progetto del cliente B", async () => {
    const clienteA = await creaAttoreCliente({
      email: "a@clienti.it",
      nome: "Cliente A",
      organizationId: scenario.studio,
    });
    const clienteB = await creaAttoreCliente({
      email: "b@clienti.it",
      nome: "Cliente B",
      organizationId: scenario.studio,
    });

    await creaProgettoDiretto({
      codice: "P-201",
      titolo: "Libro di A",
      organizationId: scenario.studio,
      clientId: clienteA.clientId,
    });
    const progettoB = await creaProgettoDiretto({
      codice: "P-202",
      titolo: "Libro di B",
      organizationId: scenario.studio,
      clientId: clienteB.clientId,
    });

    const perA = await elencaProgetti(clienteA);
    expect(perA.voci).toHaveLength(1);
    expect(JSON.stringify(perA)).toContain("Libro di A");
    expect(JSON.stringify(perA)).not.toContain("Libro di B");

    await expect(leggiProgetto(clienteA, progettoB.id)).rejects.toThrow(NonTrovato);
  });

  it("un cliente di un'agenzia non vede i progetti dello studio", async () => {
    const clienteAgenzia = await creaAttoreCliente({
      email: "cliente@agenzia-a.it",
      nome: "Cliente Agenzia",
      organizationId: scenario.agenziaA,
    });
    const clienteStudio = await creaCliente({
      nome: "Cliente Studio",
      email: "studio@x.it",
      organizationId: scenario.studio,
    });
    await creaProgettoDiretto({
      codice: "P-301",
      titolo: "Progetto dello studio",
      organizationId: scenario.studio,
      clientId: clienteStudio.id,
    });

    const elenco = await elencaProgetti(clienteAgenzia);
    expect(elenco.voci).toHaveLength(0);
  });

  it("l'agenzia A non vede i progetti dell'agenzia B", async () => {
    const clienteB = await creaCliente({
      nome: "Cliente B",
      email: "cb@x.it",
      organizationId: scenario.agenziaB,
    });
    const progettoB = await creaProgettoDiretto({
      codice: "P-401",
      titolo: "Progetto agenzia B",
      organizationId: scenario.agenziaB,
      clientId: clienteB.id,
    });

    const elenco = await elencaProgetti(scenario.attori.opsAgenziaA!);
    expect(elenco.voci).toHaveLength(0);
    await expect(leggiProgetto(scenario.attori.opsAgenziaA!, progettoB.id)).rejects.toThrow(
      NonTrovato,
    );
  });
});

describe("cosa arriva a chi — i DTO in condizioni reali", () => {
  it("al redattore non arriva niente del cliente né delle note interne", async () => {
    const cliente = await creaCliente({
      nome: "Mario Rossi",
      email: "mario.rossi@esempio.it",
      organizationId: scenario.studio,
      alias: "Autore 12",
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-501",
      titolo: "La storia della famiglia Rossi",
      titoloAlias: "Memoir familiare",
      organizationId: scenario.studio,
      clientId: cliente.id,
      membri: [{ userId: scenario.attori.redattore!.userId, ruolo: "editor_reviewer" }],
    });

    const dettaglio = await leggiProgetto(scenario.attori.redattore!, progetto.id);
    const testo = JSON.stringify(dettaglio);

    // Identità e contatti del cliente.
    expect(testo).not.toContain("Mario Rossi");
    expect(testo).not.toContain("mario.rossi@esempio.it");
    expect(testo).not.toContain("01234567890");
    expect(testo).not.toContain("333 0000000");
    // Titolo vero dell'opera: può identificare la famiglia di cui parla.
    expect(testo).not.toContain("famiglia Rossi");
    // Note commerciali e interne.
    expect(testo).not.toContain("Budget alto");
    expect(testo).not.toContain("Margine basso");
    // Ciò che invece gli serve, c'è.
    expect(testo).toContain("Memoir familiare");
    expect(testo).toContain("Non toccare i dialoghi");
    expect(dettaglio.cliente).toBeNull();
  });

  it("a finance non arrivano le istruzioni editoriali del progetto", async () => {
    const cliente = await creaCliente({
      nome: "Mario",
      email: "m2@x.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-506",
      titolo: "Titolo",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });

    const dettaglio = await leggiProgetto(scenario.attori.finance!, progetto.id);
    const testo = JSON.stringify(dettaglio);
    expect(testo).not.toContain("Non toccare i dialoghi");
    expect(testo).not.toContain("Margine basso");
    // L'anagrafica di fatturazione invece sì: è il suo mestiere.
    expect(testo).toContain("01234567890");
  });

  it("a operations arriva l'identità del cliente", async () => {
    const cliente = await creaCliente({
      nome: "Mario Rossi",
      email: "mario.rossi@esempio.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-502",
      titolo: "Titolo vero",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });

    const dettaglio = await leggiProgetto(scenario.attori.operations!, progetto.id);
    expect(JSON.stringify(dettaglio)).toContain("mario.rossi@esempio.it");
    expect(JSON.stringify(dettaglio)).toContain("Titolo vero");
  });

  it("al cliente non arrivano istruzioni editoriali, note interne né i membri", async () => {
    const clienteAttore = await creaAttoreCliente({
      email: "c@clienti.it",
      nome: "Cliente",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-503",
      titolo: "Il mio libro",
      organizationId: scenario.studio,
      clientId: clienteAttore.clientId,
      membri: [{ userId: scenario.attori.redattore!.userId, ruolo: "editor_reviewer" }],
    });

    const dettaglio = await leggiProgetto(clienteAttore, progetto.id);
    const testo = JSON.stringify(dettaglio);
    expect(testo).not.toContain("Non toccare i dialoghi");
    expect(testo).not.toContain("Margine basso");
    expect(testo).not.toContain("Philippe");
    expect(dettaglio.membri).toEqual([]);
    expect(testo).toContain("Il mio libro");
  });

  it("le note interne non finiscono nei messaggi del cliente", async () => {
    const clienteAttore = await creaAttoreCliente({
      email: "c2@clienti.it",
      nome: "Cliente",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-504",
      titolo: "Libro",
      organizationId: scenario.studio,
      clientId: clienteAttore.clientId,
    });

    await scriviMessaggio(scenario.attori.operations!, progetto.id, "Ciao, ecco il punto.", true);
    await scriviMessaggio(
      scenario.attori.operations!,
      progetto.id,
      "Nota interna: il cliente insiste, teniamo duro sul prezzo.",
      false,
    );

    const perCliente = await elencaMessaggi(clienteAttore, progetto.id);
    expect(perCliente).toHaveLength(1);
    expect(JSON.stringify(perCliente)).not.toContain("teniamo duro");

    const perStaff = await elencaMessaggi(scenario.attori.operations!, progetto.id);
    expect(perStaff).toHaveLength(2);
  });

  it("un cliente non può scrivere una nota interna", async () => {
    const clienteAttore = await creaAttoreCliente({
      email: "c3@clienti.it",
      nome: "Cliente",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-505",
      titolo: "Libro",
      organizationId: scenario.studio,
      clientId: clienteAttore.clientId,
    });

    // Anche chiedendolo esplicitamente, il messaggio resta visibile.
    const m = await scriviMessaggio(clienteAttore, progetto.id, "Una domanda", false);
    expect(m.visibileAlCliente).toBe(true);
  });
});

describe("separazione fra approvazione editoriale e consegna", () => {
  async function preparaProgetto(): Promise<{ progettoId: string; cliente: Attore }> {
    const cliente = await creaAttoreCliente({
      email: "appr@clienti.it",
      nome: "Cliente",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-601",
      titolo: "Libro",
      organizationId: scenario.studio,
      clientId: cliente.clientId,
      membri: [{ userId: scenario.attori.redattore!.userId, ruolo: "editor_reviewer" }],
    });
    return { progettoId: progetto.id, cliente };
  }

  it("il redattore non può decidere un'approvazione operativa", async () => {
    const { progettoId } = await preparaProgetto();
    const id = await richiediApprovazione(scenario.attori.operations!, {
      progettoId,
      tipo: "operativa",
    });
    await expect(
      decidiApprovazione(scenario.attori.redattore!, id, "approvata"),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("operations non può decidere un'approvazione editoriale", async () => {
    const { progettoId } = await preparaProgetto();
    const id = await richiediApprovazione(scenario.attori.responsabile!, {
      progettoId,
      tipo: "editoriale",
    });
    await expect(
      decidiApprovazione(scenario.attori.operations!, id, "approvata"),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("il redattore approva editorialmente", async () => {
    const { progettoId } = await preparaProgetto();
    const id = await richiediApprovazione(scenario.attori.responsabile!, {
      progettoId,
      tipo: "editoriale",
    });
    await expect(
      decidiApprovazione(scenario.attori.redattore!, id, "approvata"),
    ).resolves.toBeUndefined();
  });

  it("chi richiede un'approvazione non può concederla a sé stesso", async () => {
    const { progettoId } = await preparaProgetto();
    const id = await richiediApprovazione(scenario.attori.admin!, {
      progettoId,
      tipo: "operativa",
    });
    await expect(decidiApprovazione(scenario.attori.admin!, id, "approvata")).rejects.toThrow(
      NonAutorizzato,
    );
  });

  it("un'approvazione già decisa non si decide due volte", async () => {
    const { progettoId } = await preparaProgetto();
    const id = await richiediApprovazione(scenario.attori.responsabile!, {
      progettoId,
      tipo: "operativa",
    });
    await decidiApprovazione(scenario.attori.operations!, id, "approvata");
    await expect(decidiApprovazione(scenario.attori.admin!, id, "respinta")).rejects.toThrow(
      /già stata decisa/,
    );
  });

  it("il cliente decide solo le proprie milestone, e solo sui propri progetti", async () => {
    const { progettoId, cliente } = await preparaProgetto();
    const altro = await creaAttoreCliente({
      email: "altro@clienti.it",
      nome: "Altro",
      organizationId: scenario.studio,
    });

    const id = await richiediApprovazione(scenario.attori.operations!, {
      progettoId,
      tipo: "milestone_cliente",
    });

    await expect(decidiApprovazione(altro, id, "approvata")).rejects.toThrow(NonTrovato);
    await expect(decidiApprovazione(cliente, id, "approvata")).resolves.toBeUndefined();
  });
});

describe("creazione di progetti", () => {
  it("crea progetto, tappe e membro iniziale in una sola transazione", async () => {
    const cliente = await creaCliente({
      nome: "Nuovo",
      email: "nuovo@x.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgetto(scenario.attori.operations!, {
      clientId: cliente.id,
      titolo: "Un nuovo libro",
    });

    expect(progetto.codice).toMatch(/^P-\d+$/);
    const dettaglio = await leggiProgetto(scenario.attori.operations!, progetto.id);
    expect(dettaglio.tappe.length).toBeGreaterThanOrEqual(5);
    expect(dettaglio.tappe[0]!.stato).toBe("in_corso");
    expect(dettaglio.membri.length).toBe(1);
  });

  it("non crea un progetto per un cliente di un altro tenant", async () => {
    const clienteB = await creaCliente({
      nome: "Cliente B",
      email: "cb2@x.it",
      organizationId: scenario.agenziaB,
    });
    await expect(
      creaProgetto(scenario.attori.opsAgenziaA!, { clientId: clienteB.id, titolo: "Furto" }),
    ).rejects.toThrow(NonTrovato);
  });

  it("il redattore non può creare progetti né assegnare membri", async () => {
    const cliente = await creaCliente({
      nome: "X",
      email: "x@x.it",
      organizationId: scenario.studio,
    });
    await expect(
      creaProgetto(scenario.attori.redattore!, { clientId: cliente.id, titolo: "No" }),
    ).rejects.toThrow(NonAutorizzato);

    const progetto = await creaProgettoDiretto({
      codice: "P-701",
      titolo: "Y",
      organizationId: scenario.studio,
      clientId: cliente.id,
      membri: [{ userId: scenario.attori.redattore!.userId, ruolo: "editor_reviewer" }],
    });
    await expect(
      aggiungiMembro(
        scenario.attori.redattore!,
        progetto.id,
        scenario.attori.finance!.userId,
        "finance",
      ),
    ).rejects.toThrow(NonAutorizzato);
  });
});
