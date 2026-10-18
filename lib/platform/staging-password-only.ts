/**
 * Explicitly relaxes the mandatory second factor only for disposable seed
 * identities on the isolated Vercel staging branch. Never disable RBAC,
 * email/password sign-in, verified-email checks, or session enforcement.
 *
 * This flag must NEVER make a real email or a production deployment password-only.
 */
export function stagingPasswordOnly(email: string): boolean {
  return process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "feat/real-role-access-staging-20261014"
    && process.env.PROEMIOS_STAGING_PASSWORD_ONLY === "1"
    && /^[a-z0-9._%+-]+@proemios-demo\.invalid$/i.test(email);
}
