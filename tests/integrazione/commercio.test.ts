/**
 * Ordini, incassi e fatture su database vero.
 *
 * Le proprietà che questi test difendono sono quelle che, se cedono, si vedono
 * in contabilità e non nei log: un incasso contato due volte, una rata pagata
 * da chi non doveva vederla, un rimborso che non riapre il dovuto, una fattura
 * emessa due volte per lo stesso incasso.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  chiudiDatabase,
  creaAttoreCliente,
  creaCliente,
  creaScenario,
  preparaDatabase,
  svuota,
  type Scenario,
} from "./aiuto";
import {
  annullaOrdine,
  confermaOrdine,
  creaOrdine,
  elencaOrdini,
  leggiOrdine,
} from "@/lib/dati/ordini";
import {
  collegaSessioneStripe,
  elencaIncassi,
  registraPagamentoManuale,
  registraRimborso,
  riepilogoIncassi,
  segnaIncassata,
} from "@/lib/dati/pagamenti";
import { emettiFattura, preparaFattura } from "@/lib/dati/fatture";
import { applicaEventoStripe } from "@/lib/pagamenti/webhook";
import { impostaProviderFatturazionePerTest } from "@/lib/fatturazione";
import type { ProviderFatturazione } from "@/lib/fatturazione/provider";
import { ErroreFatturazione } from "@/lib/fatturazione/provider";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import * as schema from "@/db/schema";

let scenario: Scenario;

beforeAll(async () => {
  await preparaDatabase();
});

afterAll(async () => {
  await chiudiDatabase();
  impostaProviderFatturazionePerTest(null);
});

beforeEach(async () => {
  await svuota();
  scenario = await creaScenario();
  impostaProviderFatturazionePerTest(null);
});

/** Cliente con anagrafica completa: fatturabile senza aggiungere altro. */
async function clienteFatturabile(organizationId: string) {
  const db = await preparaDatabase();
  const cliente = await creaCliente({
    nome: "Edizioni Aurora",
    email: `a${Math.random()}@x.it`,
    organizationId,
  });
  await db
    .update(schema.clients)
    .set({
      tipo: "azienda",
      ragioneSociale: "Edizioni Aurora S.r.l.",
      indirizzo: { via: "Via Mazzini 4", cap: "20121", citta: "Milano", provincia: "MI" },
      codiceDestinatario: "ABCDEFG",
    })
    .where(eq(schema.clients.id, cliente.id));
  return cliente;
}

describe("creazione dell'ordine", () => {
  it("crea ordine e rate in un colpo solo, con l'acconto del listino", async () => {
    const cliente = await creaCliente({
      nome: "C",
      email: "o1@x.it",
      organizationId: scenario.studio,
    });

    const { ordine, rate } = await creaOrdine(scenario.attori.operations!, {
      clientId: cliente.id,
      imponibileCent: 100_000,
    });

    // IVA calcolata qui, non accettata da fuori.
    expect(ordine.imponibileCent).toBe(100_000);
    expect(ordine.ivaCent).toBe(22_000);
    expect(ordine.totaleCent).toBe(122_000);

    expect(rate).toHaveLength(2);
    expect(rate[0]).toMatchObject({ tipo: "acconto", importoCent: 48_800 });
    expect(rate[1]).toMatchObject({ tipo: "saldo", importoCent: 73_200 });
    expect(rate.reduce((t, r) => t + r.importoCent, 0)).toBe(ordine.totaleCent);
    expect(ordine.codice).toMatch(/^O-\d{4}-\d{4}$/);
  });

  it("non crea niente se il piano non quadra", async () => {
    const cliente = await creaCliente({
      nome: "C",
      email: "o2@x.it",
      organizationId: scenario.studio,
    });

    await expect(
      creaOrdine(scenario.attori.operations!, {
        clientId: cliente.id,
        imponibileCent: 100_000,
        piano: {
          modalita: "personalizzato",
          rate: [{ importoCent: 1, descrizione: "Sbagliata" }],
        },
      }),
    ).rejects.toThrow(/non quadra/);

    // Nessun ordine orfano rimasto in giro.
    const { totale } = await elencaOrdini(scenario.attori.operations!);
    expect(totale).toBe(0);
  });

  it("rifiuta un cliente di un altro tenant", async () => {
    const altrui = await creaCliente({
      nome: "Altro",
      email: "o3@x.it",
      organizationId: scenario.agenziaB,
    });
    await expect(
      creaOrdine(scenario.attori.operations!, { clientId: altrui.id, imponibileCent: 10_000 }),
    ).rejects.toBeInstanceOf(NonTrovato);
  });

  it("il redattore non crea ordini", async () => {
    const cliente = await creaCliente({
      nome: "C",
      email: "o4@x.it",
      organizationId: scenario.studio,
    });
    await expect(
      creaOrdine(scenario.attori.redattore!, { clientId: cliente.id, imponibileCent: 10_000 }),
    ).rejects.toBeInstanceOf(NonAutorizzato);
  });
});

