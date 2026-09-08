/**
 * L'attore: chi sta compiendo un'operazione.
 *
 * È l'unico modo per accedere ai dati. Le funzioni di `lib/dati/` esigono un
 * `Attore` come primo argomento e non espongono nessuna variante che ne faccia
 * a meno: dimenticare l'autorizzazione deve essere un errore di compilazione,
 * non una svista che passa la revisione.
 */
import type { Permesso, Ruolo } from "./ruoli";
import { ruoloHaPermesso } from "./ruoli";

export type Attore = {
  readonly userId: string;
  readonly email: string;
  readonly nome: string | null;
  readonly ruolo: Ruolo;
  /** Tenant di appartenenza. Ogni query è filtrata su questo. */
  readonly organizationId: string;
  /** Per i clienti: l'anagrafica a cui l'account è legato, se esiste. */
  readonly clientId: string | null;
  readonly attivo: boolean;
};

/**
 * Attore di sistema, per le operazioni che non hanno un utente dietro:
 * webhook, job in background, cron. Non ha permessi impliciti — le funzioni
 * che accettano questo attore lo dichiarano esplicitamente — e l'audit lo
 * registra come tale, così un'azione automatica non sembra mai un'azione umana.
 */
export type AttoreSistema = {
  readonly tipo: "sistema";
  readonly origine: string;
  readonly organizationId: string;
};

export function haPermesso(attore: Attore, permesso: Permesso): boolean {
  if (!attore.attivo) return false;
  return ruoloHaPermesso(attore.ruolo, permesso);
}

export function haTuttiIPermessi(attore: Attore, permessi: readonly Permesso[]): boolean {
  return permessi.every((p) => haPermesso(attore, p));
}

export function haAlmenoUnPermesso(attore: Attore, permessi: readonly Permesso[]): boolean {
  return permessi.some((p) => haPermesso(attore, p));
}
