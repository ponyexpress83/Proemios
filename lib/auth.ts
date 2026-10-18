import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { magicLink } from "better-auth/plugins/magic-link";
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
import { stagingPasswordOnly } from "@/lib/platform/staging-password-only";
import { linkLeadsToAuthor } from "@/lib/platform/lead-linking";
import { recordFunnel } from "@/lib/platform/funnel";

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
        // Email verificata: le richieste pubbliche fatte con lo stesso indirizzo
        // compaiono nell'area autore senza passare dal token di collegamento.
        if (user.emailVerified) {
          await linkLeadsToAuthor(user.id, user.email).catch(() => {});
          await recordFunnel(getDb(), "email_verified").catch(() => {});
        }
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
      if (["/sign-up/email", "/request-password-reset", "/send-verification-email", "/sign-in/magic-link"].includes(context.path) && !mailConfigured()) throw new APIError("SERVICE_UNAVAILABLE", { message: "Il servizio di accesso non è disponibile al momento." });
      // Il link di accesso è solo per gli autori: team e partner entrano con
      // password e verifica in due passaggi, che il link salterebbe.
      if (context.path === "/sign-in/magic-link") {
        const email = String(context.body?.email ?? "").trim().toLowerCase();
        const [person] = email ? await getDb().select({ id: authSchema.user.id, twoFactorEnabled: authSchema.user.twoFactorEnabled }).from(authSchema.user).where(eq(authSchema.user.email, email)) : [];
        if (person) {
          const access = await getDb().select().from(memberships).where(eq(memberships.userId, person.id));
          if (person.twoFactorEnabled || access.some(m => m.active && m.role !== "author")) throw new APIError("FORBIDDEN", { message: "Per questo account serve l'accesso con password e codice di verifica." });
        }
      }
      if (context.path === "/two-factor/disable") {
        const session = await getAuth().api.getSession({ headers: context.headers! });
        if (session) {
          const access = await getDb().select().from(memberships).where(eq(memberships.userId, session.user.id));
          if (access.some(m => m.active && m.role !== "author") && !stagingPasswordOnly(session.user.email)) throw new APIError("FORBIDDEN", { message: "La verifica in due passaggi è obbligatoria per il team." });
        }
      }
    }) },
    plugins: [
      twoFactor({ issuer: "Proemios", skipVerificationOnEnable: false }),
      // Accesso senza password per gli autori: link monouso, 15 minuti, solo
      // account esistenti (la registrazione resta esplicita, con privacy).
      magicLink({
        disableSignUp: true,
        expiresIn: 15 * 60,
        rateLimit: { window: 60, max: 3 },
        sendMagicLink: async ({ email, url }) => {
          // Nessuna email a indirizzi sconosciuti: la risposta resta identica, così
          // l'esistenza di un account non si indovina dal comportamento.
          const [known] = await getDb().select({ id: authSchema.user.id }).from(authSchema.user).where(eq(authSchema.user.email, email.toLowerCase()));
          if (!known) return;
          await enqueueMail(`magic-link:${hashToken(url)}`, { to: email, subject: "Il tuo link di accesso a Proemios", html: impaginaEmail("Entra nella tua area", `<p>Apri questo collegamento per accedere senza password. Vale 15 minuti e funziona una sola volta.</p><p><a href="${esc(url)}">Accedi alla tua area</a></p><p>Se non hai richiesto tu l'accesso, ignora questa email: nessuno può entrare senza questo collegamento.</p>`) });
        },
      }),
      nextCookies(),
    ],
  });
}
type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;
export function getAuth(): Auth {
  if (!authConfigured()) throw unavailable();
  return instance ??= createAuth();
}
