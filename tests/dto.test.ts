import { describe, it, expect } from "vitest";
import {
  clienteAnonimo,
  clienteCompleto,
  clienteDTO,
  clienteIdentita,
  haDatiFatturazione,
  haIdentita,
} from "@/lib/dto/cliente";
import { progettoDTO, progettoPerCliente, progettoPerRedattore } from "@/lib/dto/progetto";
import { attribuzioneDTO, leadDTO } from "@/lib/dto/lead";
import { jobPerRedattore, lavorazionePerCliente, runDTO } from "@/lib/dto/job";
import { CHIAVI_VIETATE_AL_CLIENTE, CHIAVI_VIETATE_AL_REDATTORE } from "@/lib/dto/comuni";
import { NonAutorizzato } from "@/lib/auth/errori";
import type { Attore } from "@/lib/auth/attore";
import type { Ruolo } from "@/lib/auth/ruoli";
import type { Cliente, Lead } from "@/db/schema/crm";
import type { Progetto } from "@/db/schema/progetti";
import type { JobEditoriale, RunAi } from "@/db/schema/produzione";

function attore(ruolo: Ruolo, extra: Partial<Attore> = {}): Attore {
  return {
    userId: "u-1",
    email: "x@y.it",
    nome: "X",
    ruolo,
    organizationId: "org-1",
    clientId: null,
    attivo: true,
    ...extra,
  };
}

