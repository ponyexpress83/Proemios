"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, Clock3, CreditCard, FileText, ShieldCheck, UserRound } from "lucide-react";
import { platformApi } from "@/components/platform/workspace";
import { JOURNEY_LABELS, type JourneyStage, type PurchasePath } from "@/lib/platform/commercial";
import { BillingFields, billingPayload, billingSummary, emptyBilling, type Billing } from "./billing";
type Money = { grossCents: number; netCents: number; taxCents: number };
type Package = { tier: string; name: string; headline: string; recommended: boolean; total: number; deposit: number; includes: string[]; excludes: string[]; lineItems: { key: string; label: string; amount: number }[]; rushSurcharge: number; volumeDiscount: number; minimumApplied: boolean; money: Money; depositMoney: Money };
type Detail = {
  quote: { id: string; input: { projectType: string; textState: string; wordCount: number; singleService?: string; requestedServices?: string[]; urgency?: string }; createdAt: string };
  packages: Package[];
  record: { version: number; acceptedAt: string | null; selectedTier: string | null; termsVersion: string | null; expiresAt: string | null; commercialState: string; reviewRequestedAt: string | null; offeredAt: string | null; preferredTier: string | null };
  paymentPolicy: { version: string; vatMode: string; vatRateBps: number; termsVersion: string } | null;
  journey: JourneyStage;
  purchasePath: PurchasePath;
  referente: { name: string } | null;
};
type Payments = { project: { id: string; stage: string } | null; checkoutAvailable: boolean; methods: string[]; deposit: { grossCents: number | null; paid: boolean }; balance: { grossCents: number | null; paid: boolean }; orders: { id: string; kind: string; status: string }[]; invoices: { id: string; kind: string; number: string | null; status: string; grossCents: number }[] };
const cents = (v: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v / 100);
const euro = (v: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const date = (s: string) => new Date(s).toLocaleDateString("it-IT");
const serviceNames: Record<string, string> = { proofreading: "Correzione bozze", editing: "Editing", layout: "Impaginazione", epub: "EPUB", cover: "Copertina", kdp: "Pubblicazione KDP", isbn: "Assistenza ISBN", amazonListing: "Scheda Amazon" };
const projectNames: Record<string, string> = { romanzo: "Romanzo", saggio: "Saggio", memoir: "Memoir", "libro-professionale": "Libro professionale", "solo-grafica": "Solo grafica" };
const PATH_COPY: Record<PurchasePath, string> = {
  standard: "Servizio con perimetro e prezzo di listino verificabili.",
  evaluation: "Il prezzo dipende dalla lettura del testo: il team lo conferma prima della proposta definitiva.",
  complex: "Progetto da costruire insieme: brief, confronto e proposta per fasi.",
};
/**
 * La proposta dell’autore, dalla stima al pagamento, in una sola pagina.
 * Ogni importo arriva dal server con la policy fiscale della proposta: qui non
 * si calcola l’IVA, si mostra.
 */
export function PurchaseConfirm({ quoteId, user, initialTier, payment }: { quoteId: string; user: { id: string; name: string; email: string }; initialTier?: string; payment?: string }) {
  const [detail, setDetail] = useState<Detail | null>(null), [payments, setPayments] = useState<Payments | null>(null), [billing, setBilling] = useState<Billing | null | undefined>(undefined);
  const [tier, setTier] = useState<string | null>(null), [terms, setTerms] = useState(false), [editBilling, setEditBilling] = useState(false), [form, setForm] = useState<Billing>(emptyBilling(user.name));
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [missing, setMissing] = useState(false), [reload, setReload] = useState(0), [note, setNote] = useState("");
  useEffect(() => {
    if (payment === "annullato") setNotice("Pagamento annullato: nessun importo è stato addebitato. La proposta e le tue scelte sono ancora qui.");
  }, [payment]);
  useEffect(() => {
    let live = true;
    Promise.all([platformApi<Detail>(`quotes/${quoteId}`), platformApi<Payments>(`quotes/${quoteId}/payments`), platformApi<{ billing: Billing | null }>("me/billing")])
      .then(([d, p, b]) => {
        if (!live) return;
        setDetail(d); setPayments(p); setBilling(b.billing);
        if (b.billing) setForm({ ...b.billing, taxCode: b.billing.taxCode ?? "", vatNumber: b.billing.vatNumber ?? "", province: b.billing.province ?? "", sdiCode: b.billing.sdiCode ?? "", pec: b.billing.pec ?? "" });
        const tiers = d.packages.map((x) => x.tier);
        const wanted = [d.record.selectedTier, initialTier, d.record.preferredTier, d.packages.find((x) => x.recommended)?.tier, tiers[0]].find((t) => t && tiers.includes(t));
        setTier(wanted ?? null);
        fetch("/api/eventi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "proposal_viewed", quoteId }) }).catch(() => {});
      })
      .catch((e: Error & { status?: number }) => { if (!live) return; if (e.status === 404) setMissing(true); else setError(e.message); });
    return () => { live = false; };
  }, [quoteId, initialTier, reload]);
  const pkg = useMemo(() => detail?.packages.find((p) => p.tier === tier) ?? null, [detail, tier]);
  const distinct = useMemo(() => detail ? detail.packages.filter((p, i, all) => all.findIndex((o) => o.tier === p.tier) === i) : [], [detail]);
  async function run(work: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await work(); } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "STALE_QUOTE" || err.code === "POLICY_REVIEW_REQUIRED") { setNotice("La proposta è stata aggiornata dal team mentre la leggevi: ecco la versione attuale."); setReload((x) => x + 1); }
      else if (err.code === "CHECKOUT_EXPIRED") { setNotice("La sessione di pagamento era scaduta: ne apriamo una nuova."); setReload((x) => x + 1); }
      else setError(err.message || "Operazione non riuscita.");
    } finally { setBusy(false); }
  }
  function choose(next: string) {
    setTier(next);
    if (detail && !detail.record.acceptedAt) platformApi(`quotes/${quoteId}/prefer`, "POST", { tier: next }).catch(() => {});
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !pkg || !detail.paymentPolicy) return;
    await run(async () => {
      const result = await platformApi<{ accepted: boolean; url: string | null; checkoutAvailable: boolean; message?: string }>(`quotes/${quoteId}/confirm`, "POST", {
        tier: pkg.tier, version: detail.record.version, policyVersion: detail.paymentPolicy!.version, termsAccepted: true,
        ...(billing && !editBilling ? {} : { billing: billingPayload(form) }),
      });
      if (result.url) { fetch("/api/eventi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "checkout_opened", quoteId }) }).catch(() => {}); window.location.assign(result.url); return; }
      setNotice(result.message ?? "Proposta accettata."); setReload((x) => x + 1);
    });
  }
  const pay = (kind: "deposit" | "balance") => run(async () => { const r = await platformApi<{ url: string }>("checkout", "POST", { quoteId, kind }); if (r.url) window.location.assign(r.url); });
  if (missing) return <Shell><article className="workspace-card"><span className="eyebrow">PROPOSTA</span><h2>Questa proposta non è collegata al tuo account.</h2><p>Succede quando il preventivo è stato richiesto con un altro indirizzo email. Apri il collegamento personale che hai ricevuto via email con l’indirizzo giusto, oppure scrivici.</p><div className="author-approval"><Link className="author-cta" href="/area-autore">La tua area <ArrowRight size={16} /></Link><Link className="author-text-link" href="/contatti">Scrivi al team →</Link></div></article></Shell>;
  if (!detail || !payments || billing === undefined) return <Shell>{error ? <p role="alert" className="platform-error">{error}</p> : <p role="status">Caricamento della proposta…</p>}</Shell>;
  const stage = detail.journey, label = JOURNEY_LABELS[stage];
  const policy = detail.paymentPolicy, vat = policy ? (policy.vatMode === "exempt" ? "operazione esente IVA" : `IVA ${policy.vatRateBps / 100}%`) : "";
  const business = (editBilling || !billing ? form.kind : billing.kind) === "business";
  const input = detail.quote.input;
  const service = input.singleService ? serviceNames[input.singleService] ?? input.singleService : "Percorso editoriale";
  const pending = payments.orders.find((o) => o.status === "pending");
  return (
    <Shell>
      <header className="author-confirm-head">
        <span className={`status-pill ${["paid", "deposit_paid"].includes(stage) ? "peach" : "lavender"}`}>{label.label}</span>
        <h1>{service} · {projectNames[input.projectType] ?? input.projectType}</h1>
        <p>{label.hint}</p>
        <ul className="author-confirm-meta">
          <li><FileText size={16} /> {input.wordCount.toLocaleString("it-IT")} parole{input.urgency === "prioritaria" ? " · tempi prioritari" : ""}</li>
          {detail.referente && <li><UserRound size={16} /> Ti segue {detail.referente.name}</li>}
          {detail.record.expiresAt && stage === "offer" && <li><Clock3 size={16} /> Valida fino al {date(detail.record.expiresAt)}</li>}
          <li><ShieldCheck size={16} /> {PATH_COPY[detail.purchasePath]}</li>
        </ul>
      </header>
      {error && <p role="alert" className="platform-error">{error}</p>}
      {notice && <p role="status" className="platform-notice">{notice}</p>}

      {(stage === "estimate" || stage === "expired") && (
        <article className="workspace-card">
          <span className="eyebrow">{stage === "expired" ? "PROPOSTA SCADUTA" : "STIMA INDICATIVA"}</span>
          <h2>{stage === "expired" ? "Serve una nuova versione." : "Non è ancora una proposta acquistabile."}</h2>
          <p>{stage === "expired" ? "La validità è terminata. Chiedi al team una nuova versione: non perdi nulla di quanto inserito." : detail.purchasePath === "complex" ? "Per questo tipo di progetto il team legge i materiali e costruisce con te una proposta per fasi. Il prezzo qui sotto è un ordine di grandezza dal listino." : "Il prezzo qui sotto è calcolato dal listino sui dati inseriti. Dopo la verifica del testo diventa definitivo e potrai confermarlo: se il lavoro è meno di quanto stimato, scende."}</p>
          <div className="author-real-grid">{distinct.map((p) => <PackageCard key={p.tier} p={p} chosen={p.tier === tier} estimate vat={vat} onChoose={() => choose(p.tier)} />)}</div>
          <form className="author-upload" onSubmit={(e) => { e.preventDefault(); run(async () => { await platformApi(`quotes/${quoteId}/review`, "POST", note.trim() ? { note: note.trim() } : {}); setNotice("Richiesta inviata: il team ti risponde con la proposta definitiva. Non devi fare altro."); setReload((x) => x + 1); }); }}>
            <label>Qualcosa che il team deve sapere (facoltativo)<textarea rows={3} maxLength={3000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Scadenze, dubbi, cosa ti preme di più…" /></label>
            <div className="author-approval"><button className="author-cta" disabled={busy}>{stage === "expired" ? "Chiedi una nuova versione" : "Richiedi la proposta definitiva"} <ArrowRight size={16} /></button><Link className="author-text-link" href="/contatti?motivo=editor">Preferisco parlarne con un editor →</Link></div>
          </form>
        </article>
      )}

      {stage === "review" && (
        <article className="workspace-card">
          <span className="eyebrow">IN VALUTAZIONE</span>
          <h2>Il team sta esaminando il progetto.</h2>
          <p>Richiesta inviata{detail.record.reviewRequestedAt ? ` il ${date(detail.record.reviewRequestedAt)}` : ""}. {detail.referente ? `${detail.referente.name} verifica testo, quantità e servizi` : "Il team verifica testo, quantità e servizi"} e ti manda la proposta definitiva via email e qui. Fino ad allora non devi fare nulla.</p>
          <div className="author-real-grid">{distinct.map((p) => <PackageCard key={p.tier} p={p} chosen={p.tier === tier} estimate vat={vat} />)}</div>
          <Link className="author-text-link" href="/area-autore">Torna alla tua area →</Link>
        </article>
      )}

      {stage === "offer" && pkg && policy && (
        <form className="workspace-card" onSubmit={confirm} aria-busy={busy}>
          <span className="eyebrow">CONFERMA E PAGAMENTO</span>
          <h2>Tutto quello che conferma questa proposta.</h2>
          {distinct.length > 1 && <fieldset className="author-tier-choice"><legend>Il pacchetto</legend><div className="author-real-grid">{distinct.map((p) => <PackageCard key={p.tier} p={p} chosen={p.tier === tier} vat={vat} onChoose={() => choose(p.tier)} />)}</div></fieldset>}
          <dl className="author-confirm-table">
            <div><dt>Servizio e pacchetto</dt><dd>{service} · {pkg.name}{pkg.recommended ? " (consigliato)" : ""}</dd></div>
            <div><dt>Quantità e materiali</dt><dd>{input.wordCount.toLocaleString("it-IT")} parole dichiarate{input.textState === "finito-revisionato" ? ", testo finito e revisionato" : input.textState === "finito-da-revisionare" ? ", testo finito da revisionare" : ""}. Il conteggio è stato verificato dal team con la proposta definitiva.</dd></div>
            <div><dt>Prestazioni e file inclusi</dt><dd><ul>{pkg.lineItems.map((li) => <li key={li.key}>{li.label} · {euro(li.amount)}</li>)}</ul></dd></div>
            {pkg.excludes.length > 0 && <div><dt>Non incluso</dt><dd>{pkg.excludes.join(" · ")}</dd></div>}
            <div><dt>Revisioni comprese</dt><dd>I giri di revisione indicati nelle voci sopra{pkg.lineItems.some((li) => li.key === "extraRevisionRound") ? ", con un giro aggiuntivo" : ""}. Ogni consegna passa dalla tua approvazione nell’area autore.</dd></div>
            <div><dt>Tempi e avvio</dt><dd>Tempi {input.urgency === "prioritaria" ? "prioritari, con maggiorazione già inclusa" : "standard"}. La lavorazione parte dopo l’acconto e il caricamento dei materiali; il saldo è dovuto alla consegna.</dd></div>
            <div><dt>Importi</dt><dd>
              {business ? (
                <ul className="author-amounts"><li>Imponibile <strong>{cents(pkg.money.netCents)}</strong></li><li>{vat} <strong>{cents(pkg.money.taxCents)}</strong></li><li>Totale <strong>{cents(pkg.money.grossCents)}</strong></li></ul>
              ) : (
                <ul className="author-amounts"><li>Totale, {policy.vatMode === "exempt" ? "esente IVA" : "IVA inclusa"} <strong>{cents(pkg.money.grossCents)}</strong></li>{policy.vatMode !== "exempt" && <li><small>di cui {vat}: {cents(pkg.money.taxCents)}</small></li>}</ul>
              )}
              <ul className="author-amounts"><li>Da pagare ora (acconto) <strong>{cents(pkg.depositMoney.grossCents)}</strong></li><li>Residuo alla consegna <strong>{cents(pkg.money.grossCents - pkg.depositMoney.grossCents)}</strong></li></ul>
            </dd></div>
          </dl>
          <section className="author-billing">
            <h3>Dati di fatturazione</h3>
            {billing && !editBilling ? <><p>{billingSummary(billing)}</p><button type="button" className="author-text-link" onClick={() => setEditBilling(true)}>Modifica →</button></> : <div className="author-upload"><BillingFields form={form} onChange={setForm} />{billing && <button type="button" className="author-text-link" onClick={() => setEditBilling(false)}>Annulla la modifica</button>}</div>}
          </section>
          <label className="author-terms"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required /> Ho letto e accetto le <Link href="/termini" target="_blank" rel="noopener">condizioni contrattuali e di pagamento</Link> (versione {policy.termsVersion}) per questa proposta.</label>
          <div className="author-approval">
            <button className="author-cta" disabled={busy || !terms}>{payments.checkoutAvailable ? `Accetta e paga ${cents(pkg.depositMoney.grossCents)} ora` : "Accetta la proposta"} <ArrowRight size={16} /></button>
            <small>{payments.checkoutAvailable ? "Pagamento sulla pagina sicura di Stripe con i metodi disponibili. La conferma arriva da Stripe, non dal ritorno a questa pagina." : "Il pagamento online non è ancora attivo: dopo l’accettazione il team ti indica come procedere."}</small>
          </div>
        </form>
      )}

      {["accepted", "processing", "deposit_paid", "paid"].includes(stage) && pkg && (
        <article className="workspace-card">
          <span className="eyebrow">PAGAMENTI</span>
          <h2>{stage === "paid" ? "Tutto pagato." : stage === "deposit_paid" ? "Acconto confermato." : stage === "processing" ? "Stiamo aspettando la conferma." : "Manca solo l’acconto."}</h2>
          <p>Proposta accettata{detail.record.acceptedAt ? ` il ${date(detail.record.acceptedAt)}` : ""}: {pkg.name}, {cents(pkg.money.grossCents)} {policy?.vatMode === "exempt" ? "esente IVA" : "IVA inclusa"}. Le condizioni sono bloccate.</p>
          <div className="author-action-line author-payment-row"><CreditCard size={20} /><span><strong>Acconto</strong><small>{cents(pkg.depositMoney.grossCents)}{payments.deposit.paid ? " · confermato" : pending?.kind === "deposit" ? " · in elaborazione" : ""}</small></span>{payments.deposit.paid ? <span className="status-pill peach"><Check size={14} /> Pagato</span> : <button className="author-cta" disabled={busy || !payments.checkoutAvailable} onClick={() => pay("deposit")}>{pending?.kind === "deposit" ? "Riprendi il pagamento" : "Paga l’acconto"} <ArrowRight size={16} /></button>}</div>
          <div className="author-action-line author-payment-row"><CreditCard size={20} /><span><strong>Saldo</strong><small>{cents(pkg.money.grossCents - pkg.depositMoney.grossCents)} · dovuto alla consegna{payments.balance.paid ? " · confermato" : pending?.kind === "balance" ? " · in elaborazione" : ""}</small></span>{payments.balance.paid ? <span className="status-pill peach"><Check size={14} /> Pagato</span> : payments.deposit.paid ? <button className="author-cta" disabled={busy || !payments.checkoutAvailable} onClick={() => pay("balance")}>{pending?.kind === "balance" ? "Riprendi il pagamento" : "Paga il saldo"} <ArrowRight size={16} /></button> : <small>Dopo l’acconto</small>}</div>
          {pending && <p className="platform-notice">Un pagamento è in attesa di conferma. Con bonifico o addebito SEPA servono alcuni giorni lavorativi: non ripetere l’operazione, ti avvisiamo noi.</p>}
          {payments.invoices.length > 0 && <div className="author-invoices">{payments.invoices.map((f) => <div className="author-action-line" key={f.id}><FileText size={18} /><span><strong>{f.number ? `Fattura n. ${f.number}` : "Fattura"} · {f.kind === "deposit" ? "acconto" : "saldo"}</strong><small>{cents(f.grossCents)}</small></span>{f.number && <a href={`/api/platform/invoices/${f.id}/pdf`}>Scarica PDF</a>}</div>)}</div>}
          {payments.project && <Link className="author-cta" href={`/area-autore?progetto=${payments.project.id}` as Route}>Vai al progetto <ArrowRight size={16} /></Link>}
        </article>
      )}
    </Shell>
  );
}
function PackageCard({ p, chosen, estimate = false, vat, onChoose }: { p: Package; chosen: boolean; estimate?: boolean; vat: string; onChoose?: () => void }) {
  const body = (
    <>
      <strong>{p.name}{p.recommended ? " · consigliato" : ""}</strong>
      <h3>{cents(p.money.grossCents)}</h3>
      <small>{estimate ? "stima " : ""}{vat ? `${vat} inclusa` : ""} · acconto {cents(p.depositMoney.grossCents)}</small>
      <ul>{p.lineItems.map((li) => <li key={li.key}>{li.label}</li>)}</ul>
    </>
  );
  return onChoose ? <button type="button" className={`author-quote-card${chosen ? " chosen" : ""}`} aria-pressed={chosen} onClick={onChoose}>{body}</button> : <div className={`author-quote-card${chosen ? " chosen" : ""}`}>{body}</div>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="author-workspace proemios-author-real author-confirm">
      <div className="author-main">
        <header className="author-topbar"><Link href="/area-autore" className="author-text-link">← La tua area</Link><Link href="/" className="author-logo">proemios</Link></header>
        <main id="contenuto" className="author-content">{children}</main>
      </div>
    </div>
  );
}
