"use client";
import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
export function TokenClaim({
  token,
  kind,
}: {
  token: string;
  kind: "invite-accept" | "quote-claim";
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  // Dopo login o registrazione si torna qui, con il token ancora nell'URL.
  const ritorno = typeof location !== "undefined" ? `${location.pathname}${location.search}` : "";
  const conRitorno = (href: string) => `${href}?ritorno=${encodeURIComponent(ritorno)}`;
  return (
    <section className="platform-auth">
      <p className="platform-eyebrow">PROEMIOS / ACCESSO PERSONALE</p>
      <h1>{kind === "invite-accept" ? "Unisciti al team." : "La tua proposta ti aspetta."}</h1>
      <p>
        Accedi con l’indirizzo che ha ricevuto il collegamento, poi conferma qui. Il collegamento è
        personale e ha una scadenza.
      </p>
      <div className="platform-auth-links">
        <Link href={conRitorno("/accedi") as Route}>Accedi</Link>
        <Link href={conRitorno("/registrati") as Route}>Crea un account</Link>
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
            if (r.status === 401) {
              location.assign(conRitorno("/accedi"));
              return;
            }
            if (!r.ok) setError(data.errore ?? "Operazione non riuscita.");
            else {
              history.replaceState(null, "", location.pathname);
              location.assign(
                kind === "invite-accept"
                  ? "/sicurezza"
                  : `/area-autore/conferma/${encodeURIComponent(data.quoteId ?? "")}`,
              );
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