const CLIENTE: Cliente = {
  id: "11111111-1111-1111-1111-111111111111",
  organizationId: "org-1",
  userId: null,
  tipo: "privato",
  nome: "Mario",
  cognome: "Rossi",
  ragioneSociale: null,
  email: "mario.rossi@esempio.it",
  telefono: "+39 333 1234567",
  indirizzo: { via: "Via Roma 1", cap: "58100", citta: "Grosseto" },
  partitaIva: "01234567890",
  codiceFiscale: "RSSMRA80A01D612X",
  codiceDestinatario: "ABCDEFG",
  pec: "mario@pec.it",
  alias: null,
  noteCommerciali: "Ha detto che ha budget alto, insistere a settembre.",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const PROGETTO: Progetto = {
  id: "p-1",
  codice: "P-184",
  organizationId: "org-1",
  clientId: CLIENTE.id,
  orderId: "o-1",
  titolo: "La storia della famiglia Rossi",
  titoloAlias: "Memoir familiare",
  percorsoSlug: "memoir-e-storia-familiare",
  serviziSlug: ["ghostwriting"],
  stato: "in_corso",
  avanzamento: 40,
  projectManagerId: "u-9",
  conteggioParole: 82_430,
  scadenzaAt: new Date("2026-06-01"),
  prioritaria: false,
  brief: { obiettivo: "tramandare" },
  briefVerificatoAt: null,
  briefVerificatoDaId: null,
  istruzioniEditoriali: "Non toccare i dialoghi in dialetto.",
  noteInterne: "Cliente delicato, margine basso.",
  conclusoAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const LEAD: Lead = {
  id: "l-1",
  userId: null,
  nome: "Anna Bianchi",
  email: "anna@esempio.it",
  telefono: null,
  fonte: "preventivo",
  stage: "new",
  leadScore: 80,
  attribution: { utmSource: "google", gclid: "abc123", landingPath: "/preventivo" },
  consensoPrivacy: true,
  consensoMarketing: false,
  note: null,
  createdAt: new Date("2026-02-01"),
  organizationId: "org-1",
  stato: "qualificato",
  ownerId: null,
  clientId: null,
  valoreStimato: 4200,
  ultimaAttivitaAt: null,
  prossimaAttivitaAt: null,
  prossimaAttivita: null,
  callPrenotataAt: null,
  persoMotivo: null,
  updatedAt: new Date("2026-02-01"),
};

const JOB: JobEditoriale = {
  id: "j-1",
  codice: "J-0042",
  organizationId: "org-1",
  projectId: "p-1",
  fileVersionOrigineId: "fv-1",
  fileVersionEsitoId: null,
  livelloServizio: "correzione-bozze",
  modalitaRevisione: "controllato",
  stato: "needs_review",
  assegnatoAId: "u-7",
  assegnatoDaId: "u-9",
  assegnatoAt: new Date(),
  conteggioParole: 82_430,
  conteggioInterventi: 1427,
  conteggioDaVerificare: 74,
  istruzioni: "Uniformare le virgolette.",
  scadenzaAt: null,
  prioritaria: false,
  approvatoEditorialmenteAt: null,
  approvatoEditorialmenteDaId: null,
  approvatoAt: null,
  approvatoDaId: null,
  consegnatoAt: null,
  erroreMessaggio: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const RUN: RunAi = {
  id: "r-1",
  jobId: "j-1",
  organizationId: "org-1",
  ruolo: "primaria",
  stato: "completata",
  provider: "openai",
  modello: "un-modello",
  versionePrompt: "v3",
  promptRiferimento: "prompts/2026/j-1.txt",
  motivazioniRouting: ["primary:x"],
  tokenInput: 120_000,
  tokenOutput: 8_000,
  costoMicroCent: 45_000,
  latenzaMs: 41_000,
  tentativo: 1,
  interventiProdotti: 1427,
  erroreMessaggio: null,
  iniziataAt: new Date(),
  conclusaAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Elenca ricorsivamente le chiavi di un oggetto serializzato. */
function chiaviDi(oggetto: unknown, prefisso = "", acc: string[] = []): string[] {
  if (!oggetto || typeof oggetto !== "object") return acc;
  for (const [k, v] of Object.entries(oggetto)) {
    acc.push(k);
    if (v && typeof v === "object" && !Array.isArray(v)) chiaviDi(v, `${prefisso}${k}.`, acc);
  }
  return acc;
}

describe("DTO cliente", () => {
  it("non mostra mai il nome vero a chi non ha il permesso", () => {
    const dto = clienteDTO(attore("editor_reviewer"), CLIENTE);
    expect(haIdentita(dto)).toBe(false);
    const testo = JSON.stringify(dto);
    expect(testo).not.toContain("Mario");
    expect(testo).not.toContain("Rossi");
    expect(testo).not.toContain("mario.rossi@esempio.it");
    expect(testo).not.toContain("333");
  });

  it("non espone mai le note commerciali, a nessun ruolo", () => {
    for (const r of ["super_admin", "operations_admin", "finance", "editor_reviewer"] as Ruolo[]) {
      const dto = clienteDTO(attore(r), CLIENTE);
      expect(chiaviDi(dto), r).not.toContain("noteCommerciali");
    }
  });

  it("dà identità senza dati fiscali a chi vede solo l'identità", () => {
    const dto = clienteIdentita(CLIENTE);
    expect(chiaviDi(dto)).not.toContain("partitaIva");
    expect(chiaviDi(dto)).not.toContain("pec");
    expect(haDatiFatturazione(dto)).toBe(false);
  });

  it("dà i dati fiscali a finance e operations", () => {
    for (const r of ["finance", "operations_admin", "super_admin"] as Ruolo[]) {
      const dto = clienteDTO(attore(r), CLIENTE);
      expect(haDatiFatturazione(dto), r).toBe(true);
    }
  });

  it("nega i dati fiscali al responsabile editoriale", () => {
    const dto = clienteDTO(attore("editorial_manager"), CLIENTE);
    expect(haDatiFatturazione(dto)).toBe(false);
    expect(haIdentita(dto)).toBe(false);
  });

  it("il riferimento anonimo non contiene il nome", () => {
    const dto = clienteAnonimo({ ...CLIENTE, alias: null });
    expect(dto.riferimento).not.toContain("Mario");
    const conAlias = clienteAnonimo({ ...CLIENTE, alias: "Autore 12" });
    expect(conAlias.riferimento).toBe("Autore 12");
  });

  it("il DTO completo contiene tutto e nient'altro", () => {
    const chiavi = Object.keys(clienteCompleto(CLIENTE)).sort();
    expect(chiavi).toEqual(
      [
        "id", "riferimento", "tipo", "nome", "cognome", "ragioneSociale", "email",
        "telefono", "createdAt", "indirizzo", "partitaIva", "codiceFiscale",
        "codiceDestinatario", "pec",
      ].sort(),
    );
  });
});

describe("DTO progetto", () => {
  it("al redattore mostra l'alias, non il titolo vero", () => {
    const dto = progettoPerRedattore(PROGETTO);
    expect(dto.titolo).toBe("Memoir familiare");
    expect(JSON.stringify(dto)).not.toContain("famiglia Rossi");
  });

  it("al redattore non dà clientId, note interne né avanzamento commerciale", () => {
    const chiavi = chiaviDi(progettoDTO(attore("editor_reviewer"), PROGETTO));
    for (const vietata of ["clientId", "noteInterne", "orderId", "organizationId"]) {
      expect(chiavi, vietata).not.toContain(vietata);
    }
  });

  it("al cliente non dà istruzioni editoriali né note interne", () => {
    const chiavi = chiaviDi(progettoPerCliente(PROGETTO));
    for (const vietata of ["istruzioniEditoriali", "noteInterne", "projectManagerId", "clientId"]) {
      expect(chiavi, vietata).not.toContain(vietata);
    }
  });

  it("a finance non arrivano le istruzioni editoriali", () => {
    // Emettere una fattura non richiede di sapere come trattare i dialoghi.
    const chiavi = chiaviDi(progettoDTO(attore("finance"), PROGETTO));
    expect(chiavi).not.toContain("istruzioniEditoriali");
    expect(chiavi).not.toContain("noteInterne");
    // Ma il collegamento all'ordine e al cliente sì: le servono per fatturare.
    expect(chiavi).toContain("clientId");
    expect(chiavi).toContain("orderId");
  });

  it("nessun DTO del cliente contiene chiavi di back-office", () => {
    const chiavi = chiaviDi(progettoDTO(attore("client", { clientId: CLIENTE.id }), PROGETTO));
    for (const vietata of CHIAVI_VIETATE_AL_CLIENTE) {
      expect(chiavi, vietata).not.toContain(vietata);
    }
  });
});

describe("DTO lead", () => {
  it("rifiuta chi non ha il permesso invece di restituire una versione ridotta", () => {
    expect(() => leadDTO(attore("editor_reviewer"), LEAD)).toThrow(NonAutorizzato);
    expect(() => leadDTO(attore("editorial_manager"), LEAD)).toThrow(NonAutorizzato);
    expect(() => leadDTO(attore("client"), LEAD)).toThrow(NonAutorizzato);
  });

  it("separa l'attribuzione, che ha un permesso proprio", () => {
    const operations = attore("operations_admin");
    expect(chiaviDi(leadDTO(operations, LEAD))).not.toContain("attribution");
    expect(() => attribuzioneDTO(attore("finance"), LEAD)).toThrow(NonAutorizzato);
    expect(attribuzioneDTO(operations, LEAD).gclid).toBe("abc123");
  });
});

describe("DTO job — il confine con il cliente", () => {
  it("la lavorazione vista dal cliente non ha nulla di tecnico", () => {
    const dto = lavorazionePerCliente(JOB);
    const chiavi = chiaviDi(dto);
    for (const vietata of CHIAVI_VIETATE_AL_CLIENTE) {
      expect(chiavi, vietata).not.toContain(vietata);
    }
    expect(chiavi).not.toContain("conteggioInterventi");
    expect(chiavi).not.toContain("assegnatoAId");
    expect(chiavi).not.toContain("stato");
  });

  it("traduce lo stato tecnico in linguaggio editoriale", () => {
    expect(lavorazionePerCliente({ ...JOB, stato: "running" }).fase).toBe("In lavorazione");
    // Un fallimento interno non deve arrivare al cliente come "fallito".
    expect(lavorazionePerCliente({ ...JOB, stato: "failed" }).fase).toBe("In verifica");
    expect(lavorazionePerCliente({ ...JOB, stato: "delivered" }).fase).toBe("Consegnata");
  });

  it("il job del redattore non contiene chiavi commerciali", () => {
    const chiavi = chiaviDi(jobPerRedattore(JOB, "P-184"));
    for (const vietata of CHIAVI_VIETATE_AL_REDATTORE) {
      expect(chiavi, vietata).not.toContain(vietata);
    }
  });
});

describe("DTO run AI", () => {
  it("è negato a chi non ha job.vedi_run_ai", () => {
    expect(() => runDTO(attore("editor_reviewer"), RUN)).toThrow(NonAutorizzato);
    expect(() => runDTO(attore("client"), RUN)).toThrow(NonAutorizzato);
    expect(() => runDTO(attore("finance"), RUN)).toThrow(NonAutorizzato);
    expect(() => runDTO(attore("operations_admin"), RUN)).toThrow(NonAutorizzato);
  });

  it("mostra la run al responsabile editoriale, ma senza il costo", () => {
    const dto = runDTO(attore("editorial_manager"), RUN);
    expect(dto.provider).toBe("openai");
    expect(chiaviDi(dto)).not.toContain("costoMicroCent");
  });

  it("mostra il costo solo a chi ha job.vedi_costi_ai", () => {
    const dto = runDTO(attore("super_admin"), RUN);
    expect(chiaviDi(dto)).toContain("costoMicroCent");
  });

  it("non espone mai il prompt", () => {
    const dto = runDTO(attore("super_admin"), RUN);
    expect(chiaviDi(dto)).not.toContain("promptRiferimento");
    expect(JSON.stringify(dto)).not.toContain("prompts/");
  });
});
