import { describe, it, expect } from "vitest";
import { addBusinessMinutes, isWithinHours, nextOpening, personNextAvailable, defaultBusinessHours } from "@/lib/crm-core/hours";
import { chooseAssignee, type AssignmentCandidate } from "@/lib/crm-core/assignment";
import { decideAttribution, type AttributionInput } from "@/lib/crm-core/attribution";
import { defaultAttributionRules } from "@/lib/crm-core/rules";
import { matchReasons, mergeable, normalizePhone } from "@/lib/crm-core/dedup";
import { validateCustomFields } from "@/lib/crm-core/fields";
import { signPayload, verifySignature, retryDelaySeconds } from "@/lib/crm-core/webhooks";
import { stageMove, pipelineSchema } from "@/lib/crm-core/pipelines";

const rome = defaultBusinessHours;
// Venerdì 16 ottobre 2026, 17:30 a Roma (UTC+2).
const friday1730 = new Date("2026-10-16T15:30:00Z");
const candidate = (userId: string, extra: Partial<AssignmentCandidate> = {}): AssignmentCandidate => ({ userId, active: true, verified: true, participates: true, skills: [], languages: ["it"], hours: null, absences: [], capacity: 10, openLoad: 0, lastAssignedAt: null, ...extra });
const request = (extra: Partial<Parameters<typeof chooseAssignee>[1]> = {}) => ({ requiredSkill: null, language: "it", openDealOwner: null, now: new Date("2026-10-14T08:00:00Z"), orgHours: rome, defaultCapacity: 40, ...extra });

describe("service hours and SLA", () => {
  it("counts only service minutes across the weekend and holidays", () => {
    expect(isWithinHours(friday1730, rome)).toBe(true);
    // 60 minuti di servizio da venerdì 17:30: 30 venerdì + 30 lunedì dalle 9:00.
    expect(addBusinessMinutes(friday1730, 60, rome).toISOString()).toBe("2026-10-19T07:30:00.000Z");
    expect(nextOpening(new Date("2026-10-17T10:00:00Z"), rome).toISOString()).toBe("2026-10-19T07:00:00.000Z");
    expect(nextOpening(new Date("2026-10-17T10:00:00Z"), { ...rome, holidays: ["2026-10-19"] }).toISOString()).toBe("2026-10-20T07:00:00.000Z");
  });
  it("handles the daylight saving change in the declared time zone", () => {
    // Domenica 25 ottobre 2026 l'Italia torna a UTC+1: lunedì 9:00 = 08:00 UTC.
    expect(nextOpening(new Date("2026-10-24T12:00:00Z"), rome).toISOString()).toBe("2026-10-26T08:00:00.000Z");
  });
  it("skips declared absences", () => {
    const at = personNextAvailable(new Date("2026-10-14T08:00:00Z"), rome, [{ from: "2026-10-14T00:00:00Z", to: "2026-10-15T22:00:00Z" }]);
    expect(at.toISOString()).toBe("2026-10-16T07:00:00.000Z");
  });
});

describe("assignment rules", () => {
  it("keeps the owner of an open deal, even if busy", () => {
    const d = chooseAssignee([candidate("a", { openLoad: 10 }), candidate("b")], request({ openDealOwner: { userId: "a", active: true } }));
    expect(d).toMatchObject({ assignee: "a", reason: "open_deal_owner" });
  });
  it("filters by skill and language, excludes absent and full, balances relative load", () => {
    const d = chooseAssignee(
      [
        candidate("absent", { absences: [{ from: "2026-10-13T00:00:00Z", to: "2026-10-20T00:00:00Z" }] }),
        candidate("english", { languages: ["en"] }),
        candidate("cover-only", { skills: ["cover"] }),
        candidate("full", { capacity: 2, openLoad: 2 }),
        candidate("busy", { skills: ["editing"], capacity: 10, openLoad: 5 }),
        candidate("light", { skills: ["editing"], capacity: 20, openLoad: 6 }),
      ],
      request({ requiredSkill: "editing" }),
    );
    expect(d.assignee).toBe("light");
    expect(d.considered.find((c) => c.userId === "absent")?.excluded).toBe("absent");
    expect(d.considered.find((c) => c.userId === "english")?.excluded).toBe("language");
    expect(d.considered.find((c) => c.userId === "cover-only")?.excluded).toBe("skill");
    expect(d.considered.find((c) => c.userId === "full")?.excluded).toBe("capacity");
  });
  it("queues when nobody is eligible and gives the first useful period", () => {
    const d = chooseAssignee([candidate("x", { active: false }), candidate("y", { participates: false })], request({ now: new Date("2026-10-17T10:00:00Z") }));
    expect(d).toMatchObject({ assignee: null, reason: "no_eligible" });
    expect(d.availableAt.toISOString()).toBe("2026-10-19T07:00:00.000Z");
  });
  it("outside hours goes to whoever is back first, never by online presence", () => {
    const early = { ...rome, start: "07:00" };
    const d = chooseAssignee([candidate("late"), candidate("early", { hours: early, openLoad: 5 })], request({ now: new Date("2026-10-17T10:00:00Z") }));
    expect(d).toMatchObject({ assignee: "early", reason: "next_shift" });
  });
});