describe("incassi", () => {
  async function ordinePronto() {
    const cliente = await clienteFatturabile(scenario.studio);
    const { ordine, rate } = await creaOrdine(scenario.attori.operations!, {
      clientId: cliente.id,
      imponibileCent: 100_000,
    });
    await confermaOrdine(scenario.attori.operations!, ordine.id);
    return { cliente, ordineId: ordine.id, rate };
  }

  it("un bonifico registrato conferma l'ordine e riduce il residuo", async () => {
    const { ordineId, rate } = await ordinePronto();

    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO 123456",
    });

    const dettaglio = await leggiOrdine(scenario.attori.finance!, ordineId);
    expect(dettaglio.ordine.stato).toBe("confermato");
    expect(dettaglio.residuoCent).toBe(73_200);
    expect(dettaglio.saldato).toBe(false);
  });

  it("non si registra due volte lo stesso incasso", async () => {
    const { rate } = await ordinePronto();
    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO 1",
    });
    await expect(
      registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
        metodo: "bonifico",
        riferimentoEsterno: "CRO 2",
      }),
    ).rejects.toThrow(/già incassata/);
  });

  it("il webhook Stripe è idempotente: due consegne, un incasso", async () => {
    const { ordineId, rate } = await ordinePronto();
    await collegaSessioneStripe(rate[0]!.id, "cs_test_1");

    const evento = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_status: "paid",
          payment_intent: "pi_test_1",
          metadata: { pagamentoId: rate[0]!.id },
        },
      },
    } as unknown as Stripe.Event;

    // Stripe riconsegna gli eventi: è la norma, non un caso limite.
    expect((await applicaEventoStripe(evento)).azione).toBe("incassato");
    expect((await applicaEventoStripe(evento)).azione).toBe("gia_incassato");

    const dettaglio = await leggiOrdine(scenario.attori.finance!, ordineId);
    expect(dettaglio.residuoCent).toBe(73_200);
  });

  it("una sessione completata ma non pagata non è un incasso", async () => {
    const { ordineId, rate } = await ordinePronto();
    const evento = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_x",
          payment_status: "unpaid",
          metadata: { pagamentoId: rate[0]!.id },
        },
      },
    } as unknown as Stripe.Event;

    expect((await applicaEventoStripe(evento)).azione).toBe("ignorato");
    const dettaglio = await leggiOrdine(scenario.attori.finance!, ordineId);
    expect(dettaglio.residuoCent).toBe(122_000);
  });

  it("l'importo incassato è quello della rata, non quello del payload", async () => {
    // Il payload dice *quale* rata, non quanto: un evento con un importo
    // gonfiato non deve poter cambiare la contabilità.
    const { ordineId, rate } = await ordinePronto();
    await segnaIncassata(rate[0]!.id, { stripePaymentIntentId: "pi_1" });

    const dettaglio = await leggiOrdine(scenario.attori.finance!, ordineId);
    const acconto = dettaglio.rate.find((r) => r.tipo === "acconto")!;
    expect(acconto.importoCent).toBe(48_800);
  });

  it("un rimborso riapre il dovuto", async () => {
    const { ordineId, rate } = await ordinePronto();
    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO 1",
    });

    const esito = await registraRimborso(
      scenario.attori.finance!,
      rate[0]!.id,
      20_000,
      "Rinuncia parziale",
    );
    expect(esito.completo).toBe(false);

    const dettaglio = await leggiOrdine(scenario.attori.finance!, ordineId);
    expect(dettaglio.residuoCent).toBe(73_200 + 20_000);
  });

  it("non si rimborsa più di quanto incassato", async () => {
    const { rate } = await ordinePronto();
    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO 1",
    });
    await expect(
      registraRimborso(scenario.attori.finance!, rate[0]!.id, 99_999, "Troppo"),
    ).rejects.toThrow(/supera l'incassato/);
  });

  it("il redattore non vede né registra incassi", async () => {
    await ordinePronto();
    await expect(elencaIncassi(scenario.attori.redattore!)).rejects.toBeInstanceOf(NonAutorizzato);
    await expect(riepilogoIncassi(scenario.attori.redattore!)).rejects.toBeInstanceOf(
      NonAutorizzato,
    );
  });

  it("i totali di cassa contano il netto, non il lordo", async () => {
    const { rate } = await ordinePronto();
    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO 1",
    });
    await registraRimborso(scenario.attori.finance!, rate[0]!.id, 8_800, "Sconto concordato");

    const r = await riepilogoIncassi(scenario.attori.finance!);
    expect(r.incassatoCent).toBe(40_000);
    expect(r.rimborsatoCent).toBe(8_800);
    expect(r.attesoCent).toBe(73_200);
  });
});

