/**
 * Dalla revisione al documento consegnabile, su database e storage veri.
 *
 * Qui si prova la parte che un test unitario non può provare: che
 * l'approvazione editoriale produca davvero un file Word nuovo, legato al Job,
 * derivato dall'originale e senza toccarlo — e che i confini di ruolo tengano
 * proprio nel punto in cui il lavoro diventa un artefatto consegnabile.
 */
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
import { caricaVersione, contenutoVersione, elencaFile, urlDownload } from "@/lib/dati/file";
import {
  approvaEditorialmente,
  cambiaStatoJob,
  creaJob,
  decidiInterventi,
  leggiJob,
} from "@/lib/dati/job";
import { PacchettoDocx, PARTE_DOCUMENTO } from "@/lib/docx/pacchetto";
import { accettaTutte, rifiutaTutte, testoParagrafi } from "@/lib/docx/revisioni-simulazione";
import { estraiParagrafiDocx } from "@/lib/docx/estrazione";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import { haPermesso } from "@/lib/auth/attore";
import * as schema from "@/db/schema";

const CORPUS = path.join(process.cwd(), "tests/corpus");
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let scenario: Scenario;
let radiceStorage: string;

beforeAll(async () => {
  await preparaDatabase();
});

afterAll(async () => {
  await chiudiDatabase();
  impostaStoragePerTest(null);
});

beforeEach(async () => {
  await svuota();
  scenario = await creaScenario();
  radiceStorage = await mkdtemp(path.join(tmpdir(), "proemios-consegna-"));
  impostaStoragePerTest(new StorageFilesystem({ radice: radiceStorage, segreto: "prova" }));
});

afterEach(async () => {
  await rm(radiceStorage, { recursive: true, force: true });
});

/**
 * Prepara un Job in revisione con interventi reali, ancorati al testo del
 * documento: le posizioni sono quelle vere, non inventate.
 */
async function preparaJobInRevisione() {
  const cliente = await creaCliente({
    nome: "Cliente",
    email: `c${Math.random()}@x.it`,
    organizationId: scenario.studio,
  });
  const progetto = await creaProgettoDiretto({
    codice: `P-${Math.floor(Math.random() * 9000) + 1000}`,
    titolo: "Manoscritto",
    organizationId: scenario.studio,
    clientId: cliente.id,
    membri: [{ userId: scenario.attori.redattore!.userId, ruolo: "editor_reviewer" }],
  });

  const originale = await readFile(path.join(CORPUS, "semplice.docx"));
  const versione = await caricaVersione(scenario.attori.operations!, {
    progettoId: progetto.id,
    nomeFile: "manoscritto.docx",
    mimeType: MIME_DOCX,
    contenuto: originale,
  });

  const job = await creaJob(scenario.attori.operations!, {
    progettoId: progetto.id,
    fileVersionOrigineId: versione.id,
    livelloServizio: "correzione-bozze",
  });

  const paragrafi = await estraiParagrafiDocx(originale);
  const db = await preparaDatabase();

  /** Costruisce un intervento ancorato a un frammento reale del documento. */
  function ancoraA(frammento: string, dopo: string, categoria: "refuso" | "punteggiatura") {
    const indice = paragrafi.findIndex((p) => p.testo.includes(frammento));
    if (indice === -1) throw new Error(`frammento assente dal corpus: ${frammento}`);
    const inizio = paragrafi[indice]!.testo.indexOf(frammento);
    return {
      jobId: job.id,
      organizationId: scenario.studio,
      categoria,
      ancora: { indice, start: inizio, end: inizio + frammento.length },
      prima: frammento,
      dopo,
      confidenza: 0.95,
      motivazioneInterna: `refuso: ${frammento} → ${dopo}`,
    };
  }

  const inseriti = await db
    .insert(schema.editorialInterventions)
    .values([
      ancoraA("acuqa", "acqua", "refuso"),
      ancoraA("tornato , ma", "tornato, ma", "punteggiatura"),
      ancoraA("Qual'è", "Qual è", "refuso"),
    ])
    .returning();

  await db
    .update(schema.editorialJobs)
    .set({ stato: "needs_review", conteggioInterventi: 3, conteggioDaVerificare: 3 })
    .where(eq(schema.editorialJobs.id, job.id));

  return {
    progettoId: progetto.id,
    versioneId: versione.id,
    jobId: job.id,
    originale,
    interventi: inseriti,
    paragrafi,
  };
}

