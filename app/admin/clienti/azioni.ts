"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esigiAttore } from "@/lib/auth/sessione";
import { creaClienteEsistente } from "@/lib/dati/onboarding";

export type EsitoCliente =
  | { ok: true; messaggio: string; clienteId: string }
  | { ok: false; messaggio: string; clienteId?: undefined };

const vuotaANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opzionale = z.preprocess(vuotaANull, z.string().max(500).optional());

const schema = z.object({
  tipo: z.enum(["privato", "azienda"]),
  nome: z.string().trim().min(1).max(200),
  cognome: opzionale,
  ragioneSociale: z.preprocess(vuotaANull, z.string().max(300).optional()),
  email: z.string().trim().email().max(320),
  telefono: z.preprocess(vuotaANull, z.string().max(40).optional()),
  partitaIva: z.preprocess(vuotaANull, z.string().max(30).optional()),
  codiceFiscale: z.preprocess(vuotaANull, z.string().max(30).optional()),
  pec: z.preprocess(vuotaANull, z.string().email().max(320).optional()),
  codiceDestinatario: z.preprocess(vuotaANull, z.string().max(20).optional()),
  alias: z.preprocess(vuotaANull, z.string().max(80).optional()),
  noteCommerciali: z.preprocess(vuotaANull, z.string().max(5000).optional()),
});

export async function creaClienteAttuale(
  _precedente: EsitoCliente | null,
  formData: FormData,
): Promise<EsitoCliente> {
  const analisi = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!analisi.success) {
    return { ok: false, messaggio: "Controlla i dati inseriti: alcuni campi non sono validi." };
  }

  try {
    const attore = await esigiAttore();
    const cliente = await creaClienteEsistente(attore, analisi.data);
    revalidatePath("/admin/clienti");
    return { ok: true, messaggio: "Cliente inserito. Ora puoi creare il suo progetto.", clienteId: cliente.id };
  } catch (errore) {
    return {
      ok: false,
      messaggio: errore instanceof Error ? errore.message : "Creazione cliente non riuscita.",
    };
  }
}
