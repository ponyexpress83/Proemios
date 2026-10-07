/**
 * Enum e colonne condivise dallo schema.
 *
 * Convenzione: i nomi delle colonne in database sono in snake_case inglese
 * (portabilità degli strumenti SQL), gli identificatori TypeScript seguono la
 * convenzione italiana del resto del repository.
 */
import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";

/** Ruoli applicativi. Combacia con `staffRoleSchema` di lib/ai-backoffice/contracts.ts. */
export const ruoloEnum = pgEnum("ruolo", [
  "super_admin",
  "operations_admin",
  "editorial_manager",
  "editor_reviewer",
  "finance",
  "client",
]);

/** Tipo di organizzazione: lo studio stesso, oppure un'agenzia in white label. */
export const tipoOrganizzazioneEnum = pgEnum("tipo_organizzazione", ["studio", "agenzia"]);

export const statoLeadEnum = pgEnum("stato_lead", [
  "nuovo",
  "qualificato",
  "call",
  "proposta",
  "cliente",
  "produzione",
  "post_pubblicazione",
  "perso",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "preventivo",
  "analisi",
  "contatto",
  "agenzie",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "deposit_paid",
  "won",
  "lost",
]);

export const statoOrdineEnum = pgEnum("stato_ordine", [
  "bozza",
  "in_attesa_pagamento",
  "confermato",
  "in_produzione",
  "consegnato",
  "chiuso",
  "annullato",
]);

export const statoContrattoEnum = pgEnum("stato_contratto", [
  "bozza",
  "inviato",
  "firmato",
  "risolto",
]);

export const statoProgettoEnum = pgEnum("stato_progetto", [
  "avvio",
  "in_corso",
  "in_attesa_cliente",
  "in_revisione",
  "in_consegna",
  "concluso",
  "sospeso",
  "annullato",
]);

export const statoTappaEnum = pgEnum("stato_tappa", [
  "attesa",
  "in_corso",
  "completata",
  "bloccata",
  "saltata",
]);

export const statoMilestoneEnum = pgEnum("stato_milestone", [
  "pianificata",
  "in_corso",
  "in_approvazione",
  "approvata",
  "respinta",
]);

export const statoAttivitaEnum = pgEnum("stato_attivita", [
  "da_fare",
  "in_corso",
  "bloccata",
  "fatta",
  "annullata",
]);

/** Stati del Job, da docs/AI_BACKOFFICE_ARCHITECTURE.md §2. */
export const statoJobEnum = pgEnum("stato_job", [
  "queued",
  "running",
  "needs_review",
  "needs_input",
  "editorially_approved",
  "approved",
  "delivered",
  "failed",
  "cancelled",
]);

export const livelloServizioEnum = pgEnum("livello_servizio", [
  "correzione-bozze",
  "revisione-linguistica",
  "editing-stilistico",
  "editing-narrativo",
]);

export const modalitaRevisioneEnum = pgEnum("modalita_revisione", ["controllato", "premium"]);

export const ruoloRunEnum = pgEnum("ruolo_run", ["primaria", "secondaria", "adjudicator", "controllo"]);

export const statoRunEnum = pgEnum("stato_run", ["in_corso", "completata", "fallita", "annullata"]);

export const categoriaInterventoEnum = pgEnum("categoria_intervento", [
  "refuso",
  "ortografia",
  "punteggiatura",
  "grammatica",
  "sintassi",
  "ripetizione",
  "uniformita-tipografica",
  "stile",
  "dubbio-da-verificare",
]);

export const statoInterventoEnum = pgEnum("stato_intervento", [
  "pending",
  "accepted",
  "rejected",
  "modified",
]);

/** Ruolo di una versione file nella catena originale → lavorazione → consegna. */
export const ruoloVersioneEnum = pgEnum("ruolo_versione", [
  "originale",
  "lavorazione",
  "revisionata",
  "approvata",
  "deliverable",
]);

export const statoVersioneEnum = pgEnum("stato_versione", [
  "in_caricamento",
  "disponibile",
  "in_verifica",
  "needs_review",
  "scartata",
  "cancellata",
]);

export const statoPagamentoEnum = pgEnum("stato_pagamento", [
  "in_attesa",
  "autorizzato",
  "pagato",
  "fallito",
  "rimborsato",
  "annullato",
]);

export const tipoPagamentoEnum = pgEnum("tipo_pagamento", [
  "acconto",
  "saldo",
  "milestone",
  "personalizzato",
]);

export const metodoPagamentoEnum = pgEnum("metodo_pagamento", ["stripe", "bonifico", "altro"]);

export const statoFatturaEnum = pgEnum("stato_fattura", [
  "da_emettere",
  "in_emissione",
  "emessa",
  "errore",
  "annullata",
]);

export const statoApprovazioneEnum = pgEnum("stato_approvazione", [
  "richiesta",
  "approvata",
  "respinta",
  "scaduta",
]);

export const tipoApprovazioneEnum = pgEnum("tipo_approvazione", [
  "milestone_cliente",
  "editoriale",
  "operativa",
  "variazione",
]);

export const canaleNotificaEnum = pgEnum("canale_notifica", ["in_app", "email"]);

/** Colonne temporali presenti su quasi tutte le tabelle. */
export const tempi = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Chiave primaria standard. */
export const idPrimario = uuid("id").defaultRandom().primaryKey();
