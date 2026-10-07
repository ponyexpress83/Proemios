"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { isErroreAutorizzazione } from "@/lib/auth/errori";
import { revocaApprovazione, salvaPolicy } from "@/lib/dati/provider";
import { PROVIDER } from "@/config/modelli";

export type EsitoAzione = { ok: true; messaggio: string } | { ok: false; messaggio: string };

async function esegui(azione: () => Promise<string>): Promise<EsitoAzione> {
  try {
    const messaggio = await azione();
    revalidatePath("/admin/provider");
    return { ok: true, messaggio };
  } catch (errore) {
    if (isErroreAutorizzazione(errore)) return { ok: false, messaggio: errore.message };
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Operazione non riuscita.",
    };
  }
}

const schema = z.object({
  provider: z.enum(PROVIDER),
  addestramentoConsentito: z.boolean(),
  zeroDataRetention: z.boolean(),
  giorniConservazione: z.number().int().min(0).max(3650).nullable(),
  dpaDisponibile: z.boolean(),
  regioneDati: z.string().max(60),
  subresponsabili: z.array(z.string().max(200)).max(30),
  approvatoManoscrittiInediti: z.boolean(),
  approvatoProgettiSensibili: z.boolean(),
  note: z.string().max(4000),
});

/**
 * Salva e approva la policy di un provider.
 *
 * Zod controlla la forma; la coerenza fra condizioni e approvazioni la verifica
 * il livello dati, perché è lì che la riga viene scritta e da lì che il router
 * la legge.
 */
export async function salva(dati: z.input<typeof schema>): Promise<EsitoAzione> {
  const analisi = schema.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Dati della policy non validi." };

  return esegui(async () => {
    const attore = await esigiAttore();
    const salvata = await salvaPolicy(attore, analisi.data);
    return salvata.approvatoManoscrittiInediti
      ? `${salvata.provider}: policy approvata per i manoscritti inediti.`
      : `${salvata.provider}: policy salvata, ma non approvata per i manoscritti — il router continuerà a escluderlo.`;
  });
}

const schemaRevoca = z.object({
  provider: z.enum(PROVIDER),
  motivo: z.string().min(1).max(1000),
});

export async function revoca(dati: z.input<typeof schemaRevoca>): Promise<EsitoAzione> {
  const analisi = schemaRevoca.safeParse(dati);
  if (!analisi.success) return { ok: false, messaggio: "Serve un motivo per revocare." };

  return esegui(async () => {
    const attore = await esigiAttore();
    await revocaApprovazione(attore, analisi.data.provider, analisi.data.motivo);
    return `${analisi.data.provider}: approvazione revocata. Nessun Job userà più questo fornitore.`;
  });
}
