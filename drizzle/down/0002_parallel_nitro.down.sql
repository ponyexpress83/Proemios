-- Rollback della migrazione 0002_parallel_nitro.
--
-- Generato da scripts/genera-rollback.mjs e riletto a mano.
--
-- ATTENZIONE: eliminare una tabella elimina i suoi dati. Serve ad annullare
-- un rilascio andato male in staging, non all'uso ordinario in produzione.
-- Fare un backup prima di eseguirlo.
--
--   npm run db:rollback

-- Colonne aggiunte a tabelle preesistenti
ALTER TABLE "agency_leads" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "stato";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "owner_id";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "client_id";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "valore_stimato";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "ultima_attivita_at";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "prossima_attivita_at";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "prossima_attivita";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "call_prenotata_at";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "perso_motivo";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "quotes" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "quotes" DROP COLUMN IF EXISTS "client_id";
ALTER TABLE "quotes" DROP COLUMN IF EXISTS "redatto_da_id";
ALTER TABLE "quotes" DROP COLUMN IF EXISTS "valido_fino_at";
ALTER TABLE "quotes" DROP COLUMN IF EXISTS "note_interne";

-- Tabelle introdotte dalla migrazione
DROP TABLE IF EXISTS "provider_policies" CASCADE;
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "audit_events" CASCADE;
DROP TABLE IF EXISTS "reviews" CASCADE;
DROP TABLE IF EXISTS "editorial_jobs" CASCADE;
DROP TABLE IF EXISTS "editorial_interventions" CASCADE;
DROP TABLE IF EXISTS "ai_job_runs" CASCADE;
DROP TABLE IF EXISTS "files" CASCADE;
DROP TABLE IF EXISTS "file_versions" CASCADE;
DROP TABLE IF EXISTS "deliverables" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "project_stages" CASCADE;
DROP TABLE IF EXISTS "project_members" CASCADE;
DROP TABLE IF EXISTS "milestones" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "clarification_requests" CASCADE;
DROP TABLE IF EXISTS "approvals" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "invoices" CASCADE;
DROP TABLE IF EXISTS "contracts" CASCADE;
DROP TABLE IF EXISTS "quote_items" CASCADE;
DROP TABLE IF EXISTS "lead_events" CASCADE;
DROP TABLE IF EXISTS "clients" CASCADE;
DROP TABLE IF EXISTS "verification_tokens" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "staff_accounts" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "inviti" CASCADE;
DROP TABLE IF EXISTS "accounts" CASCADE;
DROP TABLE IF EXISTS "organizations" CASCADE;

-- Tipi enum introdotti dalla migrazione
DROP TYPE IF EXISTS "public"."canale_notifica";
DROP TYPE IF EXISTS "public"."categoria_intervento";
DROP TYPE IF EXISTS "public"."livello_servizio";
DROP TYPE IF EXISTS "public"."metodo_pagamento";
DROP TYPE IF EXISTS "public"."modalita_revisione";
DROP TYPE IF EXISTS "public"."ruolo";
DROP TYPE IF EXISTS "public"."ruolo_run";
DROP TYPE IF EXISTS "public"."ruolo_versione";
DROP TYPE IF EXISTS "public"."stato_approvazione";
DROP TYPE IF EXISTS "public"."stato_attivita";
DROP TYPE IF EXISTS "public"."stato_contratto";
DROP TYPE IF EXISTS "public"."stato_fattura";
DROP TYPE IF EXISTS "public"."stato_intervento";
DROP TYPE IF EXISTS "public"."stato_job";
DROP TYPE IF EXISTS "public"."stato_lead";
DROP TYPE IF EXISTS "public"."stato_milestone";
DROP TYPE IF EXISTS "public"."stato_ordine";
DROP TYPE IF EXISTS "public"."stato_pagamento";
DROP TYPE IF EXISTS "public"."stato_progetto";
DROP TYPE IF EXISTS "public"."stato_run";
DROP TYPE IF EXISTS "public"."stato_tappa";
DROP TYPE IF EXISTS "public"."stato_versione";
DROP TYPE IF EXISTS "public"."tipo_approvazione";
DROP TYPE IF EXISTS "public"."tipo_organizzazione";
DROP TYPE IF EXISTS "public"."tipo_pagamento";
