import { beforeEach, describe, expect, it, vi } from "vitest";
import journal from "@/drizzle/meta/_journal.json";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db", () => ({ getDb: () => mock }));
import { migrationStatus } from "@/lib/platform/diagnostics";

const tables = ["crm_contacts", "job_runs", "doc_documents", "doc_revisions", "doc_versions", "doc_suggestions", "doc_comments", "doc_revision_cycles", "ai_jobs", "ai_job_chunks", "ai_usage", "project_costs", "external_connections"];

describe("migration diagnostics before launch", () => {
  beforeEach(() => { mock.execute.mockReset(); });

  it("detects missing Document Studio from the migration journal", async () => {
    mock.execute.mockResolvedValue({ rows: journal.entries.filter(e => e.tag !== "0014_document_studio").map(e => ({ created_at: String(e.when) })) });
    expect((await migrationStatus()).missing).toContain("0014_document_studio");
  });

  it.each(tables.slice(2))("rejects an untracked partial Studio missing %s", async missingTable => {
    mock.execute.mockRejectedValueOnce(new Error("journal absent"));
    for (const table of tables) mock.execute.mockResolvedValueOnce({ rows: [{ t: table === missingTable ? null : table }] });
    expect((await migrationStatus()).missing).toEqual(["0014_document_studio"]);
  });

  it("accepts an untracked schema only when every Studio table is present", async () => {
    mock.execute.mockRejectedValueOnce(new Error("journal absent"));
    for (const table of tables) mock.execute.mockResolvedValueOnce([{ t: table }]);
    expect(await migrationStatus()).toMatchObject({ tracked: false, missing: [] });
    expect(mock.execute).toHaveBeenCalledTimes(tables.length + 1);
  });

  it("propagates a database failure instead of declaring migrations verified", async () => {
    mock.execute.mockRejectedValue(new Error("database unavailable"));
    await expect(migrationStatus()).rejects.toThrow("database unavailable");
  });
});
