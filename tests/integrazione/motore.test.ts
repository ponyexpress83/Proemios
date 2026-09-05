import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  chiudiDatabase,
  creaCliente,
  creaProgettoDiretto,
  creaScenario,
  preparaDatabase,
  svuota,
  type Scenario,
} from "./aiuto";
import { impostaStoragePerTest } from "@/lib/storage";
import { StorageFilesystem } from "@/lib/storage/filesystem";
import { registraProviderPerTest } from "@/lib/ai/registro";
import type { EsitoProvider, ProviderAi, RichiestaProvider } from "@/lib/ai/provider";
import { ErroreProvider } from "@/lib/ai/provider";
import { caricaVersione } from "@/lib/dati/file";
import { creaJob, leggiJob, decidiInterventi, cambiaStatoJob, assegnaJob } from "@/lib/dati/job";
import { elaboraJob, ErroreElaborazione } from "@/lib/produzione/motore";
import * as schema from "@/db/schema";
import type { AttoreSistema } from "@/lib/auth/attore";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";

let scenario: Scenario;
let radiceStorage: string;

const CORPUS = path.join(process.cwd(), "tests/corpus");
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Provider finto: restituisce interventi decisi dal test, senza rete e senza
 * chiavi. È l'unico modo per provare la pipeline in modo ripetibile — un test
 * che chiama un modello vero misura il modello, non il codice.
 */
class ProviderFinto implements ProviderAi {
  readonly nome = "finto";
  chiamate = 0;
  ultimeIstruzioni = "";
  ultimoContenuto = "";

  constructor(
    private readonly risposte: (richiesta: RichiestaProvider, chiamata: number) => unknown,
  ) {}

  configurato() {
    return true;
  }

  async esegui(richiesta: RichiestaProvider): Promise<EsitoProvider> {
    this.chiamate += 1;
    this.ultimeIstruzioni = richiesta.istruzioniSistema;
    this.ultimoContenuto = richiesta.contenuto;
    const risposta = this.risposte(richiesta, this.chiamate);
    if (risposta instanceof Error) throw risposta;
    return {
      risposta: risposta as EsitoProvider["risposta"],
      tokenInput: 1_000,
      tokenOutput: 200,
      latenzaMs: 42,
    };
  }
}

function sistema(organizationId: string): AttoreSistema {
  return { tipo: "sistema", origine: "test", organizationId };
}

beforeAll(async () => {
  await preparaDatabase();
});

afterAll(async () => {
  await chiudiDatabase();
  registraProviderPerTest("anthropic", null);
  impostaStoragePerTest(null);
});

beforeEach(async () => {
  await svuota();
  scenario = await creaScenario();
  radiceStorage = await mkdtemp(path.join(tmpdir(), "proemios-motore-"));
  impostaStoragePerTest(new StorageFilesystem({ radice: radiceStorage, segreto: "prova" }));
  // Le policy devono esistere in database, altrimenti il cancello privacy
  // esclude tutto — che è il comportamento voluto in produzione.
  const db = await preparaDatabase();
  await db.insert(schema.providerPolicies).values({
    provider: "anthropic",
    addestramentoConsentito: false,
    zeroDataRetention: true,
    dpaDisponibile: true,
    regioneDati: "UE",
    approvatoManoscrittiInediti: true,
    approvatoProgettiSensibili: true,
  });
});

afterEach(async () => {
  await rm(radiceStorage, { recursive: true, force: true });
});