describe("confini del cliente", () => {
  it("il cliente vede solo i propri ordini", async () => {
    const mio = await creaAttoreCliente({
      email: "mio@x.it",
      nome: "Mio",
      organizationId: scenario.studio,
    });
    const altro = await creaCliente({
      nome: "Altro",
      email: "altro@x.it",
      organizationId: scenario.studio,
    });

    const suo = await creaOrdine(scenario.attori.operations!, {
      clientId: mio.clientId,
      imponibileCent: 10_000,
    });
    const nonSuo = await creaOrdine(scenario.attori.operations!, {
      clientId: altro.id,
      imponibileCent: 10_000,
    });

    const { voci } = await elencaOrdini(mio);
    expect(voci.map((o) => o.id)).toEqual([suo.ordine.id]);

    // L'ordine di un altro cliente risulta inesistente, non vietato.
    await expect(leggiOrdine(mio, nonSuo.ordine.id)).rejects.toBeInstanceOf(NonTrovato);
  });

  it("il DTO del cliente non porta identificativi Stripe né note interne", async () => {
    const mio = await creaAttoreCliente({
      email: "dto@x.it",
      nome: "Mio",
      organizationId: scenario.studio,
    });
    const { ordine, rate } = await creaOrdine(scenario.attori.operations!, {
      clientId: mio.clientId,
      imponibileCent: 10_000,
      noteInterne: "Margine basso, non allargare.",
    });
    await confermaOrdine(scenario.attori.operations!, ordine.id);
    await collegaSessioneStripe(rate[0]!.id, "cs_segreta");

    const dettaglio = await leggiOrdine(mio, ordine.id);
    const chiavi = new Set([
      ...Object.keys(dettaglio.ordine),
      ...dettaglio.rate.flatMap((r) => Object.keys(r)),
    ]);
    for (const vietata of [
      "noteInterne",
      "stripeSessionId",
      "stripePaymentIntentId",
      "stripeChargeId",
      "registratoDaId",
      "riferimentoEsterno",
      "creatoDaId",
    ]) {
      expect([...chiavi], `il cliente non deve vedere ${vietata}`).not.toContain(vietata);
    }
    expect(JSON.stringify(dettaglio)).not.toContain("cs_segreta");
    expect(JSON.stringify(dettaglio)).not.toContain("Margine basso");
  });
});

describe("annullamento", () => {
  it("annulla un ordine non ancora incassato e chiude le rate", async () => {
    const cliente = await creaCliente({
      nome: "C",
      email: "ann@x.it",
      organizationId: scenario.studio,
    });
    const { ordine } = await creaOrdine(scenario.attori.operations!, {
      clientId: cliente.id,
      imponibileCent: 50_000,
    });

    await annullaOrdine(scenario.attori.operations!, ordine.id, "Il cliente ha rinunciato");
    const dettaglio = await leggiOrdine(scenario.attori.operations!, ordine.id);
    expect(dettaglio.ordine.stato).toBe("annullato");
    expect(dettaglio.rate.every((r) => r.stato === "annullato")).toBe(true);
  });

  it("non annulla un ordine con incassi non rimborsati", async () => {
    const cliente = await creaCliente({
      nome: "C",
      email: "ann2@x.it",
      organizationId: scenario.studio,
    });
    const { ordine, rate } = await creaOrdine(scenario.attori.operations!, {
      clientId: cliente.id,
      imponibileCent: 50_000,
    });
    await confermaOrdine(scenario.attori.operations!, ordine.id);
    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO 9",
    });

    await expect(
      annullaOrdine(scenario.attori.operations!, ordine.id, "Ripensamento"),
    ).rejects.toThrow(/rimborsati/);
  });
});