const base: AttributionInput = { path: "self_serve", now: new Date("2026-10-17T10:00:00Z"), buyerUserId: "buyer", identityVerified: true, dealId: "d1", dealOwnerId: null, salesAssisted: false, link: null, otherDeals: [], affiliateId: null, sourcerId: null, marketing: { first: null, last: null, campaignId: null, channel: null } };
describe("attribution decisions", () => {
  it("custom quote: credited to the deal owner, assisted", () => {
    const d = decideAttribution({ ...base, path: "custom_quote", dealOwnerId: "s1", salesAssisted: true }, defaultAttributionRules);
    expect(d).toMatchObject({ creditedSellerId: "s1", closing: "assisted", status: "final", beneficiaries: { seller: "s1", affiliate: null } });
  });
  it("later purchase without link: credited to the recent owner only with verified identity", () => {
    const won = { dealId: "old", ownerId: "s1", ownerActive: true, status: "won" as const, lastActivityAt: null, closedAt: new Date("2026-09-20T00:00:00Z") };
    expect(decideAttribution({ ...base, path: "later_purchase", otherDeals: [won] }, defaultAttributionRules)).toMatchObject({ creditedSellerId: "s1", closing: "autonomous" });
    expect(decideAttribution({ ...base, path: "later_purchase", identityVerified: false, otherDeals: [won] }, defaultAttributionRules).creditedSellerId).toBeNull();
    expect(decideAttribution({ ...base, path: "later_purchase", otherDeals: [{ ...won, closedAt: new Date("2026-05-01T00:00:00Z") }] }, defaultAttributionRules).creditedSellerId).toBeNull();
  });
  it("flags concurrent deals instead of choosing", () => {
    const d = decideAttribution({ ...base, path: "custom_quote", dealOwnerId: "s1", salesAssisted: true, otherDeals: [{ dealId: "d2", ownerId: "s2", ownerActive: true, status: "open", lastActivityAt: null, closedAt: null }] }, defaultAttributionRules);
    expect(d.status).toBe("conflict");
    expect(d.creditedSellerId).toBeNull();
    expect(d.beneficiaries.seller).toBeNull();
    expect(d.conflicts[0]!.candidates.sort()).toEqual(["s1", "s2"]);
  });
  it("keeps seller and affiliate separate and avoids double commissions", () => {
    const both = decideAttribution({ ...base, path: "custom_quote", dealOwnerId: "s1", salesAssisted: true, affiliateId: "aff" }, defaultAttributionRules);
    expect(both.beneficiaries).toEqual({ seller: "s1", affiliate: "aff" });
    const same = decideAttribution({ ...base, path: "custom_quote", dealOwnerId: "s1", salesAssisted: true, affiliateId: "s1" }, defaultAttributionRules);
    expect(same.beneficiaries).toEqual({ seller: "s1", affiliate: null });
    const sellerOnly = decideAttribution({ ...base, path: "custom_quote", dealOwnerId: "s1", salesAssisted: true, affiliateId: "aff" }, { ...defaultAttributionRules, affiliateAndSeller: "seller_only" });
    expect(sellerOnly.beneficiaries).toEqual({ seller: "s1", affiliate: null });
  });
});

describe("deduplication, custom fields, pipelines and webhook signatures", () => {
  it("never makes a name-only match mergeable", () => {
    expect(normalizePhone("0039 333 123 4567")).toBe("+393331234567");
    expect(normalizePhone("333 1234567")).toBe("+393331234567");
    const a = { id: "1", email: "a@x.test", phone: "333 1234567", name: "Maria Rossi" };
    expect(matchReasons(a, { id: "2", email: "b@x.test", phone: "+39 333 1234567", name: "M. Rossi" })).toEqual(["phone"]);
    const nameOnly = matchReasons(a, { id: "3", email: "c@x.test", phone: null, name: "rossi maria" });
    expect(nameOnly).toEqual(["name_only"]);
    expect(mergeable(nameOnly)).toBe(false);
  });
  it("validates custom fields server side", () => {
    const defs = [{ entity: "deal" as const, key: "genre", label: "Genere", type: "select" as const, options: ["giallo", "saggio"], required: true, active: true }];
    expect(validateCustomFields(defs, { genre: "giallo" }).errors).toEqual({});
    expect(validateCustomFields(defs, { genre: "horror" }).errors.genre).toBeTruthy();
    expect(validateCustomFields(defs, { other: "x" }).errors.other).toBeTruthy();
    expect(validateCustomFields(defs, {}).errors.genre).toBe("Campo obbligatorio.");
  });
  it("never sets a won stage by hand", () => {
    const p = pipelineSchema.parse({ key: "agenzie", name: "Agenzie", stages: [{ key: "first_call", label: "Prima call", kind: "open" }, { key: "signed", label: "Firmato", kind: "won" }, { key: "lost", label: "Perso", kind: "lost" }] });
    expect(stageMove(p, "signed")).toEqual({ ok: false, code: "WON_BY_PAYMENT" });
    expect(stageMove(p, "first_call").ok).toBe(true);
  });
  it("signs and verifies webhooks with a time window", () => {
    const header = signPayload("secret", '{"a":1}', 1_800_000_000);
    expect(verifySignature("secret", '{"a":1}', header, 300, 1_800_000_100)).toBe(true);
    expect(verifySignature("secret", '{"a":2}', header, 300, 1_800_000_100)).toBe(false);
    expect(verifySignature("secret", '{"a":1}', header, 300, 1_800_001_000)).toBe(false);
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(20)).toBe(6 * 3600);
  });
});
