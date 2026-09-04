/**
 * DTO di utente. Anche fra colleghi vale il need to know: la scheda staff
 * mostra ruolo e stato, non l'ultimo accesso di ciascuno se chi guarda non
 * gestisce il personale.
 */
import type { Utente } from "@/db/schema/utenti";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import type { Ruolo } from "@/lib/auth/ruoli";
import { iso, sigilla } from "./comuni";

/** La versione minima: chi è, per attribuire un'azione o un messaggio. */
export type UtenteRiferimento = {
  id: string;
  nome: string | null;
  ruolo: Ruolo;
};

export type UtentePerAmministrazione = UtenteRiferimento & {
  email: string;
  organizationId: string;
  attivo: boolean;
  ultimoAccessoAt: string | null;
  mfaAbilitata: boolean;
  createdAt: string | null;
};

export function utenteRiferimento(u: Pick<Utente, "id" | "name" | "ruolo">): UtenteRiferimento {
  return sigilla({ id: u.id, nome: u.name, ruolo: u.ruolo as Ruolo });
}

export function utenteDTO(attore: Attore, u: Utente): UtenteRiferimento | UtentePerAmministrazione {
  if (!haPermesso(attore, "staff.vedi")) return utenteRiferimento(u);
  return sigilla({
    ...utenteRiferimento(u),
    email: u.email,
    organizationId: u.organizationId,
    attivo: u.attivo,
    ultimoAccessoAt: iso(u.ultimoAccessoAt),
    mfaAbilitata: u.mfaAbilitata,
    createdAt: iso(u.createdAt),
  });
}

/** Il profilo che l'utente vede di sé stesso. */
export type ProfiloProprio = {
  id: string;
  nome: string | null;
  email: string;
  ruolo: Ruolo;
  organizationId: string;
};

export function profiloProprio(attore: Attore): ProfiloProprio {
  return sigilla({
    id: attore.userId,
    nome: attore.nome,
    email: attore.email,
    ruolo: attore.ruolo,
    organizationId: attore.organizationId,
  });
}
