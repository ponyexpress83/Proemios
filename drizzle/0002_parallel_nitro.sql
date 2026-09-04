-- Fase 2 — modello dati completo.
--
-- Migrazione additiva: nessun DROP, nessuna colonna rimossa, nessun dato
-- toccato. Le tabelle preesistenti (leads, quotes, manuscript_analyses,
-- agency_leads) restano e ricevono solo colonne nuove, tutte nullable o con
-- default.
--
-- Cinque istruzioni su `leads` sono rese idempotenti (IF NOT EXISTS): la
-- migrazione 0001_ads_attribution.sql fu scritta a mano senza aggiornare lo
-- snapshot di drizzle-kit, che quindi le ripropone. Su un database già
-- migrato quelle colonne e quegli indici esistono già.
--
-- Rollback: drizzle/down/0002_parallel_nitro.down.sql (npm run db:rollback).

CREATE TYPE "public"."canale_notifica" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."categoria_intervento" AS ENUM('refuso', 'ortografia', 'punteggiatura', 'grammatica', 'sintassi', 'ripetizione', 'uniformita-tipografica', 'stile', 'dubbio-da-verificare');--> statement-breakpoint
CREATE TYPE "public"."livello_servizio" AS ENUM('correzione-bozze', 'revisione-linguistica', 'editing-stilistico', 'editing-narrativo');--> statement-breakpoint
CREATE TYPE "public"."metodo_pagamento" AS ENUM('stripe', 'bonifico', 'altro');--> statement-breakpoint
CREATE TYPE "public"."modalita_revisione" AS ENUM('controllato', 'premium');--> statement-breakpoint
CREATE TYPE "public"."ruolo" AS ENUM('super_admin', 'operations_admin', 'editorial_manager', 'editor_reviewer', 'finance', 'client');--> statement-breakpoint
CREATE TYPE "public"."ruolo_run" AS ENUM('primaria', 'secondaria', 'adjudicator', 'controllo');--> statement-breakpoint
CREATE TYPE "public"."ruolo_versione" AS ENUM('originale', 'lavorazione', 'revisionata', 'approvata', 'deliverable');--> statement-breakpoint
CREATE TYPE "public"."stato_approvazione" AS ENUM('richiesta', 'approvata', 'respinta', 'scaduta');--> statement-breakpoint
CREATE TYPE "public"."stato_attivita" AS ENUM('da_fare', 'in_corso', 'bloccata', 'fatta', 'annullata');--> statement-breakpoint
CREATE TYPE "public"."stato_contratto" AS ENUM('bozza', 'inviato', 'firmato', 'risolto');--> statement-breakpoint
CREATE TYPE "public"."stato_fattura" AS ENUM('da_emettere', 'in_emissione', 'emessa', 'errore', 'annullata');--> statement-breakpoint
CREATE TYPE "public"."stato_intervento" AS ENUM('pending', 'accepted', 'rejected', 'modified');--> statement-breakpoint
CREATE TYPE "public"."stato_job" AS ENUM('queued', 'running', 'needs_review', 'needs_input', 'editorially_approved', 'approved', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stato_lead" AS ENUM('nuovo', 'qualificato', 'call', 'proposta', 'cliente', 'produzione', 'post_pubblicazione', 'perso');--> statement-breakpoint
CREATE TYPE "public"."stato_milestone" AS ENUM('pianificata', 'in_corso', 'in_approvazione', 'approvata', 'respinta');--> statement-breakpoint
CREATE TYPE "public"."stato_ordine" AS ENUM('bozza', 'in_attesa_pagamento', 'confermato', 'in_produzione', 'consegnato', 'chiuso', 'annullato');--> statement-breakpoint
CREATE TYPE "public"."stato_pagamento" AS ENUM('in_attesa', 'autorizzato', 'pagato', 'fallito', 'rimborsato', 'annullato');--> statement-breakpoint
CREATE TYPE "public"."stato_progetto" AS ENUM('avvio', 'in_corso', 'in_attesa_cliente', 'in_revisione', 'in_consegna', 'concluso', 'sospeso', 'annullato');--> statement-breakpoint
CREATE TYPE "public"."stato_run" AS ENUM('in_corso', 'completata', 'fallita', 'annullata');--> statement-breakpoint
CREATE TYPE "public"."stato_tappa" AS ENUM('attesa', 'in_corso', 'completata', 'bloccata', 'saltata');--> statement-breakpoint
CREATE TYPE "public"."stato_versione" AS ENUM('in_caricamento', 'disponibile', 'in_verifica', 'needs_review', 'scartata', 'cancellata');--> statement-breakpoint
CREATE TYPE "public"."tipo_approvazione" AS ENUM('milestone_cliente', 'editoriale', 'operativa', 'variazione');--> statement-breakpoint
CREATE TYPE "public"."tipo_organizzazione" AS ENUM('studio', 'agenzia');--> statement-breakpoint
CREATE TYPE "public"."tipo_pagamento" AS ENUM('acconto', 'saldo', 'milestone', 'personalizzato');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"nome" varchar(200) NOT NULL,
	"tipo" "tipo_organizzazione" DEFAULT 'agenzia' NOT NULL,
	"attiva" boolean DEFAULT true NOT NULL,
	"branding" jsonb,
	"proemios_invisibile" boolean DEFAULT false NOT NULL,
	"nda_firmato_at" timestamp with time zone,
	"sla_giorni_lavorazione" jsonb,
	"note_interne" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"provider" varchar(80) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(80),
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "inviti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"ruolo" "ruolo" NOT NULL,
	"organization_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"invitato_da_id" uuid,
	"scade_at" timestamp with time zone NOT NULL,
	"accettato_at" timestamp with time zone,
	"revocato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"user_agent" varchar(400),
	"indirizzo_ip" varchar(64),
	"creata_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"titolo" varchar(120),
	"specializzazioni" jsonb DEFAULT '[]'::jsonb,
	"capacita_settimanale_parole" integer,
	"note_interne" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified" timestamp with time zone,
	"name" varchar(200),
	"image" text,
	"ruolo" "ruolo" DEFAULT 'client' NOT NULL,
	"organization_id" uuid NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"disattivato_at" timestamp with time zone,
	"motivo_disattivazione" varchar(300),
	"ultimo_accesso_at" timestamp with time zone,
	"mfa_abilitata" boolean DEFAULT false NOT NULL,
	"mfa_segreto" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(320) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"tipo" varchar(20) DEFAULT 'privato' NOT NULL,
	"nome" varchar(200) NOT NULL,
	"cognome" varchar(200),
	"ragione_sociale" varchar(300),
	"email" varchar(320) NOT NULL,
	"telefono" varchar(40),
	"indirizzo" jsonb,
	"partita_iva" varchar(30),
	"codice_fiscale" varchar(30),
	"codice_destinatario" varchar(20),
	"pec" varchar(320),
	"alias" varchar(80),
	"note_commerciali" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"tipo" varchar(60) NOT NULL,
	"attore_id" uuid,
	"descrizione" varchar(500),
	"dettagli" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"servizio_slug" varchar(80),
	"descrizione" varchar(300) NOT NULL,
	"quantita" integer DEFAULT 1 NOT NULL,
	"prezzo_unitario_cent" integer NOT NULL,
	"sconto_cent" integer DEFAULT 0 NOT NULL,
	"totale_cent" integer NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"stato" "stato_contratto" DEFAULT 'bozza' NOT NULL,
	"versione" integer DEFAULT 1 NOT NULL,
	"testo" text,
	"chiave_documento" varchar(500),
	"inviato_at" timestamp with time zone,
	"firmato_at" timestamp with time zone,
	"firmato_da" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"order_id" uuid,
	"payment_id" uuid,
	"stato" "stato_fattura" DEFAULT 'da_emettere' NOT NULL,
	"imponibile_cent" integer NOT NULL,
	"iva_cent" integer DEFAULT 0 NOT NULL,
	"totale_cent" integer NOT NULL,
	"provider_nome" varchar(60),
	"provider_documento_id" varchar(120),
	"numero_documento" varchar(60),
	"data_documento" timestamp with time zone,
	"url_documento" text,
	"dati_fatturazione" jsonb,
	"errore_messaggio" varchar(500),
	"tentativi" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codice" varchar(30) NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"quote_id" uuid,
	"stato" "stato_ordine" DEFAULT 'bozza' NOT NULL,
	"imponibile_cent" integer NOT NULL,
	"iva_cent" integer DEFAULT 0 NOT NULL,
	"totale_cent" integer NOT NULL,
	"acconto_punti_base" integer NOT NULL,
	"acconto_cent" integer NOT NULL,
	"creato_da_id" uuid,
	"confermato_at" timestamp with time zone,
	"note_interne" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid,
	"client_id" uuid,
	"milestone_id" uuid,
	"tipo" "tipo_pagamento" NOT NULL,
	"metodo" "metodo_pagamento" DEFAULT 'stripe' NOT NULL,
	"stato" "stato_pagamento" DEFAULT 'in_attesa' NOT NULL,
	"importo_cent" integer NOT NULL,
	"valuta" varchar(3) DEFAULT 'EUR' NOT NULL,
	"stripe_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"riferimento_esterno" varchar(200),
	"registrato_da_id" uuid,
	"pagato_at" timestamp with time zone,
	"rimborsato_at" timestamp with time zone,
	"importo_rimborsato_cent" integer DEFAULT 0 NOT NULL,
	"scadenza_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"job_id" uuid,
	"file_version_id" uuid,
	"tipo" "tipo_approvazione" NOT NULL,
	"stato" "stato_approvazione" DEFAULT 'richiesta' NOT NULL,
	"richiesta_a_id" uuid,
	"richiesta_da_id" uuid,
	"decisa_da_id" uuid,
	"decisa_at" timestamp with time zone,
	"motivazione" text,
	"scade_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clarification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"job_id" uuid,
	"richiedente_id" uuid,
	"domanda_interna" text NOT NULL,
	"domanda_al_cliente" text,
	"riferimento" varchar(300),
	"risposta" text,
	"risposta_da_id" uuid,
	"risposta_at" timestamp with time zone,
	"inoltrata_al_cliente_at" timestamp with time zone,
	"chiusa_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"autore_id" uuid,
	"corpo" text NOT NULL,
	"visibile_al_cliente" boolean DEFAULT false NOT NULL,
	"allegati" jsonb DEFAULT '[]'::jsonb,
	"letto_da_cliente" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" uuid,
	"nome" varchar(200) NOT NULL,
	"descrizione" text,
	"stato" "stato_milestone" DEFAULT 'pianificata' NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"scadenza_at" timestamp with time zone,
	"importo_cent" integer,
	"approvata_at" timestamp with time zone,
	"approvata_da_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"ruolo" "ruolo" NOT NULL,
	"assegnato_da_id" uuid,
	"rimosso_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"nome" varchar(150) NOT NULL,
	"descrizione" text,
	"ordine" integer DEFAULT 0 NOT NULL,
	"stato" "stato_tappa" DEFAULT 'attesa' NOT NULL,
	"inizio_previsto_at" timestamp with time zone,
	"fine_prevista_at" timestamp with time zone,
	"completata_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codice" varchar(20) NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"order_id" uuid,
	"titolo" varchar(300) NOT NULL,
	"titolo_alias" varchar(120),
	"percorso_slug" varchar(80),
	"servizi_slug" jsonb DEFAULT '[]'::jsonb,
	"stato" "stato_progetto" DEFAULT 'avvio' NOT NULL,
	"avanzamento" integer DEFAULT 0 NOT NULL,
	"project_manager_id" uuid,
	"conteggio_parole" integer,
	"scadenza_at" timestamp with time zone,
	"prioritaria" boolean DEFAULT false NOT NULL,
	"brief" jsonb,
	"brief_verificato_at" timestamp with time zone,
	"brief_verificato_da_id" uuid,
	"istruzioni_editoriali" text,
	"note_interne" text,
	"concluso_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" uuid,
	"titolo" varchar(300) NOT NULL,
	"descrizione" text,
	"stato" "stato_attivita" DEFAULT 'da_fare' NOT NULL,
	"assegnato_a_id" uuid,
	"creato_da_id" uuid,
	"scadenza_at" timestamp with time zone,
	"completata_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"file_version_id" uuid NOT NULL,
	"titolo" varchar(300) NOT NULL,
	"descrizione" text,
	"consegnato_at" timestamp with time zone,
	"consegnato_da_id" uuid,
	"visibile_al_cliente" boolean DEFAULT false NOT NULL,
	"scaricato_at" timestamp with time zone,
	"conteggio_download" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"job_id" uuid,
	"numero_versione" integer NOT NULL,
	"ruolo" "ruolo_versione" NOT NULL,
	"stato" "stato_versione" DEFAULT 'in_caricamento' NOT NULL,
	"nome_file" varchar(400) NOT NULL,
	"mime_type" varchar(150) NOT NULL,
	"dimensione_byte" bigint NOT NULL,
	"hash_sha256" varchar(64) NOT NULL,
	"chiave_storage" varchar(500) NOT NULL,
	"driver_storage" varchar(30) NOT NULL,
	"precedente_id" uuid,
	"creato_da_id" uuid,
	"metadati" jsonb,
	"nota_verifica" varchar(500),
	"cancellata_at" timestamp with time zone,
	"conservare_fino_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"nome" varchar(400) NOT NULL,
	"categoria" varchar(40) DEFAULT 'altro' NOT NULL,
	"caricato_da_id" uuid,
	"versione_corrente_id" uuid,
	"archiviato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"ruolo" "ruolo_run" NOT NULL,
	"stato" "stato_run" DEFAULT 'in_corso' NOT NULL,
	"provider" varchar(40) NOT NULL,
	"modello" varchar(120) NOT NULL,
	"versione_prompt" varchar(60),
	"prompt_riferimento" varchar(300),
	"motivazioni_routing" jsonb DEFAULT '[]'::jsonb,
	"token_input" integer,
	"token_output" integer,
	"costo_micro_cent" integer,
	"latenza_ms" integer,
	"tentativo" integer DEFAULT 1 NOT NULL,
	"interventi_prodotti" integer DEFAULT 0 NOT NULL,
	"errore_messaggio" varchar(500),
	"iniziata_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conclusa_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"run_id" uuid,
	"organization_id" uuid NOT NULL,
	"categoria" "categoria_intervento" NOT NULL,
	"ancora" jsonb NOT NULL,
	"prima" text NOT NULL,
	"dopo" text NOT NULL,
	"confidenza" real NOT NULL,
	"motivazione_interna" text NOT NULL,
	"commento_per_autore" text,
	"stato" "stato_intervento" DEFAULT 'pending' NOT NULL,
	"testo_modificato" text,
	"rivisto_da_id" uuid,
	"rivisto_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codice" varchar(30) NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"file_version_origine_id" uuid,
	"file_version_esito_id" uuid,
	"livello_servizio" "livello_servizio" NOT NULL,
	"modalita_revisione" "modalita_revisione" DEFAULT 'controllato' NOT NULL,
	"stato" "stato_job" DEFAULT 'queued' NOT NULL,
	"assegnato_a_id" uuid,
	"assegnato_da_id" uuid,
	"assegnato_at" timestamp with time zone,
	"conteggio_parole" integer,
	"conteggio_interventi" integer DEFAULT 0 NOT NULL,
	"conteggio_da_verificare" integer DEFAULT 0 NOT NULL,
	"istruzioni" text,
	"scadenza_at" timestamp with time zone,
	"prioritaria" boolean DEFAULT false NOT NULL,
	"approvato_editorialmente_at" timestamp with time zone,
	"approvato_editorialmente_da_id" uuid,
	"approvato_at" timestamp with time zone,
	"approvato_da_id" uuid,
	"consegnato_at" timestamp with time zone,
	"errore_messaggio" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"revisore_id" uuid NOT NULL,
	"iniziata_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conclusa_at" timestamp with time zone,
	"interventi_accettati" integer DEFAULT 0 NOT NULL,
	"interventi_rifiutati" integer DEFAULT 0 NOT NULL,
	"interventi_modificati" integer DEFAULT 0 NOT NULL,
	"note_interne" text,
	"esito" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"attore_id" uuid,
	"attore_ruolo" varchar(40),
	"azione" varchar(80) NOT NULL,
	"entita" varchar(60),
	"entita_id" uuid,
	"esito" varchar(20) DEFAULT 'ok' NOT NULL,
	"metadati" jsonb,
	"indirizzo_ip" varchar(64),
	"user_agent" varchar(400),
	"richiesta_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"destinatario_id" uuid NOT NULL,
	"tipo" varchar(60) NOT NULL,
	"canale" "canale_notifica" DEFAULT 'in_app' NOT NULL,
	"titolo" varchar(200) NOT NULL,
	"corpo" text,
	"percorso" varchar(300),
	"entita" varchar(60),
	"entita_id" uuid,
	"letta_at" timestamp with time zone,
	"inviata_at" timestamp with time zone,
	"errore_invio" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) NOT NULL,
	"modello" varchar(120),
	"addestramento_consentito" boolean DEFAULT false NOT NULL,
	"zero_data_retention" boolean DEFAULT false NOT NULL,
	"giorni_conservazione" varchar(20),
	"dpa_disponibile" boolean DEFAULT false NOT NULL,
	"regione_dati" varchar(60),
	"subresponsabili" jsonb DEFAULT '[]'::jsonb,
	"approvato_manoscritti_inediti" boolean DEFAULT false NOT NULL,
	"approvato_progetti_sensibili" boolean DEFAULT false NOT NULL,
	"note" text,
	"rivisto_at" timestamp with time zone,
	"rivisto_da_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_leads" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage" varchar(40) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lead_score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "attribution" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stato" "stato_lead" DEFAULT 'nuovo' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "valore_stimato" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ultima_attivita_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "prossima_attivita_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "prossima_attivita" varchar(300);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "call_prenotata_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "perso_motivo" varchar(300);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "redatto_da_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "valido_fino_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "note_interne" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inviti" ADD CONSTRAINT "inviti_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inviti" ADD CONSTRAINT "inviti_invitato_da_id_users_id_fk" FOREIGN KEY ("invitato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_attore_id_users_id_fk" FOREIGN KEY ("attore_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_creato_da_id_users_id_fk" FOREIGN KEY ("creato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registrato_da_id_users_id_fk" FOREIGN KEY ("registrato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_richiesta_a_id_users_id_fk" FOREIGN KEY ("richiesta_a_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_richiesta_da_id_users_id_fk" FOREIGN KEY ("richiesta_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decisa_da_id_users_id_fk" FOREIGN KEY ("decisa_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_richiedente_id_users_id_fk" FOREIGN KEY ("richiedente_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_risposta_da_id_users_id_fk" FOREIGN KEY ("risposta_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_autore_id_users_id_fk" FOREIGN KEY ("autore_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_approvata_da_id_users_id_fk" FOREIGN KEY ("approvata_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_assegnato_da_id_users_id_fk" FOREIGN KEY ("assegnato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_users_id_fk" FOREIGN KEY ("project_manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_brief_verificato_da_id_users_id_fk" FOREIGN KEY ("brief_verificato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assegnato_a_id_users_id_fk" FOREIGN KEY ("assegnato_a_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creato_da_id_users_id_fk" FOREIGN KEY ("creato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_file_version_id_file_versions_id_fk" FOREIGN KEY ("file_version_id") REFERENCES "public"."file_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_consegnato_da_id_users_id_fk" FOREIGN KEY ("consegnato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_creato_da_id_users_id_fk" FOREIGN KEY ("creato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_caricato_da_id_users_id_fk" FOREIGN KEY ("caricato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_runs" ADD CONSTRAINT "ai_job_runs_job_id_editorial_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."editorial_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_runs" ADD CONSTRAINT "ai_job_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_interventions" ADD CONSTRAINT "editorial_interventions_job_id_editorial_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."editorial_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_interventions" ADD CONSTRAINT "editorial_interventions_run_id_ai_job_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_job_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_interventions" ADD CONSTRAINT "editorial_interventions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_interventions" ADD CONSTRAINT "editorial_interventions_rivisto_da_id_users_id_fk" FOREIGN KEY ("rivisto_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_file_version_origine_id_file_versions_id_fk" FOREIGN KEY ("file_version_origine_id") REFERENCES "public"."file_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_file_version_esito_id_file_versions_id_fk" FOREIGN KEY ("file_version_esito_id") REFERENCES "public"."file_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_assegnato_a_id_users_id_fk" FOREIGN KEY ("assegnato_a_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_assegnato_da_id_users_id_fk" FOREIGN KEY ("assegnato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_approvato_editorialmente_da_id_users_id_fk" FOREIGN KEY ("approvato_editorialmente_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_jobs" ADD CONSTRAINT "editorial_jobs_approvato_da_id_users_id_fk" FOREIGN KEY ("approvato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_editorial_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."editorial_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_revisore_id_users_id_fk" FOREIGN KEY ("revisore_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_attore_id_users_id_fk" FOREIGN KEY ("attore_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_destinatario_id_users_id_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_policies" ADD CONSTRAINT "provider_policies_rivisto_da_id_users_id_fk" FOREIGN KEY ("rivisto_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_tipo_idx" ON "organizations" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inviti_email_idx" ON "inviti" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "inviti_token_idx" ON "inviti" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "inviti_organization_idx" ON "inviti" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_accounts_user_idx" ON "staff_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_organization_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_ruolo_idx" ON "users" USING btree ("ruolo");--> statement-breakpoint
CREATE INDEX "clients_organization_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "clients_user_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lead_events_lead_idx" ON "lead_events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_events_tipo_idx" ON "lead_events" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "lead_events_created_at_idx" ON "lead_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "contracts_order_idx" ON "contracts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "contracts_organization_idx" ON "contracts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoices_organization_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_stato_idx" ON "invoices" USING btree ("stato");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_codice_idx" ON "orders" USING btree ("codice");--> statement-breakpoint
CREATE INDEX "orders_organization_idx" ON "orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "orders_client_idx" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "orders_stato_idx" ON "orders" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "payments_organization_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_stato_idx" ON "payments" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "payments_stripe_session_idx" ON "payments" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "payments_stripe_intent_idx" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "approvals_project_idx" ON "approvals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "approvals_stato_idx" ON "approvals" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "approvals_richiesta_a_idx" ON "approvals" USING btree ("richiesta_a_id");--> statement-breakpoint
CREATE INDEX "clarification_requests_project_idx" ON "clarification_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "clarification_requests_job_idx" ON "clarification_requests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "messages_project_idx" ON "messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "milestones_stato_idx" ON "milestones" USING btree ("stato");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_unico_idx" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_stages_project_idx" ON "project_stages" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_codice_idx" ON "projects" USING btree ("codice");--> statement-breakpoint
CREATE INDEX "projects_organization_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "projects_stato_idx" ON "projects" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "projects_pm_idx" ON "projects" USING btree ("project_manager_id");--> statement-breakpoint
CREATE INDEX "projects_scadenza_idx" ON "projects" USING btree ("scadenza_at");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_assegnato_idx" ON "tasks" USING btree ("assegnato_a_id");--> statement-breakpoint
CREATE INDEX "tasks_stato_idx" ON "tasks" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "deliverables_project_idx" ON "deliverables" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deliverables_organization_idx" ON "deliverables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "file_versions_file_idx" ON "file_versions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_versions_project_idx" ON "file_versions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "file_versions_job_idx" ON "file_versions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "file_versions_hash_idx" ON "file_versions" USING btree ("hash_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "file_versions_numero_idx" ON "file_versions" USING btree ("file_id","numero_versione");--> statement-breakpoint
CREATE INDEX "files_project_idx" ON "files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "files_organization_idx" ON "files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "files_categoria_idx" ON "files" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "ai_job_runs_job_idx" ON "ai_job_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_job_runs_stato_idx" ON "ai_job_runs" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "editorial_interventions_job_idx" ON "editorial_interventions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "editorial_interventions_run_idx" ON "editorial_interventions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "editorial_interventions_stato_idx" ON "editorial_interventions" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "editorial_interventions_categoria_idx" ON "editorial_interventions" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "editorial_jobs_codice_idx" ON "editorial_jobs" USING btree ("codice");--> statement-breakpoint
CREATE INDEX "editorial_jobs_project_idx" ON "editorial_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "editorial_jobs_stato_idx" ON "editorial_jobs" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "editorial_jobs_assegnato_idx" ON "editorial_jobs" USING btree ("assegnato_a_id");--> statement-breakpoint
CREATE INDEX "editorial_jobs_organization_idx" ON "editorial_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "reviews_job_idx" ON "reviews" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "reviews_revisore_idx" ON "reviews" USING btree ("revisore_id");--> statement-breakpoint
CREATE INDEX "audit_events_attore_idx" ON "audit_events" USING btree ("attore_id");--> statement-breakpoint
CREATE INDEX "audit_events_azione_idx" ON "audit_events" USING btree ("azione");--> statement-breakpoint
CREATE INDEX "audit_events_entita_idx" ON "audit_events" USING btree ("entita","entita_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_organization_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notifications_destinatario_idx" ON "notifications" USING btree ("destinatario_id");--> statement-breakpoint
CREATE INDEX "notifications_letta_idx" ON "notifications" USING btree ("letta_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "provider_policies_provider_idx" ON "provider_policies" USING btree ("provider");--> statement-breakpoint
ALTER TABLE "agency_leads" ADD CONSTRAINT "agency_leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_redatto_da_id_users_id_fk" FOREIGN KEY ("redatto_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_score_idx" ON "leads" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "leads_stato_idx" ON "leads" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "leads_owner_idx" ON "leads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "leads_organization_idx" ON "leads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "quotes_client_idx" ON "quotes" USING btree ("client_id");