describe("approvazione editoriale e generazione del documento", () => {
  it("produce un DOCX revisionato derivato dall'originale, senza toccarlo", async () => {
    const p = await preparaJobInRevisione();
    const redattore = scenario.attori.redattore!;

    await decidiInterventi(
      redattore,
      p.jobId,
      p.interventi.map((i) => ({ interventoId: i.id, decisione: "accepted" as const })),
    );

    const esito = await approvaEditorialmente(redattore, p.jobId);
    expect(esito.applicati).toBe(3);
    expect(esito.richiedeVerifica).toBe(false);
    expect(esito.versioneId).toBeTruthy();

    // Il Job è approvato editorialmente e porta con sé il documento prodotto.
    const dettaglio = await leggiJob(scenario.attori.responsabile!, p.jobId);
    expect(dettaglio.job.stato).toBe("editorially_approved");
    expect("fileVersionEsitoId" in dettaglio.job ? dettaglio.job.fileVersionEsitoId : null).toBe(
      esito.versioneId,
    );

    // Il documento nuovo è una versione del file, con l'originale come padre.
    const file = await elencaFile(scenario.attori.operations!, p.progettoId);
    const versioni = file.flatMap((f) => f.versioni);
    const revisionata = versioni.find((v) => v.id === esito.versioneId)!;
    expect(revisionata.ruolo).toBe("revisionata");
    expect(revisionata.precedenteId).toBe(p.versioneId);
    expect(revisionata.nomeFile).toContain("revisionato");

    // L'originale è ancora byte per byte quello caricato.
    const rileggiOriginale = await contenutoVersione(scenario.attori.operations!, p.versioneId);
    expect(rileggiOriginale.contenuto.equals(p.originale)).toBe(true);

    // E il documento prodotto contiene revisioni tracciate vere.
    const prodotto = await contenutoVersione(scenario.attori.operations!, esito.versioneId!);
    const pacchetto = await PacchettoDocx.apri(prodotto.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    expect(xml).toContain("<w:ins ");
    expect(xml).toContain("<w:del ");
    expect(xml).toContain('w:author="Philippe"');

    const accettato = testoParagrafi(accettaTutte(xml)).join("\n");
    expect(accettato).toContain("acqua");
    expect(accettato).not.toContain("acuqa");
    // Rifiutando tutto si torna al manoscritto di partenza: nulla è andato perso.
    expect(testoParagrafi(rifiutaTutte(xml))).toEqual(p.paragrafi.map((x) => x.testo));
  });

  it("usa il testo scelto dal revisore, non quello proposto", async () => {
    const p = await preparaJobInRevisione();
    const redattore = scenario.attori.redattore!;
    const primo = p.interventi.find((i) => i.prima === "acuqa")!;

    await decidiInterventi(redattore, p.jobId, [
      { interventoId: primo.id, decisione: "modified", testoModificato: "ACQUA" },
      ...p.interventi
        .filter((i) => i.id !== primo.id)
        .map((i) => ({ interventoId: i.id, decisione: "rejected" as const })),
    ]);

    const esito = await approvaEditorialmente(redattore, p.jobId);
    // Un solo intervento è finito nel documento: gli altri due sono stati rifiutati.
    expect(esito.applicati).toBe(1);

    const prodotto = await contenutoVersione(scenario.attori.operations!, esito.versioneId!);
    const pacchetto = await PacchettoDocx.apri(prodotto.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    const accettato = testoParagrafi(accettaTutte(xml)).join("\n");

    expect(accettato).toContain("ACQUA");
    // Il rifiuto non lascia traccia nel documento: è come se non fosse mai stato proposto.
    expect(accettato).toContain("tornato , ma");
  });

  it("scrive il commento per l'autore dentro il documento", async () => {
    const p = await preparaJobInRevisione();
    const redattore = scenario.attori.redattore!;

    await decidiInterventi(redattore, p.jobId, [
      {
        interventoId: p.interventi[0]!.id,
        decisione: "accepted",
        commentoPerAutore: "Refuso ricorrente: l'ho corretto ovunque.",
      },
      ...p.interventi.slice(1).map((i) => ({ interventoId: i.id, decisione: "accepted" as const })),
    ]);

    const esito = await approvaEditorialmente(redattore, p.jobId);
    const prodotto = await contenutoVersione(scenario.attori.operations!, esito.versioneId!);
    const pacchetto = await PacchettoDocx.apri(prodotto.contenuto);

    expect(pacchetto.ha("word/comments.xml")).toBe(true);
    const commenti = await pacchetto.leggiTesto("word/comments.xml");
    expect(commenti).toContain("Refuso ricorrente");
    // La motivazione interna resta interna: non finisce mai nel file consegnato.
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    expect(xml).not.toContain("refuso: acuqa");
    expect(commenti).not.toContain("refuso: acuqa");
  });

  it("rifiuta di generare il documento con interventi ancora da decidere", async () => {
    const p = await preparaJobInRevisione();
    const redattore = scenario.attori.redattore!;

    await decidiInterventi(redattore, p.jobId, [
      { interventoId: p.interventi[0]!.id, decisione: "accepted" },
    ]);

    await expect(approvaEditorialmente(redattore, p.jobId)).rejects.toThrow(/da decidere/);

    // E il Job resta in revisione: un errore a metà non lo lascia in uno stato
    // dichiarato ma non raggiunto.
    const dettaglio = await leggiJob(redattore, p.jobId);
    expect(dettaglio.job.stato).toBe("needs_review");
  });

  it("segna da verificare il documento in cui un intervento non si è potuto applicare", async () => {
    const p = await preparaJobInRevisione();
    const redattore = scenario.attori.redattore!;
    const db = await preparaDatabase();

    // Un'ancora che punta a un paragrafo che non esiste: capita quando il
    // documento cambia fra l'analisi e l'approvazione.
    await db
      .update(schema.editorialInterventions)
      .set({ ancora: { indice: 9999, start: 0, end: 5 } })
      .where(eq(schema.editorialInterventions.id, p.interventi[0]!.id));

    await decidiInterventi(
      redattore,
      p.jobId,
      p.interventi.map((i) => ({ interventoId: i.id, decisione: "accepted" as const })),
    );

    const esito = await approvaEditorialmente(redattore, p.jobId);
    expect(esito.richiedeVerifica).toBe(true);
    expect(esito.applicati).toBe(2);

    const file = await elencaFile(scenario.attori.operations!, p.progettoId);
    const revisionata = file.flatMap((f) => f.versioni).find((v) => v.id === esito.versioneId)!;
    expect(revisionata.stato).toBe("needs_review");
    expect(revisionata.notaVerifica).toBeTruthy();
  });
});

describe("confini di ruolo attorno alla consegna", () => {
  it("il redattore che ha approvato editorialmente non può approvare la consegna", async () => {
    const p = await preparaJobInRevisione();
    const redattore = scenario.attori.redattore!;

    await decidiInterventi(
      redattore,
      p.jobId,
      p.interventi.map((i) => ({ interventoId: i.id, decisione: "accepted" as const })),
    );
    await approvaEditorialmente(redattore, p.jobId);

    // Manca il permesso: il redattore non approva la consegna di nessun Job.
    await expect(cambiaStatoJob(redattore, p.jobId, "approved")).rejects.toBeInstanceOf(
      NonAutorizzato,
    );
  });

  it("chi approva editorialmente non approva anche la consegna dello stesso Job", async () => {
    const p = await preparaJobInRevisione();
    // Serve un attore che abbia **entrambi** i permessi, altrimenti il rifiuto
    // arriverebbe dal ruolo e non proverebbe nulla sulla separazione fra le due
    // persone. `super_admin` li ha tutti: è il caso peggiore, ed è quello che
    // conta.
    const admin = scenario.attori.admin!;
    expect(haPermesso(admin, "job.approva_editorialmente")).toBe(true);
    expect(haPermesso(admin, "progetto.approva_consegna")).toBe(true);

    await decidiInterventi(
      admin,
      p.jobId,
      p.interventi.map((i) => ({ interventoId: i.id, decisione: "accepted" as const })),
    );
    await approvaEditorialmente(admin, p.jobId);

    // Stesso permesso, stessa persona: il secondo anello non si chiude da solo.
    await expect(cambiaStatoJob(admin, p.jobId, "approved")).rejects.toBeInstanceOf(NonAutorizzato);
    // Un'altra persona con lo stesso permesso invece può.
    await expect(
      cambiaStatoJob(scenario.attori.operations!, p.jobId, "approved"),
    ).resolves.toBeUndefined();
  });

  it("il cliente non può scaricare la versione revisionata prima della consegna", async () => {
    const p = await preparaJobInRevisione();
    const redattore = scenario.attori.redattore!;
    await decidiInterventi(
      redattore,
      p.jobId,
      p.interventi.map((i) => ({ interventoId: i.id, decisione: "accepted" as const })),
    );
    const esito = await approvaEditorialmente(redattore, p.jobId);

    const db = await preparaDatabase();
    const [progetto] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, p.progettoId));
    const [cliente] = await db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, progetto!.clientId!));
    const [utenteCliente] = await db
      .insert(schema.users)
      .values({
        email: `u${Math.random()}@x.it`,
        name: "Autore",
        ruolo: "client",
        organizationId: scenario.studio,
      })
      .returning();
    await db
      .update(schema.clients)
      .set({ userId: utenteCliente!.id })
      .where(eq(schema.clients.id, cliente!.id));

    const attoreCliente = {
      userId: utenteCliente!.id,
      email: utenteCliente!.email,
      nome: "Autore",
      ruolo: "client" as const,
      organizationId: scenario.studio,
      clientId: cliente!.id,
      attivo: true,
    };

    // «Revisionata» è una lavorazione interna: al cliente risulta inesistente,
    // non vietata — distinguere le due cose direbbe quali id esistono.
    await expect(urlDownload(attoreCliente, esito.versioneId!)).rejects.toBeInstanceOf(NonTrovato);
    // L'originale invece è suo e lo scarica.
    await expect(urlDownload(attoreCliente, p.versioneId)).resolves.toHaveProperty("url");
  });

  it("un Job di un altro tenant risulta inesistente, non vietato", async () => {
    const p = await preparaJobInRevisione();
    // `adminAgenziaA` ha il permesso di approvare: se fallisce è per il tenant,
    // non per il ruolo. E fallisce con «non trovato», non con «non
    // autorizzato»: sapere che un id esiste è già un'informazione.
    await expect(
      approvaEditorialmente(scenario.attori.adminAgenziaA!, p.jobId),
    ).rejects.toBeInstanceOf(NonTrovato);
  });
});
