/**
 * Costruzione dell'oggetto sessione servito a `/api/auth/session`.
 *
 * Sta in un modulo a parte, puro e senza dipendenze, per due motivi: è
 * testabile senza avviare Auth.js, e soprattutto è **l'unico punto** in cui si
 * decide cosa il browser può leggere della sessione.
 *
 * L'adapter Drizzle consegna al callback la riga completa di `users` e quella
 * di `sessions`. Tutto ciò che resta nell'oggetto restituito viene serializzato
 * e servito al browser da un endpoint pubblico. Senza una ricostruzione
 * esplicita uscirebbero `mfaSegreto`, `motivoDisattivazione` e soprattutto
 * `sessionToken` — cioè il valore del cookie di sessione, che è `httpOnly`
 * proprio per non essere leggibile da JavaScript: esporlo qui annullerebbe
 * quella protezione.
 */
import type { Ruolo } from "./ruoli";

export type SessionePubblica = {
  expires: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    ruolo: Ruolo;
    organizationId: string;
    attivo: boolean;
  };
};

export type DatiUtenteSessione = {
  ruolo: string | null;
  organizationId: string | null;
  attivo: boolean | null;
  name: string | null;
  email: string | null;
  image: string | null;
};

export function costruisciSessionePubblica(
  expires: string,
  userId: string,
  riga: DatiUtenteSessione | undefined,
): SessionePubblica {
  return {
    expires,
    user: {
      id: userId,
      name: riga?.name ?? null,
      email: riga?.email ?? "",
      image: riga?.image ?? null,
      ruolo: (riga?.ruolo ?? "client") as Ruolo,
      organizationId: riga?.organizationId ?? "",
      attivo: riga?.attivo ?? false,
    },
  };
}

/**
 * Chiavi che non devono mai comparire nella sessione servita al browser.
 * Usata da `tests/sessione.test.ts` come rete di sicurezza sopra l'allowlist.
 */
export const CHIAVI_VIETATE_IN_SESSIONE = [
  "sessionToken",
  "session_token",
  "mfaSegreto",
  "mfa_segreto",
  "motivoDisattivazione",
  "disattivatoAt",
  "ultimoAccessoAt",
  "indirizzoIp",
  "userAgent",
  "emailVerified",
  "createdAt",
  "updatedAt",
] as const;
