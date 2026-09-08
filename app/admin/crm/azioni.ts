"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiStaff } from "@/lib/auth/sessione";
import {
  aggiungiNotaLead,
  assegnaLead,
  cambiaStatoLead,
  pianificaAttivita,
  STATI_LEAD,
} from "@/lib/dati/lead";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import { registraNegato } from "@/lib/audit";

export type EsitoAzione = { ok: true } | { ok: false; messaggio: string };

/**
 * Le azioni server sono un confine di rete come le route: qui si valida con Zod
 * e si risolve l'attore. Nessuna azione si fida di ciò che arriva dal client,
 * inclusi gli id — il livello dati verifica comunque tenant e permessi.
 *
 * Gli errori di autorizzazione tornano al client con un messaggio generico e
 * finiscono nell'audit con il motivo vero: dire a chi prova «ti manca il
 * permesso crm.assegna_lead» è già informazione sul sistema.
 */
async function esegui(azione: () => Promise<void>): Promise<EsitoAzione> {
  try {
    await azione();
    revalidatePath("/admin/crm");
    return { ok: true };
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) {
      return { ok: false, messaggio: errore.message };
    }
    const messaggio = errore instanceof Error ? errore.message : "Operazione non riuscita.";
    return { ok: false, messaggio };
  }
}

const schemaStato = z.object({
  leadId: z.string().uuid(),
  stato: z.enum(STATI_LEAD),
  motivo: z.string().max(300).optional(),
});

export async function azioneCambiaStato(dati: z.input<typeof schemaStato>): Promise<EsitoAzione> {
  const analisi = schemaStato.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(async () => {
    const attore = await esigiStaff("crm.modifica_lead").catch(async (e) => {
      await registraNegato(null, "lead.stato_cambiato", String(e));
      throw e;
    });
    await cambiaStatoLead(attore, analisi.data.leadId, analisi.data.stato, analisi.data.motivo);
  });
}

const schemaAssegna = z.object({
  leadId: z.string().uuid(),
  ownerId: z.string().uuid().nullable(),
});

export async function azioneAssegna(dati: z.input<typeof schemaAssegna>): Promise<EsitoAzione> {
  const analisi = schemaAssegna.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(async () => {
    const attore = await esigiStaff("crm.assegna_lead");
    await assegnaLead(attore, analisi.data.leadId, analisi.data.ownerId);
  });
}

const schemaNota = z.object({
  leadId: z.string().uuid(),
  nota: z.string().min(1).max(2000),
});

export async function azioneNota(dati: z.input<typeof schemaNota>): Promise<EsitoAzione> {
  const analisi = schemaNota.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "La nota è vuota o troppo lunga." };

  return esegui(async () => {
    const attore = await esigiStaff("crm.modifica_lead");
    await aggiungiNotaLead(attore, analisi.data.leadId, analisi.data.nota);
  });
}

const schemaAttivita = z.object({
  leadId: z.string().uuid(),
  quando: z.string().datetime(),
  cosa: z.string().min(1).max(300),
});

export async function azionePianifica(dati: z.input<typeof schemaAttivita>): Promise<EsitoAzione> {
  const analisi = schemaAttivita.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(async () => {
    const attore = await esigiStaff("crm.modifica_lead");
    await pianificaAttivita(
      attore,
      analisi.data.leadId,
      new Date(analisi.data.quando),
      analisi.data.cosa,
    );
  });
}
