CREATE TABLE "rate_limits" (
	"chiave" varchar(120) PRIMARY KEY NOT NULL,
	"conteggio" integer DEFAULT 0 NOT NULL,
	"finestra_inizio" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limits_finestra_idx" ON "rate_limits" USING btree ("finestra_inizio");