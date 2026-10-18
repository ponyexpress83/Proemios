CREATE TABLE "platform_funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'ui' NOT NULL,
	"quote_id" uuid,
	"visitor_key" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "reminders_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "commercial_state" text DEFAULT 'offer' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "review_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "offered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "offered_by" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "preferred_tier" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "sales_assisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "reminders_paused_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "funnel_name_idx" ON "platform_funnel_events" USING btree ("name","created_at");--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD CONSTRAINT "platform_quote_records_offered_by_auth_users_id_fk" FOREIGN KEY ("offered_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;