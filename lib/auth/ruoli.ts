/**
 * Ruoli e permessi.
 *
 * Principio: **least privilege + need to know**. Un ruolo riceve un permesso
 * solo se senza quel permesso non può fare il proprio lavoro. In particolare
 * `editor_reviewer` non vede nulla di commerciale, e nessun ruolo tranne
 * `super_admin` vede tutto.
 *
 * Questo modulo è puro: nessun accesso a database, nessuna dipendenza da
 * Next.js. Le verifiche stanno in lib/auth/guardie.ts, che lo usa.
 */

export const RUOLI = [
  "super_admin",
  "operations_admin",
  "editorial_manager",
  "editor_reviewer",
  "finance",
  "client",
] as const;

export type Ruolo = (typeof RUOLI)[number];

/**
 * L'elenco completo dei permessi del prodotto. Aggiungere una capacità
 * significa aggiungere una voce qui e assegnarla esplicitamente: non esiste un
 * permesso implicito.
 */
export const PERMESSI = [
  // ── Lavoro editoriale ──
  "job.vedi_assegnati",
  "job.vedi_tutti",
  "job.assegna",
  "job.rivedi_interventi",
  "job.modifica_intervento",
  "job.richiedi_chiarimento",
  "job.approva_editorialmente",
  "job.rigenera",
  "job.cambia_modello",
  "job.vedi_run_ai",
  "job.vedi_costi_ai",

  // ── Manoscritti e file ──
  "file.vedi_manoscritto",
  "file.carica",
  "file.scarica_deliverable",
  "file.cancella",

  // ── Progetti ──
  "progetto.vedi_assegnati",
  "progetto.vedi_tutti",
  "progetto.crea",
  "progetto.modifica",
  "progetto.assegna_membri",
  "progetto.approva_consegna",
  "progetto.consegna_al_cliente",

  // ── Identità e dati del cliente ──
  "cliente.vedi_identita",
  "cliente.vedi_contatti",
  "cliente.vedi_dati_fatturazione",
  "cliente.modifica",

  // ── Commerciale ──
  "crm.vedi_lead",
  "crm.modifica_lead",
  "crm.assegna_lead",
  "crm.vedi_attribuzione",
  "preventivo.vedi",
  "preventivo.crea",
  "prezzo.vedi",
  "contratto.vedi",
  "contratto.modifica",
  "ordine.vedi",
  "ordine.crea",
  "ordine.annulla",

  // ── Amministrazione ──
  "pagamento.vedi",
  "pagamento.registra",
  "pagamento.rimborsa",
  "fattura.vedi",
  "fattura.emetti",
  "margine.vedi",

  // ── Piattaforma ──
  "staff.vedi",
  "staff.invita",
  "staff.cambia_ruolo",
  "staff.disattiva",
  "organizzazione.vedi",
  "organizzazione.gestisci",
  "audit.vedi",
  "configurazione.gestisci",
  "analytics.vedi",
] as const;

export type Permesso = (typeof PERMESSI)[number];

/**
 * La matrice. È deliberatamente esplicita e verbosa: un elenco leggibile riga
 * per riga è l'unico modo per accorgersi che un ruolo ha un permesso che non
 * dovrebbe avere. `tests/permessi.test.ts` verifica le esclusioni critiche.
 */
