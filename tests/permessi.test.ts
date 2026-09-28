import { describe, it, expect } from "vitest";
import {
  PERMESSI,
  PERMESSI_PER_RUOLO,
  RUOLI,
  RUOLI_STAFF,
  isStaff,
  ruoloHaPermesso,
  vedeIdentitaCliente,
  type Permesso,
  type Ruolo,
} from "@/lib/auth/ruoli";
import { haPermesso, type Attore } from "@/lib/auth/attore";
import { esigiPermesso, esigiProprietaCliente, esigiStessoTenant } from "@/lib/auth/guardie";
import { NonAutorizzato, NonTrovato } from "@/lib/auth/errori";

function attore(ruolo: Ruolo, extra: Partial<Attore> = {}): Attore {
  return {
    userId: "u-1",
    email: "tizio@esempio.it",
    nome: "Tizio",
    ruolo,
    organizationId: "org-studio",
    clientId: null,
    attivo: true,
    ...extra,
  };
}

describe("matrice dei permessi — struttura", () => {
  it("copre tutti i ruoli", () => {
    for (const r of RUOLI) expect(PERMESSI_PER_RUOLO[r]).toBeDefined();
  });

  it("non assegna permessi inesistenti", () => {
    const validi = new Set<string>(PERMESSI);
    for (const r of RUOLI) {
      for (const p of PERMESSI_PER_RUOLO[r]) {
        expect(validi.has(p), `${r} → ${p}`).toBe(true);
      }
    }
  });

  it("non ripete lo stesso permesso dentro un ruolo", () => {
    for (const r of RUOLI) {
      const lista = PERMESSI_PER_RUOLO[r];
      expect(new Set(lista).size, r).toBe(lista.length);
    }
  });

  it("dà tutto solo a super_admin", () => {
    for (const r of RUOLI) {
      const completo = PERMESSI.every((p) => ruoloHaPermesso(r, p));
      expect(completo, r).toBe(r === "super_admin");
    }
  });

  it("considera staff tutti i ruoli tranne client", () => {
    for (const r of RUOLI) expect(isStaff(r)).toBe(r !== "client");
    expect(RUOLI_STAFF).not.toContain("client");
  });
});

/**
 * Le esclusioni sono la parte che conta. Un permesso in più concesso per
 * distrazione non rompe nulla al momento — si nota quando qualcuno vede dati
 * che non doveva vedere, e allora è tardi.
 */
describe("matrice dei permessi — esclusioni critiche", () => {
  const vietatiAlRedattore: Permesso[] = [
    "cliente.vedi_identita",
    "cliente.vedi_contatti",
    "cliente.vedi_dati_fatturazione",
    "prezzo.vedi",
    "preventivo.vedi",
    "contratto.vedi",
    "pagamento.vedi",
    "fattura.vedi",
    "margine.vedi",
    "crm.vedi_lead",
    "crm.vedi_attribuzione",
    "job.vedi_run_ai",
    "job.vedi_costi_ai",
    "job.cambia_modello",
    "job.vedi_tutti",
    "progetto.vedi_tutti",
    "progetto.consegna_al_cliente",
    "progetto.approva_consegna",
    "staff.cambia_ruolo",
    "audit.vedi",
  ];

  it.each(vietatiAlRedattore)("editor_reviewer NON ha %s", (p) => {
    expect(ruoloHaPermesso("editor_reviewer", p)).toBe(false);
  });

  it("editor_reviewer ha ciò che gli serve per lavorare", () => {
    for (const p of [
      "job.vedi_assegnati",
      "job.rivedi_interventi",
      "job.modifica_intervento",
      "job.richiedi_chiarimento",
      "job.approva_editorialmente",
      "file.vedi_manoscritto",
      "progetto.vedi_assegnati",
    ] as Permesso[]) {
      expect(ruoloHaPermesso("editor_reviewer", p), p).toBe(true);
    }
  });

  it("finance NON vede i manoscritti né il lavoro editoriale", () => {
    for (const p of [
      "file.vedi_manoscritto",
      "job.vedi_tutti",
      "job.vedi_assegnati",
      "job.rivedi_interventi",
      "job.approva_editorialmente",
      "file.cancella",
    ] as Permesso[]) {
      expect(ruoloHaPermesso("finance", p), p).toBe(false);
    }
  });

  it("finance vede il lato amministrativo", () => {
    for (const p of [
      "cliente.vedi_dati_fatturazione",
      "prezzo.vedi",
      "pagamento.vedi",
      "fattura.emetti",
    ] as Permesso[]) {
      expect(ruoloHaPermesso("finance", p), p).toBe(true);
    }
  });

  it("editorial_manager NON vede prezzi, contratti né pagamenti", () => {
    for (const p of [
      "prezzo.vedi",
      "contratto.vedi",
      "pagamento.vedi",
      "fattura.vedi",
      "margine.vedi",
      "cliente.vedi_dati_fatturazione",
      "crm.vedi_attribuzione",
    ] as Permesso[]) {
      expect(ruoloHaPermesso("editorial_manager", p), p).toBe(false);
    }
  });

  it("solo super_admin e finance vedono il margine", () => {
    for (const r of RUOLI) {
      expect(ruoloHaPermesso(r, "margine.vedi"), r).toBe(r === "super_admin" || r === "finance");
    }
  });

  it("nessun redattore può consegnare al cliente", () => {
    // La separazione fra approvazione editoriale e consegna è il vincolo
    // centrale del workflow: chi approva il contenuto non lo spedisce.
    expect(ruoloHaPermesso("editor_reviewer", "progetto.consegna_al_cliente")).toBe(false);
    expect(ruoloHaPermesso("editorial_manager", "progetto.consegna_al_cliente")).toBe(false);
  });

  it("il cliente non ha permessi di back-office", () => {
    const suoi = PERMESSI_PER_RUOLO.client;
    expect(suoi).toEqual(["file.carica", "file.scarica_deliverable"]);
  });

  it("solo chi vede l'identità del cliente supera vedeIdentitaCliente", () => {
    expect(vedeIdentitaCliente("editor_reviewer")).toBe(false);
    expect(vedeIdentitaCliente("editorial_manager")).toBe(false);
    expect(vedeIdentitaCliente("client")).toBe(false);
    expect(vedeIdentitaCliente("finance")).toBe(true);
    expect(vedeIdentitaCliente("operations_admin")).toBe(true);
  });
});

