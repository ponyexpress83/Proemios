/**
 * Il motore editoriale.
 *
 * Prende un Job, legge la versione di partenza, la segmenta, sceglie il
 * modello, esegue le run, filtra gli interventi secondo il livello acquistato,
 * li ancora al testo e li salva.
 *
 * Quello che **non** fa, di proposito: consegnare. Il motore porta il Job fino
 * a `needs_review` e si ferma. Da lì in poi decidono le persone.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { aiJobRuns, editorialInterventions, editorialJobs } from "@/db/schema/produzione";
import { fileVersions } from "@/db/schema/file";
import { projects } from "@/db/schema/progetti";
import { MODELLI, POLICY_RIFERIMENTO, type PolicyPrivacy } from "@/config/modelli";
import { providerPolicies } from "@/db/schema/sistema";
import { NessunModelloAmmesso, scegliModello } from "@/lib/ai/router";
import { providerPer } from "@/lib/ai/registro";
import { ErroreProvider } from "@/lib/ai/provider";
import {
  applicaLimiti,
  riclassificaDubbi,
  type InterventoGrezzo,
  type LivelloServizio,
} from "@/lib/ai/livelli";
import { istruzioniSistema } from "./prompt";
import { componiTesto, contaParole, segmenta, stimaToken } from "./segmentazione";
import { ancora } from "./ancoraggio";
import { storage } from "@/lib/storage";
import { estraiParagrafi } from "./estrazione";
import { registra } from "@/lib/audit";
import type { AttoreSistema } from "@/lib/auth/attore";

export type EsitoElaborazione = {
  jobId: string;
  interventiSalvati: number;
  interventiScartati: number;
  interventiNonAncorati: number;
  dubbi: number;
  runEseguite: number;
};

/**
 * Carica le policy privacy dal database, con i valori di riferimento come
 * ripiego solo in sviluppo. In produzione l'assenza di una riga in
 * `provider_policies` significa provider non approvato, e il router lo esclude:
 * è il comportamento voluto, non un difetto da compensare.
 */
async function policyEffettive(): Promise<PolicyPrivacy[]> {
  const db = getDb();
  const righe = await db.select().from(providerPolicies);

  if (righe.length === 0) {
    if (process.env.NODE_ENV === "production") {
      // Nessuna policy registrata: nessun modello passerà il routing, e il Job
      // fallirà con un motivo chiaro. È giusto così — meglio un Job fermo che
      // un manoscritto mandato a un fornitore mai verificato.
      return [];
    }
    return POLICY_RIFERIMENTO;
  }

  return righe.map((r) => ({
    provider: r.provider as PolicyPrivacy["provider"],
    addestramentoConsentito: r.addestramentoConsentito,
    zeroDataRetention: r.zeroDataRetention,
    giorniConservazione: r.giorniConservazione ? Number(r.giorniConservazione) : null,
    dpaDisponibile: r.dpaDisponibile,
    regioneDati: r.regioneDati ?? "",
    subresponsabili: r.subresponsabili ?? [],
    approvatoManoscrittiInediti: r.approvatoManoscrittiInediti,
    approvatoProgettiSensibili: r.approvatoProgettiSensibili,
    note: r.note ?? "",
  }));
}

export class ErroreElaborazione extends Error {
  readonly ritentabile: boolean;
  constructor(messaggio: string, ritentabile = false) {
    super(messaggio);
    this.name = "ErroreElaborazione";
    this.ritentabile = ritentabile;
  }
}

/**
 * Elabora un Job.
 *
 * Firmata con un `AttoreSistema`: è il worker che lavora, non una persona.
 * L'audit lo registra come tale, così un'azione automatica non sembra mai
 * un'azione umana.
 */
