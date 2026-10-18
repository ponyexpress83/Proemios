CREATE TABLE "platform_billing_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'private' NOT NULL,
	"name" text NOT NULL,
	"tax_code" text,
	"vat_number" text,
	"street" text NOT NULL,
	"postcode" text NOT NULL,
	"city" text NOT NULL,
	"province" text,
	"country" text DEFAULT 'IT' NOT NULL,
	"sdi_code" text,
	"pec" text,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"gross_cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"payment_method" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"fic_document_id" integer,
	"number" text,
	"issued_on" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_invoices_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "platform_billing_profiles" ADD CONSTRAINT "platform_billing_profiles_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_order_id_platform_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."platform_payment_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_author_id_auth_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_author_idx" ON "platform_invoices" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "platform_invoices" USING btree ("status");