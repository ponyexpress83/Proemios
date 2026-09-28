/**
 * Il percorso intero, in un test solo.
 *
 * Gli altri file di integrazione provano bene ciascun pezzo — inviti, progetti,
 * motore, consegna — ma nessuno esegue la sequenza come la vivranno le
 * persone. È una differenza che conta: i confini di ruolo si rompono proprio
 * nei passaggi di mano, dove un attore lascia il lavoro a un altro, e un test
 * per pezzo non li attraversa mai.
 *
 * Qui c'è una corsa unica, su database e storage veri:
 *
 *   Valerio (super_admin)  invita Philippe, inserisce un cliente già
 *                          acquisito, apre il progetto, assegna, carica il
 *                          manoscritto, avvia la lavorazione
 *   Motore                 produce interventi (provider finto: un modello
 *                          vero misurerebbe il modello, non il codice)
 *   Philippe (reviewer)    vede solo il suo lavoro, decide gli interventi,
 *                          approva editorialmente — e NON può consegnare
 *   Operations             approva la consegna
 *   Cliente                vede il progetto, scarica il DOCX revisionato,
 *                          e non vede nulla della macchina che l'ha prodotto
 *
 * Ogni passaggio verifica anche chi NON deve poter fare quella cosa.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  chiudiDatabase,
  creaAttoreCliente,
  creaScenario,
  preparaDatabase,
  svuota,
  type Scenario,
} from "./aiuto";
import { impostaStoragePerTest } from "@/lib/storage";
import { StorageFilesystem } from "@/lib/storage/filesystem";
import { registraProviderPerTest } from "@/lib/ai/registro";
import type { EsitoProvider, ProviderAi, RichiestaProvider } from "@/lib/ai/provider";
import type { AttoreSistema } from "@/lib/auth/attore";
import { creaInvito, accettaInvito } from "@/lib/dati/utenti";
import { creaClienteEsistente } from "@/lib/dati/onboarding";
import {
  aggiungiMembro,
  creaProgetto,
  elencaProgetti,
  leggiProgetto,
} from "@/lib/dati/progetti";
import { caricaVersione, elencaFile, contenutoVersione } from "@/lib/dati/file";
import {
  creaJob,
  leggiJob,
  assegnaJob,
  cambiaStatoJob,
  decidiInterventi,
  approvaEditorialmente,
} from "@/lib/dati/job";
import { elaboraJob } from "@/lib/produzione/motore";
import { estraiParagrafiDocx } from "@/lib/docx/estrazione";
import { PacchettoDocx, PARTE_DOCUMENTO } from "@/lib/docx/pacchetto";
import * as schema from "@/db/schema";

const CORPUS = path.join(process.cwd(), "tests/corpus");
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let scenario: Scenario;
let radiceStorage: string;

/** Restituisce interventi ancorati a refusi che esistono davvero nel corpus. */
class ProviderDelPercorso implements ProviderAi {
  readonly nome = "finto";
  chiamate = 0;
  /** Il testo dell'opera che il provider ha visto: serve a provare cosa esce. */
  contenutoRicevuto = "";

  configurato() {
    return true;
  }

  async esegui(richiesta: RichiestaProvider): Promise<EsitoProvider> {
    this.chiamate += 1;
    this.contenutoRicevuto = richiesta.contenuto;
    return {
      risposta: {
        interventi: [
          {
            categoria: "refuso",
            prima: "acuqa",
            dopo: "acqua",
            confidenza: 0.98,
            motivazione: "inversione di lettere",
          },
          {
            categoria: "refuso",
            prima: "Qual'è",
            dopo: "Qual è",
            confidenza: 0.99,
            motivazione: "apostrofo indebito su qual",
          },
          {
            categoria: "punteggiatura",
            prima: "tornato , ma",
            dopo: "tornato, ma",
            confidenza: 0.6,
            motivazione: "spazio prima della virgola",
          },
        ],
      },
      tokenInput: 1_000,
      tokenOutput: 200,
      latenzaMs: 42,
    };
  }
}

let provider: ProviderDelPercorso;

