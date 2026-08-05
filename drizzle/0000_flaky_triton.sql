CREATE TYPE "public"."lead_source" AS ENUM('preventivo', 'analisi', 'contatto', 'agenzie');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'deposit_paid', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "agency_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"nome_agenzia" varchar(200) NOT NULL,
	"sito" varchar(320),
	"servizi_esternalizzati" text,
	"volume_stimato" varchar(120)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"nome" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"telefono" varchar(40),
	"fonte" "lead_source" NOT NULL,
	"consenso_privacy" boolean DEFAULT false NOT NULL,
	"consenso_marketing" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscript_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"filename" varchar(400) NOT NULL,
	"word_count" integer NOT NULL,
	"report" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"input" jsonb NOT NULL,
	"pacchetti_generati" jsonb NOT NULL,
	"pacchetto_scelto" varchar(40),
	"prezzo_totale" integer,
	"acconto" integer,
	"stato" "quote_status" DEFAULT 'draft' NOT NULL,
	"stripe_session_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_leads" ADD CONSTRAINT "agency_leads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_analyses" ADD CONSTRAINT "manuscript_analyses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_leads_lead_idx" ON "agency_leads" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_fonte_idx" ON "leads" USING btree ("fonte");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analyses_lead_idx" ON "manuscript_analyses" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "analyses_expires_idx" ON "manuscript_analyses" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "analyses_created_at_idx" ON "manuscript_analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quotes_lead_idx" ON "quotes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "quotes_stato_idx" ON "quotes" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quotes_stripe_session_idx" ON "quotes" USING btree ("stripe_session_id");