/** Prepara progetto, versione e Job, e restituisce gli id. */
async function preparaJob(opzioni: { livello?: "correzione-bozze" | "editing-stilistico" } = {}) {
  const cliente = await creaCliente({
    nome: "Cliente",
    email: "c@x.it",
    organizationId: scenario.studio,
  });
  const progetto = await creaProgettoDiretto({
    codice: `P-${Math.floor(Math.random() * 9000) + 1000}`,
    titolo: "Manoscritto",
    organizationId: scenario.studio,
    clientId: cliente.id,
    membri: [{ userId: scenario.attori.redattore!.userId, ruolo: "editor_reviewer" }],
  });

  const contenuto = await readFile(path.join(CORPUS, "semplice.docx"));
  const versione = await caricaVersione(scenario.attori.operations!, {
    progettoId: progetto.id,
    nomeFile: "manoscritto.docx",
    mimeType: MIME_DOCX,
    contenuto,
  });

  const job = await creaJob(scenario.attori.operations!, {
    progettoId: progetto.id,
    fileVersionOrigineId: versione.id,
    livelloServizio: opzioni.livello ?? "correzione-bozze",
  });

  const db = await preparaDatabase();
  await db
    .update(schema.editorialJobs)
    .set({ stato: "running" })
    .where(eq(schema.editorialJobs.id, job.id));

  return { progettoId: progetto.id, versioneId: versione.id, jobId: job.id };
}

describe("caricamento e versioni", () => {
  it("carica un originale e ne calcola l'hash", async () => {
    const cliente = await creaCliente({
      nome: "C",
      email: "c1@x.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-900",
      titolo: "X",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });
    const contenuto = await readFile(path.join(CORPUS, "semplice.docx"));

    const versione = await caricaVersione(scenario.attori.operations!, {
      progettoId: progetto.id,
      nomeFile: "manoscritto.docx",
      mimeType: MIME_DOCX,
      contenuto,
    });

    expect(versione.numeroVersione).toBe(1);
    expect(versione.ruolo).toBe("originale");
    expect(versione.hashBreve).toHaveLength(12);
    expect(versione.dimensioneByte).toBe(contenuto.byteLength);
  });

  it("rifiuta un secondo originale sullo stesso file", async () => {
    // L'originale non si sostituisce: si carica un file nuovo.
    const cliente = await creaCliente({
      nome: "C",
      email: "c2@x.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-901",
      titolo: "X",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });
    const contenuto = await readFile(path.join(CORPUS, "semplice.docx"));

    const prima = await caricaVersione(scenario.attori.operations!, {
      progettoId: progetto.id,
      nomeFile: "m.docx",
      mimeType: MIME_DOCX,
      contenuto,
      ruolo: "originale",
    });

    await expect(
      caricaVersione(scenario.attori.operations!, {
        progettoId: progetto.id,
        nomeFile: "m.docx",
        mimeType: MIME_DOCX,
        contenuto,
        fileId: prima.fileId,
        ruolo: "originale",
      }),
    ).rejects.toThrow(/ha già un originale/);
  });

  it("rifiuta un file con contenuto che non corrisponde al tipo dichiarato", async () => {
    const cliente = await creaCliente({
      nome: "C",
      email: "c3@x.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-902",
      titolo: "X",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });

    await expect(
      caricaVersione(scenario.attori.operations!, {
        progettoId: progetto.id,
        nomeFile: "finto.docx",
        mimeType: MIME_DOCX,
        contenuto: Buffer.from("\x7fELF questo è un eseguibile"),
      }),
    ).rejects.toThrow(/non corrisponde al formato/);
  });

  it("finance non può leggere i file di un progetto", async () => {
    // Vede il progetto come voce contabile, non i manoscritti.
    const cliente = await creaCliente({
      nome: "C",
      email: "c4@x.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-903",
      titolo: "X",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });
    const { elencaFile } = await import("@/lib/dati/file");
    await expect(elencaFile(scenario.attori.finance!, progetto.id)).rejects.toThrow(NonAutorizzato);
  });
});

