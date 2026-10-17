CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'server' NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_per_minute" integer DEFAULT 60 NOT NULL,
	"created_by" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE "crm_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"quote_id" uuid,
	"deal_id" uuid,
	"requested_by" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"from_user" text,
	"to_user" text,
	"method" text NOT NULL,
	"reason" text NOT NULL,
	"rule_version" text,
	"detail" jsonb,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"current" boolean DEFAULT true NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"path" text NOT NULL,
	"marketing" jsonb,
	"affiliate_id" text,
	"sourcer_id" text,
	"owner_at_sale" text,
	"credited_seller_id" text,
	"closing" text NOT NULL,
	"status" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"beneficiaries" jsonb NOT NULL,
	"rule_version" text NOT NULL,
	"commission_rule_version" text,
	"corrected_by" text,
	"correction_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vat_number" text,
	"website" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"phone" text,
	"phone_normalized" text,
	"company_id" uuid,
	"user_id" text,
	"identity_verified_at" timestamp with time zone,
	"language" text DEFAULT 'it' NOT NULL,
	"merged_into_id" uuid,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"origin_lead_id" uuid,
	"title" text NOT NULL,
	"pipeline_key" text DEFAULT 'vendite' NOT NULL,
	"stage" text DEFAULT 'received' NOT NULL,
	"owner_id" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"lost_reason_key" text,
	"lost_note" text,
	"closed_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"type" text NOT NULL,
	"entity_id" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "crm_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_handoff_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"parent_id" uuid,
	"decided_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_handoffs" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"deal_id" uuid,
	"contract_id" uuid,
	"seller_id" text,
	"package" jsonb NOT NULL,
	"inconsistencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"matched_on" jsonb NOT NULL,
	"reason" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"layout" text DEFAULT 'table' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"deal_id" uuid,
	"quote_id" uuid,
	"catalog_key" text,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"views" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_share_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "crm_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text NOT NULL,
	"event" text NOT NULL,
	"channel" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_event_pk" PRIMARY KEY("user_id","event")
);
--> statement-breakpoint
CREATE TABLE "setting_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" text NOT NULL,
	"value" jsonb NOT NULL,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"author_id" text,
	"project_id" uuid,
	"quote_id" uuid,
	"order_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_to" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "team_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"team" text,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '["it"]'::jsonb NOT NULL,
	"hours" jsonb,
	"absences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity" integer,
	"participates" boolean DEFAULT true NOT NULL,
	"max_discount_bps" integer,
	"max_installments" integer,
	"external" boolean DEFAULT false NOT NULL,
	"last_assigned_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"deactivation_reason" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_status" integer,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"secret_enc" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_tasks" ALTER COLUMN "assigned_to" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source_kind" varchar(20);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sourced_by" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "priority" varchar(10) DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "language" varchar(8) DEFAULT 'it' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "required_skill" varchar(40);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "assignment_status" varchar(12) DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reserved_by" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reserved_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sla_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "first_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "custom" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_lead_activities" ADD COLUMN "structured" jsonb;--> statement-breakpoint
