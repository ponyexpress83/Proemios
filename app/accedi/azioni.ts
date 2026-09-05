"use server";

import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { chiaveLimite, origineRichiesta, REGOLE } from "@/lib/sicurezza";
import { conta } from "@/lib/sicurezza/store-limite";
import { headers } from "next/headers";

const schema = z.object({
  email: z.string().email().max(320),
  destinazione: z.string().max(300).optional(),
});

/**
 * Richiede un link di accesso.
 *
 * Due cautele:
 *  - **risposta uniforme**: che l'indirizzo esista o no, il chiamante riceve
 *    `ok`. Distinguere i due casi permetterebbe di enumerare gli account;
 *  - **limite di frequenza per indirizzo IP**: senza, la casella di chiunque
 *    diventa bersaglio di un invio a raffica.
 */
export async function richiediLinkAccesso(dati: {
  email: string;
  destinazione?: string;
}): Promise<{ ok: true } | { ok: false; messaggio: string }> {
  const analisi = schema.safeParse(dati);
  if (!analisi.success) {
    return { ok: false, messaggio: "Controlla l'indirizzo email: manca qualcosa." };
  }

  const intestazioni = await headers();
  // Il contatore vive in database, non in memoria: su un runtime serverless un
  // limite per istanza si aggira aprendo connessioni finché non se ne prende
  // una nuova, e l'accesso è il bersaglio di chi prova indirizzi a caso.
  const chiave = await chiaveLimite("accesso", origineRichiesta(intestazioni));
  const consentito = await conta(chiave, REGOLE.accesso!);
  if (!consentito.ammessa) {
    return {
      ok: false,
      messaggio: "Troppi tentativi. Riprova fra un quarto d'ora.",
    };
  }

  const destinazione =
    analisi.data.destinazione && analisi.data.destinazione.startsWith("/")
      ? analisi.data.destinazione
      : "/area";

  try {
    await signIn("resend", {
      email: analisi.data.email.trim().toLowerCase(),
      redirect: false,
      redirectTo: destinazione,
    });
  } catch (errore) {
    // Un indirizzo senza account fa fallire `signIn` per via del callback
    // `signIn` in lib/auth/config.ts. Non lo diciamo: la risposta resta uguale.
    const messaggio = errore instanceof Error ? errore.message : "";
    if (!/AccessDenied|CredentialsSignin/i.test(messaggio)) {
      console.error("[accesso] invio fallito", { messaggio });
      return {
        ok: false,
        messaggio: "Non siamo riusciti a mandare l'email. Riprova fra poco.",
      };
    }
  }

  return { ok: true };
}

/** Chiude la sessione e riporta alla home. */
export async function esci(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
