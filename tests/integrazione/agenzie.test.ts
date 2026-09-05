/**
 * Multi-tenant: white label e conversioni, su database vero.
 *
 * La proprietà da difendere è la stessa che vende il prodotto alle agenzie:
 * un'agenzia non vede i dati di un'altra, e non sa che l'altra esista. Un mock
 * non può dimostrarlo — accetterebbe qualunque query — e per questo il test
 * gira su Postgres.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  chiudiDatabase,
  creaLead,
  creaScenario,
  preparaDatabase,
  svuota,
  type Scenario,
} from "./aiuto";
import {
  aggiornaBranding,
  cambiaAttivazione,
  creaAgenzia,
  elencaAgenzie,
  isStudio,
  organizzazioneCorrente,
} from "@/lib/dati/organizzazioni";
import { cambiaStatoLead } from "@/lib/dati/lead";
import { funnelConversioni, registraConversione, ultimeConversioni } from "@/lib/dati/conversioni";
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
  // Nello scenario base tutte le organizzazioni nascono come "agenzia":
  // Proemios è quella di tipo "studio".
  const db = await preparaDatabase();
  await db
    .update(schema.organizations)
    .set({ tipo: "studio" })
    .where(eq(schema.organizations.id, scenario.studio));
});

describe("confini fra tenant", () => {
  it("un'agenzia non elenca le altre organizzazioni", async () => {
    // Non un elenco filtrato: un rifiuto. Non esiste una versione «vedi le
    // altre agenzie, ma meno».
    await expect(elencaAgenzie(scenario.attori.adminAgenziaA!)).rejects.toBeInstanceOf(
      NonAutorizzato,
    );
  });

  it("lo studio elenca le agenzie, ma non sé stesso", async () => {
    const elenco = await elencaAgenzie(scenario.attori.admin!);
    const id = elenco.map((a) => a.id);
    expect(id).toContain(scenario.agenziaA);
    expect(id).toContain(scenario.agenziaB);
    expect(id).not.toContain(scenario.studio);
  });

  it("ognuno vede la propria organizzazione", async () => {
    const mia = await organizzazioneCorrente(scenario.attori.adminAgenziaA!);
    expect(mia.id).toBe(scenario.agenziaA);
    expect(await isStudio(scenario.attori.adminAgenziaA!)).toBe(false);
    expect(await isStudio(scenario.attori.admin!)).toBe(true);
  });

  it("un'agenzia non crea altre agenzie", async () => {
    await expect(
      creaAgenzia(scenario.attori.adminAgenziaA!, { slug: "nuova", nome: "Nuova" }),
    ).rejects.toBeInstanceOf(NonAutorizzato);
  });

  it("un'agenzia non disattiva un'altra agenzia", async () => {
    await expect(
      cambiaAttivazione(scenario.attori.adminAgenziaA!, scenario.agenziaB, false),
    ).rejects.toBeInstanceOf(NonAutorizzato);
  });

  it("nemmeno lo studio disattiva sé stesso", async () => {
    await expect(cambiaAttivazione(scenario.attori.admin!, scenario.studio, false)).rejects.toThrow(
      /propria organizzazione/,
    );
  });

  it("lo studio non disattiva un'organizzazione inesistente", async () => {
    await expect(
      cambiaAttivazione(scenario.attori.admin!, "00000000-0000-0000-0000-000000000000", false),
    ).rejects.toBeInstanceOf(NonTrovato);
  });
});

describe("branding", () => {
  it("il branding di un'agenzia resta suo", async () => {
    await aggiornaBranding(scenario.attori.adminAgenziaA!, {
      coloreIdentita: "#00AAFF",
      nomeVisualizzato: "Aurora",
    });

    const a = await organizzazioneCorrente(scenario.attori.adminAgenziaA!);
    expect(a.branding?.coloreIdentita).toBe("#00aaff");

    // L'altra agenzia non ne è toccata.
    const b = await organizzazioneCorrente(scenario.attori.opsAgenziaB!);
    expect(b.branding).toBeNull();
  });

  it("rifiuta un colore che non è un colore", async () => {
    await expect(
      aggiornaBranding(scenario.attori.adminAgenziaA!, {
        coloreIdentita: "red; } body { display: none",
      }),
    ).rejects.toThrow(/esadecimale/);

    const a = await organizzazioneCorrente(scenario.attori.adminAgenziaA!);
    expect(a.branding).toBeNull();
  });

  it("rifiuta un logo che non è https", async () => {
    await expect(
      aggiornaBranding(scenario.attori.adminAgenziaA!, {
        logoUrl: "http://cdn.esempio.it/logo.png",
      }),
    ).rejects.toThrow(/https/);
  });

  it("scrive solo i campi validati, non l'input intero", async () => {
    await aggiornaBranding(scenario.attori.adminAgenziaA!, {
      nomeVisualizzato: "Aurora",
      ...({ noteInterne: "iniezione", tipo: "studio" } as Record<string, string>),
    });
    const a = await organizzazioneCorrente(scenario.attori.adminAgenziaA!);
    expect(Object.keys(a.branding!)).toEqual(["nomeVisualizzato"]);
    expect(a.tipo).toBe("agenzia");
  });

  it("il redattore non tocca il branding", async () => {
    await expect(
      aggiornaBranding(scenario.attori.redattore!, { nomeVisualizzato: "X" }),
    ).rejects.toBeInstanceOf(NonAutorizzato);
  });
});

describe("creazione di un'agenzia", () => {
  it("crea un tenant vuoto, senza persone", async () => {
    const creata = await creaAgenzia(scenario.attori.admin!, {
      slug: "edizioni-aurora",
      nome: "Edizioni Aurora",
      proemiosInvisibile: true,
    });
    expect(creata.tipo).toBe("agenzia");
    expect(creata.proemiosInvisibile).toBe(true);

    const db = await preparaDatabase();
    const utenti = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.organizationId, creata.id));
    expect(utenti).toHaveLength(0);
  });

  it("rifiuta uno slug già usato e uno malformato", async () => {
    await creaAgenzia(scenario.attori.admin!, { slug: "aurora", nome: "Aurora" });
    await expect(
      creaAgenzia(scenario.attori.admin!, { slug: "aurora", nome: "Altra" }),
    ).rejects.toThrow(/già usato/);

    for (const slug of ["-aurora", "aurora-", "Aurora Edizioni", "a"]) {
      await expect(creaAgenzia(scenario.attori.admin!, { slug, nome: "X" })).rejects.toThrow();
    }
  });
});

describe("conversioni per tenant", () => {
  it("il funnel di un'agenzia non contiene le conversioni di un'altra", async () => {
    await registraConversione({
      evento: "client_won",
      chiaveDedup: "a-1",
      organizationId: scenario.agenziaA,
      valoreCent: 100_000,
    });
    await registraConversione({
      evento: "client_won",
      chiaveDedup: "b-1",
      organizationId: scenario.agenziaB,
      valoreCent: 500_000,
    });

    const a = await funnelConversioni(scenario.attori.adminAgenziaA!);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ evento: "client_won", conteggio: 1, valoreCent: 100_000 });

    const ultime = await ultimeConversioni(scenario.attori.adminAgenziaA!);
    expect(ultime).toHaveLength(1);
  });

  it("non registra due volte la stessa conversione", async () => {
    const dati = {
      evento: "purchase" as const,
      chiaveDedup: "pagamento-1-purchase",
      organizationId: scenario.studio,
      valoreCent: 12_200,
    };
    expect((await registraConversione(dati)).registrata).toBe(true);
    expect((await registraConversione(dati)).registrata).toBe(false);

    const funnel = await funnelConversioni(scenario.attori.admin!);
    expect(funnel.find((f) => f.evento === "purchase")?.conteggio).toBe(1);
  });

  it("non attribuisce un valore a un evento che non ne ha uno", async () => {
    // Google ottimizza su questi numeri: un valore inventato insegna alla
    // campagna a comprare il pubblico sbagliato.
    await registraConversione({
      evento: "qualified_lead",
      chiaveDedup: "q-1",
      organizationId: scenario.studio,
      valoreCent: 999_999,
    });
    const funnel = await funnelConversioni(scenario.attori.admin!);
    expect(funnel.find((f) => f.evento === "qualified_lead")?.valoreCent).toBe(0);
  });

  it("il cambio di stato del lead emette la conversione, e congela l'attribuzione", async () => {
    const lead = await creaLead({
      nome: "Anna",
      email: "anna@x.it",
      organizationId: scenario.studio,
      valoreStimato: 3_000,
    });

    await cambiaStatoLead(scenario.attori.operations!, lead.id, "qualificato");
    await cambiaStatoLead(scenario.attori.operations!, lead.id, "proposta");
    await cambiaStatoLead(scenario.attori.operations!, lead.id, "cliente");

    const funnel = await funnelConversioni(scenario.attori.admin!);
    const eventi = Object.fromEntries(funnel.map((f) => [f.evento, f.conteggio]));
    expect(eventi.qualified_lead).toBe(1);
    expect(eventi.proposal_sent).toBe(1);
    expect(eventi.client_won).toBe(1);

    // L'attribuzione del lead è finita nella conversione, congelata.
    const db = await preparaDatabase();
    const [riga] = await db
      .select()
      .from(schema.conversions)
      .where(eq(schema.conversions.evento, "client_won"));
    expect(riga!.attribuzione).toMatchObject({ gclid: "click-123", utmSource: "google" });
    // E nessun dato personale ci è passato dentro.
    expect(JSON.stringify(riga!.attribuzione)).not.toContain("anna@x.it");
    expect(JSON.stringify(riga!.attribuzione)).not.toContain("Anna");
  });

  it("un lead che torna indietro e riavanza non conta due volte", async () => {
    const lead = await creaLead({
      nome: "Bruno",
      email: "bruno@x.it",
      organizationId: scenario.studio,
    });
    await cambiaStatoLead(scenario.attori.operations!, lead.id, "qualificato");
    await cambiaStatoLead(scenario.attori.operations!, lead.id, "call");
    await cambiaStatoLead(scenario.attori.operations!, lead.id, "qualificato");

    const funnel = await funnelConversioni(scenario.attori.admin!);
    expect(funnel.find((f) => f.evento === "qualified_lead")?.conteggio).toBe(1);
  });

  it("il redattore non vede il funnel", async () => {
    await expect(funnelConversioni(scenario.attori.redattore!)).rejects.toBeInstanceOf(
      NonAutorizzato,
    );
  });
});
