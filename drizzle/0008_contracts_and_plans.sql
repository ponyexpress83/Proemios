CREATE TABLE "platform_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"tier" text NOT NULL,
	"author_id" text NOT NULL,
	"terms_version" text NOT NULL,
	"terms_hash" text NOT NULL,
	"order_sheet" jsonb NOT NULL,
	"order_sheet_hash" text NOT NULL,
	"storage_key" text,
	"pdf_hash" text,
	"acceptances" jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"accepted_ip" text,
	"accepted_user_agent" text,
	"consumer" boolean DEFAULT true NOT NULL,
	"withdrawal_deadline" timestamp with time zone,
	"withdrawal_requested_at" timestamp with time zone,
	"withdrawal_note" text,
	"withdrawal_handled_at" timestamp with time zone,
	"withdrawal_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_email_outbox" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "platform_payment_orders" ADD COLUMN "sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_payment_orders" ADD COLUMN "plan" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_payment_orders" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_payment_orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "referent_id" text;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "start_condition" text DEFAULT 'deposit' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_projects" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "payment_plan" jsonb;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD COLUMN "authorized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD COLUMN "executed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD COLUMN "stripe_refund_id" text;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "platform_contracts" ADD CONSTRAINT "platform_contracts_author_id_auth_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_quote_version_idx" ON "platform_contracts" USING btree ("quote_id","version");--> statement-breakpoint
CREATE INDEX "contract_author_idx" ON "platform_contracts" USING btree ("author_id");--> statement-breakpoint
ALTER TABLE "platform_projects" ADD CONSTRAINT "platform_projects_referent_id_auth_users_id_fk" FOREIGN KEY ("referent_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_quote_idx" ON "platform_projects" USING btree ("quote_id") WHERE "platform_projects"."quote_id" is not null;--> statement-breakpoint
ALTER TABLE "platform_refund_requests" ADD CONSTRAINT "platform_refund_requests_stripe_refund_id_unique" UNIQUE("stripe_refund_id");