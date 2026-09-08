"use server";

import { redirect } from "next/navigation";
import { esigiAttore } from "@/lib/auth/sessione";
import { revocaSessioniProprie } from "@/lib/dati/utenti";

/**
 * Chiude tutte le sessioni dell'utente, inclusa quella corrente: chi revoca
 * gli accessi si aspetta di dover rientrare, non di restare dentro.
 */
export async function revocaTutteLeSessioni(): Promise<void> {
  const attore = await esigiAttore();
  await revocaSessioniProprie(attore);
  redirect("/accedi");
}
