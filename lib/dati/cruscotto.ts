/**
 * Numeri del cruscotto operativo.
 *
 * Ogni blocco è calcolato solo se l'attore può vederlo: `finance` non deve
 * ricevere i conteggi dei Job, e `editorial_manager` non deve ricevere il
 * valore della pipeline. Restituire zeri sarebbe peggio che omettere il
 * blocco — un dato falso è più dannoso di un dato assente.
 */
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema/crm";
import { projects, approvals } from "@/db/schema/progetti";
import { editorialJobs } from "@/db/schema/produzione";
import { payments } from "@/db/schema/commercio";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";

export type Cruscotto = {
  commerciale?: {
    leadNuovi7g: number;
    leadCaldi: number;
    callPrenotate: number;
    proposteAperte: number;
    valorePipeline: number;
  };
  produzione?: {
    progettiInCorso: number;
    progettiInRitardo: number;
    jobInRevisione: number;
    jobFalliti: number;
  };
  approvazioni?: { inAttesa: number };
  amministrazione?: {
    pagamentiInAttesa: number;
    incassatoMese: number;
  };
};

export async function cruscotto(attore: Attore): Promise<Cruscotto> {
  const db = getDb();
  const org = attore.organizationId;
  const risultato: Cruscotto = {};

  const settimanaFa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const inizioMese = new Date();
  inizioMese.setDate(1);
  inizioMese.setHours(0, 0, 0, 0);

  if (haPermesso(attore, "crm.vedi_lead")) {
    const filtroLead = sql`(${leads.organizationId} = ${org} or ${leads.organizationId} is null)`;
    const [nuovi, caldi, call, proposte, valore] = await Promise.all([
      db.select({ n: count() }).from(leads).where(and(filtroLead, gte(leads.createdAt, settimanaFa))),
      db.select({ n: count() }).from(leads).where(and(filtroLead, gte(leads.leadScore, 75), inArray(leads.stato, ["nuovo", "qualificato"]))),
      db.select({ n: count() }).from(leads).where(and(filtroLead, eq(leads.stato, "call"))),
      db.select({ n: count() }).from(leads).where(and(filtroLead, eq(leads.stato, "proposta"))),
      db
        .select({ v: sql<number>`coalesce(sum(${leads.valoreStimato}), 0)::int` })
        .from(leads)
        .where(and(filtroLead, inArray(leads.stato, ["qualificato", "call", "proposta"]))),
    ]);

    risultato.commerciale = {
      leadNuovi7g: Number(nuovi[0]?.n ?? 0),
      leadCaldi: Number(caldi[0]?.n ?? 0),
      callPrenotate: Number(call[0]?.n ?? 0),
      proposteAperte: Number(proposte[0]?.n ?? 0),
      valorePipeline: Number(valore[0]?.v ?? 0),
    };
  }

  if (haPermesso(attore, "progetto.vedi_tutti")) {
    // `inArray` vuole un array mutabile: `as const` lo renderebbe readonly.
    const attivi: (typeof projects.$inferSelect)["stato"][] = [
      "avvio",
      "in_corso",
      "in_attesa_cliente",
      "in_revisione",
      "in_consegna",
    ];
    const [inCorso, inRitardo] = await Promise.all([
      db
        .select({ n: count() })
        .from(projects)
        .where(and(eq(projects.organizationId, org), inArray(projects.stato, attivi))),
      db
        .select({ n: count() })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, org),
            inArray(projects.stato, attivi),
            sql`${projects.scadenzaAt} < now()`,
          ),
        ),
    ]);

    let jobInRevisione = 0;
    let jobFalliti = 0;
    if (haPermesso(attore, "job.vedi_tutti")) {
      const [revisione, falliti] = await Promise.all([
        db
          .select({ n: count() })
          .from(editorialJobs)
          .where(and(eq(editorialJobs.organizationId, org), eq(editorialJobs.stato, "needs_review"))),
        db
          .select({ n: count() })
          .from(editorialJobs)
          .where(and(eq(editorialJobs.organizationId, org), eq(editorialJobs.stato, "failed"))),
      ]);
      jobInRevisione = Number(revisione[0]?.n ?? 0);
      jobFalliti = Number(falliti[0]?.n ?? 0);
    }

    risultato.produzione = {
      progettiInCorso: Number(inCorso[0]?.n ?? 0),
      progettiInRitardo: Number(inRitardo[0]?.n ?? 0),
      jobInRevisione,
      jobFalliti,
    };
  }

  const [approvazioni] = await db
    .select({ n: count() })
    .from(approvals)
    .innerJoin(projects, eq(projects.id, approvals.projectId))
    .where(and(eq(projects.organizationId, org), eq(approvals.stato, "richiesta")));
  risultato.approvazioni = { inAttesa: Number(approvazioni?.n ?? 0) };

  if (haPermesso(attore, "pagamento.vedi")) {
    const [inAttesa, incassato] = await Promise.all([
      db
        .select({ n: count() })
        .from(payments)
        .where(and(eq(payments.organizationId, org), eq(payments.stato, "in_attesa"))),
      db
        .select({ v: sql<number>`coalesce(sum(${payments.importoCent}), 0)::bigint` })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, org),
            eq(payments.stato, "pagato"),
            gte(payments.pagatoAt, inizioMese),
          ),
        ),
    ]);
    risultato.amministrazione = {
      pagamentiInAttesa: Number(inAttesa[0]?.n ?? 0),
      incassatoMese: Number(incassato[0]?.v ?? 0),
    };
  }

  return risultato;
}

/** Job assegnati al redattore, per la sua schermata di lavoro. */
export async function jobAssegnati(attore: Attore) {
  const db = getDb();
  return db
    .select({
      id: editorialJobs.id,
      codice: editorialJobs.codice,
      progettoCodice: projects.codice,
      livelloServizio: editorialJobs.livelloServizio,
      stato: editorialJobs.stato,
      conteggioParole: editorialJobs.conteggioParole,
      conteggioInterventi: editorialJobs.conteggioInterventi,
      conteggioDaVerificare: editorialJobs.conteggioDaVerificare,
      scadenzaAt: editorialJobs.scadenzaAt,
      prioritaria: editorialJobs.prioritaria,
    })
    .from(editorialJobs)
    .innerJoin(projects, eq(projects.id, editorialJobs.projectId))
    .where(
      and(
        eq(editorialJobs.organizationId, attore.organizationId),
        eq(editorialJobs.assegnatoAId, attore.userId),
        inArray(editorialJobs.stato, ["needs_review", "needs_input", "running", "queued"]),
      ),
    )
    .orderBy(sql`${editorialJobs.prioritaria} desc`, editorialJobs.scadenzaAt)
    .limit(100);
}
