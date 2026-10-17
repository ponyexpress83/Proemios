CREATE TABLE "job_locks" (
	"job" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"locked_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"trigger" text DEFAULT 'cron' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"summary" jsonb
);
--> statement-breakpoint
CREATE INDEX "job_run_job_idx" ON "job_runs" USING btree ("job","started_at");