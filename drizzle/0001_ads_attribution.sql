ALTER TABLE "leads" ADD COLUMN "stage" varchar(40) DEFAULT 'new' NOT NULL;
ALTER TABLE "leads" ADD COLUMN "lead_score" integer;
ALTER TABLE "leads" ADD COLUMN "attribution" jsonb;
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");
CREATE INDEX "leads_score_idx" ON "leads" USING btree ("lead_score");
