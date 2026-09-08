CREATE TABLE "conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"lead_id" uuid,
	"evento" varchar(60) NOT NULL,
	"valore_cent" integer,
	"valuta" varchar(3) DEFAULT 'EUR' NOT NULL,
	"chiave_dedup" varchar(200) NOT NULL,
	"attribuzione" jsonb,
	"avvenuta_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inviata_at" timestamp with time zone,
	"errore_invio" varchar(300),
	"tentativi" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversions_evento_idx" ON "conversions" USING btree ("evento");--> statement-breakpoint
CREATE INDEX "conversions_organization_idx" ON "conversions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversions_lead_idx" ON "conversions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "conversions_dedup_idx" ON "conversions" USING btree ("chiave_dedup");--> statement-breakpoint
CREATE INDEX "conversions_avvenuta_idx" ON "conversions" USING btree ("avvenuta_at");