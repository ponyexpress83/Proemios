import { describe, it, expect } from "vitest";
import {
  CHIAVI_VIETATE_IN_SESSIONE,
  costruisciSessionePubblica,
} from "@/lib/auth/sessione-pubblica";

/**
 * `/api/auth/session` è un endpoint pubblico che il browser può interrogare
 * liberamente. Tutto ciò che finisce nell'oggetto restituito dal callback
 * `session` viene servito lì: questi test presidiano quel confine.
 */
describe("sessione servita al browser", () => {
  const rigaCompleta = {
    ruolo: "editor_reviewer",
    organizationId: "org-1",
    attivo: true,
    name: "Philippe",
    email: "philippe@proemios.it",
    image: null,
  };

  it("contiene solo le chiavi previste", () => {
    const s = costruisciSessionePubblica("2026-12-31T00:00:00Z", "u-1", rigaCompleta);
    expect(Object.keys(s).sort()).toEqual(["expires", "user"]);
    expect(Object.keys(s.user).sort()).toEqual(
      ["attivo", "email", "id", "image", "name", "organizationId", "ruolo"].sort(),
    );
  });

  it("non espone il token di sessione né i segreti dell'account", () => {
    // Il token è il valore del cookie httpOnly: servirlo da un endpoint
    // leggibile via fetch annullerebbe la protezione del cookie.
    const serializzato = JSON.stringify(
      costruisciSessionePubblica("2026-12-31T00:00:00Z", "u-1", rigaCompleta),
    );
    for (const chiave of CHIAVI_VIETATE_IN_SESSIONE) {
      expect(serializzato, chiave).not.toContain(chiave);
    }
  });

  it("non si lascia inquinare da colonne aggiunte in futuro", () => {
    // Simula una colonna nuova su `users`: non deve raggiungere il browser
    // solo perché qualcuno l'ha aggiunta allo schema.
    const conColonnaNuova = {
      ...rigaCompleta,
      mfaSegreto: "JBSWY3DPEHPK3PXP",
      motivoDisattivazione: "licenziato",
      noteHR: "riservato",
    } as never;

    const serializzato = JSON.stringify(
      costruisciSessionePubblica("2026-12-31T00:00:00Z", "u-1", conColonnaNuova),
    );
    expect(serializzato).not.toContain("JBSWY3DPEHPK3PXP");
    expect(serializzato).not.toContain("licenziato");
    expect(serializzato).not.toContain("riservato");
  });

  it("degrada in sicurezza quando la riga utente manca", () => {
    // Utente cancellato con la sessione ancora aperta: il risultato non deve
    // essere un account attivo con ruolo elevato.
    const s = costruisciSessionePubblica("2026-12-31T00:00:00Z", "u-1", undefined);
    expect(s.user.attivo).toBe(false);
    expect(s.user.ruolo).toBe("client");
    expect(s.user.organizationId).toBe("");
  });
});
