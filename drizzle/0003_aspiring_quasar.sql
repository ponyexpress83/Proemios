ALTER TABLE "platform_quote_records" ADD COLUMN "tax_policy" jsonb;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "commission_policy" jsonb;--> statement-breakpoint
ALTER TABLE "platform_invitations" ADD COLUMN "project_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_tasks" ADD COLUMN "internal" boolean DEFAULT true NOT NULL;