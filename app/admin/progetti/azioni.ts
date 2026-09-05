"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { scriviMessaggio, decidiApprovazione, rispondiChiarimento } from "@/lib/dati/comunicazioni";
import { completaTappa } from "@/lib/dati/progetti";
import { isErroreAutorizzazione } from "@/lib/auth/errori";

export type EsitoAzione = { ok: true } | { ok: false; messaggio: string };

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
