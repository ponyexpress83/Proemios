"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { scriviMessaggio, decidiApprovazione, rispondiChiarimento } from "@/lib/dati/comunicazioni";
import { completaTappa, creaProgetto } from "@/lib/dati/progetti";
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
