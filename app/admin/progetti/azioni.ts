"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { scriviMessaggio, decidiApprovazione, rispondiChiarimento } from "@/lib/dati/comunicazioni";
import {
  aggiungiMembro,
  completaTappa,
  creaProgetto,
  rimuoviMembro,
} from "@/lib/dati/progetti";
import { assegnaJob, cambiaStatoJob, creaJob, leggiJob } from "@/lib/dati/job";
import { accodaElaborazione } from "@/lib/lavori/client";
import { LIVELLI } from "@/lib/ai/livelli";
import { isErroreAutorizzazione } from "@/lib/auth/errori";

export type EsitoAzione = { ok: true } | { ok: false; messaggio: string };
export type EsitoCreaProgetto =
  | { ok: true; progettoId: string; codice: string }
  | { ok: false; messaggio: string; progettoId?: undefined; codice?: undefined };

async function esegui(percorso: string, azione: () => Promise<void>): Promise<EsitoAzione> {
  try {
    await azione();
    revalidatePath(percorso);
    return { ok: true };
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) return { ok: false, messaggio: errore.message };
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Operazione non riuscita.",
    };
  }
}

const schemaNuovoProgetto = z.object({
  clientId: z.string().uuid(),
  titolo: z.string().trim().min(1).max(300),
  titoloAlias: z.string().trim().max(300).optional(),
  conteggioParole: z.coerce.number().int().positive().max(2_000_000).optional(),
  scadenza: z.string().optional(),
  istruzioniEditoriali: z.string().max(20_000).optional(),
});

export async function creaNuovoProgetto(
  _precedente: EsitoCreaProgetto | null,
  formData: FormData,
): Promise<EsitoCreaProgetto> {
  const grezzi = Object.fromEntries(formData.entries());
  const normalizzati = {
    ...grezzi,
    titoloAlias: typeof grezzi.titoloAlias === "string" && grezzi.titoloAlias.trim() ? grezzi.titoloAlias : undefined,
    conteggioParole:
      typeof grezzi.conteggioParole === "string" && grezzi.conteggioParole.trim()
        ? grezzi.conteggioParole
        : undefined,
    scadenza: typeof grezzi.scadenza === "string" && grezzi.scadenza.trim() ? grezzi.scadenza : undefined,
    istruzioniEditoriali:
      typeof grezzi.istruzioniEditoriali === "string" && grezzi.istruzioniEditoriali.trim()
        ? grezzi.istruzioniEditoriali
        : undefined,
  };
  const analisi = schemaNuovoProgetto.safeParse(normalizzati);
  if (!analisi.success) return { ok: false, messaggio: "Controlla cliente e dati del progetto." };

  try {
    const attore = await esigiAttore();
    const scadenzaAt = analisi.data.scadenza
      ? new Date(`${analisi.data.scadenza}T12:00:00`)
      : null;
    if (scadenzaAt && Number.isNaN(scadenzaAt.getTime())) {
      return { ok: false, messaggio: "La data di scadenza non è valida." };
    }
    const progetto = await creaProgetto(attore, {
      clientId: analisi.data.clientId,
      titolo: analisi.data.titolo,
      titoloAlias: analisi.data.titoloAlias ?? null,
      conteggioParole: analisi.data.conteggioParole ?? null,
      scadenzaAt,
      istruzioniEditoriali: analisi.data.istruzioniEditoriali ?? null,
    });
    revalidatePath("/admin/progetti");
    return { ok: true, progettoId: progetto.id, codice: progetto.codice };
  } catch (errore) {
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Creazione progetto non riuscita.",
    };
  }
}

const schemaMessaggio = z.object({
  progettoId: z.string().uuid(),
  corpo: z.string().min(1).max(10_000),
  visibileAlCliente: z.boolean(),
});