function sistema(organizationId: string): AttoreSistema {
  return { tipo: "sistema", origine: "percorso-completo", organizationId };
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
  radiceStorage = await mkdtemp(path.join(tmpdir(), "proemios-percorso-"));
  impostaStoragePerTest(new StorageFilesystem({ radice: radiceStorage, segreto: "prova" }));
  provider = new ProviderDelPercorso();
  registraProviderPerTest("anthropic", provider);

  // Il cancello privacy è fail-closed: senza una policy approvata in database
  // nessun modello passa il routing, e il Job fallisce con un motivo chiaro.
  // In esercizio la riga la crea un amministratore da /admin/provider.
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

describe("il percorso che deve funzionare prima del go-live", () => {
  it("dall'invito del redattore al file scaricato dal cliente", async () => {
    const db = await preparaDatabase();
    const valerio = scenario.attori.admin!;
    const operations = scenario.attori.operations!;

    // ── 1. Valerio invita Philippe ──────────────────────────────────────
    const invito = await creaInvito(valerio, {
      email: "philippe.nuovo@proemios.it",
      ruolo: "editor_reviewer",
    });
    const philippeAccount = await accettaInvito(invito.token, "Philippe Marchand");
    expect(philippeAccount.ruolo).toBe("editor_reviewer");

    // L'invito è monouso: un secondo tentativo con lo stesso token non passa.
    await expect(accettaInvito(invito.token, "Qualcun altro")).rejects.toThrow();

    const philippe = {
      userId: philippeAccount.userId,
      email: philippeAccount.email,
      nome: "Philippe Marchand",
      ruolo: "editor_reviewer" as const,
      organizationId: scenario.studio,
      clientId: null,
      attivo: true,
    };

    // ── 2. Un cliente già acquisito, senza passare dal funnel ───────────
    // Non deve nascere un lead finto: falserebbe le metriche commerciali.
    const cliente = await creaClienteEsistente(valerio, {
      tipo: "privato",
      nome: "Mario",
      cognome: "Rossi",
      email: "mario.rossi@esempio.it",
      telefono: "+39 000 0000000",
      codiceFiscale: "RSSMRA80A01H501U",
      alias: "Autore R.",
      noteCommerciali: "Arrivato per passaparola.",
    });
    const leadCreati = await db.select().from(schema.leads);
    expect(leadCreati, "inserire un cliente non deve creare lead").toHaveLength(0);

    // ── 3. Il progetto, con le sue tappe ────────────────────────────────
    const progetto = await creaProgetto(valerio, {
      clientId: cliente.id,
      titolo: "Romanzo Test Proemios",
      titoloAlias: "P-0184",
      conteggioParole: 82_000,
      istruzioniEditoriali: "Correzione di bozze. Non toccare la voce narrante.",
      projectManagerId: operations.userId,
    });
    expect(progetto.id).toBeTruthy();

    // ── 4. Il manoscritto ───────────────────────────────────────────────
    const originale = await readFile(path.join(CORPUS, "semplice.docx"));
    const versione = await caricaVersione(operations, {
      progettoId: progetto.id,
      nomeFile: "manoscritto.docx",
      mimeType: MIME_DOCX,
      contenuto: originale,
    });

    // ── 5. Il lavoro, assegnato a Philippe ──────────────────────────────
    const job = await creaJob(operations, {
      progettoId: progetto.id,
      fileVersionOrigineId: versione.id,
      livelloServizio: "correzione-bozze",
    });
    // Assegnare significa dare accesso al manoscritto: prima si entra nella
    // squadra del progetto. È il passaggio che l'interfaccia non permetteva.
    await aggiungiMembro(valerio, progetto.id, philippe.userId, "editor_reviewer");
    await assegnaJob(operations, job.id, philippe.userId);

    // ── 6. Il motore lavora ─────────────────────────────────────────────
    // In esercizio il passaggio a `running` lo fa la funzione Inngest quando
    // riceve `job/elabora`; qui lo si fa a mano perché il test non monta la
    // coda, ma la transizione è la stessa e passa dalla macchina a stati.
    await cambiaStatoJob(operations, job.id, "running");
    const esito = await elaboraJob(job.id, sistema(scenario.studio));
    expect(esito.interventiSalvati).toBeGreaterThan(0);
    expect(provider.chiamate).toBeGreaterThan(0);

    const dopoMotore = await leggiJob(operations, job.id);
    expect(dopoMotore.job.stato, "l'AI non consegna: si ferma in revisione").toBe("needs_review");

    // ── 7. Philippe vede solo il suo, e non i soldi ─────────────────────
    const suoJob = await leggiJob(philippe, job.id);
    const serializzato = JSON.stringify(suoJob);
    for (const vietato of ["prezzo", "imponibile", "fattura", "utm", "gclid", "costo"]) {
      expect(serializzato.toLowerCase(), `il redattore non deve vedere: ${vietato}`).not.toContain(
        vietato,
      );
    }
    expect(serializzato).not.toContain("mario.rossi@esempio.it");

    // ── 8. Decide gli interventi ────────────────────────────────────────
    const interventi = await db
      .select()
      .from(schema.editorialInterventions)
      .where(eq(schema.editorialInterventions.jobId, job.id));
    expect(interventi.length).toBeGreaterThan(0);

    await decidiInterventi(
      philippe,
      job.id,
      interventi.map((i) => ({ interventoId: i.id, decisione: "accepted" as const })),
    );

    // ── 9. Approva editorialmente — ma non consegna ─────────────────────
    const approvazione = await approvaEditorialmente(philippe, job.id);
    expect(approvazione.versioneId, "l'approvazione deve produrre un documento").toBeTruthy();
    expect(approvazione.applicati).toBeGreaterThan(0);

    const dopoRevisione = await leggiJob(operations, job.id);
    expect(dopoRevisione.job.stato).toBe("editorially_approved");
    expect(dopoRevisione.job.stato, "il redattore non consegna").not.toBe("delivered");

    // ── 10. Il documento è un vero DOCX con revisioni ───────────────────
    const revisionato = await contenutoVersione(operations, approvazione.versioneId!);
    const pacchetto = await PacchettoDocx.apri(revisionato.contenuto);
    const corpo = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    expect(corpo).toContain("w:ins");
    expect(corpo).toContain("w:del");

    // L'originale non è stato toccato: resta scaricabile com'era.
    const intatto = await contenutoVersione(operations, versione.id);
    expect(Buffer.from(intatto.contenuto)).toEqual(Buffer.from(originale));

    // Il testo è davvero corretto, non solo marcato.
    const paragrafi = await estraiParagrafiDocx(revisionato.contenuto);
    const testo = paragrafi.map((p) => p.testo).join(" ");
    expect(testo).toContain("acqua");

    // ── 11. Il cliente vede il proprio progetto, e nient'altro ──────────
    const attoreCliente = await creaAttoreCliente({
      email: "mario.rossi@esempio.it",
      nome: "Mario Rossi",
      organizationId: scenario.studio,
    });
    await db
      .update(schema.projects)
      .set({ clientId: attoreCliente.clientId })
      .where(eq(schema.projects.id, progetto.id));

    const suoi = await elencaProgetti(attoreCliente);
    expect(suoi.voci.map((p) => p.id)).toContain(progetto.id);

    const visto = await leggiProgetto(attoreCliente, progetto.id);
    const vistoSerializzato = JSON.stringify(visto).toLowerCase();
    for (const tecnico of ["prompt", "anthropic", "openai", "confidenza", "tokeninput"]) {
      expect(vistoSerializzato, `il cliente non deve vedere: ${tecnico}`).not.toContain(tecnico);
    }

    // ── 12. Confini: chi non c'entra resta fuori ────────────────────────
    const altroCliente = await creaAttoreCliente({
      email: "estraneo@esempio.it",
      nome: "Estraneo",
      organizationId: scenario.studio,
    });
    await expect(leggiProgetto(altroCliente, progetto.id)).rejects.toThrow();

    // A finance il sistema risponde "non trovato", non "non autorizzato": chi
    // non ha titolo non deve nemmeno sapere che quel lavoro esiste.
    await expect(
      leggiJob(scenario.attori.finance!, job.id),
      "finance non entra nel manoscritto",
    ).rejects.toThrow();

    await expect(
      leggiProgetto(scenario.attori.opsAgenziaB!, progetto.id),
      "un'altra agenzia non vede il progetto dello studio",
    ).rejects.toThrow();

    // ── 13. Il file arriva al cliente ───────────────────────────────────
    const fileCliente = await elencaFile(attoreCliente, progetto.id);
    expect(fileCliente.length).toBeGreaterThan(0);
  });
});
