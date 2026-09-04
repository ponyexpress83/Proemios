/**
 * Schema Drizzle di Proemios.
 *
 * Suddiviso per dominio: un solo file da 1.500 righe rende impossibile capire
 * dove finisce il CRM e comincia la produzione.
 *
 * Convenzioni:
 *  - importi sempre in **centesimi**, mai float;
 *  - `organization_id` su ogni entità che appartiene a un tenant, e il livello
 *    dati (lib/dati/) filtra sempre su quello;
 *  - nessun binario in database: i file stanno nello storage, qui c'è la chiave;
 *  - nessun testo integrale di manoscritto in log, audit o metadati.
 */
export * from "./comuni";
export * from "./organizzazioni";
export * from "./utenti";
export * from "./crm";
export * from "./commercio";
export * from "./progetti";
export * from "./file";
export * from "./produzione";
export * from "./sistema";