ALTER TABLE "platform_lead_activities" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_lead_notes" ADD COLUMN "visibility" text DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "ops_status" text DEFAULT 'waiting_materials' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "ops_lead_id" text;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "qa_owner_id" text;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "contractual_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "origin_link_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "custom_lines" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "work_terms" jsonb;--> statement-breakpoint
ALTER TABLE "platform_invitations" ADD COLUMN "template" text;--> statement-breakpoint
ALTER TABLE "platform_invitations" ADD COLUMN "profile" jsonb;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "support_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "status" text DEFAULT 'todo' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "phase" text;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "skill" text;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "depends_on" uuid;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "claimable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_approvals" ADD CONSTRAINT "crm_approvals_requested_by_auth_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_handoff_items" ADD CONSTRAINT "crm_handoff_items_author_id_auth_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_saved_views" ADD CONSTRAINT "crm_saved_views_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_share_links" ADD CONSTRAINT "crm_share_links_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_author_id_auth_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assigned_to_auth_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_assignment_entity_idx" ON "crm_assignments" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_assignment_to_idx" ON "crm_assignments" USING btree ("to_user","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_attribution_version_idx" ON "crm_attributions" USING btree ("quote_id","version");--> statement-breakpoint
CREATE INDEX "crm_attribution_seller_idx" ON "crm_attributions" USING btree ("credited_seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contact_email_idx" ON "crm_contacts" USING btree ("email_normalized") WHERE "crm_contacts"."merged_into_id" is null;--> statement-breakpoint
CREATE INDEX "crm_contact_phone_idx" ON "crm_contacts" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "crm_contact_user_idx" ON "crm_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crm_deal_contact_idx" ON "crm_deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_deal_owner_idx" ON "crm_deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "crm_deal_next_idx" ON "crm_deals" USING btree ("next_action_at");--> statement-breakpoint
CREATE INDEX "crm_event_type_idx" ON "crm_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_field_entity_key_idx" ON "crm_field_definitions" USING btree ("entity","key");--> statement-breakpoint
CREATE INDEX "crm_handoff_item_project_idx" ON "crm_handoff_items" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "setting_version_idx" ON "setting_versions" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "support_contact_idx" ON "support_requests" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "support_assignee_idx" ON "support_requests" USING btree ("assigned_to");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_delivery_idx" ON "webhook_deliveries" USING btree ("endpoint_id","event_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_due_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "platform_projects" ADD CONSTRAINT "platform_projects_ops_lead_id_auth_users_id_fk" FOREIGN KEY ("ops_lead_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD CONSTRAINT "platform_projects_qa_owner_id_auth_users_id_fk" FOREIGN KEY ("qa_owner_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_contact_idx" ON "leads" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "leads_assignment_idx" ON "leads" USING btree ("assignment_status","sla_due_at");--> statement-breakpoint
-- Dati esistenti: un contatto per email, una trattativa per ogni richiesta, proposte e progetti agganciati.
INSERT INTO "crm_contacts" ("name", "email", "email_normalized", "phone", "phone_normalized", "created_at", "updated_at")
SELECT (array_agg("nome" ORDER BY "created_at" DESC))[1], lower(trim("email")), lower(trim("email")),
  (array_agg("telefono" ORDER BY "created_at" DESC) FILTER (WHERE "telefono" IS NOT NULL AND "telefono" <> ''))[1],
  NULL, min("created_at"), now()
FROM "leads" GROUP BY lower(trim("email"));--> statement-breakpoint
UPDATE "leads" l SET "contact_id" = c."id" FROM "crm_contacts" c WHERE c."email_normalized" = lower(trim(l."email")) AND c."merged_into_id" IS NULL;--> statement-breakpoint
INSERT INTO "crm_deals" ("contact_id", "origin_lead_id", "title", "stage", "owner_id", "next_action", "next_action_at", "lost_note", "closed_at", "created_at", "updated_at")
SELECT l."contact_id", l."id", l."nome", l."stage", o."assigned_to", l."next_action", l."next_action_at", l."lost_reason", l."closed_at", l."created_at", now()
FROM "leads" l LEFT JOIN "platform_lead_ownership" o ON o."lead_id" = l."id";--> statement-breakpoint
UPDATE "leads" l SET "deal_id" = d."id" FROM "crm_deals" d WHERE d."origin_lead_id" = l."id";--> statement-breakpoint
UPDATE "leads" SET "source_kind" = CASE "fonte" WHEN 'marketplace' THEN 'marketplace' WHEN 'import' THEN 'manual' ELSE 'form' END;--> statement-breakpoint
UPDATE "platform_quote_records" r SET "deal_id" = l."deal_id" FROM "quotes" q JOIN "leads" l ON l."id" = q."lead_id" WHERE q."id" = r."quote_id";--> statement-breakpoint
UPDATE "platform_projects" p SET "deal_id" = r."deal_id" FROM "platform_quote_records" r WHERE r."quote_id" = p."quote_id";--> statement-breakpoint
UPDATE "platform_projects" SET "ops_status" = CASE WHEN "stage" IN ('approved', 'delivered') THEN 'concluded' WHEN "stage" = 'review' THEN 'client_review' WHEN "stage" IN ('editing') THEN 'in_progress' WHEN "stage" IN ('intake') THEN 'ready_for_assignment' ELSE 'waiting_materials' END;--> statement-breakpoint
UPDATE "platform_tasks" SET "status" = 'done', "completed_at" = "created_at" WHERE "done" = true;
