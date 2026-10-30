"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { authClient } from "@/lib/auth-client";
export function Security({ enabled }: { enabled: boolean }) {
  const [uri, setUri] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sessions, setSessions] = useState<
      Array<{ token: string; createdAt: Date; userAgent?: string | null }>
    >([]);
  useEffect(() => {
    let active = true;
    authClient.listSessions().then((r) => {
      if (active && r.data) setSessions(r.data);
    });
    return () => {
      active = false;
    };
  }, []);
  async function enable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const r = await authClient.twoFactor.enable({ password: String(data.get("password")) });
      if (r.error) setError("Controlla la password o riprova.");
      else if (r.data && r.data.method === "totp") {
        setUri(r.data.totpURI);
        setCodes(r.data.backupCodes);
      }
    } catch {
      setError("Il servizio non risponde.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try { const r = await authClient.twoFactor.verifyTotp({
      code: String(new FormData(e.currentTarget).get("code")),
      trustDevice: false,
    });
    if (r.error) setError("Il codice non è valido. Riprova.");
    else window.location.assign("/spazio");
    } catch { setError("Il servizio non risponde. Riprova."); } finally { setBusy(false); }
  }
  return (
    <section className="platform-auth">
      <p className="platform-eyebrow">PROEMIOS / SICUREZZA</p>
      <h1>Proteggi il tuo accesso.</h1>
      <p>
        La verifica in due passaggi è richiesta al team. I codici di recupero consentono l’accesso
        se perdi il telefono: conservali in un posto sicuro.
      </p>
      {error ? (
        <p role="alert" className="platform-error">
          {error}
        </p>
      ) : null}
      {!enabled && !uri ? (
        <form className="platform-form" onSubmit={enable}>
          <label>
            Conferma la password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="platform-button" disabled={busy}>
            Attiva la verifica →
          </button>
        </form>
      ) : null}
      {uri ? (
        <div className="platform-card">
          <h2>Collega l’app di autenticazione</h2>
          <QRCodeSVG value={uri} size={180} title="Codice QR per l’app di autenticazione" />
          <details>
            <summary>Non puoi scansionare il codice?</summary>
            <p className="platform-secret">{new URL(uri).searchParams.get("secret")}</p>
          </details>
          <h2>Codici di recupero</h2>
          <p>Salvali prima di continuare. Ogni codice funziona una sola volta.</p>
          <ul>
            {codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <form className="platform-form" onSubmit={verify}>
            <label>
              Primo codice dell’app
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
              />
            </label>
            <button className="platform-button" disabled={busy}>
              Verifica e continua →
            </button>
          </form>
        </div>
      ) : null}
      {enabled ? <p className="platform-notice">Verifica in due passaggi attiva.</p> : null}
      <h2>Sessioni del tuo account</h2>
      <button className="platform-text-button" disabled={busy} onClick={async () => {
        setBusy(true); try { const result = await authClient.revokeSessions(); if (result.error) setError("Revoca non riuscita."); else location.assign("/accedi"); } catch { setError("Il servizio non risponde."); } finally { setBusy(false); }
      }}>Esci da tutti i dispositivi</button>
      {sessions.map((s) => (
        <div className="platform-row" key={s.token}>
          <span>
            {s.userAgent?.slice(0, 90) ?? "Dispositivo"} ·{" "}
            {new Date(s.createdAt).toLocaleDateString("it-IT")}
          </span>
          <button
            className="platform-text-button"
            onClick={async () => {
              const r = await authClient.revokeSession({ token: s.token });
              if (!r.error) {
                setSessions((all) => all.filter((x) => x.token !== s.token));
                window.location.assign("/accedi");
              } else setError("Revoca non riuscita.");
            }}
          >
            Revoca
          </button>
        </div>
      ))}
      <Link className="platform-button" href="/spazio">
        Torna al tuo spazio →
      </Link>
    </section>
  );
}
