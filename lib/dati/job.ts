/**
 * Job editoriali: creazione, assegnazione, revisione degli interventi,
 * approvazioni.
 *
 * Tutte le transizioni passano dalla macchina a stati di
 * `lib/produzione/stati.ts`: qui non si scrive mai uno stato senza averle
 * chiesto se il passaggio è ammesso.
 */
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiJobRuns,
  editorialInterventions,
  editorialJobs,
  reviews,
} from "@/db/schema/produzione";
import { projects, projectMembers } from "@/db/schema/progetti";
import { fileVersions } from "@/db/schema/file";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";
import {
  PERMESSO_PER_TRANSIZIONE,
  puoEssereConsegnato,
  transizioneAmmessa,
  type StatoJob,
} from "@/lib/produzione/stati";
import {
  interventoPerRedattore,
  jobPerRedattore,
  jobPerResponsabile,
  runDTO,
  type InterventoPerRedattore,
  type JobPerRedattore,
  type RunPerBackOffice,
} from "@/lib/dto/job";
import type { LivelloServizio } from "@/lib/ai/livelli";
import { registra } from "@/lib/audit";
import { progettoAccessibile } from "./comunicazioni";

/**
 * Un Job è accessibile a chi è assegnato o a chi vede tutti i Job del tenant.
 * Il filtro è nella query, come per i progetti.
 */
function condizioneVisibilita(attore: Attore) {
  const tenant = eq(editorialJobs.organizationId, attore.organizationId);
  if (haPermesso(attore, "job.vedi_tutti")) return tenant;
  if (haPermesso(attore, "job.vedi_assegnati")) {
    return and(
      tenant,
      sql`(${editorialJobs.assegnatoAId} = ${attore.userId} or exists (
        select 1 from ${projectMembers}
        where ${projectMembers.projectId} = ${editorialJobs.projectId}
          and ${projectMembers.userId} = ${attore.userId}
          and ${projectMembers.rimossoAt} is null
      ))`,
    );
  }
  // Nessun permesso sui Job: la condizione non seleziona nulla.
  return sql`false`;
}

export type FiltriJob = {
  stato?: StatoJob[];
  soloMiei?: boolean;
  progettoId?: string;
  pagina?: number;
  perPagina?: number;
};

export async function elencaJob(
  attore: Attore,
  filtri: FiltriJob = {},
): Promise<{ voci: JobPerRedattore[]; totale: number }> {
  esigiPermesso(attore, haPermesso(attore, "job.vedi_tutti") ? "job.vedi_tutti" : "job.vedi_assegnati");
  const db = getDb();

  const pagina = Math.max(1, filtri.pagina ?? 1);
  const perPagina = Math.min(100, Math.max(1, filtri.perPagina ?? 25));

  const condizioni = [condizioneVisibilita(attore)];
  if (filtri.stato?.length) condizioni.push(inArray(editorialJobs.stato, filtri.stato));
  if (filtri.soloMiei) condizioni.push(eq(editorialJobs.assegnatoAId, attore.userId));
  if (filtri.progettoId) condizioni.push(eq(editorialJobs.projectId, filtri.progettoId));

  const dove = and(...condizioni);

  const [righe, [conteggio]] = await Promise.all([
    db
      .select({ job: editorialJobs, progettoCodice: projects.codice })
      .from(editorialJobs)
      .innerJoin(projects, eq(projects.id, editorialJobs.projectId))
      .where(dove)
      .orderBy(desc(editorialJobs.prioritaria), editorialJobs.scadenzaAt, desc(editorialJobs.createdAt))
      .limit(perPagina)
      .offset((pagina - 1) * perPagina),
    db.select({ n: count() }).from(editorialJobs).where(dove),
  ]);

  return {
    voci: righe.map((r) => jobPerRedattore(r.job, r.progettoCodice)),
    totale: Number(conteggio?.n ?? 0),
  };
}

export type DettaglioJob = {
  job: JobPerRedattore;
  interventi: InterventoPerRedattore[];
  run: RunPerBackOffice[];
  conteggiPerCategoria: { categoria: string; totale: number; daRivedere: number }[];
};

