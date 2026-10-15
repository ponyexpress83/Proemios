"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { BookOpen, FolderOpen, CreditCard, MessageSquare, FileText, ArrowRight, CheckCircle2, Clock3, LogOut, PlusCircle, Upload, ThumbsUp, RotateCcw, Bell, UserRound, CalendarDays } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { platformApi } from "@/components/platform/workspace";
import type { Grant } from "@/lib/platform/permissions";
import { JOURNEY_LABELS, type JourneyStage } from "@/lib/platform/commercial";
import { BillingSection } from "./billing";
type Props = { user: { id: string; name: string; email: string; grants: Grant[] } };
type Project = { id: string; title: string; type: string; description: string | null; stage: string; updatedAt: string; quoteId: string | null; dueAt: string | null; members: { id: string; name: string }[]; materialsCount: number; materialsPending: number; deliveriesAwaiting: { id: string; name: string; version: number }[]; lastDeliveryAt: string | null; unreadMessages: number };
type Quote = { id: string; stato: string; prezzoTotale: number | null; pacchettoScelto: string | null; acceptedAt: string | null; expiresAt: string | null; commercialState: string; preferredTier: string | null; selectedTier: string | null; journey: JourneyStage; depositPaid: boolean; balancePaid: boolean; paymentPending: boolean; name?: string; version?: number; input?: { singleService?: string; requestedServices?: string[] } };
type FileEntry = { id: string; name: string; version: number; status: string; kind: string; createdAt?: string };
type Approval = { fileId: string; decision: string };
type Detail = { project: Project; files: FileEntry[]; tasks: { id: string; title: string; done: boolean }[]; approvals: Approval[]; members: { id: string; name: string }[] };
type Invoice = { id: string; kind: string; grossCents: number; number: string | null; issuedOn: string | null; status: string };
type Payments = { accepted: boolean; journey: JourneyStage; checkoutAvailable: boolean; vatMode: string; vatRateBps: number; methods: string[]; billingReady: boolean; invoices: Invoice[]; deposit: { grossCents: number | null; paid: boolean }; balance: { grossCents: number | null; paid: boolean }; orders: { id: string; kind: string; amountCents: number; status: string; createdAt: string }[] };
type Notification = { id: string; title: string; body: string; href: string | null; read: boolean; createdAt: string };
const format = (v: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);
const cents = (v: number) => format(v / 100);
const date = (s: string) => new Date(s).toLocaleDateString("it-IT");
const stages = [{ id: "brief", label: "Brief" }, { id: "estimate", label: "Preventivo" }, { id: "materials", label: "Materiali" }, { id: "editing", label: "Lavorazione" }, { id: "review", label: "Revisione" }, { id: "approved", label: "Approvazione" }, { id: "delivered", label: "Consegna" }];
const labels: Record<string, string> = { brief: "Definizione del progetto", estimate: "Preventivo", materials: "Materiali da raccogliere", editing: "Lavorazione editoriale", review: "Revisione", approved: "Approvato", delivered: "Consegnato" };
const fileStatus: Record<string, string> = { quarantine: "in controllo", ready: "disponibile", rejected: "respinto", deleted: "rimosso" };
const serviceNames: Record<string, string> = { proofreading: "Correzione bozze", editing: "Editing", layout: "Impaginazione", epub: "EPUB", cover: "Copertina", kdp: "Pubblicazione KDP", isbn: "Assistenza ISBN", amazonListing: "Scheda Amazon" };
type View = "overview" | "projects" | "quotes" | "payments" | "messages" | "notifications";
const viewFromQuery: Record<string, View> = { panoramica: "overview", progetti: "projects", preventivi: "quotes", pagamenti: "payments", messaggi: "messages", notifiche: "notifications" };
const nav: [View, string, typeof BookOpen][] = [["overview", "Panoramica", BookOpen], ["projects", "I miei libri", FolderOpen], ["quotes", "Preventivi e servizi", FileText], ["payments", "Pagamenti", CreditCard], ["messages", "Messaggi e supporto", MessageSquare], ["notifications", "Notifiche", Bell]];
function vatNote(policy: { vatMode: string; vatRateBps: number } | null) {
  if (!policy) return "";
  if (policy.vatMode === "exempt") return "Operazione esente IVA.";
  if (policy.vatMode === "included") return `IVA ${policy.vatRateBps / 100}% inclusa.`;
  return `+ IVA ${policy.vatRateBps / 100}%.`;
}
type NextAction = { key: string; title: string; detail: string; href?: string; onClick?: () => void; icon: typeof BookOpen; tone: "primary" | "info" };
const serviceSummary = (q: Quote) => q.input?.singleService ? serviceNames[q.input.singleService] ?? q.input.singleService : "Percorso editoriale";
/**
 * Il prossimo passo dell’autore, dallo stato reale di proposte, pagamenti e
 * progetti. Niente richieste già soddisfatte: una proposta pagata non chiede
 * più di pagare, una consegna approvata non chiede più di approvare.
 */
