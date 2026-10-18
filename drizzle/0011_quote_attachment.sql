ALTER TABLE "platform_quote_records" ADD COLUMN "attachment_key" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "attachment_name" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "attachment_hash" text;--> statement-breakpoint
ALTER TABLE "platform_quote_records" ADD COLUMN "attachment_uploaded_at" timestamp with time zone;