export async function elaboraJob(
  jobId: string,
  attore: AttoreSistema,
  opzioni: { onProgresso?: (fatti: number, totali: number) => Promise<void> } = {},
): Promise<EsitoElaborazione> {
  const db = getDb();

  const [job] = await db.select().from(editorialJobs).where(eq(editorialJobs.id, jobId)).limit(1);
  if (!job) throw new ErroreElaborazione(`Job ${jobId} inesistente.`);
  if (job.stato !== "running") {
    throw new ErroreElaborazione(`Job ${jobId} in stato ${job.stato}, atteso "running".`);
  }
  if (!job.fileVersionOrigineId) {
    throw new ErroreElaborazione(`Job ${jobId} senza versione di partenza.`);
  }

  const [versione] = await db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.id, job.fileVersionOrigineId))
    .limit(1);
  if (!versione) throw new ErroreElaborazione("Versione di partenza inesistente.");

  const [progetto] = await db
    .select({ istruzioni: projects.istruzioniEditoriali, percorso: projects.percorsoSlug })
    .from(projects)
    .where(eq(projects.id, job.projectId))
    .limit(1);

  // ── Estrazione e segmentazione ──
  const contenuto = await storage().leggi(versione.chiaveStorage);
  const paragrafi = await estraiParagrafi(contenuto, versione.mimeType);
  if (paragrafi.length === 0) {
    throw new ErroreElaborazione("Il file non contiene testo leggibile.");
  }

  const parole = contaParole(paragrafi);
  const segmenti = segmenta(paragrafi);

  // ── Scelta del modello ──
  const livello = job.livelloServizio as LivelloServizio;
  const policy = await policyEffettive();

  let decisione;
  try {
    decisione = scegliModello(
      {
        livelloServizio: livello,
        modalitaRevisione: job.modalitaRevisione as "controllato" | "premium",
        manoscrittoInedito: true,
        // I memoir e le storie familiari contengono dati su persone reali che
        // non hanno acconsentito a nulla: meritano il vaglio più stretto.
        progettoSensibile: progetto?.percorso === "memoir-e-storia-familiare",
        capacitaRichieste: [],
        tokenStimati: stimaToken(paragrafi.map((p) => p.testo).join(" ")),
      },
      MODELLI,
      policy,
    );
  } catch (errore) {
    if (errore instanceof NessunModelloAmmesso) {
      throw new ErroreElaborazione(
        `Nessun modello ammesso: ${errore.motivi.slice(0, 3).join("; ")}`,
      );
    }
    throw errore;
  }

  const istruzioni = istruzioniSistema({
    livello,
    istruzioniProgetto: progetto?.istruzioni ?? null,
  });

  // ── Esecuzione ──
  const [run] = await db
    .insert(aiJobRuns)
    .values({
      jobId,
      organizationId: job.organizationId,
      ruolo: "primaria",
      stato: "in_corso",
      provider: decisione.primaria.provider,
      modello: decisione.primaria.modello,
      versionePrompt: `${livello}-v1`,
      motivazioniRouting: decisione.motivazioni,
    })
    .returning();

  const provider = providerPer(decisione.primaria.provider);
  const grezzi: (InterventoGrezzo & { paragrafo?: number; occorrenza?: number })[] = [];
  let tokenInput = 0;
  let tokenOutput = 0;
  let latenza = 0;

  try {
    for (const [i, segmento] of segmenti.entries()) {
      const esito = await provider.esegui({
        modello: decisione.primaria,
        istruzioniSistema: istruzioni,
        contenuto: componiTesto(segmento),
        massimoToken: 8_000,
      });

      tokenInput += esito.tokenInput;
      tokenOutput += esito.tokenOutput;
      latenza += esito.latenzaMs;

      for (const int of esito.risposta.interventi) {
        grezzi.push({
          categoria: int.categoria,
          prima: int.prima,
          dopo: int.dopo,
          confidenza: int.confidenza,
          motivazioneInterna: int.motivazione,
          paragrafo: int.paragrafo,
          occorrenza: int.occorrenza,
        });
      }

      await opzioni.onProgresso?.(i + 1, segmenti.length);
    }
  } catch (errore) {
    await db
      .update(aiJobRuns)
      .set({
        stato: "fallita",
        // Il messaggio del provider è già sanitizzato dall'adapter: non
        // contiene il prompt né il testo.
        erroreMessaggio:
          errore instanceof Error ? errore.message.slice(0, 500) : "errore sconosciuto",
        conclusaAt: new Date(),
      })
      .where(eq(aiJobRuns.id, run!.id));

    const ritentabile = errore instanceof ErroreProvider && errore.ritentabile;
    throw new ErroreElaborazione(
      errore instanceof Error ? errore.message : "Elaborazione fallita.",
      ritentabile,
    );
  }

  // ── Filtri: livello, poi ancoraggio ──
  const conDubbi = riclassificaDubbi(grezzi);
  const { ammessi, scartati } = applicaLimiti(livello, conDubbi);

  const daSalvare: {
    categoria: string;
    prima: string;
    dopo: string;
    confidenza: number;
    motivazione: string;
    ancora: Record<string, unknown>;
  }[] = [];
  let nonAncorati = 0;

  for (const int of ammessi) {
    const grezzo = int as InterventoGrezzo & { paragrafo?: number; occorrenza?: number };
    const esito = ancora(paragrafi, {
      paragrafo: grezzo.paragrafo,
      prima: grezzo.prima,
      occorrenza: grezzo.occorrenza,
    });

    // Un intervento che non si ancora è un intervento su un testo che non
    // esiste: scartarlo è l'unica cosa sicura da fare.
    if (!esito.ok) {
      nonAncorati += 1;
      continue;
    }

    daSalvare.push({
      categoria: grezzo.categoria,
      prima: grezzo.prima,
      dopo: grezzo.dopo,
      confidenza: grezzo.confidenza,
      motivazione: grezzo.motivazioneInterna,
      ancora: {
        paragraphId: esito.ancora.idOoxml,
        indice: esito.ancora.indiceParagrafo,
        start: esito.ancora.inizio,
        end: esito.ancora.fine,
      },
    });
  }

  // ── Salvataggio ──
  const dubbi = daSalvare.filter((i) => i.categoria === "dubbio-da-verificare").length;

  await db.transaction(async (tx) => {
    if (daSalvare.length > 0) {
      // A blocchi: un insert con diecimila valori supera i limiti del protocollo.
      const blocco = 500;
      for (let i = 0; i < daSalvare.length; i += blocco) {
        await tx.insert(editorialInterventions).values(
          daSalvare.slice(i, i + blocco).map((int) => ({
            jobId,
            runId: run!.id,
            organizationId: job.organizationId,
            categoria: int.categoria as "refuso",
            ancora: int.ancora,
            prima: int.prima,
            dopo: int.dopo,
            confidenza: int.confidenza,
            motivazioneInterna: int.motivazione,
          })),
        );
      }
    }

    await tx
      .update(aiJobRuns)
      .set({
        stato: "completata",
        tokenInput,
        tokenOutput,
        latenzaMs: latenza,
        interventiProdotti: daSalvare.length,
        costoMicroCent: Math.round(
          (tokenInput / 1_000) * decisione.primaria.costoInputMicroCent +
            (tokenOutput / 1_000) * decisione.primaria.costoOutputMicroCent,
        ),
        conclusaAt: new Date(),
      })
      .where(eq(aiJobRuns.id, run!.id));

    await tx
      .update(editorialJobs)
      .set({
        stato: "needs_review",
        conteggioParole: parole,
        conteggioInterventi: daSalvare.length,
        conteggioDaVerificare: dubbi,
        updatedAt: new Date(),
      })
      .where(eq(editorialJobs.id, jobId));

    await registra(
      attore,
      {
        azione: "job.stato_cambiato",
        entita: "job",
        entitaId: jobId,
        metadati: {
          da: "running",
          a: "needs_review",
          interventi: daSalvare.length,
          scartatiPerLivello: scartati.length,
          nonAncorati,
          modello: decisione.primaria.id,
        },
      },
      tx,
    );
  });

  return {
    jobId,
    interventiSalvati: daSalvare.length,
    interventiScartati: scartati.length,
    interventiNonAncorati: nonAncorati,
    dubbi,
    runEseguite: 1,
  };
}

/** Segna un Job come fallito, con il motivo sanitizzato. */
export async function segnalaFallimento(
  jobId: string,
  attore: AttoreSistema,
  messaggio: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(editorialJobs)
    .set({ stato: "failed", erroreMessaggio: messaggio.slice(0, 500), updatedAt: new Date() })
    .where(and(eq(editorialJobs.id, jobId), sql`${editorialJobs.stato} <> 'cancelled'`));

  await registra(attore, {
    azione: "job.stato_cambiato",
    entita: "job",
    entitaId: jobId,
    esito: "errore",
    metadati: { a: "failed", messaggio: messaggio.slice(0, 200) },
  });
}