describe("motore editoriale", () => {
  it("elabora un Job, salva gli interventi e lo porta in revisione", async () => {
    const { jobId } = await preparaJob();

    const provider = new ProviderFinto(() => ({
      interventi: [
        {
          categoria: "refuso",
          prima: "acuqa",
          dopo: "acqua",
          confidenza: 0.98,
          motivazione: "trasposizione di lettere",
          paragrafo: 2,
          occorrenza: 0,
        },
        {
          categoria: "punteggiatura",
          prima: "tornato , ma",
          dopo: "tornato, ma",
          confidenza: 0.95,
          motivazione: "spazio prima della virgola",
          paragrafo: 3,
          occorrenza: 0,
        },
      ],
    }));
    registraProviderPerTest("anthropic", provider);

    const esito = await elaboraJob(jobId, sistema(scenario.studio));

    expect(provider.chiamate).toBeGreaterThan(0);
    expect(esito.interventiSalvati).toBe(2);

    const dettaglio = await leggiJob(scenario.attori.responsabile!, jobId);
    expect(dettaglio.job.stato).toBe("needs_review");
    expect(dettaglio.interventi).toHaveLength(2);
    expect(dettaglio.job.conteggioParole).toBeGreaterThan(0);
  });

  it("scarta gli interventi fuori dal livello acquistato", async () => {
    // Chi compra una correzione bozze non riceve una riscrittura, e il
    // controllo non è affidato al prompt.
    const { jobId } = await preparaJob({ livello: "correzione-bozze" });

    registraProviderPerTest(
      "anthropic",
      new ProviderFinto(() => ({
        interventi: [
          {
            categoria: "refuso",
            prima: "acuqa",
            dopo: "acqua",
            confidenza: 0.98,
            motivazione: "refuso",
            paragrafo: 2,
          },
          {
            categoria: "stile",
            prima: "La casa era la casa di sempre",
            dopo: "La dimora restava quella di un tempo",
            confidenza: 0.9,
            motivazione: "lessico",
            paragrafo: 2,
          },
        ],
      })),
    );

    const esito = await elaboraJob(jobId, sistema(scenario.studio));
    expect(esito.interventiSalvati).toBe(1);
    expect(esito.interventiScartati).toBe(1);

    const dettaglio = await leggiJob(scenario.attori.responsabile!, jobId);
    expect(dettaglio.interventi.map((i) => i.categoria)).toEqual(["refuso"]);
  });

  it("scarta gli interventi che non si ancorano al testo", async () => {
    // Un frammento inventato dal modello non viene applicato altrove: sparisce.
    const { jobId } = await preparaJob();

    registraProviderPerTest(
      "anthropic",
      new ProviderFinto(() => ({
        interventi: [
          {
            categoria: "refuso",
            prima: "zqxwv",
            dopo: "zqxwj",
            confidenza: 0.99,
            motivazione: "inventato",
            paragrafo: 1,
          },
        ],
      })),
    );

    const esito = await elaboraJob(jobId, sistema(scenario.studio));
    expect(esito.interventiSalvati).toBe(0);
    expect(esito.interventiNonAncorati).toBe(1);
  });

  it("riclassifica come dubbio gli interventi a bassa confidenza", async () => {
    const { jobId } = await preparaJob();

    registraProviderPerTest(
      "anthropic",
      new ProviderFinto(() => ({
        interventi: [
          {
            categoria: "grammatica",
            prima: "acuqa",
            dopo: "acqua",
            confidenza: 0.4,
            motivazione: "non ne sono certo",
            paragrafo: 2,
          },
        ],
      })),
    );

    await elaboraJob(jobId, sistema(scenario.studio));
    const dettaglio = await leggiJob(scenario.attori.responsabile!, jobId);
    expect(dettaglio.interventi[0]!.categoria).toBe("dubbio-da-verificare");
    expect(dettaglio.job.conteggioDaVerificare).toBe(1);
  });

  it("registra la run con provider, modello e motivazioni del routing", async () => {
    const { jobId } = await preparaJob();
    registraProviderPerTest("anthropic", new ProviderFinto(() => ({ interventi: [] })));

    await elaboraJob(jobId, sistema(scenario.studio));

    const dettaglio = await leggiJob(scenario.attori.responsabile!, jobId);
    expect(dettaglio.run).toHaveLength(1);
    expect(dettaglio.run[0]!.provider).toBe("anthropic");
    expect(dettaglio.run[0]!.motivazioniRouting.join(" ")).toMatch(/primaria:/);
    expect(dettaglio.run[0]!.stato).toBe("completata");
  });

  it("il redattore non riceve le run AI", async () => {
    const { jobId } = await preparaJob();
    registraProviderPerTest("anthropic", new ProviderFinto(() => ({ interventi: [] })));
    await elaboraJob(jobId, sistema(scenario.studio));

    const dettaglio = await leggiJob(scenario.attori.redattore!, jobId);
    expect(dettaglio.run).toEqual([]);
    const testo = JSON.stringify(dettaglio);
    expect(testo).not.toContain("anthropic");
    expect(testo).not.toContain("costoMicroCent");
  });

  it("le istruzioni contengono il mandato del livello e quelle del progetto", async () => {
    const { jobId } = await preparaJob({ livello: "correzione-bozze" });
    const provider = new ProviderFinto(() => ({ interventi: [] }));
    registraProviderPerTest("anthropic", provider);

    await elaboraJob(jobId, sistema(scenario.studio));

    expect(provider.ultimeIstruzioni).toContain("MANDATO: correzione bozze");
    expect(provider.ultimeIstruzioni).toContain("Non toccare i dialoghi");
    expect(provider.ultimeIstruzioni).not.toContain('"stile"');
  });

  it("segna il Job come fallito quando il provider non è ritentabile", async () => {
    const { jobId } = await preparaJob();
    registraProviderPerTest(
      "anthropic",
      new ProviderFinto(() => new ErroreProvider("credenziali-mancanti", "chiave assente")),
    );

    await expect(elaboraJob(jobId, sistema(scenario.studio))).rejects.toThrow(ErroreElaborazione);

    const db = await preparaDatabase();
    const [run] = await db.select().from(schema.aiJobRuns).where(eq(schema.aiJobRuns.jobId, jobId));
    expect(run!.stato).toBe("fallita");
    // Il messaggio salvato non contiene il prompt né il testo.
    expect(run!.erroreMessaggio).not.toContain("acuqa");
  });

  it("senza policy privacy in database nessun modello passa", async () => {
    const db = await preparaDatabase();
    await db.delete(schema.providerPolicies);
    const { jobId } = await preparaJob();
    registraProviderPerTest("anthropic", new ProviderFinto(() => ({ interventi: [] })));

    // In sviluppo il motore ripiega sui valori di riferimento, che NON
    // approvano i manoscritti inediti: il Job si ferma, com'è giusto.
    await expect(elaboraJob(jobId, sistema(scenario.studio))).rejects.toThrow(
      /Nessun modello ammesso/,
    );
  });
});

