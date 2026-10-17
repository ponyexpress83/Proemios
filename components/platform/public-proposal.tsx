"use client";
/**
 * Proposta o pacchetto da un link protetto: si legge prima di avere un
 * account (totale, imposte, acconto e rate sempre visibili), si accetta o
 * si compra solo con un account dall'email verificata. Nessun dato personale
 * passa dal link.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

type Money = { netCents: number; taxCents: number; grossCents: number };
type Pkg = { tier: string; name: string; recommended: boolean; lineItems: Array<{ label: string; amount: number }>; includes: string[]; excludes: string[]; money: Money; depositMoney: Money; installments: Array<{ label: string; amountCents: number }> };
type View = { kind: "quote" | "package"; name?: string; version?: number; accepted?: boolean; expiresAt?: string | null; linkExpiresAt: string; workTerms?: { deliveries?: string; revisions?: string; timing?: string; exclusions?: string[] } | null; vat: { mode: string; rateBps: number }; packages: Pkg[] };
const eur = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100);

export function PublicProposal({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState("");
  useEffect(() => {
    fetch(`/api/public/proposta/${encodeURIComponent(token)}`, { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (r.ok) setView(d); else setError(d.errore ?? "Il collegamento non è valido."); }).catch(() => setError("Il servizio non risponde. Riprova."));
  }, [token]);
  const back = typeof location !== "undefined" ? encodeURIComponent(location.pathname) : "";
  async function proceed() {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/platform/crm/links/${view?.kind === "package" ? "purchase" : "claim"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const d = await r.json();
      if (r.status === 401) { location.assign(`/accedi?ritorno=${back}`); return; }
      if (!r.ok) { setError(d.errore ?? "Operazione non riuscita."); return; }
      location.assign(d.href);
    } catch { setError("Il servizio non risponde. Riprova."); } finally { setBusy(false); }
  }
  async function message(kind: "clarification" | "change_request", body: string) {
    setBusy(true); setError(""); setSent("");
    try {
      const r = await fetch(`/api/public/proposta/${encodeURIComponent(token)}/messaggio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.errore ?? "Invio non riuscito."); else setSent("Messaggio inviato: chi ti segue ti risponde.");
    } finally { setBusy(false); }
  }
  return (
    <section className="platform-auth crm-public">
      <p className="platform-eyebrow">PROPOSTA PERSONALE</p>
      <h1>{view?.kind === "package" ? view.name : "La tua proposta"}</h1>
      {error ? <p className="platform-error" role="alert">{error}</p> : null}
      {!view && !error ? <p role="status">Caricamento…</p> : null}
      {view ? (
        <>
          <p>Prezzi {view.vat.mode === "exempt" ? "senza IVA (regime applicato dal fornitore)" : `con IVA al ${view.vat.rateBps / 100}%`}. Il link vale fino al {new Date(view.linkExpiresAt).toLocaleDateString("it-IT")}{view.expiresAt ? `; la proposta fino al ${new Date(view.expiresAt).toLocaleDateString("it-IT")}` : ""}.</p>
          {view.packages.map((p) => (
            <article className="platform-card" key={p.tier}>
              <h2>{p.name}{p.recommended ? " · consigliato" : ""}</h2>
              <ul>{p.lineItems.map((l, i) => <li key={i}>{l.label}: € {l.amount.toLocaleString("it-IT")}</li>)}</ul>
              <p><strong>Totale {eur(p.money.grossCents)}</strong> (imponibile {eur(p.money.netCents)}, imposte {eur(p.money.taxCents)})</p>
              <p>Acconto alla conferma: <strong>{eur(p.depositMoney.grossCents)}</strong></p>
              <p>Pagamenti: {p.installments.map((s) => `${s.label} ${eur(s.amountCents)}`).join(" · ")}</p>
              {p.includes.length ? <details><summary>Cosa è incluso</summary><ul>{p.includes.map((x, i) => <li key={i}>{x}</li>)}</ul></details> : null}
              {p.excludes.length ? <details><summary>Cosa non è incluso</summary><ul>{p.excludes.map((x, i) => <li key={i}>{x}</li>)}</ul></details> : null}
            </article>
          ))}
          {view.workTerms ? <div className="platform-card"><h2>Condizioni di lavorazione</h2>{view.workTerms.revisions ? <p>Revisioni: {view.workTerms.revisions}</p> : null}{view.workTerms.deliveries ? <p>Consegne: {view.workTerms.deliveries}</p> : null}{view.workTerms.timing ? <p>Tempi: {view.workTerms.timing}</p> : null}{view.workTerms.exclusions?.length ? <p>Esclusioni: {view.workTerms.exclusions.join(", ")}</p> : null}</div> : null}
          {view.accepted ? <p className="platform-notice">Questa proposta è già stata accettata.</p> : (
            <>
              <p>Per {view.kind === "package" ? "acquistare" : "accettare"} accedi o crea un account con il tuo indirizzo email: lo verifichiamo prima di procedere. Il contratto e il pagamento arrivano nella pagina successiva.</p>
              <div className="platform-auth-links"><Link href={`/accedi?ritorno=${back}` as Route}>Accedi</Link><Link href={`/registrati?ritorno=${back}` as Route}>Crea un account</Link></div>
              <button className="platform-button" disabled={busy} onClick={proceed}>{view.kind === "package" ? "Ho un account: acquista →" : "Ho un account: collega e conferma →"}</button>
            </>
          )}
          <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); message(f.get("kind") === "change_request" ? "change_request" : "clarification", String(f.get("body"))); }}>
            <h2>Hai una domanda?</h2>
            <label>Tipo<select name="kind"><option value="clarification">Chiedere un chiarimento</option><option value="change_request">Chiedere una modifica</option></select></label>
            <label>Messaggio<textarea name="body" required minLength={5} maxLength={3000} /></label>
            <button className="platform-button" disabled={busy}>Invia</button>
            {sent ? <p className="platform-notice" role="status">{sent}</p> : null}
          </form>
        </>
      ) : null}
    </section>
  );
}