export async function inviaMessaggio(dati: z.input<typeof schemaMessaggio>): Promise<EsitoAzione> {
  const analisi = schemaMessaggio.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Messaggio non valido." };

  return esegui(`/admin/progetti/${analisi.data.progettoId}`, async () => {
    const attore = await esigiAttore();
    await scriviMessaggio(
      attore,
      analisi.data.progettoId,
      analisi.data.corpo,
      analisi.data.visibileAlCliente,
    );
  });
}

const schemaApprovazione = z.object({
  approvazioneId: z.string().uuid(),
  decisione: z.enum(["approvata", "respinta"]),
  motivazione: z.string().max(2000).optional(),
});

export async function decidi(dati: z.input<typeof schemaApprovazione>): Promise<EsitoAzione> {
  const analisi = schemaApprovazione.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui("/admin/approvazioni", async () => {
    const attore = await esigiAttore();
    await decidiApprovazione(
      attore,
      analisi.data.approvazioneId,
      analisi.data.decisione,
      analisi.data.motivazione,
    );
  });
}

const schemaTappa = z.object({
  progettoId: z.string().uuid(),
  tappaId: z.string().uuid(),
});

export async function chiudiTappa(dati: z.input<typeof schemaTappa>): Promise<EsitoAzione> {
  const analisi = schemaTappa.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(`/admin/progetti/${analisi.data.progettoId}`, async () => {
    const attore = await esigiAttore();
    await completaTappa(attore, analisi.data.progettoId, analisi.data.tappaId);
  });
}

const schemaRisposta = z.object({
  chiarimentoId: z.string().uuid(),
  risposta: z.string().min(1).max(5000),
  percorso: z.string().max(300),
});

export async function rispondi(dati: z.input<typeof schemaRisposta>): Promise<EsitoAzione> {
  const analisi = schemaRisposta.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Risposta non valida." };

  const percorso = analisi.data.percorso.startsWith("/") ? analisi.data.percorso : "/area";
  return esegui(percorso, async () => {
    const attore = await esigiAttore();
    await rispondiChiarimento(attore, analisi.data.chiarimentoId, analisi.data.risposta);
  });
}

/*
 * Squadra del progetto e assegnazione dei lavori.
 *
 * Esistevano nel livello dati ma nessuna pagina le chiamava, e il risultato
 * era un vicolo cieco: `assegnaJob` rifiuta chi non è membro del progetto —
 * giustamente, perché assegnare un lavoro significa dare accesso al
 * manoscritto — e non c'era modo di rendere qualcuno membro. Un progetto
 * appena creato non poteva quindi essere affidato a nessuno.
 */

const schemaMembro = z.object({
  progettoId: z.string().uuid(),
  userId: z.string().uuid(),
  ruolo: z.enum([
    "super_admin",
    "operations_admin",
    "editorial_manager",
    "editor_reviewer",
    "finance",
  ]),
});

export async function aggiungiAllaSquadra(
  dati: z.input<typeof schemaMembro>,
): Promise<EsitoAzione> {
  const analisi = schemaMembro.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Scegli una persona e un ruolo." };

  return esegui(`/admin/progetti/${analisi.data.progettoId}`, async () => {
    const attore = await esigiAttore();
    await aggiungiMembro(
      attore,
      analisi.data.progettoId,
      analisi.data.userId,
      analisi.data.ruolo,
    );
  });
}

