CREATE TABLE "platform_account_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"optional_email" boolean DEFAULT false NOT NULL,
	"saved_filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"operation_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"filename" text NOT NULL,
	"source_key" text,
	"metrics" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"report" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"locked_until" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_analysis_jobs_operation_key_unique" UNIQUE("operation_key")
);
--> statement-breakpoint
CREATE TABLE "platform_quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"prepared_by" text NOT NULL,
	"authorized_by" text,
	"status" text DEFAULT 'prepared' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_account_preferences" ADD CONSTRAINT "platform_account_preferences_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_analysis_jobs" ADD CONSTRAINT "platform_analysis_jobs_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_quote_versions" ADD CONSTRAINT "platform_quote_versions_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD CONSTRAINT "platform_refund_requests_order_id_platform_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."platform_payment_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD CONSTRAINT "platform_refund_requests_prepared_by_auth_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD CONSTRAINT "platform_refund_requests_authorized_by_auth_users_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_user_idx" ON "platform_analysis_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analysis_status_idx" ON "platform_analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_version_idx" ON "platform_quote_versions" USING btree ("quote_id","version");