CREATE TABLE "ai_job_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"paragraph_ids" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"cycle_id" uuid,
	"service" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"status_reason" text,
	"scope" jsonb NOT NULL,
	"instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"glossary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"effort" text NOT NULL,
	"base_revision_id" uuid NOT NULL,
	"budget_micros" bigint NOT NULL,
	"spent_micros" bigint DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"chunks_total" integer DEFAULT 0 NOT NULL,
	"chunks_done" integer DEFAULT 0 NOT NULL,
	"suggestions" integer DEFAULT 0 NOT NULL,
	"discarded" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"locked_until" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"project_id" uuid,
	"job_id" uuid,
	"deal_id" uuid,
	"actor_id" text,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint NOT NULL,
	"price_version" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"paragraph_id" text,
	"quote" text,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"visibility" text NOT NULL,
	"cycle_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"paragraphs" jsonb NOT NULL,
	"hash" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"base_revision_id" uuid NOT NULL,
	"paragraph_id" text NOT NULL,
	"kind" text DEFAULT 'replace' NOT NULL,
	"start" integer NOT NULL,
	"end" integer NOT NULL,
	"original_text" text NOT NULL,
	"suggested_text" text NOT NULL,
	"reason" text,
	"category" text DEFAULT 'other' NOT NULL,
	"origin" text NOT NULL,
	"job_id" uuid,
	"cycle_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"final_text" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"revision_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"docx_file_id" uuid,
	"pdf_file_id" uuid,
	"cycle_id" uuid,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"original_file_id" uuid NOT NULL,
	"source_format" text NOT NULL,
	"current_revision_id" uuid,
	"revision_number" integer DEFAULT 0 NOT NULL,
	"provider" text DEFAULT 'internal' NOT NULL,
	"external_id" text,
	"external_revision_id" text,
	"client_access" text DEFAULT 'comment' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"account_email" text,
	"encrypted_token" text,
	"scopes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"state_hash" text,
	"last_error" text,
	"connected_by" text,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_revision_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" text DEFAULT 'pending_decision' NOT NULL,
	"status" text DEFAULT 'collecting' NOT NULL,
	"requested_by" text,
	"notes" text,
	"scope" jsonb,
	"submitted_at" timestamp with time zone,
	"decided_by" text,
	"decision_reason" text,
	"quote_id" uuid,
	"delivered_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "revision_rounds" integer;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "revision_rounds_set_by" text;--> statement-breakpoint
ALTER TABLE "ai_job_chunks" ADD CONSTRAINT "ai_job_chunks_job_id_ai_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_project_id_platform_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."platform_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_document_id_doc_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."doc_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_comments" ADD CONSTRAINT "doc_comments_document_id_doc_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."doc_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_comments" ADD CONSTRAINT "doc_comments_author_id_auth_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_revisions" ADD CONSTRAINT "doc_revisions_document_id_doc_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."doc_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_suggestions" ADD CONSTRAINT "doc_suggestions_document_id_doc_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."doc_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_suggestions" ADD CONSTRAINT "doc_suggestions_base_revision_id_doc_revisions_id_fk" FOREIGN KEY ("base_revision_id") REFERENCES "public"."doc_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_suggestions" ADD CONSTRAINT "doc_suggestions_decided_by_auth_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_document_id_doc_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."doc_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_revision_id_doc_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."doc_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_docx_file_id_platform_files_id_fk" FOREIGN KEY ("docx_file_id") REFERENCES "public"."platform_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_pdf_file_id_platform_files_id_fk" FOREIGN KEY ("pdf_file_id") REFERENCES "public"."platform_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_approved_by_auth_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_documents" ADD CONSTRAINT "doc_documents_project_id_platform_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."platform_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_documents" ADD CONSTRAINT "doc_documents_original_file_id_platform_files_id_fk" FOREIGN KEY ("original_file_id") REFERENCES "public"."platform_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_documents" ADD CONSTRAINT "doc_documents_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_connections" ADD CONSTRAINT "external_connections_connected_by_auth_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_project_id_platform_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."platform_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_revision_cycles" ADD CONSTRAINT "doc_revision_cycles_project_id_platform_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."platform_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_revision_cycles" ADD CONSTRAINT "doc_revision_cycles_document_id_doc_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."doc_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_revision_cycles" ADD CONSTRAINT "doc_revision_cycles_requested_by_auth_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_revision_cycles" ADD CONSTRAINT "doc_revision_cycles_decided_by_auth_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_chunk_idx" ON "ai_job_chunks" USING btree ("job_id","index");--> statement-breakpoint
CREATE INDEX "ai_job_status_idx" ON "ai_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ai_job_doc_idx" ON "ai_jobs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "ai_usage_project_idx" ON "ai_usage" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "doc_comment_doc_idx" ON "doc_comments" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_revision_number_idx" ON "doc_revisions" USING btree ("document_id","number");--> statement-breakpoint
CREATE INDEX "doc_suggestion_status_idx" ON "doc_suggestions" USING btree ("document_id","status");--> statement-breakpoint
CREATE INDEX "doc_suggestion_job_idx" ON "doc_suggestions" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_version_number_idx" ON "doc_versions" USING btree ("document_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_original_idx" ON "doc_documents" USING btree ("original_file_id");--> statement-breakpoint
CREATE INDEX "doc_project_idx" ON "doc_documents" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_provider_idx" ON "external_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "project_cost_idx" ON "project_costs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_cycle_number_idx" ON "doc_revision_cycles" USING btree ("document_id","number");--> statement-breakpoint
CREATE INDEX "doc_cycle_project_idx" ON "doc_revision_cycles" USING btree ("project_id","status");