describe("guardie", () => {
  it("un account disattivato non ha alcun permesso", () => {
    const spento = attore("super_admin", { attivo: false });
    for (const p of PERMESSI) expect(haPermesso(spento, p), p).toBe(false);
    expect(() => esigiPermesso(spento, "crm.vedi_lead")).toThrow(NonAutorizzato);
  });

  it("esigiPermesso lancia senza rivelare il permesso mancante nel messaggio", () => {
    try {
      esigiPermesso(attore("editor_reviewer"), "prezzo.vedi");
      expect.unreachable("doveva lanciare");
    } catch (e) {
      expect(e).toBeInstanceOf(NonAutorizzato);
      expect((e as NonAutorizzato).message).not.toContain("prezzo.vedi");
      // Il dettaglio esiste, ma per l'audit.
      expect((e as NonAutorizzato).motivoInterno).toContain("prezzo.vedi");
    }
  });

  it("blocca l'accesso a un altro tenant", () => {
    const a = attore("operations_admin", { organizationId: "org-a" });
    expect(() => esigiStessoTenant(a, "org-b", "progetto")).toThrow(NonTrovato);
    expect(() => esigiStessoTenant(a, "org-a", "progetto")).not.toThrow();
  });

  it("risponde NonTrovato, non NonAutorizzato, su tenant diverso", () => {
    // Confermare che la risorsa esiste direbbe a un tenant che l'altro ha
    // quell'id: la risposta deve essere indistinguibile da "non esiste".
    const a = attore("operations_admin", { organizationId: "org-a" });
    try {
      esigiStessoTenant(a, "org-b", "progetto");
      expect.unreachable("doveva lanciare");
    } catch (e) {
      expect(e).toBeInstanceOf(NonTrovato);
      expect((e as NonTrovato).stato).toBe(404);
    }
  });

  it("un cliente accede solo alle proprie risorse", () => {
    const c = attore("client", { clientId: "cli-1" });
    expect(() => esigiProprietaCliente(c, "cli-1", "progetto")).not.toThrow();
    expect(() => esigiProprietaCliente(c, "cli-2", "progetto")).toThrow(NonTrovato);
    expect(() => esigiProprietaCliente(c, null, "progetto")).toThrow(NonTrovato);
  });

  it("la proprietà non si applica allo staff", () => {
    const s = attore("operations_admin");
    expect(() => esigiProprietaCliente(s, "cli-2", "progetto")).not.toThrow();
  });
});
