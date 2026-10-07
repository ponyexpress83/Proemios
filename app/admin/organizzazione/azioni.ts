"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import { aggiornaBranding, cambiaAttivazione, creaAgenzia } from "@/lib/dati/organizzazioni";

export type EsitoAzione = { ok: true; messaggio?: string } | { ok: false; messaggio: string };

async function esegui(azione: () => Promise<string | void>): Promise<EsitoAzione> {
  try {
    const messaggio = await azione();
    revalidatePath("/admin/organizzazione");
    return { ok: true, messaggio: messaggio ?? undefined };
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) return { ok: false, messaggio: errore.message };
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Operazione non riuscita.",
    };
  }
}

const schemaBranding = z.object({
  logoUrl: z.string().max(1000).optional(),
  coloreIdentita: z.string().max(20).optional(),
  nomeVisualizzato: z.string().max(200).optional(),
  dominio: z.string().max(300).optional(),
  emailMittente: z.string().max(400).optional(),
  firmaEmail: z.string().max(1000).optional(),
});

/**
 * Salva il branding.
 *
 * Zod controlla solo la forma; la validazione che conta — un colore che sia un
 * colore, un logo in https — è nel livello dati, perché è lì che il valore
 * viene scritto e da lì che finisce in una `<style>`.
 */
export async function salvaBranding(dati: z.input<typeof schemaBranding>): Promise<EsitoAzione> {
  const analisi = schemaBranding.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(async () => {
    const attore = await esigiAttore();
    await aggiornaBranding(attore, analisi.data);
    return "Aspetto aggiornato.";
  });
}

const schemaAgenzia = z.object({
  slug: z.string().min(2).max(64),
  nome: z.string().min(2).max(200),
  proemiosInvisibile: z.boolean().optional(),
});

export async function nuovaAgenzia(dati: z.input<typeof schemaAgenzia>): Promise<EsitoAzione> {
  const analisi = schemaAgenzia.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Nome o slug non validi." };

  return esegui(async () => {
    const attore = await esigiAttore();
    const creata = await creaAgenzia(attore, analisi.data);
    return `Agenzia ${creata.nome} creata. Ora vanno invitate le persone.`;
  });
}

const schemaAttivazione = z.object({
  organizationId: z.string().uuid(),
  attiva: z.boolean(),
});

export async function attivaAgenzia(dati: z.input<typeof schemaAttivazione>): Promise<EsitoAzione> {
  const analisi = schemaAttivazione.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati non validi." };

  return esegui(async () => {
    const attore = await esigiAttore();
    await cambiaAttivazione(attore, analisi.data.organizationId, analisi.data.attiva);
    return analisi.data.attiva ? "Agenzia riattivata." : "Agenzia disattivata.";
  });
}
