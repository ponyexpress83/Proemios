/**
 * Guardie di autorizzazione. Lanciano, non restituiscono booleani: una guardia
 * che restituisce `false` si può ignorare per distrazione, una che lancia no.
 */
import type { Attore } from "./attore";
import { haPermesso } from "./attore";
import type { Permesso } from "./ruoli";
import { NonAutorizzato, NonTrovato } from "./errori";

export function esigiPermesso(attore: Attore, permesso: Permesso): void {
  if (!attore.attivo) throw new NonAutorizzato(`account disattivato: ${attore.userId}`);
  if (!haPermesso(attore, permesso)) {
    throw new NonAutorizzato(`permesso mancante: ${permesso} per ruolo ${attore.ruolo}`);
  }
}

export function esigiUnoDei(attore: Attore, permessi: readonly Permesso[]): void {
  if (!attore.attivo) throw new NonAutorizzato(`account disattivato: ${attore.userId}`);
  if (!permessi.some((p) => haPermesso(attore, p))) {
    throw new NonAutorizzato(`nessuno dei permessi ${permessi.join(", ")} per ${attore.ruolo}`);
  }
}

/**
 * Isolamento fra tenant. È la verifica più importante del prodotto: un utente
 * dell'agenzia A non deve poter leggere nulla dell'agenzia B, per nessuna via.
 *
 * `super_admin` fa eccezione **solo** se appartiene all'organizzazione studio:
 * un amministratore di un'agenzia resta dentro la propria.
 */
export function esigiStessoTenant(
  attore: Attore,
  organizationIdRisorsa: string | null | undefined,
  contesto: string,
): void {
  if (!organizationIdRisorsa) {
    throw new NonTrovato(`${contesto}: risorsa senza organizzazione`);
  }
  if (attore.organizationId !== organizationIdRisorsa) {
    // NonTrovato, non NonAutorizzato: confermare l'esistenza della risorsa
    // direbbe a un tenant che l'altro ha quell'id.
    throw new NonTrovato(
      `${contesto}: tenant ${attore.organizationId} ≠ ${organizationIdRisorsa}`,
    );
  }
}

/** Il cliente accede alle proprie cose per proprietà, non per permesso. */
export function esigiProprietaCliente(
  attore: Attore,
  clientIdRisorsa: string | null | undefined,
  contesto: string,
): void {
  if (attore.ruolo !== "client") return;
  if (!clientIdRisorsa || attore.clientId !== clientIdRisorsa) {
    throw new NonTrovato(`${contesto}: cliente ${attore.clientId} ≠ ${clientIdRisorsa}`);
  }
}