export async function leggiJob(attore: Attore, jobId: string): Promise<DettaglioJob> {
  const db = getDb();
  const [riga] = await db
    .select({ job: editorialJobs, progettoCodice: projects.codice })
    .from(editorialJobs)
    .innerJoin(projects, eq(projects.id, editorialJobs.projectId))
    .where(and(eq(editorialJobs.id, jobId), condizioneVisibilita(attore)))
    .limit(1);
  if (!riga) throw new NonTrovato(`job ${jobId} inesistente o non visibile a ${attore.userId}`);

  const interventi = await db
    .select()
    .from(editorialInterventions)
    .where(eq(editorialInterventions.jobId, jobId))
    .orderBy(editorialInterventions.createdAt)
    .limit(20_000);

  // Le run sono materiale di back-office: il redattore non le riceve, e la
  // query non parte nemmeno se non ha il permesso.
  const run = haPermesso(attore, "job.vedi_run_ai")
    ? await db.select().from(aiJobRuns).where(eq(aiJobRuns.jobId, jobId)).orderBy(aiJobRuns.iniziataAt)
    : [];

  const perCategoria = new Map<string, { totale: number; daRivedere: number }>();
  for (const i of interventi) {
    const voce = perCategoria.get(i.categoria) ?? { totale: 0, daRivedere: 0 };
    voce.totale += 1;
    if (i.stato === "pending") voce.daRivedere += 1;
    perCategoria.set(i.categoria, voce);
  }

  return {
    job: haPermesso(attore, "job.vedi_run_ai")
      ? jobPerResponsabile(riga.job, riga.progettoCodice)
      : jobPerRedattore(riga.job, riga.progettoCodice),
    interventi: interventi.map(interventoPerRedattore),
    run: run.map((r) => runDTO(attore, r)),
    conteggiPerCategoria: [...perCategoria.entries()].map(([categoria, v]) => ({
      categoria,
      ...v,
    })),
  };
}

/** Codice Job progressivo. */
async function prossimoCodice(): Promise<string> {
  const db = getDb();
  const [riga] = await db.select({ n: count() }).from(editorialJobs);
  return `J-${String(Number(riga?.n ?? 0) + 1).padStart(4, "0")}`;
}

export async function creaJob(
  attore: Attore,
  dati: {
    progettoId: string;
    fileVersionOrigineId: string;
    livelloServizio: LivelloServizio;
    modalitaRevisione?: "controllato" | "premium";
    istruzioni?: string;
    scadenzaAt?: Date;
    prioritaria?: boolean;
  },
): Promise<JobPerRedattore> {
  esigiPermesso(attore, "job.assegna");
  const progetto = await progettoAccessibile(attore, dati.progettoId);

  const db = getDb();
  return db.transaction(async (tx) => {
    const [versione] = await tx
      .select({ id: fileVersions.id })
      .from(fileVersions)
      .where(
        and(
          eq(fileVersions.id, dati.fileVersionOrigineId),
          eq(fileVersions.projectId, dati.progettoId),
        ),
      )
      .limit(1);
    if (!versione) throw new NonTrovato("versione di partenza inesistente o di altro progetto");

    const [job] = await tx
      .insert(editorialJobs)
      .values({
        codice: await prossimoCodice(),
        organizationId: progetto.organizationId,
        projectId: dati.progettoId,
        fileVersionOrigineId: dati.fileVersionOrigineId,
        livelloServizio: dati.livelloServizio,
        modalitaRevisione: dati.modalitaRevisione ?? "controllato",
        stato: "queued",
        istruzioni: dati.istruzioni ?? null,
        scadenzaAt: dati.scadenzaAt ?? null,
        prioritaria: dati.prioritaria ?? false,
      })
      .returning();

    const [codice] = await tx
      .select({ c: projects.codice })
      .from(projects)
      .where(eq(projects.id, dati.progettoId));

    await registra(
      attore,
      {
        azione: "job.creato",
        entita: "job",
        entitaId: job!.id,
        metadati: { progettoId: dati.progettoId, livello: dati.livelloServizio },
      },
      tx,
    );

    return jobPerRedattore(job!, codice?.c ?? "");
  });
}

