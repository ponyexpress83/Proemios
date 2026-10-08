import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { memberships } from "@/db/platform-schema";
import { appOrigin, applicationOrigins, authConfigured, mailConfigured } from "@/lib/platform/config";
import { impaginaEmail, esc } from "@/lib/email";
import { enqueueMail } from "@/lib/platform/mail";
import { hashToken } from "@/lib/platform/http";
import { unavailable } from "@/lib/platform/http";

function createAuth() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!, baseURL: appOrigin(), trustedOrigins: applicationOrigins(),
    // Library hooks use application tables through the pool; do not nest those
    // calls inside a provider transaction on another connection. Domain writes
    // use their own explicit transactions and privileged grants follow verification.
    database: drizzleAdapter(getDb(), { provider: "pg", schema: authSchema, transaction: false }),
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await enqueueMail(`password-reset:${hashToken(url)}`, { to: user.email, subject: "Recupera il tuo accesso a Proemios", html: impaginaEmail("Recupera l'accesso", `<p>È stata richiesta una nuova password per il tuo account.</p><p><a href="${esc(url)}">Imposta una nuova password</a></p><p>Se non hai fatto questa richiesta, ignora questa email.</p>`) });
      },
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await enqueueMail(`email-verification:${hashToken(url)}`, { to: user.email, subject: "Verifica la tua email per Proemios", html: impaginaEmail("Conferma il tuo indirizzo", `<p>Ciao ${esc(user.name)}, conferma il tuo indirizzo per accedere al tuo spazio.</p><p><a href="${esc(url)}">Verifica l'email</a></p><p>Se non hai richiesto un account, ignora questa email.</p>`) });
      },
    },
    user: { additionalFields: { privacyAccepted: { type: "boolean", required: true, input: true } }, deleteUser: { enabled: false } },
    session: { expiresIn: 7 * 24 * 60 * 60, updateAge: 60 * 60, cookieCache: { enabled: false } },
    account: { accountLinking: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 50,
      customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 3600, max: 10 }, "/request-password-reset": { window: 3600, max: 5 } } },
    databaseHooks: {
      user: { update: { after: async user => {
        if (user.twoFactorEnabled) await getDb().delete(authSchema.session).where(eq(authSchema.session.userId, user.id));
      } }, create: { after: async user => {
        await getDb().insert(memberships).values({ userId: user.id, role: "author" }).onConflictDoNothing();
      } } },
      session: { create: { before: async session => {
        const access = await getDb().select().from(memberships).where(eq(memberships.userId, session.userId));
        if (!access.some(m => m.active)) throw new APIError("FORBIDDEN", { message: "Accesso sospeso. Contatta il referente del progetto." });
        if (access.some(m => m.active && m.role !== "author")) return { data: { ...session, expiresAt: new Date(Math.min(session.expiresAt.getTime(), Date.now() + 12 * 60 * 60 * 1000)) } };
        return { data: session };
      } } },
    },
    hooks: { before: createAuthMiddleware(async context => {
      if (context.path === "/sign-up/email" && context.body?.privacyAccepted !== true) throw new APIError("BAD_REQUEST", { message: "Leggi e accetta l'informativa sulla privacy per creare l'account." });
      if (["/sign-up/email", "/request-password-reset", "/send-verification-email"].includes(context.path) && !mailConfigured()) throw new APIError("SERVICE_UNAVAILABLE", { message: "Il servizio di accesso non è disponibile al momento." });
      if (context.path === "/two-factor/disable") {
        const session = await getAuth().api.getSession({ headers: context.headers! });
        if (session) {
          const access = await getDb().select().from(memberships).where(eq(memberships.userId, session.user.id));
          if (access.some(m => m.active && m.role !== "author")) throw new APIError("FORBIDDEN", { message: "La verifica in due passaggi è obbligatoria per il team." });
        }
      }
    }) },
    plugins: [twoFactor({ issuer: "Proemios", skipVerificationOnEnable: false }), nextCookies()],
  });
}
type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;
export function getAuth(): Auth {
  if (!authConfigured()) throw unavailable();
  return instance ??= createAuth();
}
