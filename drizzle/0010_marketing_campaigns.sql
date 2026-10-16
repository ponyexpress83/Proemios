CREATE TABLE "platform_campaign_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"day" text NOT NULL,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer,
	"clicks" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"channel" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"destination" text DEFAULT '/preventivo' NOT NULL,
	"utm_source" text NOT NULL,
	"utm_medium" text NOT NULL,
	"utm_campaign" text NOT NULL,
	"utm_content" text,
	"utm_term" text,
	"partner_id" text,
	"seller_id" text,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_campaign_spend" ADD CONSTRAINT "platform_campaign_spend_campaign_id_platform_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."platform_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_campaign_spend" ADD CONSTRAINT "platform_campaign_spend_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_campaigns" ADD CONSTRAINT "platform_campaigns_partner_id_auth_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_campaigns" ADD CONSTRAINT "platform_campaigns_seller_id_auth_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_campaigns" ADD CONSTRAINT "platform_campaigns_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_spend_day_idx" ON "platform_campaign_spend" USING btree ("campaign_id","day","source");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_utm_idx" ON "platform_campaigns" USING btree ("utm_source","utm_medium","utm_campaign");