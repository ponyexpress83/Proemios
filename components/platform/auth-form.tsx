"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { authClient } from "@/lib/auth-client";
import { REALM_HOME, realmFor, safeReturnPath } from "@/lib/platform/realms";
type Mode = "login" | "register" | "reset" | "new-password" | "challenge";
/**
 * Accesso e registrazione. Il percorso di acquisto passa da qui: il parametro
 * `ritorno` (solo percorsi interni) conserva la proposta e il pacchetto scelti
 * attraverso registrazione, verifica dell'email e accesso. Gli autori possono
 * entrare anche con un link via email; il team sempre con password e codice.
 */
export function AuthForm({
  mode = "login",
  ready = true,
  team = false,
  realm = "author",
  token,
}: {
  mode?: Mode;
  ready?: boolean;
  team?: boolean;
  realm?: "author" | "staff" | "partner";
  token?: string;
}) {
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [backup, setBackup] = useState(false),
    [byLink, setByLink] = useState(false),
    [existing, setExisting] = useState<string | null>(null),
    [email, setEmail] = useState("");
  const [ritorno, setRitorno] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRitorno(safeReturnPath(params.get("ritorno")));
    if (mode === "login" && params.get("verificata") === "1")
      setNotice("Indirizzo verificato. Accedi: ritroverai la tua proposta e le scelte fatte.");
    if (mode === "login" && params.get("sessione") === "scaduta")
      setNotice("La sessione è scaduta. Accedi di nuovo per continuare.");
    if (mode === "login" && (params.get("error") || params.get("link") === "non-valido")) {
      setByLink(true);
      setNotice("Il collegamento di accesso è scaduto o è già stato usato. Richiedine uno nuovo qui sotto: vale 15 minuti.");
    }
    if (mode === "register" && params.get("preventivo"))
      setNotice("Crea l'account con lo stesso indirizzo usato per il preventivo: dopo la verifica lo troverai nella tua area con il pacchetto scelto.");
  }, [mode]);
  const withReturn = (path: string) => (ritorno ? `${path}?ritorno=${encodeURIComponent(ritorno)}` : path);
  async function destinationFor(): Promise<string> {
    if (ritorno) return ritorno;
    try {
      const response = await fetch("/api/platform/me", { credentials: "same-origin", cache: "no-store" });
      if (response.ok) {
        const body = (await response.json()) as { user?: { roles?: string[] } };
        return REALM_HOME[realmFor(body.user?.roles ?? [])];
      }
    } catch {
      /* il profilo non risponde: si cade sull'area della pagina di accesso */
    }
    return REALM_HOME[realm];
  }
  async function sendLink(address: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await authClient.signIn.magicLink({
        email: address,
        callbackURL: ritorno ?? REALM_HOME.author,
        errorCallbackURL: `/accedi?link=non-valido${ritorno ? `&ritorno=${encodeURIComponent(ritorno)}` : ""}`,
      });
      if (result.error) {
        setError(result.error.status === 403 ? "Per questo account serve l'accesso con password e codice di verifica." : result.error.status === 429 ? "Hai chiesto troppi collegamenti: attendi un minuto e riprova." : "Non è stato possibile inviare il collegamento. Riprova tra poco.");
        return;
      }
      setExisting(null);
      setNotice("Se l'indirizzo è registrato, riceverai un collegamento valido 15 minuti. Aprilo da questo dispositivo o da un altro: ti porta alla tua proposta.");
    } catch {
      setError("Il servizio non risponde. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setExisting(null);
    const data = new FormData(event.currentTarget);
    const address = String(data.get("email") ?? "").trim(),
      password = String(data.get("password") ?? "");
    if (mode === "login" && byLink) return sendLink(address);
    setBusy(true);
    try {
      let result;
      if (mode === "register")
        result = await authClient.signUp.email({
          email: address,
          password,
          name: String(data.get("name")),
          privacyAccepted: data.get("privacy") === "on",
          callbackURL: `/accedi?verificata=1${ritorno ? `&ritorno=${encodeURIComponent(ritorno)}` : ""}`,
        });
      else if (mode === "reset")
        result = await authClient.requestPasswordReset({ email: address, redirectTo: "/nuova-password" });
      else if (mode === "new-password")
        result = await authClient.resetPassword({ newPassword: password, token });
      else if (mode === "challenge")
        result = backup
          ? await authClient.twoFactor.verifyBackupCode({ code: String(data.get("code")), disableSession: false })
          : await authClient.twoFactor.verifyTotp({ code: String(data.get("code")), trustDevice: false });
      else result = await authClient.signIn.email({ email: address, password, rememberMe: !team });
      if (result.error) {
        if (mode === "register" && /ALREADY_EXISTS/i.test(result.error.code ?? "")) {
          setExisting(address);
          setNotice("Hai già un account con questo indirizzo: non serve crearne un altro.");
          return;
        }
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
        setNotice("Ti abbiamo scritto: apri il collegamento nell'email per verificare l'indirizzo, poi accedi. La tua proposta e le scelte restano salvate. Se non lo trovi, controlla la posta indesiderata.");
      else if (mode === "reset")
        setNotice("Se l'indirizzo è associato a un account, riceverai il collegamento per reimpostare la password.");
      else if (mode === "new-password") setNotice("Password aggiornata. Puoi accedere con la nuova password.");
      else if (mode === "challenge") window.location.assign(await destinationFor());
      else if ("twoFactorRedirect" in (result.data ?? {}))
        window.location.assign(`/verifica-accesso${ritorno ? `?ritorno=${encodeURIComponent(ritorno)}` : ""}`);
      else window.location.assign(await destinationFor());
    } catch {
      setError("Il servizio non risponde. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: realm === "partner" ? "Accesso partner Proemios" : team ? "Il tuo accesso al team" : "Bentornato, autore.",
    register: "Il tuo libro inizia qui.",
    reset: "Recupera l’accesso.",
    "new-password": "Scegli una nuova password.",
    challenge: "Verifica il tuo accesso.",
  }[mode];
  const showPassword = ["register", "new-password"].includes(mode) || (mode === "login" && !byLink);
  return (
    <section className="platform-auth">
      <p className="platform-eyebrow">PROEMIOS / {realm === "partner" ? "PARTNER" : team ? "TEAM" : "IL TUO SPAZIO"}</p>
      <h1>{title}</h1>
      <p>
        {mode === "challenge"
          ? "Inserisci il codice della tua app di autenticazione, oppure un codice di recupero."
          : team
            ? "Usa il tuo account personale. L’accesso ai progetti e alle funzioni dipende dai permessi assegnati."
            : ritorno
              ? "Accedi per ritrovare la tua proposta: le scelte fatte sono salvate."
              : "Progetti, conversazioni e consegne: un posto per seguire il tuo percorso editoriale."}
      </p>
      {!ready ? (
        <div className="platform-notice" role="status">
          Stiamo attivando l’accesso alla piattaforma. Per iniziare il tuo progetto puoi{" "}
          <Link href="/contatti">contattarci</Link>.
        </div>
      ) : (
        <form onSubmit={submit} className="platform-form" aria-busy={busy}>
          {mode === "login" && !team ? (
            <div className="platform-segmented" role="group" aria-label="Come vuoi accedere">
              <button type="button" aria-pressed={!byLink} onClick={() => { setByLink(false); setError(""); }}>Con la password</button>
              <button type="button" aria-pressed={byLink} onClick={() => { setByLink(true); setError(""); }}>Con un link via email</button>
            </div>
          ) : null}
          {mode === "register" ? (
            <label>
              Nome e cognome
              <input name="name" autoComplete="name" required minLength={2} maxLength={200} />
            </label>
          ) : null}
          {["login", "register", "reset"].includes(mode) ? (
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          ) : null}
          {showPassword ? (
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
              {mode !== "login" ? <small>Almeno 12 caratteri. Puoi usare una frase facile da ricordare.</small> : null}
            </label>
          ) : null}
          {mode === "login" && byLink ? <small>Ti mandiamo un collegamento monouso, valido 15 minuti. Niente password da ricordare.</small> : null}
          {mode === "challenge" ? (
            <>
              <label>
                {backup ? "Codice di recupero" : "Codice di verifica"}
                <input name="code" autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} required minLength={6} maxLength={64} />
              </label>
              <button type="button" className="platform-text-button" onClick={() => setBackup(!backup)}>
                {backup ? "Usa l’app di autenticazione" : "Usa un codice di recupero"}
              </button>
            </>
          ) : null}
          {mode === "register" ? (
            <label className="platform-check">
              <input type="checkbox" name="privacy" required />
              Ho letto l’<Link href="/privacy">informativa privacy</Link> e i <Link href="/termini">termini di utilizzo</Link>.
            </label>
          ) : null}
          {error ? <p role="alert" className="platform-error">{error}</p> : null}
          {notice ? <p role="status" className="platform-notice">{notice}</p> : null}
          {existing ? (
            <div className="platform-actions">
              <button type="button" className="platform-button" disabled={busy} onClick={() => sendLink(existing)}>Inviami un link di accesso</button>
              <Link className="platform-text-button" href={withReturn("/accedi") as Route}>Accedi con la password</Link>
            </div>
          ) : (
            <button className="platform-button" disabled={busy}>
              {busy
                ? "Attendi…"
                : mode === "login"
                  ? byLink ? "Inviami il link →" : "Accedi →"
                  : mode === "register"
                    ? "Crea il tuo account →"
                    : mode === "challenge"
                      ? "Verifica →"
                      : mode === "reset"
                        ? "Invia collegamento →"
                        : "Aggiorna password →"}
            </button>
          )}
        </form>
      )}
      <div className="platform-auth-links">
        {mode === "login" ? (
          <>
            <Link href="/recupera-accesso">Password dimenticata?</Link>
            {team ? null : <Link href={withReturn("/registrati") as Route}>Crea un account autore</Link>}
          </>
        ) : (
          <Link href={withReturn("/accedi") as Route}>Torna all’accesso</Link>
        )}
      </div>
    </section>
  );
}
