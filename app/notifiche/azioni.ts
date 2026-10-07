"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { segnaLette } from "@/lib/dati/notifiche";

const schema = z.object({ ids: z.array(z.string().uuid()).max(200).optional() });

/**
 * Segna come lette le proprie notifiche.
 *
 * Non c'è un parametro «di chi»: il destinatario è l'attore della sessione, e
 * la `WHERE` del livello dati lo usa come vincolo. Passare l'id della notifica
 * di un'altra persona non aggiorna niente.
 */
export async function segnaComeLette(
  dati: z.input<typeof schema> = {},
): Promise<{ lette: number }> {
  const analisi = schema.safeParse(dati);
  if (!analisi.success) return { lette: 0 };
  const attore = await esigiAttore();
  const lette = await segnaLette(attore, analisi.data.ids);
  revalidatePath("/area");
  revalidatePath("/admin");
  return { lette };
}
