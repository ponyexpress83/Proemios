/**
 * Le tre aree della piattaforma e come si sceglie quella giusta per una
 * persona. È l'unico posto dove la mappa ruolo → area esiste: la usano il
 * middleware, i moduli di accesso, le pagine delle aree e la verifica in due
 * passaggi. Funzioni pure, usabili anche nel browser.
 */
export type Realm = "author" | "staff" | "partner";
export const REALM_HOME: Record<Realm, string> = {
  author: "/area-autore",
  staff: "/area-team",
  partner: "/partner",
};
export const REALM_LOGIN: Record<Realm, string> = {
  author: "/accedi",
  staff: "/accesso-team",
  partner: "/accesso-partner",
};
const TEAM_ROLES = ["owner", "admin", "editor", "seller", "finance", "coordinator", "marketing"];
/** Team prima di tutto, poi partner, poi autore: chi ha più ruoli va dove lavora. */
export function realmFor(roles: readonly string[]): Realm {
  if (roles.some((r) => TEAM_ROLES.includes(r))) return "staff";
  if (roles.includes("affiliate")) return "partner";
  return "author";
}
/** Può entrare in un'area chi vi appartiene; il team può aprire anche l'area partner se è affiliato. */
export function allowedIn(roles: readonly string[], realm: Realm): boolean {
  if (realm === "staff") return roles.some((r) => TEAM_ROLES.includes(r));
  if (realm === "partner") return roles.includes("affiliate");
  return realmFor(roles) === "author";
}
/** Un percorso di ritorno interno, mai un URL esterno né un protocollo. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return /^\/[a-z0-9\-/]*(\?[a-zA-Z0-9=&%._-]*)?$/i.test(value) ? value : null;
}