describe("revisione e approvazioni", () => {
  async function jobInRevisione() {
    const { jobId, progettoId } = await preparaJob();
    registraProviderPerTest(
      "anthropic",
      new ProviderFinto(() => ({
        interventi: [
          {
            categoria: "refuso",
            prima: "acuqa",
            dopo: "acqua",
            confidenza: 0.98,
            motivazione: "refuso",
            paragrafo: 2,
          },
        ],
      })),
    );
    await elaboraJob(jobId, sistema(scenario.studio));
    await assegnaJob(scenario.attori.operations!, jobId, scenario.attori.redattore!.userId);
    return { jobId, progettoId };
  }

  it("il redattore decide gli interventi e approva editorialmente", async () => {
    const { jobId } = await jobInRevisione();
    const dettaglio = await leggiJob(scenario.attori.redattore!, jobId);

    const esito = await decidiInterventi(scenario.attori.redattore!, jobId, [
      { interventoId: dettaglio.interventi[0]!.id, decisione: "accepted" },
    ]);
    expect(esito.applicate).toBe(1);

    await cambiaStatoJob(scenario.attori.redattore!, jobId, "editorially_approved");
    const dopo = await leggiJob(scenario.attori.redattore!, jobId);
    expect(dopo.job.stato).toBe("editorially_approved");
  });

  it("il redattore non può consegnare al cliente", async () => {
    // È il vincolo centrale del workflow: approva il contenuto, non lo spedisce.
    const { jobId } = await jobInRevisione();
    await cambiaStatoJob(scenario.attori.redattore!, jobId, "editorially_approved");
    await expect(
      cambiaStatoJob(scenario.attori.redattore!, jobId, "approved"),
    ).rejects.toThrow(NonAutorizzato);
  });

  it("chi approva editorialmente non approva anche la consegna", async () => {
    // Vale sulla persona, non solo sul ruolo: un super_admin che ha approvato
    // il contenuto non può chiudere anche il secondo anello.
    const { jobId } = await jobInRevisione();
    await cambiaStatoJob(scenario.attori.admin!, jobId, "editorially_approved");
    const errore = await cambiaStatoJob(scenario.attori.admin!, jobId, "approved").catch((e) => e);
    expect(errore).toBeInstanceOf(NonAutorizzato);
    // Il messaggio verso l'utente resta generico: il dettaglio va nell'audit.
    expect(errore.message).not.toContain("approvato editorialmente");
    expect(errore.motivoInterno).toMatch(/non può approvare anche la consegna/);
    // Un'altra persona invece sì.
    await expect(
      cambiaStatoJob(scenario.attori.operations!, jobId, "approved"),
    ).resolves.toBeUndefined();
  });

  it("non si consegna saltando le approvazioni", async () => {
    const { jobId } = await jobInRevisione();
    await expect(cambiaStatoJob(scenario.attori.admin!, jobId, "delivered")).rejects.toThrow(
      /Transizione non ammessa/,
    );
  });

  it("un intervento di un altro Job non si decide passando il suo id", async () => {
    const primo = await jobInRevisione();
    const secondo = await jobInRevisione();
    const dettaglioSecondo = await leggiJob(scenario.attori.redattore!, secondo.jobId);

    const esito = await decidiInterventi(scenario.attori.redattore!, primo.jobId, [
      { interventoId: dettaglioSecondo.interventi[0]!.id, decisione: "accepted" },
    ]);
    expect(esito.applicate).toBe(0);

    const ancoraPending = await leggiJob(scenario.attori.redattore!, secondo.jobId);
    expect(ancoraPending.interventi[0]!.stato).toBe("pending");
  });

  it("un Job non può essere assegnato a chi non è membro del progetto", async () => {
    const { jobId } = await preparaJob();
    const errore = await assegnaJob(
      scenario.attori.operations!,
      jobId,
      scenario.attori.finance!.userId,
    ).catch((e) => e);
    expect(errore).toBeInstanceOf(NonAutorizzato);
    expect(errore.motivoInterno).toMatch(/non è membro del progetto/);
  });

  it("un redattore non vede i Job di progetti di cui non fa parte", async () => {
    const cliente = await creaCliente({
      nome: "Altro",
      email: "altro@x.it",
      organizationId: scenario.studio,
    });
    const progetto = await creaProgettoDiretto({
      codice: "P-950",
      titolo: "Altrui",
      organizationId: scenario.studio,
      clientId: cliente.id,
    });
    const contenuto = await readFile(path.join(CORPUS, "semplice.docx"));
    const versione = await caricaVersione(scenario.attori.operations!, {
      progettoId: progetto.id,
      nomeFile: "m.docx",
      mimeType: MIME_DOCX,
      contenuto,
    });
    const job = await creaJob(scenario.attori.operations!, {
      progettoId: progetto.id,
      fileVersionOrigineId: versione.id,
      livelloServizio: "correzione-bozze",
    });

    const errore = await leggiJob(scenario.attori.redattore!, job.id).catch((e) => e);
    expect(errore).toBeInstanceOf(NonTrovato);
    expect(errore.motivoInterno).toMatch(/non visibile/);
  });
});
