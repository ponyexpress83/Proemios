"use client";
import { useState } from "react";
import Link from "next/link";
export function TokenClaim({
  token,
  kind,
}: {
  token: string;
  kind: "invite-accept" | "quote-claim";
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="platform-auth">
      <p className="platform-eyebrow">PROEMIOS / ACCESSO PERSONALE</p>
      <h1>{kind === "invite-accept" ? "Unisciti al team." : "La tua proposta ti aspetta."}</h1>
      <p>
        Accedi con l’indirizzo verificato che ha ricevuto il collegamento, poi conferma qui. Il
        collegamento è personale e ha una scadenza.
      </p>
      <div className="platform-auth-links">
        <Link href="/accedi" target="_blank" rel="noopener noreferrer">
          Accedi
        </Link>
        <Link href="/registrati" target="_blank" rel="noopener noreferrer">
          Crea un account
        </Link>
      </div>
      {error ? (
        <p className="platform-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        disabled={busy || !token}
        className="platform-button"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(`/api/platform/${kind}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const data = await r.json();
            if (!r.ok) setError(data.errore ?? "Operazione non riuscita.");
            else {
              history.replaceState(null, "", location.pathname);
              location.assign(kind === "invite-accept" ? "/sicurezza" : "/spazio");
            }
          } catch {
            setError("Il servizio non risponde. Riprova.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Conferma e continua →
      </button>
    </section>
  );
}