const schemaRimozione = z.object({
  progettoId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function togliDallaSquadra(
  dati: z.input<typeof schemaRimozione>,
): Promise<EsitoAzione> {
  const analisi = schemaRimozione.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(`/admin/progetti/${analisi.data.progettoId}`, async () => {
    const attore = await esigiAttore();
    await rimuoviMembro(attore, analisi.data.progettoId, analisi.data.userId);
  });
}

const schemaAssegnazione = z.object({
  progettoId: z.string().uuid(),
  jobId: z.string().uuid(),
  /** Stringa vuota: togli l'assegnazione invece di darla a qualcuno. */
  userId: z.string().uuid().or(z.literal("")),
});

export async function assegnaLavoro(
  dati: z.input<typeof schemaAssegnazione>,
): Promise<EsitoAzione> {
  const analisi = schemaAssegnazione.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(`/admin/progetti/${analisi.data.progettoId}`, async () => {
    const attore = await esigiAttore();
    await assegnaJob(attore, analisi.data.jobId, analisi.data.userId || null);
  });
}

const schemaAvvio = z.object({
  progettoId: z.string().uuid(),
  fileVersionOrigineId: z.string().uuid(),
  livelloServizio: z.enum(LIVELLI),
  modalitaRevisione: z.enum(["controllato", "premium"]).default("controllato"),
});

/**
 * Crea il Job e lo mette in coda.
 *
 * Le due cose stanno insieme di proposito: un Job creato e mai accodato resta
 * `queued` per sempre, e dall'interfaccia sembra avviato. Se la coda non è
 * configurata lo si dice, invece di lasciare una riga ferma che nessuno
 * saprebbe interpretare.
 */
export async function avviaLavorazione(
  dati: z.input<typeof schemaAvvio>,
): Promise<EsitoAzione> {
  const analisi = schemaAvvio.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Scegli il file e il livello di intervento." };

  return esegui(`/admin/progetti/${analisi.data.progettoId}`, async () => {
    const attore = await esigiAttore();
    const job = await creaJob(attore, {
      progettoId: analisi.data.progettoId,
      fileVersionOrigineId: analisi.data.fileVersionOrigineId,
      livelloServizio: analisi.data.livelloServizio,
      modalitaRevisione: analisi.data.modalitaRevisione,
    });
    const accodato = await accodaElaborazione({
      jobId: job.id,
      organizationId: attore.organizationId,
    });
    if (!accodato) {
      throw new Error(
        "Lavorazione creata ma non avviata: la coda non è configurata " +
          "(INNGEST_EVENT_KEY). Il lavoro resta in attesa e partirà appena la coda è attiva.",
      );
    }
  });
}

const schemaRipresa = z.object({
  progettoId: z.string().uuid(),
  jobId: z.string().uuid(),
});

/**
 * Rimette in coda una lavorazione ferma.
 *
 * Serve in due casi che in esercizio capitano entrambi:
 *  - `failed`, dopo che i ritentativi automatici si sono esauriti e
 *    `onFailure` ha tolto il Job da `running`;
 *  - `queued`, quando l'evento si è perso — la coda era irraggiungibile al
 *    momento dell'avvio, oppure il Job è nato prima che fosse configurata.
 *
 * Senza questo, un lavoro fermo restava fermo per sempre: il cruscotto ne
 * mostrava il numero e non c'era modo di farci niente. Un Job già in
 * lavorazione o già oltre non si tocca — rimetterlo in coda vorrebbe dire
 * elaborarlo due volte.
 */
export async function riprendiLavorazione(
  dati: z.input<typeof schemaRipresa>,
): Promise<EsitoAzione> {
  const analisi = schemaRipresa.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(`/admin/progetti/${analisi.data.progettoId}`, async () => {
    const attore = await esigiAttore();
    const { job } = await leggiJob(attore, analisi.data.jobId);

    if (job.stato === "failed") {
      await cambiaStatoJob(attore, analisi.data.jobId, "queued");
    } else if (job.stato !== "queued") {
      throw new Error(
        `Una lavorazione in stato "${job.stato}" non si rimette in coda: ` +
          "si riprende solo ciò che è fallito o mai partito.",
      );
    }

    const accodato = await accodaElaborazione({
      jobId: analisi.data.jobId,
      organizationId: attore.organizationId,
      // Un valore diverso a ogni ripresa: con la sola chiave del Job,
      // Inngest scarterebbe l'evento come doppione e non succederebbe nulla.
      ripresa: Date.now(),
    });
    if (!accodato) {
      throw new Error(
        "La coda non è configurata (INNGEST_EVENT_KEY): la lavorazione resta in attesa.",
      );
    }
  });
}