describe("fatture", () => {
  /** Provider finto: emette senza rete, e conta quante volte è stato chiamato. */
  class ProviderFinto implements ProviderFatturazione {
    readonly nome = "finto";
    chiamate = 0;
    constructor(private readonly errore?: ErroreFatturazione) {}
    configurato() {
      return true;
    }
    async emetti() {
      this.chiamate += 1;
      if (this.errore) throw this.errore;
      return {
        providerDocumentoId: `doc-${this.chiamate}`,
        numeroDocumento: `${this.chiamate}/2026`,
        dataDocumento: new Date("2026-09-05"),
        imponibileCent: 40_000,
        ivaCent: 8_800,
        totaleCent: 48_800,
        urlDocumento: "https://esempio.invalid/fattura.pdf",
      };
    }
  }

  async function incassoDaFatturare() {
    const cliente = await clienteFatturabile(scenario.studio);
    const { ordine, rate } = await creaOrdine(scenario.attori.operations!, {
      clientId: cliente.id,
      imponibileCent: 100_000,
    });
    await confermaOrdine(scenario.attori.operations!, ordine.id);
    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO 1",
    });
    return { ordineId: ordine.id, pagamentoId: rate[0]!.id };
  }

  it("emette una sola fattura per incasso, anche chiamandola due volte", async () => {
    const provider = new ProviderFinto();
    impostaProviderFatturazionePerTest(provider);
    const { pagamentoId } = await incassoDaFatturare();

    const prima = await preparaFattura(scenario.attori.finance!, pagamentoId);
    const emessa = await emettiFattura(scenario.attori.finance!, prima.id);
    expect(emessa.stato).toBe("emessa");

    // La seconda volta non si riemette: si restituisce quella che c'è.
    const seconda = await preparaFattura(scenario.attori.finance!, pagamentoId);
    expect(seconda.id).toBe(prima.id);
    const riemessa = await emettiFattura(scenario.attori.finance!, prima.id);
    expect(riemessa.numeroDocumento).toBe(emessa.numeroDocumento);
    expect(provider.chiamate).toBe(1);
  });

  it("spezza imponibile e IVA in proporzione alla rata", async () => {
    impostaProviderFatturazionePerTest(new ProviderFinto());
    const { pagamentoId } = await incassoDaFatturare();
    const fattura = await preparaFattura(scenario.attori.finance!, pagamentoId);
    // L'acconto è il 40% di 122.000: la sua quota di imponibile è il 40% di
    // 100.000, e il resto è imposta.
    expect(fattura.imponibileCent).toBe(40_000);
    expect(fattura.ivaCent).toBe(8_800);
    expect(fattura.totaleCent).toBe(48_800);
  });

  it("non fattura ciò che non è stato incassato", async () => {
    impostaProviderFatturazionePerTest(new ProviderFinto());
    const cliente = await clienteFatturabile(scenario.studio);
    const { ordine, rate } = await creaOrdine(scenario.attori.operations!, {
      clientId: cliente.id,
      imponibileCent: 10_000,
    });
    await confermaOrdine(scenario.attori.operations!, ordine.id);
    await expect(preparaFattura(scenario.attori.finance!, rate[0]!.id)).rejects.toThrow(
      /incassato/,
    );
  });

  it("un errore definitivo ferma la fattura, uno di rete la lascia riprovabile", async () => {
    const { pagamentoId } = await incassoDaFatturare();

    impostaProviderFatturazionePerTest(new ProviderFinto(new ErroreFatturazione("rete", true)));
    const fattura = await preparaFattura(scenario.attori.finance!, pagamentoId);
    await expect(emettiFattura(scenario.attori.finance!, fattura.id)).rejects.toThrow();

    const db = await preparaDatabase();
    const [dopoRete] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, fattura.id));
    // Ritentabile: torna in coda e potrà ripartire.
    expect(dopoRete!.stato).toBe("da_emettere");

    impostaProviderFatturazionePerTest(
      new ProviderFinto(new ErroreFatturazione("partita iva non valida", false)),
    );
    await expect(emettiFattura(scenario.attori.finance!, fattura.id)).rejects.toThrow();
    const [dopoDati] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, fattura.id));
    // Definitivo: si ferma e chiede una persona.
    expect(dopoDati!.stato).toBe("errore");
    expect(dopoDati!.erroreMessaggio).toContain("partita iva");
  });

  it("non emette con un'anagrafica incompleta, e dice cosa manca", async () => {
    impostaProviderFatturazionePerTest(new ProviderFinto());
    // Cliente senza partita IVA né indirizzo.
    const cliente = await creaCliente({
      nome: "Senza dati",
      email: "sd@x.it",
      organizationId: scenario.studio,
    });
    const db = await preparaDatabase();
    await db
      .update(schema.clients)
      .set({ partitaIva: null, indirizzo: null })
      .where(eq(schema.clients.id, cliente.id));

    const { ordine, rate } = await creaOrdine(scenario.attori.operations!, {
      clientId: cliente.id,
      imponibileCent: 10_000,
    });
    await confermaOrdine(scenario.attori.operations!, ordine.id);
    await registraPagamentoManuale(scenario.attori.finance!, rate[0]!.id, {
      metodo: "bonifico",
      riferimentoEsterno: "CRO",
    });

    const fattura = await preparaFattura(scenario.attori.finance!, rate[0]!.id);
    await expect(emettiFattura(scenario.attori.finance!, fattura.id)).rejects.toThrow(/mancano/);
  });

  it("il responsabile editoriale non emette fatture", async () => {
    const { pagamentoId } = await incassoDaFatturare();
    await expect(preparaFattura(scenario.attori.responsabile!, pagamentoId)).rejects.toBeInstanceOf(
      NonAutorizzato,
    );
  });
});