export async function assegnaJob(
  attore: Attore,
  jobId: string,
  userId: string | null,
): Promise<void> {
  esigiPermesso(attore, "job.assegna");
  const db = getDb();

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(editorialJobs)
      .where(
        and(eq(editorialJobs.id, jobId), eq(editorialJobs.organizationId, attore.organizationId)),
      )
      .limit(1);
    if (!job) throw new NonTrovato(`job ${jobId} inesistente o di altro tenant`);

    // Assegnare un Job significa dare accesso al manoscritto: chi lo riceve
    // dev'essere membro del progetto, non un utente qualsiasi del tenant.
    if (userId) {
      const [membro] = await tx
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, job.projectId),
            eq(projectMembers.userId, userId),
            sql`${projectMembers.rimossoAt} is null`,
          ),
        )
        .limit(1);
      if (!membro) {
        throw new NonAutorizzato(
          "l'assegnatario non è membro del progetto: aggiungilo prima di assegnargli il lavoro",
        );
      }
    }

    await tx
      .update(editorialJobs)
      .set({
        assegnatoAId: userId,
        assegnatoDaId: attore.userId,
        assegnatoAt: userId ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(editorialJobs.id, jobId));

    await registra(
      attore,
      { azione: "job.assegnato", entita: "job", entitaId: jobId, metadati: { userId } },
      tx,
    );
  });
}

/**
 * Cambia stato a un Job.
 *
 * Unico punto in cui `editorial_jobs.stato` viene scritto da un'azione umana:
 * verifica la transizione, verifica il permesso richiesto da quella
 * transizione, registra l'audit.
 */
export async function cambiaStatoJob(
  attore: Attore,
  jobId: string,
  nuovoStato: StatoJob,
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(editorialJobs)
      .where(
        and(eq(editorialJobs.id, jobId), eq(editorialJobs.organizationId, attore.organizationId)),
      )
      .limit(1);
    if (!job) throw new NonTrovato(`job ${jobId} inesistente o di altro tenant`);

    const precedente = job.stato as StatoJob;
    if (!transizioneAmmessa(precedente, nuovoStato)) {
      throw new Error(`Transizione non ammessa: ${precedente} → ${nuovoStato}.`);
    }

    const permesso = PERMESSO_PER_TRANSIZIONE[nuovoStato];
    if (permesso) esigiPermesso(attore, permesso as never);

    // La consegna è l'unico passaggio irreversibile: prima di farla si
    // ricontrolla che entrambe le approvazioni ci siano davvero.
    if (nuovoStato === "delivered") {
      const verifica = puoEssereConsegnato({
        stato: precedente,
        approvatoEditorialmenteAt: job.approvatoEditorialmenteAt,
        approvatoAt: job.approvatoAt,
      });
      if (!verifica.ok) throw new Error(`Consegna non consentita: ${verifica.motivo}`);
    }

    // Chi approva editorialmente non può poi approvare la consegna dello
    // stesso Job: è la separazione fra i due anelli, applicata sulla persona
    // e non solo sul ruolo.
    if (nuovoStato === "approved" && job.approvatoEditorialmenteDaId === attore.userId) {
      throw new NonAutorizzato(
        "chi ha approvato editorialmente non può approvare anche la consegna",
      );
    }

    const adesso = new Date();
    await tx
      .update(editorialJobs)
      .set({
        stato: nuovoStato,
        approvatoEditorialmenteAt:
          nuovoStato === "editorially_approved" ? adesso : job.approvatoEditorialmenteAt,
        approvatoEditorialmenteDaId:
          nuovoStato === "editorially_approved" ? attore.userId : job.approvatoEditorialmenteDaId,
        approvatoAt: nuovoStato === "approved" ? adesso : job.approvatoAt,
        approvatoDaId: nuovoStato === "approved" ? attore.userId : job.approvatoDaId,
        consegnatoAt: nuovoStato === "delivered" ? adesso : job.consegnatoAt,
        updatedAt: adesso,
      })
      .where(eq(editorialJobs.id, jobId));

    const azione =
      nuovoStato === "editorially_approved"
        ? "approvazione.editoriale"
        : nuovoStato === "approved"
          ? "approvazione.operativa"
          : nuovoStato === "delivered"
            ? "consegna.effettuata"
            : "job.stato_cambiato";

    await registra(
      attore,
      { azione, entita: "job", entitaId: jobId, metadati: { da: precedente, a: nuovoStato } },
      tx,
    );
  });
}

