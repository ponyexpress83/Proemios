"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
type Mode = "login" | "register" | "reset" | "new-password" | "challenge";
export function AuthForm({
  mode = "login",
  ready = true,
  team = false,
  token,
}: {
  mode?: Mode;
  ready?: boolean;
  team?: boolean;
  token?: string;
}) {
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [backup, setBackup] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim(),
      password = String(data.get("password") ?? "");
    try {
      let result;
      if (mode === "register")
        result = await authClient.signUp.email({
          email,
          password,
          name: String(data.get("name")),
          privacyAccepted: data.get("privacy") === "on",
          callbackURL: "/spazio",
        });
      else if (mode === "reset")
        result = await authClient.requestPasswordReset({ email, redirectTo: "/nuova-password" });
      else if (mode === "new-password")
        result = await authClient.resetPassword({ newPassword: password, token });
      else if (mode === "challenge")
        result = backup
          ? await authClient.twoFactor.verifyBackupCode({
              code: String(data.get("code")),
              disableSession: false,
            })
          : await authClient.twoFactor.verifyTotp({
              code: String(data.get("code")),
              trustDevice: false,
            });
      else
        result = await authClient.signIn.email({
          email,
          password,
          rememberMe: !team,
          callbackURL: "/spazio",
        });
      if (result.error) {
        setError(
          mode === "login"
            ? "Accesso non riuscito. Controlla le credenziali e verifica il tuo indirizzo email."
            : mode === "challenge"
              ? "Codice non valido o scaduto. Riprova."
              : "Operazione non riuscita. Controlla i dati o riprova più tardi.",
        );
        return;
      }
      if (mode === "register")
        setNotice(
          "Controlla la tua email: usa il collegamento per verificare l’indirizzo e poi accedi.",
        );
      else if (mode === "reset")
        setNotice(
          "Se l’indirizzo è associato a un account, riceverai il collegamento per reimpostare la password.",
        );
      else if (mode === "new-password") {
        setNotice("Password aggiornata. Puoi accedere con la nuova password.");
      } else if (mode === "challenge") window.location.assign("/spazio");
      else if (!("twoFactorRedirect" in (result.data ?? {}))) window.location.assign("/spazio");
    } catch {
      setError("Il servizio non risponde. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: team ? "Il tuo accesso al team" : "Bentornato, autore.",
    register: "Il tuo libro inizia qui.",
    reset: "Recupera l’accesso.",
    "new-password": "Scegli una nuova password.",
    challenge: "Verifica il tuo accesso.",
  }[mode];
  return (
    <section className="platform-auth">
      <p className="platform-eyebrow">PROEMIOS / {team ? "TEAM" : "IL TUO SPAZIO"}</p>
      <h1>{title}</h1>
      <p>
        {mode === "challenge"
          ? "Inserisci il codice della tua app di autenticazione, oppure un codice di recupero."
          : team
            ? "Usa il tuo account personale. L’accesso ai progetti e alle funzioni dipende dai permessi assegnati."
            : "Progetti, conversazioni e consegne: un posto per seguire il tuo percorso editoriale."}
      </p>
      {!ready ? (
        <div className="platform-notice" role="status">
          Stiamo attivando l’accesso alla piattaforma. Per iniziare il tuo progetto puoi{" "}
          <Link href="/contatti">contattarci</Link>.
        </div>
      ) : (
        <form onSubmit={submit} className="platform-form">
          {mode === "register" ? (
            <label>
              Nome e cognome
              <input name="name" autoComplete="name" required minLength={2} maxLength={200} />
            </label>
          ) : null}
          {["login", "register", "reset"].includes(mode) ? (
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required maxLength={320} />
            </label>
          ) : null}
          {["login", "register", "new-password"].includes(mode) ? (
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                required
              />
              {mode !== "login" ? (
                <small>Almeno 12 caratteri. Puoi usare una frase facile da ricordare.</small>
              ) : null}
            </label>
          ) : null}
          {mode === "challenge" ? (
            <>
              <label>
                {backup ? "Codice di recupero" : "Codice di verifica"}
                <input
                  name="code"
                  autoComplete="one-time-code"
                  inputMode={backup ? "text" : "numeric"}
                  required
                  minLength={6}
                  maxLength={64}
                />
              </label>
              <button
                type="button"
                className="platform-text-button"
                onClick={() => setBackup(!backup)}
              >
                {backup ? "Usa l’app di autenticazione" : "Usa un codice di recupero"}
              </button>
            </>
          ) : null}
          {mode === "register" ? (
            <label className="platform-check">
              <input type="checkbox" name="privacy" required />
              Ho letto l’<Link href="/privacy">informativa privacy</Link> e i{" "}
              <Link href="/termini">termini di utilizzo</Link>.
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="platform-error">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="platform-notice">
              {notice}
            </p>
          ) : null}
          <button className="platform-button" disabled={busy}>
            {busy
              ? "Attendi…"
              : mode === "login"
                ? "Accedi →"
                : mode === "register"
                  ? "Crea il tuo account →"
                  : mode === "challenge"
                    ? "Verifica →"
                    : mode === "reset"
                      ? "Invia collegamento →"
                      : "Aggiorna password →"}
          </button>
        </form>
      )}
      <div className="platform-auth-links">
        {mode === "login" ? (
          <>
            <Link href="/recupera-accesso">Password dimenticata?</Link>
            {team ? (
              <Link href="/accedi">Area autori</Link>
            ) : (
              <Link href="/registrati">Crea un account autore</Link>
            )}
          </>
        ) : (
          <Link href="/accedi">Torna all’accesso</Link>
        )}
      </div>
    </section>
  );
}
