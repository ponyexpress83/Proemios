import { afterEach, describe, expect, it } from "vitest";
import { stagingPasswordOnly } from "@/lib/platform/staging-password-only";
const names=["VERCEL_ENV","VERCEL_GIT_COMMIT_REF","PROEMIOS_STAGING_PASSWORD_ONLY"] as const;
const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
afterEach(()=>{for(const key of names){const prior=old[key];if(prior===undefined)delete process.env[key];else process.env[key]=prior;}});
describe("staging password-only access safety",()=>{
  const on=()=>{process.env.VERCEL_ENV="preview";process.env.VERCEL_GIT_COMMIT_REF="feat/real-role-access-staging-20261014";process.env.PROEMIOS_STAGING_PASSWORD_ONLY="1";};
  it("only permits disposable identities on the exact preview branch",()=>{on();expect(stagingPasswordOnly("sales1@proemios-demo.invalid")).toBe(true);expect(stagingPasswordOnly("owner@proemios-demo.invalid")).toBe(true);});
  it("never permits real emails",()=>{on();expect(stagingPasswordOnly("info@kalamos.studio")).toBe(false);expect(stagingPasswordOnly("sales@example.com")).toBe(false);});
  it("never permits production or unrelated previews",()=>{on();process.env.VERCEL_ENV="production";expect(stagingPasswordOnly("owner@proemios-demo.invalid")).toBe(false);process.env.VERCEL_ENV="preview";process.env.VERCEL_GIT_COMMIT_REF="other-branch";expect(stagingPasswordOnly("owner@proemios-demo.invalid")).toBe(false);});
  it("defaults off without explicit opt-in",()=>{on();delete process.env.PROEMIOS_STAGING_PASSWORD_ONLY;expect(stagingPasswordOnly("owner@proemios-demo.invalid")).toBe(false);});
});