function nextActions(quotes: Quote[], projects: Project[], open: (v: View, id?: string) => void): NextAction[] {
  const actions: NextAction[] = [];
  for (const q of quotes) {
    const title = serviceSummary(q);
    if (q.journey === "estimate") actions.push({ key: `q-${q.id}`, title: "Valuta la proposta", detail: `${title}: stima pronta. Chiedi la proposta definitiva quando vuoi.`, href: `/area-autore/conferma/${q.id}`, icon: FileText, tone: "primary" });
    else if (q.journey === "offer") actions.push({ key: `q-${q.id}`, title: "Conferma la proposta", detail: `${title}: prezzo e condizioni definitivi${q.expiresAt ? `, valida fino al ${date(q.expiresAt)}` : ""}.`, href: `/area-autore/conferma/${q.id}`, icon: CheckCircle2, tone: "primary" });
    else if (q.journey === "expired") actions.push({ key: `q-${q.id}`, title: "Chiedi una nuova versione", detail: `${title}: la proposta è scaduta.`, href: `/area-autore/conferma/${q.id}`, icon: Clock3, tone: "primary" });
    else if (q.journey === "accepted") actions.push({ key: `q-${q.id}`, title: "Completa il pagamento", detail: `${title}: proposta accettata, manca l’acconto per far partire il lavoro.`, href: `/area-autore/conferma/${q.id}`, icon: CreditCard, tone: "primary" });
    else if (q.journey === "processing") actions.push({ key: `q-${q.id}`, title: "Pagamento in elaborazione", detail: `${title}: aspettiamo la conferma di Stripe. Non serve ripetere.`, href: `/area-autore/conferma/${q.id}`, icon: Clock3, tone: "info" });
  }
  for (const p of projects) {
    if (p.unreadMessages > 0) actions.push({ key: `m-${p.id}`, title: "Leggi il messaggio del referente", detail: `${p.title}: ${p.unreadMessages} ${p.unreadMessages === 1 ? "messaggio nuovo" : "messaggi nuovi"}.`, onClick: () => open("messages", p.id), icon: MessageSquare, tone: "primary" });
    for (const d of p.deliveriesAwaiting) actions.push({ key: `a-${d.id}`, title: `Approva la versione ${d.version} di ${d.name}`, detail: `${p.title}: leggila e approvala, oppure chiedi una revisione.`, onClick: () => open("projects", p.id), icon: ThumbsUp, tone: "primary" });
    const quote = p.quoteId ? quotes.find((q) => q.id === p.quoteId) : undefined;
    if (p.stage === "materials" && p.materialsCount === 0 && (!quote || quote.depositPaid)) actions.push({ key: `u-${p.id}`, title: "Carica il materiale richiesto", detail: `${p.title}: il team aspetta il manoscritto per iniziare.`, onClick: () => open("projects", p.id), icon: Upload, tone: "primary" });
    if (["approved", "delivered"].includes(p.stage) && quote && quote.depositPaid && !quote.balancePaid && !quote.paymentPending) actions.push({ key: `s-${p.id}`, title: "Paga il saldo", detail: `${p.title}: il lavoro è approvato, il saldo è dovuto alla consegna.`, href: `/area-autore/conferma/${quote.id}`, icon: CreditCard, tone: "primary" });
    if (p.stage === "delivered" && (!quote || quote.balancePaid)) actions.push({ key: `f-${p.id}`, title: "Scarica i file finali", detail: `${p.title}: la consegna è completa.`, onClick: () => open("projects", p.id), icon: FolderOpen, tone: "primary" });
  }
  return actions;
}
export function RealAuthorWorkspace({ user }: Props) {
  const [view, setView] = useState<View>("overview"), [projects, setProjects] = useState<Project[]>([]), [quotes, setQuotes] = useState<Quote[]>([]), [notifications, setNotifications] = useState<Notification[]>([]), [selected, setSelected] = useState<string | null>(null), [detail, setDetail] = useState<Detail | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preventivo = params.get("preventivo"), progetto = params.get("progetto"), vista = params.get("vista");
    if (params.get("pagamento") === "annullato") setNotice("Pagamento annullato: nessun importo è stato addebitato. Puoi riprovare quando vuoi.");
    if (vista && viewFromQuery[vista]) setView(viewFromQuery[vista]);
    if (progetto && /^[0-9a-f-]{36}$/.test(progetto)) { setView("projects"); setSelected(progetto); }
    else if (preventivo && /^[0-9a-f-]{36}$/.test(preventivo) && vista !== "pagamenti") window.location.replace(`/area-autore/conferma/${preventivo}`);
  }, []);
  useEffect(() => { let active = true; setLoading(true); Promise.all([platformApi<{ projects: Project[] }>("projects"), platformApi<{ quotes: Quote[] }>("quotes"), platformApi<{ notifications: Notification[] }>("notifications")]).then(([a, b, c]) => { if (active) { setProjects(a.projects ?? []); setQuotes(b.quotes ?? []); setNotifications(c.notifications ?? []); } }).catch(e => active && setError(e.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [reload]);
  useEffect(() => {
    if (!selected || view !== "projects") { setDetail(null); return; }
    let active = true;
    platformApi<Detail>("projects/" + selected).then(data => { if (active) setDetail(data); }).catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [selected, view, reload]);
  async function action(fn: () => Promise<unknown>) { setError(""); setBusy(true); try { await fn(); setReload(x => x + 1); } catch (e) { setError(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); } }
  const open = (v: View, id?: string) => { setView(v); setSelected(id ?? null); setError(""); setNotice(""); };
  const latest = projects[0];
  const pending = quotes.filter(q => ["estimate", "offer", "expired"].includes(q.journey)).length;
  const unread = notifications.filter(n => !n.read).length;
  const actions = useMemo(() => nextActions(quotes, projects, open), [quotes, projects]);
  const accepted = quotes.filter(q => q.acceptedAt);
  const referent = (p: Project) => p.members[0]?.name ?? null;
  return <div className="author-workspace proemios-author-real">
    <aside className="author-sidebar">
      <Link href="/" className="author-logo">proemios<span>Dalle idee alle opere</span></Link>
      <p className="sidebar-label">IL TUO SPAZIO</p>
      <nav aria-label="Navigazione autore">{nav.map(([id, label, Icon]) => <button type="button" key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => open(id)}><Icon size={19} />{label}{id === "quotes" && pending > 0 ? <span className="sidebar-counter">{pending}</span> : null}{id === "notifications" && unread > 0 ? <span className="sidebar-counter" aria-label={`${unread} notifiche non lette`}>{unread}</span> : null}</button>)}</nav>
      <div className="sidebar-project"><BookOpen size={22} /><strong>{latest?.title ?? "Il tuo prossimo libro"}</strong><span>{latest ? labels[latest.stage] ?? latest.stage : "Il tuo progetto inizia da qui"}</span></div>
      <button className="sidebar-logout" onClick={() => authClient.signOut().then(() => window.location.assign("/accedi"))}><LogOut size={18} /> Esci</button>
    </aside>
    <div className="author-main">
      <header className="author-topbar"><span>Il tuo spazio / {nav.find(([v]) => v === view)?.[1]}</span><div><span className="author-avatar">{user.name.slice(0, 2).toUpperCase()}</span><strong>{user.name}</strong></div></header>
      <main id="contenuto" className="author-content">
        <div className="workspace-intro"><div><p className="eyebrow">PROEMIOS · AREA AUTORE</p><h1>{view === "overview" ? <>La tua storia <em>prende forma.</em></> : nav.find(([v]) => v === view)?.[1]}</h1><p>{view === "overview" ? "Qui trovi sempre chi ti segue e qual è il prossimo passo." : "Il tuo percorso editoriale, dall’idea alla consegna."}</p></div><Link className="author-cta" href="/preventivo">Nuovo preventivo <ArrowRight size={16} /></Link></div>
        {error && <div className="platform-error" role="alert">{error}</div>}
        {notice && <div className="platform-notice" role="status">{notice}</div>}
        {loading ? <p role="status">Caricamento dei tuoi progetti e preventivi…</p> : <>
          {view === "overview" && <>
            <article className="workspace-card author-next" aria-labelledby="prossimo-passo">
              <span className="eyebrow">IL TUO PROSSIMO PASSO</span>
              <h2 id="prossimo-passo">{actions.length ? (actions.length === 1 ? "Una cosa da fare." : `${actions.length} cose da fare.`) : "Nessuna azione da parte tua."}</h2>
              {actions.length ? actions.map(a => {
                const Icon = a.icon;
                const body = <><Icon size={18} /><span><strong>{a.title}</strong><small>{a.detail}</small></span><ArrowRight size={16} /></>;
                return a.href ? <Link className={`author-action-line ${a.tone}`} key={a.key} href={a.href as Route}>{body}</Link> : <button className={`author-action-line ${a.tone}`} key={a.key} onClick={a.onClick}>{body}</button>;
              }) : <p>{projects.length || quotes.length ? "Il lavoro è in carico al team: ti avvisiamo qui e via email quando serve qualcosa da te." : "Non ci sono ancora attività. Puoi iniziare dal preventivatore."}</p>}
            </article>
            <div className="workspace-stat-grid">
              <article className="workspace-card"><span>Progetti editoriali</span><strong>{projects.length}</strong><button className="author-text-link" onClick={() => open("projects")}>Vai ai progetti →</button></article>
              <article className="workspace-card"><span>Proposte da valutare</span><strong>{pending}</strong><button className="author-text-link" onClick={() => open("quotes")}>Apri le proposte →</button></article>
              <article className="workspace-card"><span>Chi ti segue</span><strong>{latest && referent(latest) ? referent(latest) : "Il team Proemios"}</strong><small>{latest ? `Fase: ${labels[latest.stage] ?? latest.stage}${latest.dueAt ? ` · consegna confermata il ${date(latest.dueAt)}` : ""}` : "Un referente viene assegnato con il progetto"}</small></article>
            </div>
            {latest && <article className="workspace-card project-card"><div><span className="eyebrow">IL TUO LIBRO</span><h2>{latest.title}</h2><p>{latest.description ?? "Il tuo progetto editoriale."}</p><div className="project-progress"><span style={{ width: `${Math.max(8, (stages.findIndex(s => s.id === latest.stage) + 1) / stages.length * 100)}%` }} /></div><button className="author-cta" onClick={() => open("projects", latest.id)}>Segui il percorso <ArrowRight size={16} /></button></div><BookOpen className="author-book-symbol" size={120} strokeWidth={1} /></article>}
          </>}
          {view === "projects" && <>{selected ? <>
            <button className="author-text-link" onClick={() => setSelected(null)}>← Tutti i progetti</button>
            {detail ? <ProjectDetail detail={detail} linkedQuote={detail.project.quoteId ? quotes.find(q => q.id === detail.project.quoteId) : undefined} busy={busy} action={action} onPayments={() => { const q = quotes.find(x => x.id === detail.project.quoteId); if (q) window.location.assign(`/area-autore/conferma/${q.id}`); }} onMessages={() => open("messages", detail.project.id)} /> : <p>Caricamento progetto…</p>}
          </> : <div className="author-real-grid">{projects.map(p => <button className="workspace-card author-project-choice" key={p.id} onClick={() => setSelected(p.id)}><span className="status-pill peach">{labels[p.stage] ?? p.stage}</span><h2>{p.title}</h2><p>{p.description ?? "Il tuo progetto editoriale."}</p><small>{referent(p) ? `Ti segue ${referent(p)} · ` : ""}aggiornato il {date(p.updatedAt)}{p.unreadMessages ? ` · ${p.unreadMessages} messaggi nuovi` : ""}</small><strong>Apri il progetto →</strong></button>)}{!projects.length && <article className="workspace-card"><h2>Non hai ancora progetti.</h2><p>Una volta accettata una proposta, il tuo percorso comparirà qui.</p><Link className="author-cta" href="/preventivo">Richiedi un preventivo <ArrowRight size={16} /></Link></article>}</div>}</>}
          {view === "quotes" && <div className="author-real-grid">{quotes.map(q => <Link className="workspace-card author-project-choice" key={q.id} href={`/area-autore/conferma/${q.id}` as Route}><span className={`status-pill ${["paid", "deposit_paid"].includes(q.journey) ? "peach" : "lavender"}`}>{JOURNEY_LABELS[q.journey].label}</span><h2>{serviceSummary(q)}</h2><p>{q.prezzoTotale ? `${format(q.prezzoTotale)} + IVA` : "Importo da confermare"}{q.preferredTier && !q.acceptedAt ? ` · pacchetto scelto: ${q.preferredTier}` : q.selectedTier ? ` · ${q.selectedTier}` : ""}</p><small>{JOURNEY_LABELS[q.journey].hint}</small><strong>Apri la proposta →</strong></Link>)}{!quotes.length && <article className="workspace-card"><h2>Nessuna proposta.</h2><p>Vuoi una sola correzione bozze o un percorso completo? Puoi scegliere il servizio.</p><Link className="author-cta" href="/preventivo">Calcola il preventivo <PlusCircle size={16} /></Link></article>}</div>}
          {view === "payments" && <article className="workspace-card"><span className="eyebrow">PAGAMENTI E SCADENZE</span><h2>Acconto e saldo delle tue proposte.</h2><p>Il pagamento si apre dopo l’accettazione: prima l’acconto, poi il saldo alla consegna. Paghi sulla pagina sicura di Stripe con i metodi disponibili; lo stato è confermato da Stripe, non dal ritorno a questa pagina. A ogni incasso ricevi la fattura.</p>
            <BillingSection user={user} onReady={() => setReload(x => x + 1)} />
            {accepted.map(q => <QuotePayments key={q.id} quote={q} title={serviceSummary(q)} highlighted={selected === q.id} busy={busy} action={action} reload={reload} />)}
            {!accepted.length && <p>Non hai ancora proposte accettate. {pending > 0 && <button className="author-text-link" onClick={() => open("quotes")}>Valuta le proposte in attesa →</button>}</p>}</article>}
          {view === "messages" && <article className="workspace-card"><h2>Messaggi con il team editoriale</h2>{projects.length ? <AuthorMessages projects={projects} initial={selected ?? undefined} onRead={() => setReload(x => x + 1)} /> : <><p>Non ci sono ancora progetti collegati al tuo account. Per informazioni generali puoi scriverci.</p><Link className="author-cta" href="/contatti">Contatta Proemios <ArrowRight size={16} /></Link></>}</article>}
          {view === "notifications" && <article className="workspace-card"><h2>Notifiche</h2>{notifications.length ? notifications.map(n => <div className={`author-action-line${n.read ? "" : " unread"}`} key={n.id}><Bell size={18} /><span><strong>{n.title}</strong><small>{n.body} · {date(n.createdAt)}</small></span>{n.href && <Link href={n.href as Route} onClick={() => { if (!n.read) platformApi(`notifications/${n.id}`, "PATCH").catch(() => {}); }}>Apri</Link>}{!n.read && <button className="author-text-link" onClick={() => action(() => platformApi(`notifications/${n.id}`, "PATCH"))}>Segna letta</button>}</div>) : <p>Nessuna notifica.</p>}</article>}
        </>}
      </main>
    </div></div>;
}

function QuotePayments({ quote, title, highlighted, busy, action, reload }: { quote: Quote; title: string; highlighted: boolean; busy: boolean; action: (fn: () => Promise<unknown>) => Promise<void>; reload: number }) {
  const [payments, setPayments] = useState<Payments | null>(null), [error, setError] = useState("");
  useEffect(() => { let live = true; platformApi<Payments>(`quotes/${quote.id}/payments`).then(v => { if (live) setPayments(v); }).catch(e => live && setError(e.message)); return () => { live = false; }; }, [quote.id, reload]);
  const checkout = (kind: "deposit" | "balance") => action(async () => { const r = await platformApi<{ url: string }>("checkout", "POST", { quoteId: quote.id, kind }); if (r.url) window.location.assign(r.url); });
  const invoiceLabel: Record<string, string> = { queued: "in emissione", processing: "in emissione", retry: "in emissione", failed: "in verifica dal team", created: "emessa", sent: "emessa" };
  if (error) return <p className="platform-error" role="alert">{error}</p>;
  if (!payments) return <p>Caricamento di {title}…</p>;
  const pendingOrder = (kind: string) => payments.orders.find(o => o.kind === kind && o.status === "pending");
  const vat = vatNote(payments);
  const row = (kind: "deposit" | "balance", label: string, part: { grossCents: number | null; paid: boolean }, enabled: boolean) => <div className="author-action-line author-payment-row" key={kind}>
    <CreditCard size={20} />
    <span><strong>{label}</strong><small>{part.grossCents !== null ? `${cents(part.grossCents)} ${payments.vatMode === "excluded" ? "IVA inclusa" : vat}` : "Importo da definire"}{part.paid ? " · pagato" : pendingOrder(kind) ? " · pagamento avviato, in attesa di conferma" : ""}</small></span>
    {part.paid ? <span className="status-pill peach">Pagato</span> : enabled ? <button disabled={busy || !payments.billingReady || !payments.checkoutAvailable} title={payments.billingReady ? "" : "Completa prima i dati di fatturazione"} className="author-cta" onClick={() => checkout(kind)}>{pendingOrder(kind) ? "Riprendi il pagamento →" : `Paga ${label.toLowerCase()} →`}</button> : <small>Dopo l’acconto</small>}
  </div>;
  return <section className={`author-payments${highlighted ? " highlighted" : ""}`} aria-label={`Pagamenti: ${title}`}>
    <h3>{title}{quote.acceptedAt ? ` · accettata il ${date(quote.acceptedAt)}` : ""}</h3>
    {row("deposit", "L’acconto", payments.deposit, !payments.deposit.paid)}
    {row("balance", "Il saldo", payments.balance, payments.deposit.paid && !payments.balance.paid)}
    {payments.deposit.paid && payments.balance.paid && <p>Tutto pagato. Grazie: il percorso continua nel tuo progetto.</p>}
    {!payments.checkoutAvailable && !payments.balance.paid && <p className="platform-notice">Il pagamento online non è ancora attivo: il team ti indica come procedere.</p>}
    {payments.invoices.length > 0 && <div className="author-invoices">{payments.invoices.map(f => <div className="author-action-line" key={f.id}><FileText size={18} /><span><strong>{f.number ? `Fattura n. ${f.number}` : "Fattura"} · {f.kind === "deposit" ? "acconto" : "saldo"}</strong><small>{cents(f.grossCents)}{f.issuedOn ? ` · ${date(f.issuedOn)}` : ""} · {invoiceLabel[f.status] ?? f.status}</small></span>{f.number && <a href={`/api/platform/invoices/${f.id}/pdf`}>Scarica PDF</a>}</div>)}</div>}
  </section>;
}

/** Caricamento con avanzamento: XHR perché fetch non espone il progresso dell’invio. */
function uploadWithProgress(path: string, form: FormData, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/platform/${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      try { const body = JSON.parse(xhr.responseText) as { errore?: string }; reject(new Error(body.errore ?? "Caricamento non riuscito.")); } catch { reject(new Error("Caricamento non riuscito.")); }
    };
    xhr.onerror = () => reject(new Error("Connessione interrotta durante il caricamento. Riprova."));
    xhr.send(form);
  });
}

