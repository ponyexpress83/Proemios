"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import {
  approvaEditorialmente,
  cambiaStatoJob,
  decidiInterventi,
  registraRevisione,
} from "@/lib/dati/job";

/**
 * Azioni del banco di revisione.
 *
 * Tutte ricavano l'attore dalla sessione lato server e non accettano mai un
 * identificativo di utente dal client: chi agisce lo decide il cookie, non il
 * corpo della richiesta. Il permesso lo verifica il livello dati, non queste
 * funzioni — qui c'è solo la validazione della forma e la traduzione
 * dell'errore in qualcosa che si possa mostrare.
 */
export type EsitoAzione<T = undefined> =
  ({ ok: true } & (T extends undefined ? object : { dati: T })) | { ok: false; messaggio: string };

async function esegui<T>(percorsi: string[], azione: () => Promise<T>): Promise<EsitoAzione<T>> {
  try {
    const dati = await azione();
    for (const p of percorsi) revalidatePath(p);
    return { ok: true, dati } as EsitoAzione<T>;
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) return { ok: false, messaggio: errore.message };
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Operazione non riuscita.",
    };
  }
}

const schemaDecisioni = z.object({
  jobId: z.string().uuid(),
  decisioni: z
    .array(
      z.object({
        interventoId: z.string().uuid(),
        decisione: z.enum(["accepted", "rejected", "modified"]),
        testoModificato: z.string().max(20_000).optional(),
        commentoPerAutore: z.string().max(2000).optional(),
      }),
    )
    // Un limite alto ma esistente: il banco lavora a blocchi, e una richiesta
    // senza tetto è un modo per far cadere il server con un solo POST.
    .min(1)
    .max(2000),
});

export async function decidi(
  dati: z.input<typeof schemaDecisioni>,
): Promise<EsitoAzione<{ applicate: number }>> {
  const analisi = schemaDecisioni.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Decisioni non valide." };

  return esegui([`/redazione/${analisi.data.jobId}`], async () => {
    const attore = await esigiAttore();
    return decidiInterventi(attore, analisi.data.jobId, analisi.data.decisioni);
  });
}

const schemaApprovazione = z.object({
  jobId: z.string().uuid(),
  noteInterne: z.string().max(4000).optional(),
});

/**
 * Chiude la revisione: registra l'esito, genera il DOCX con le revisioni
 * tracciate e porta il Job in `editorially_approved`.
 *
 * Non consegna niente al cliente. Il documento prodotto resta nel back-office
 * finché qualcun altro — con `progetto.approva_consegna` — non lo approva.
 */
export async function approvaRevisione(
  dati: z.input<typeof schemaApprovazione>,
): Promise<EsitoAzione<{ applicati: number; richiedeVerifica: boolean; nota?: string }>> {
  const analisi = schemaApprovazione.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(
    [`/redazione/${analisi.data.jobId}`, "/redazione", "/admin/approvazioni"],
    async () => {
      const attore = await esigiAttore();
      await registraRevisione(attore, analisi.data.jobId, "approvato", analisi.data.noteInterne);
      const esito = await approvaEditorialmente(attore, analisi.data.jobId);
      return {
        applicati: esito.applicati,
        richiedeVerifica: esito.richiedeVerifica,
        nota: esito.nota,
      };
    },
  );
}

const schemaRinvio = z.object({
  jobId: z.string().uuid(),
  esito: z.enum(["rimandato", "escalation"]),
  noteInterne: z.string().min(1).max(4000),
});

/** Rimanda il Job in lavorazione o lo passa a un responsabile. */
export async function rimandaRevisione(
  dati: z.input<typeof schemaRinvio>,
): Promise<EsitoAzione<undefined>> {
  const analisi = schemaRinvio.safeParse(dati);
  if (!analisi.success) {
    return { ok: false, messaggio: "Serve una nota che spieghi perché il Job torna indietro." };
  }

  return esegui([`/redazione/${analisi.data.jobId}`, "/redazione"], async () => {
    const attore = await esigiAttore();
    await registraRevisione(
      attore,
      analisi.data.jobId,
      analisi.data.esito,
      analisi.data.noteInterne,
    );
    // «Rimandato» rilancia l'elaborazione; «escalation» chiede un chiarimento e
    // lascia il Job fermo, visibile a chi deve deciderlo.
    await cambiaStatoJob(
      attore,
      analisi.data.jobId,
      analisi.data.esito === "rimandato" ? "running" : "needs_input",
    );
    return undefined;
  });
}
