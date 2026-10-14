import { describe, it, expect } from "vitest";
import { allowedIn, realmFor, safeReturnPath, REALM_HOME } from "@/lib/platform/realms";

describe("one destination per person", () => {
  it("sends the team to its workspace, partners to theirs and authors to the author area", () => {
    expect(realmFor(["author"])).toBe("author");
    expect(realmFor([])).toBe("author");
    expect(realmFor(["affiliate"])).toBe("partner");
    expect(realmFor(["author", "affiliate"])).toBe("partner");
    for (const role of ["owner", "admin", "editor", "seller", "finance", "coordinator"]) expect(realmFor([role])).toBe("staff");
    expect(realmFor(["author", "seller"])).toBe("staff");
    expect(REALM_HOME[realmFor(["author"])]).toBe("/area-autore");
  });
  it("keeps every area to those who belong there", () => {
    expect(allowedIn(["author"], "author")).toBe(true);
    expect(allowedIn(["author"], "staff")).toBe(false);
    expect(allowedIn(["author"], "partner")).toBe(false);
    expect(allowedIn(["seller"], "staff")).toBe(true);
    expect(allowedIn(["seller"], "author")).toBe(false);
    expect(allowedIn(["affiliate"], "partner")).toBe(true);
    expect(allowedIn(["seller", "affiliate"], "partner")).toBe(true);
  });
  it("only follows internal return paths", () => {
    expect(safeReturnPath("/area-autore?preventivo=abc")).toBe("/area-autore?preventivo=abc");
    expect(safeReturnPath("/collega-preventivo?token=a-b_c")).toBe("/collega-preventivo?token=a-b_c");
    expect(safeReturnPath("https://evil.example/")).toBeNull();
    expect(safeReturnPath("//evil.example")).toBeNull();
    expect(safeReturnPath("/path\\evil")).toBeNull();
    expect(safeReturnPath("javascript:alert(1)")).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });
});
