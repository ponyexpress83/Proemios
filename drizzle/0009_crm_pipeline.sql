ALTER TYPE "public"."lead_source" ADD VALUE 'marketplace';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'import';--> statement-breakpoint
CREATE TABLE "platform_lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"actor_id" text,
	"kind" text NOT NULL,
	"channel" text,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"purpose" text,
	"body" text,
	"outcome" text,
	"event_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_lead_activities_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "marketing_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "marketing_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "contact_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source_detail" varchar(200);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "external_ref" varchar(200);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_action" varchar(300);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_action_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "discount_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "discount_by" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "discount_note" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "discount_approved_by" text;--> statement-breakpoint
ALTER TABLE "platform_lead_activities" ADD CONSTRAINT "platform_lead_activities_actor_id_auth_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_activity_lead_idx" ON "platform_lead_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD CONSTRAINT "platform_quote_records_discount_by_auth_users_id_fk" FOREIGN KEY ("discount_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD CONSTRAINT "platform_quote_records_discount_approved_by_auth_users_id_fk" FOREIGN KEY ("discount_approved_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_external_ref_idx" ON "leads" USING btree ("external_ref");--> statement-breakpoint
CREATE INDEX "leads_next_action_idx" ON "leads" USING btree ("next_action_at");