function ProjectDetail({ detail, linkedQuote, busy, action, onPayments, onMessages }: { detail: Detail; linkedQuote?: Quote; busy: boolean; action: (fn: () => Promise<unknown>) => Promise<void>; onPayments: () => void; onMessages: () => void }) {
  const [file, setFile] = useState<File | null>(null), [comment, setComment] = useState(""), [uploadKey, setUploadKey] = useState(0), [progress, setProgress] = useState<number | null>(null), [uploadError, setUploadError] = useState("");
  const current = stages.findIndex(x => x.id === detail.project.stage);
  const decided = new Map(detail.approvals.map(a => [a.fileId, a.decision]));
  const deliveries = detail.files.filter(f => f.kind === "delivery"), materials = detail.files.filter(f => f.kind !== "delivery");
  const latestVersion = (name: string, kind: string) => Math.max(...detail.files.filter(f => f.name === name && f.kind === kind).map(f => f.version));
  const referent = detail.members[0]?.name ?? null;
  const paymentNeeded = linkedQuote && !linkedQuote.depositPaid;
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setUploadError("Il file supera i 4 MB. Riduci il file o dividilo in parti."); return; }
    const form = new FormData(); form.append("file", file); form.append("kind", "manuscript");
    setUploadError(""); setProgress(0);
    await action(async () => {
      try { await uploadWithProgress(`projects/${detail.project.id}/files`, form, setProgress); setFile(null); setUploadKey(k => k + 1); }
      catch (e) { setUploadError(e instanceof Error ? e.message : "Caricamento non riuscito."); throw e; }
      finally { setProgress(null); }
    });
  }
  return <>
    <article className="workspace-card"><span className="eyebrow">IL PERCORSO EDITORIALE</span><h2>{detail.project.title}</h2><p>{detail.project.description}</p>
      <ul className="author-confirm-meta">
        <li><UserRound size={16} /> {referent ? `Ti segue ${referent}` : "Il referente viene assegnato dal team"}</li>
        <li><CalendarDays size={16} /> {detail.project.dueAt ? `Consegna confermata: ${date(detail.project.dueAt)}` : "Data di consegna: da confermare dal team"}</li>
      </ul>
      <ol className="author-timeline">{stages.map((s, i) => { const done = i < current, now = i === current; return <li key={s.id} className={done ? "done" : now ? "current" : ""}><span>{done ? <CheckCircle2 size={18} /> : i + 1}</span><div><strong>{s.label}</strong><small>{done ? "Completato" : now ? "Fase attuale" : "Da iniziare"}</small></div></li>; })}</ol>
      {linkedQuote && <p>Servizio acquistato: {serviceSummary(linkedQuote)}. <button className="author-text-link" onClick={onPayments}>{paymentNeeded ? "Completa il pagamento →" : "Vedi acconto e saldo →"}</button></p>}
      <p>Queste sono le fasi operative della piattaforma; la produzione esegue esclusivamente le lavorazioni concordate.</p></article>
    <div className="workspace-two-columns">
      <article className="workspace-card"><h2>I tuoi materiali</h2>
        {materials.length ? materials.map(f => <div className="author-action-line" key={f.id}><FolderOpen size={18} /><span><strong>{f.name}</strong><small>Versione {f.version}{f.version === latestVersion(f.name, f.kind) ? " (attuale)" : ""} · {fileStatus[f.status] ?? f.status}</small></span>{f.status === "ready" && <a href={`/api/platform/files/${f.id}/download`}>Scarica</a>}</div>) : <p>Non hai ancora caricato il manoscritto.</p>}
        {paymentNeeded ? <p className="platform-notice">Il caricamento si attiva dopo la conferma dell’acconto.</p> : <form className="author-upload" onSubmit={upload}>
          <label>Carica il manoscritto o un nuovo materiale<input key={uploadKey} type="file" accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadError(""); }} /></label>
          <small>Fino a 4 MB. Una nuova versione dello stesso nome conserva la precedente. DOCX e PDF restano in controllo finché la verifica non è completata.</small>
          {progress !== null && <progress value={progress} max={1} aria-label="Avanzamento del caricamento">{Math.round(progress * 100)}%</progress>}
          {uploadError && <p role="alert" className="platform-error">{uploadError}</p>}
          <button type="submit" className="author-cta" disabled={busy || !file}><Upload size={16} /> {progress !== null ? `Caricamento ${Math.round(progress * 100)}%` : "Invia al team"}</button>
        </form>}</article>
      <article className="workspace-card"><h2>Consegne da approvare</h2>
        {deliveries.length ? deliveries.map(f => { const decision = decided.get(f.id); const latest = f.version === latestVersion(f.name, f.kind); return <div className="author-action-line" key={f.id}><FileText size={18} /><span><strong>{f.name}</strong><small>Versione {f.version}{latest ? " (attuale)" : " (superata)"} · {fileStatus[f.status] ?? f.status}{decision ? ` · ${decision === "approved" ? "approvata" : "revisione richiesta"}` : ""}</small></span>{f.status === "ready" && <a href={`/api/platform/files/${f.id}/download`}>Scarica</a>}
          {f.status === "ready" && !decision && latest && <span className="author-approval"><button className="author-cta" disabled={busy} onClick={() => action(() => platformApi(`files/${f.id}/approval`, "POST", { decision: "approved", ...(comment.trim() ? { comment: comment.trim() } : {}) }))}><ThumbsUp size={16} /> Approva la versione {f.version}</button><button className="author-text-link" disabled={busy} onClick={() => action(() => platformApi(`files/${f.id}/approval`, "POST", { decision: "changes_requested", ...(comment.trim() ? { comment: comment.trim() } : {}) }))}><RotateCcw size={16} /> Chiedi una revisione</button></span>}</div>; }) : <p>Il team non ha ancora consegnato revisioni.</p>}
        {deliveries.some(f => f.status === "ready" && !decided.has(f.id)) && <label className="author-upload">Un commento per il team (facoltativo)<textarea rows={3} maxLength={5000} value={comment} onChange={e => setComment(e.target.value)} placeholder="Cosa va bene, cosa va rivisto…" /></label>}
        <h2>Attività</h2>{detail.tasks.length ? detail.tasks.map(t => <p key={t.id}>{t.done ? "✓" : "○"} {t.title}</p>) : <p>Non ci sono attività aperte.</p>}
        <button className="author-text-link" onClick={onMessages}><MessageSquare size={16} /> Scrivi al team su questo progetto →</button></article>
    </div>
  </>;
}