export type DecisioneIntervento = {
  interventoId: string;
  decisione: "accepted" | "rejected" | "modified";
  testoModificato?: string;
  commentoPerAutore?: string;
};

/**
 * Applica le decisioni del revisore sugli interventi.
 *
 * In blocco perché un revisore su millequattrocento interventi lavora a
 * gruppi: una richiesta per intervento sarebbe millequattrocento round trip.
 */
export async function decidiInterventi(
  attore: Attore,
  jobId: string,
  decisioni: readonly DecisioneIntervento[],
): Promise<{ applicate: number }> {
  esigiPermesso(attore, "job.rivedi_interventi");
  if (decisioni.some((d) => d.decisione === "modified")) {
    esigiPermesso(attore, "job.modifica_intervento");
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(editorialJobs)
      .where(and(eq(editorialJobs.id, jobId), condizioneVisibilita(attore)))
      .limit(1);
    if (!job) throw new NonTrovato(`job ${jobId} inesistente o non visibile`);
    if (job.stato !== "needs_review" && job.stato !== "needs_input") {
      throw new Error(`Il Job è in stato ${job.stato}: non è in revisione.`);
    }

    const adesso = new Date();
    let applicate = 0;

    for (const d of decisioni) {
      if (d.decisione === "modified" && !d.testoModificato?.trim()) {
        throw new Error("Una modifica richiede il testo sostitutivo.");
      }

      const [riga] = await tx
        .update(editorialInterventions)
        .set({
          stato: d.decisione,
          testoModificato: d.decisione === "modified" ? d.testoModificato! : null,
          commentoPerAutore: d.commentoPerAutore?.slice(0, 2000) ?? null,
          rivistoDaId: attore.userId,
          rivistoAt: adesso,
          updatedAt: adesso,
        })
        // Il vincolo sul jobId impedisce di decidere un intervento di un altro
        // Job passando il suo id.
        .where(
          and(
            eq(editorialInterventions.id, d.interventoId),
            eq(editorialInterventions.jobId, jobId),
          ),
        )
        .returning({ id: editorialInterventions.id });
      if (riga) applicate += 1;
    }

    const [residui] = await tx
      .select({ n: count() })
      .from(editorialInterventions)
      .where(
        and(eq(editorialInterventions.jobId, jobId), eq(editorialInterventions.stato, "pending")),
      );

    await tx
      .update(editorialJobs)
      .set({ conteggioDaVerificare: Number(residui?.n ?? 0), updatedAt: adesso })
      .where(eq(editorialJobs.id, jobId));

    await registra(
      attore,
      {
        azione: "intervento.modificato",
        entita: "job",
        entitaId: jobId,
        metadati: { decisioni: decisioni.length, applicate },
      },
      tx,
    );

    return { applicate };
  });
}

/** Apre o aggiorna la revisione di un Job, per tracciare chi ci ha lavorato. */
export async function registraRevisione(
  attore: Attore,
  jobId: string,
  esito: "approvato" | "rimandato" | "escalation",
  noteInterne?: string,
): Promise<void> {
  esigiPermesso(attore, "job.rivedi_interventi");
  const db = getDb();

  const conteggi = await db
    .select({ stato: editorialInterventions.stato, n: count() })
    .from(editorialInterventions)
    .where(eq(editorialInterventions.jobId, jobId))
    .groupBy(editorialInterventions.stato);

  const per = (s: string) => Number(conteggi.find((c) => c.stato === s)?.n ?? 0);

  await db.insert(reviews).values({
    jobId,
    revisoreId: attore.userId,
    conclusaAt: new Date(),
    interventiAccettati: per("accepted"),
    interventiRifiutati: per("rejected"),
    interventiModificati: per("modified"),
    noteInterne: noteInterne ?? null,
    esito,
  });
}
