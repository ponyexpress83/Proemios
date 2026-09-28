/**
 * Configurazione Auth.js (v5).
 *
 * Scelte e motivi:
 *  - **Magic link via Resend**, non password: elimina la superficie di attacco
 *    delle password (riuso, credential stuffing, reset) su un prodotto dove
 *    l'accesso è poco frequente e l'email è comunque il canale di lavoro.
 *  - **Sessioni su database**, non JWT: revocare l'accesso a una persona deve
 *    avere effetto subito, e un JWT già emesso resterebbe valido fino alla
 *    scadenza.
 *  - **Nessuna registrazione libera**: si entra su invito. `signIn` rifiuta chi
 *    non ha già un utente o un invito valido.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema/utenti";
import type { Ruolo } from "./ruoli";
import { costruisciSessionePubblica } from "./sessione-pubblica";
import { ambienteLive } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      ruolo: Ruolo;
      organizationId: string;
      attivo: boolean;
    } & DefaultSession["user"];
  }
}

const GIORNI_SESSIONE = Number(process.env.AUTH_SESSION_DAYS ?? 30);

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: "database", maxAge: GIORNI_SESSIONE * 24 * 60 * 60 },
    pages: { signIn: "/accedi", verifyRequest: "/accedi/controlla-email", error: "/accedi/errore" },
    trustHost: true,
    providers: [
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.AUTH_EMAIL_FROM ?? "Proemios <accessi@proemios.it>",
        /**
         * Fuori dalla produzione, senza una chiave Resend, il link di accesso
         * finisce sulla console del server invece di non partire.
         *
         * Serve perché altrimenti il prodotto non è provabile: l'accesso è
         * solo per magic link, e senza posta in uscita non entra nessuno —
         * nemmeno per guardare. Prima di questo, uno sviluppo locale o una
         * preview erano schermate vuote dietro un login impossibile.
         *
         * Il controllo è `ambienteLive()`, non `NODE_ENV`: le preview di
         * Vercel girano con `NODE_ENV=production` e devono restare provabili,
         * mentre il sito vero non deve mai stampare un link di accesso nei
         * log — chi legge i log entrerebbe come chiunque. In produzione, se
         * la chiave manca, si lascia fallire l'invio: un accesso che sembra
         * riuscito e non arriva è peggio di un errore.
         */
        async sendVerificationRequest(parametri) {
          const chiaveAssente = !process.env.RESEND_API_KEY?.trim();

          if (chiaveAssente && !ambienteLive()) {
            console.warn(
              [
                "",
                "  ┌─ Accesso Proemios ────────────────────────────────────",
                `  │  ${parametri.identifier}`,
                "  │",
                `  │  ${parametri.url}`,
                "  │",
                "  │  RESEND_API_KEY non è impostata: il link è qui invece",
                "  │  che nella posta. Non accade in produzione.",
                "  └───────────────────────────────────────────────────────",
                "",
              ].join("\n"),
            );
            return;
          }

          const { sendVerificationRequest } = await import(
            "next-auth/providers/resend"
          ).then((m) => ({ sendVerificationRequest: m.default({}).sendVerificationRequest! }));
          await sendVerificationRequest(parametri);
        },
      }),
    ],
    callbacks: {
      /**
       * Nessuna registrazione spontanea: l'adapter creerebbe un utente al primo
       * accesso di un indirizzo sconosciuto. Qui l'accesso è consentito solo a
       * chi esiste già ed è attivo. La creazione avviene per invito
       * (lib/auth/inviti.ts), che è l'unico punto in cui si assegna un ruolo.
       */
      async signIn({ user }) {
        if (!user.email) return false;
        const [esistente] = await db
          .select({ id: users.id, attivo: users.attivo })
          .from(users)
          .where(eq(users.email, user.email.toLowerCase()))
          .limit(1);
        if (!esistente) return false;
        return esistente.attivo;
      },

      /**
       * La sessione porta ruolo, tenant e stato, letti dal database a ogni
       * richiesta (sessione database, non JWT): un cambio di ruolo o una
       * disattivazione hanno effetto immediato.
       *
       * L'oggetto viene **ricostruito da zero**, non modificato. L'adapter
       * Drizzle passa qui la riga completa di `users` e la riga di `sessions`,
       * e `/api/auth/session` serializza al browser tutto ciò che resta
       * nell'oggetto: senza questa ricostruzione uscirebbero `mfaSegreto`,
       * `motivoDisattivazione` e — peggio — `sessionToken`, cioè il valore del
       * cookie di sessione, che è `httpOnly` proprio per non essere leggibile
       * da JavaScript. È la stessa regola dei DTO in lib/dto/: allowlist
       * esplicita, mai uno spread della riga.
       */
      async session({ session, user }) {
        const [riga] = await db
          .select({
            ruolo: users.ruolo,
            organizationId: users.organizationId,
            attivo: users.attivo,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        return costruisciSessionePubblica(session.expires, user.id, riga);
      },
    },
    events: {
      async signIn({ user }) {
        if (!user.id) return;
        await db
          .update(users)
          .set({ ultimoAccessoAt: new Date() })
          .where(eq(users.id, user.id));
      },
    },
  };
});