function AuthorMessages({ projects, initial, onRead }: { projects: Project[]; initial?: string; onRead: () => void }) {
  const [projectId, setProjectId] = useState(initial && projects.some(p => p.id === initial) ? initial : projects[0]?.id ?? "");
  const [items, setItems] = useState<{ id: string; body: string; name: string; createdAt: string; read: boolean; senderId: string }[]>([]);
  const [draft, setDraft] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true; setError("");
    platformApi<{ messages: typeof items }>(`projects/${projectId}/messages`).then(async v => {
      if (!live) return;
      setItems(v.messages ?? []);
      const unread = (v.messages ?? []).filter(m => !m.read);
      if (unread.length) { await Promise.all(unread.map(m => platformApi(`projects/${projectId}/messages`, "PATCH", { messageId: m.id }).catch(() => {}))); onRead(); }
    }).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [projectId, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const project = projects.find(p => p.id === projectId);
  return <div className="author-conversation">
    <label>Il progetto <select value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    {project?.members[0] && <p><UserRound size={16} /> Ti risponde {project.members[0].name}.</p>}
    {error && <p role="alert" className="platform-error">{error}</p>}
    <div className="author-message-thread" role="log">{items.length ? items.map(m => <div key={m.id} className="author-message"><strong>{m.name}</strong><small>{date(m.createdAt)}</small><p>{m.body}</p></div>) : <p>Nessun messaggio ancora. Scrivi al team per iniziare.</p>}</div>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await platformApi(`projects/${projectId}/messages`, "POST", { body: draft, internal: false }); setDraft(""); setReload(x => x + 1); } catch (err) { setError(err instanceof Error ? err.message : "Invio non riuscito"); } finally { setBusy(false); } }}>
      <label htmlFor="author-message-draft">Il tuo messaggio</label>
      <textarea id="author-message-draft" rows={4} maxLength={8000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Scrivi al team editoriale…" />
      <button type="submit" className="author-cta" disabled={busy || !draft.trim()}><MessageSquare size={16} /> Invia messaggio</button>
    </form>
  </div>;
}