export const PERMESSI_PER_RUOLO: Record<Ruolo, readonly Permesso[]> = {
  /** Unico ruolo con tutto. Va assegnato a pochissime persone. */
  super_admin: PERMESSI,

  /**
   * Conduce le operazioni: clienti, progetti, consegne, denaro in entrata.
   * NON entra nel merito editoriale (non approva editorialmente) e non vede i
   * dettagli tecnici delle run AI, che non gli servono.
   */
  operations_admin: [
    "job.vedi_tutti",
    "job.assegna",
    "file.vedi_manoscritto",
    "file.carica",
    "file.scarica_deliverable",
    "progetto.vedi_tutti",
    "progetto.crea",
    "progetto.modifica",
    "progetto.assegna_membri",
    "progetto.approva_consegna",
    "progetto.consegna_al_cliente",
    "cliente.vedi_identita",
    "cliente.vedi_contatti",
    "cliente.vedi_dati_fatturazione",
    "cliente.modifica",
    "crm.vedi_lead",
    "crm.modifica_lead",
    "crm.assegna_lead",
    "crm.vedi_attribuzione",
    "preventivo.vedi",
    "preventivo.crea",
    "prezzo.vedi",
    "contratto.vedi",
    "contratto.modifica",
    "ordine.vedi",
    "ordine.crea",
    "ordine.annulla",
    "pagamento.vedi",
    "pagamento.registra",
    "fattura.vedi",
    "staff.vedi",
    "staff.invita",
    "organizzazione.vedi",
    "audit.vedi",
    "analytics.vedi",
  ],

  /**
   * Governa la qualità editoriale: assegna il lavoro, guarda dentro le run,
   * rigenera, forza un secondo controllo. NON vede prezzi, contratti,
   * pagamenti né l'anagrafica commerciale del cliente.
   */
  editorial_manager: [
    "job.vedi_tutti",
    "job.assegna",
    "job.rivedi_interventi",
    "job.modifica_intervento",
    "job.richiedi_chiarimento",
    "job.approva_editorialmente",
    "job.rigenera",
    "job.cambia_modello",
    "job.vedi_run_ai",
    "file.vedi_manoscritto",
    "file.carica",
    "progetto.vedi_tutti",
    "progetto.modifica",
    "progetto.assegna_membri",
    "staff.vedi",
  ],

  /**
   * Il redattore. Vede il lavoro che gli è stato assegnato e nient'altro:
   * niente identità del cliente, niente contatti, niente prezzo, niente
   * attribuzione, niente run AI, niente costi.
   *
   * Non può consegnare al cliente: approva editorialmente, e la consegna resta
   * un'azione separata di operations.
   */
  editor_reviewer: [
    "job.vedi_assegnati",
    "job.rivedi_interventi",
    "job.modifica_intervento",
    "job.richiedi_chiarimento",
    "job.approva_editorialmente",
    "file.vedi_manoscritto",
    "progetto.vedi_assegnati",
  ],

  /**
   * Amministrazione. Vede cliente, contratto, prezzo, pagamenti e fatture.
   * NON vede i manoscritti: non le servono per emettere una fattura.
   */
  finance: [
    "cliente.vedi_identita",
    "cliente.vedi_contatti",
    "cliente.vedi_dati_fatturazione",
    "preventivo.vedi",
    "prezzo.vedi",
    "contratto.vedi",
    "ordine.vedi",
    "pagamento.vedi",
    "pagamento.registra",
    "pagamento.rimborsa",
    "fattura.vedi",
    "fattura.emetti",
    "margine.vedi",
    "progetto.vedi_tutti",
  ],

  /**
   * Il cliente. Non ha permessi di back-office: l'accesso ai propri dati non
   * passa dai permessi ma dalla proprietà, verificata in lib/dati/.
   */
  client: ["file.carica", "file.scarica_deliverable"],
};

export function ruoloHaPermesso(ruolo: Ruolo, permesso: Permesso): boolean {
  return PERMESSI_PER_RUOLO[ruolo].includes(permesso);
}

/** Ruoli che operano nel back-office. Il cliente e chi non ha ruolo restano fuori. */
export const RUOLI_STAFF: readonly Ruolo[] = [
  "super_admin",
  "operations_admin",
  "editorial_manager",
  "editor_reviewer",
  "finance",
];

export function isStaff(ruolo: Ruolo): boolean {
  return RUOLI_STAFF.includes(ruolo);
}

/**
 * Ruoli che possono vedere l'identità del cliente. Serve a decidere quale DTO
 * costruire, prima ancora di leggere i dati.
 */
export function vedeIdentitaCliente(ruolo: Ruolo): boolean {
  return ruoloHaPermesso(ruolo, "cliente.vedi_identita");
}

/** Etichette leggibili, usate nell'interfaccia staff. */
export const ETICHETTE_RUOLO: Record<Ruolo, string> = {
  super_admin: "Amministratore",
  operations_admin: "Operations",
  editorial_manager: "Responsabile editoriale",
  editor_reviewer: "Redattore",
  finance: "Amministrazione",
  client: "Cliente",
};
