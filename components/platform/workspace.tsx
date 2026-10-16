"use client";
import { useEffect, useState, type ReactNode } from "react";
import { PIPELINE_STATES, PIPELINE_LABELS, type PipelineState } from "@/lib/platform/pipeline";
import Link from "next/link";
import type { Route } from "next";
import type { PricingInput } from "@/lib/pricing";
import { authClient } from "@/lib/auth-client";
import {
  can,
  hasPermission,
  ROLE_NAMES,
  ROLES,
  ROLE_GRANTS,
  PERMISSIONS,
  MARKETING_PERMISSIONS,
  type Role,
  type Grant,
  type Permission,
} from "@/lib/platform/permissions";

type Profile = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  grants: Grant[];
  staff: boolean;
  mfaEnabled: boolean;
};
type Project = {
  id: string;
  title: string;
  description: string | null;
  authorId: string;
  stage: string;
  type: string;
  updatedAt: string;
};
type StoredFile = {
  id: string;
  name: string;
  version: number;
  size: number;
  kind: string;
  status: string;
};
type Task = { id: string; title: string; done: boolean; dueAt: string | null; internal: boolean };
type Message = { id: string; body: string; internal: boolean; name: string; createdAt: string };
type ContactPreferences = { email: boolean; phone: boolean; whatsapp: boolean; sms: boolean; note?: string | null };
type Lead = {
  id: string;
  nome: string;
  email: string;
  telefono: string | null;
  stage: string;
  pipeline?: PipelineState;
  fonte?: string;
  sourceDetail?: string | null;
  externalRef?: string | null;
  leadScore: number;
  note: string | null;
  assignedTo: string | null;
  assignedName?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  lastContactAt?: string | null;
  lostReason?: string | null;
  consensoPrivacy?: boolean;
  consensoMarketing?: boolean;
  marketingRevokedAt?: string | null;
  contactPreferences?: ContactPreferences | null;
  createdAt?: string;
};
type LeadActivity = { id: string; kind: string; channel: string | null; direction: string; purpose: string | null; body: string | null; outcome: string | null; createdAt: string; name: string | null };
type Quote = {
  id: string;
  name?: string;
  stato: string;
  prezzoTotale: number | null;
  acceptedAt: string | null;
};
type Payout = {
  id: string;
  beneficiaryId: string;
  amountCents: number;
  status: string;
  ruleVersion: string;
  paymentReference: string | null;
};
type Membership = { id: string; role: Role; active: boolean; grants: Grant[] | null };
type Person = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  memberships: Membership[];
};
type Order = { id: string; quoteId: string; kind: string; sequence?: number; plan?: string; amountCents: number; status: string; stripePaymentIntentId?: string | null };
type RefundRequest = { id: string; orderId: string; amountCents: number; reason: string; preparedBy: string; authorizedBy: string | null; status: string; stripeRefundId: string | null; lastError: string | null; createdAt: string };
type Ledger = {
  id: string;
  kind: string;
  amountCents: number;
  reference: string;
  createdAt: string;
};
type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string };
type Collection = {
  totals?: { balanceCents: number; entries: number };
  preferences?: { optionalEmail: boolean; savedFilters: Record<string, string> };
  jobs?: Array<{ id: string; status: string; attempts: number; errorCode: string | null }>;
  projects?: Project[];
  tasks?: Task[];
  leads?: Lead[];
  quotes?: Quote[];
  users?: Person[];
  commissions?: Payout[];
  orders?: Order[];
  refunds?: RefundRequest[];
  ledger?: Ledger[];
  invoices?: Array<{ id: string; kind: string; grossCents: number; number: string | null; issuedOn: string | null; status: string; attempts?: number; error?: string | null; createdAt: string }>;
  invoicing?: { configured: boolean; sendsToSdi: boolean };
  notifications?: Notification[];
  profiles?: Array<{ userId: string; code: string; active: boolean; link: string }>;
  conversions?: Array<{ id: string; createdAt: string; ruleVersion: string }>;
  settings?: Array<{ key: string; value: Record<string, unknown> }>;
  defaults?: Record<string, Record<string, unknown>>;
  today?: Array<{ kind: string; title: string; detail: string; href?: string; urgency: "high" | "normal" | "info"; at?: string }>;
  summary?: { newLeads24h: number; awaitingReview: number; openOffers: number; acceptedUnpaid: number; blockedProjects: number; failedInvoices: number };
  decisions?: Array<{ title: string; detail: string; href: string }>;
  capacity?: Array<{ name: string; count: number }>;
  funnel?: { days: number; events: Array<{ name: string; kind: string; count: number; quotes: number }> };
  readiness?: Record<string, boolean>;
  mail?: Array<{ id: string; status: string; attempts: number; lastError: string | null }>;
  events?: Array<{ id: string; action: string; createdAt: string }>;
  requests?: Array<{ id: string; kind: string; status: string }>;
  quarantine?: Array<{ id: string; name: string }>;
};
type ProjectDetail = {
  project: Project;
  files: StoredFile[];
  tasks: Task[];
  members: Array<{ id: string; name: string }>;
  approvals: Array<{ fileId: string; decision: string }>;
};
type QuoteDetail = {
  quote: Quote & { input: PricingInput };
  history: Array<{ version: number; createdAt: string }>;
  record: { version: number; selectedTier: string | null; acceptedAt: string | null; commercialState: string; expiresAt: string | null; remindersPausedAt: string | null; reviewNote: string | null; reviewRequestedAt: string | null; preferredTier: string | null; paymentPlan: { installments: number; grantedBy: string; approvedBy?: string | null; note?: string | null } | null };
  contract: { id: string; version: number; termsVersion: string; acceptedAt: string; acceptances: { terms: true; orderSheet: true; earlyStart: boolean; marketing: boolean }; consumer: boolean; withdrawalDeadline: string | null; withdrawalRequestedAt: string | null; stableCopy: boolean; pdfUrl: string } | null;
  journey: string;
  attribution?: { responsible: { id: string; name: string } | null; source: { channel: string; attribution: Record<string, string> | null }; affiliate: { ruleVersion: string } | null; salesAssisted: boolean; offeredBy: { name: string } | null; commissionRule: { version: string; sellerBps: number; affiliateBps: number; assistedSalesOnly: boolean } | null };
  packages: Array<{
    tier: string;
    name: string;
    total: number;
    deposit: number;
    lineItems: Array<{ label: string }>;
    money: { grossCents: number; netCents: number; taxCents: number } | null;
  }>;
  paymentPolicy: {
    version: string;
    vatMode: string;
    vatRateBps: number;
    termsVersion: string;
  } | null;
};
type LeadDetail = {
  lead: Lead;
  ownership: { assignedTo: string | null; assignedName: string | null; authorId: string | null } | null;
  notes: Array<{ id: string; body: string; name: string; createdAt: string }>;
  activities: LeadActivity[];
  tasks: Array<{ id: string; title: string; dueAt: string | null; done: boolean }>;
  quotes: Array<Quote & { journey?: string | null; commercialState?: string | null }>;
  orders: Array<{ id: string; quoteId: string; kind: string; sequence: number; status: string; amountCents: number }>;
  contracts: Array<{ id: string; quoteId: string; acceptedAt: string; withdrawalRequestedAt: string | null }>;
  states: PipelineState[];
  manualStates: PipelineState[];
};
const money = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("it-IT") : "Da concordare";
const stages: Record<string, string> = {
  brief: "Idea e materiali",
  estimate: "Proposta",
  materials: "Materiali",
  editing: "Lavorazione",
  review: "Da approvare",
  approved: "Approvato",
  delivered: "Consegnato",
  new: "Nuovo",
  contacted: "Contattato",
  qualified: "Qualificato",
  proposal: "Proposta",
  won: "Acquisito",
  lost: "Chiuso",
  pending: "In attesa",
  paid: "Pagato",
  deposit_paid: "Acconto ricevuto",
  sent: "Inviato",
  draft: "Bozza",
  ready: "Disponibile",
  quarantine: "Controllo di sicurezza",
  held: "Sospesa",
  adjustment: "Rettifica",
  refunded: "Rimborsato",
  partially_refunded: "Rimborso parziale",
  disputed: "Contestato",
  expired: "Scaduto",
  failed: "Non riuscito",
  review_required: "Verifica Finance",
};
export async function platformApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/platform/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body instanceof FormData
        ? undefined
        : body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error([result.errore, ...Object.values(result.fields ?? {})].filter(Boolean).join(" ")),
      { code: typeof result.code === "string" ? result.code : undefined, status: response.status },
    );
  return result as T;
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="platform-empty">{children}</p>;
}
function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={min}
        maxLength={type === "number" ? undefined : 500}
      />
    </label>
  );
}
const JOURNEY_STATE_LABELS: Record<string, string> = { "journey-estimate": "stima", "journey-review": "in valutazione", "journey-offer": "acquistabile", "journey-expired": "scaduta", "journey-accepted": "accettata", "journey-processing": "pagamento in corso", "journey-deposit_paid": "acconto incassato", "journey-paid": "saldata", attention: "da fare", ready: "informativo" };
function State({ value }: { value: string }) {
  return <span className={`platform-state state-${value}`}>{stages[value] ?? JOURNEY_STATE_LABELS[value] ?? value}</span>;
}
const tabRules: Array<{ id: string; label: string; permission?: Permission }> = [
  { id: "overview", label: "Oggi" },
  { id: "projects", label: "I miei libri", permission: "project.read" },
  { id: "leads", label: "Contatti", permission: "crm.read" },
  { id: "quotes", label: "Preventivi", permission: "quote.read" },
  { id: "tasks", label: "Attività", permission: "task.read" },
  { id: "affiliates", label: "Affiliazione", permission: "affiliate.read" },
  { id: "commissions", label: "Commissioni", permission: "commission.read" },
  { id: "finance", label: "Finance", permission: "finance.read" },
  { id: "marketing", label: "Marketing", permission: "marketing.read" },
  { id: "team", label: "Persone e accessi", permission: "role.manage" },
  { id: "settings", label: "Regole economiche", permission: "settings.manage" },
  { id: "operations", label: "Operazioni", permission: "operations.read" },
  { id: "notifications", label: "Notifiche" },
  { id: "preferences", label: "Preferenze" },
];

export function PlatformWorkspace({ user }: { user: Profile }) {
  const tabs = tabRules.filter((t) => !t.permission || hasPermission(user.grants, t.permission));
  const [tab, setTab] = useState(tabs[0]?.id ?? "notifications"),
    [data, setData] = useState<Collection>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [crmQuery, setCrmQuery] = useState("");
  useEffect(() => {
    let active = true;
    platformApi<Collection>("preferences").then(result => { if (active) setCrmQuery(result.preferences?.savedFilters.crm ?? ""); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search), quote = params.get("preventivo"), project = params.get("progetto"), lead = params.get("lead");
    if (quote && hasPermission(user.grants, "quote.read")) { setTab("quotes"); setSelected(quote); }
    else if (project && hasPermission(user.grants, "project.read")) { setTab("projects"); setSelected(project); }
    else if (lead && hasPermission(user.grants, "crm.read")) { setTab("leads"); setSelected(lead); }
  }, [user.grants]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData({});
    platformApi<Collection>(`${tab}${tab === "leads" && crmQuery ? `?q=${encodeURIComponent(crmQuery)}` : ""}`)
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, refresh, crmQuery]);
  async function run(work: () => Promise<unknown>, message = "Modifica salvata.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(message);
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  function changeTab(id: string) {
    setTab(id);
    setSelected(null);
    setNotice("");
  }
  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <Link href="/" className="platform-brand">
          proemios<span>Il tuo spazio</span>
        </Link>
        <p className="platform-user">
          {user.name}
          <small>{user.roles.map((r) => ROLE_NAMES[r]).join(" · ")}</small>
        </p>
        <nav aria-label="Navigazione del tuo spazio">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => changeTab(t.id)}
            >
              {t.id === "projects" && user.staff ? "Progetti editoriali" : t.label}
            </button>
          ))}
        </nav>
        <div className="platform-sidebar-bottom">
          <Link href="/sicurezza">Sicurezza e sessioni</Link>
          <Link href="/contatti">Assistenza</Link>
          <button onClick={() => authClient.signOut().then(() => location.assign("/accedi"))}>
            Esci
          </button>
        </div>
      </aside>
      <main id="contenuto" className="platform-main">
        <header className="platform-top">
          <span>PROEMIOS / {tabs.find((t) => t.id === tab)?.label.toUpperCase()}</span>
          <button className="platform-text-button" onClick={() => setRefresh((r) => r + 1)}>
            Aggiorna
          </button>
        </header>
        <div className="platform-heading">
          <div>
            <p className="platform-eyebrow">UNO SPAZIO, TUTTO IL PERCORSO</p>
            <h1>
              {selected
                ? "Seguiamo ogni dettaglio."
                : tab === "projects"
                  ? `Buongiorno, ${user.name.split(" ")[0]}.`
                  : tabs.find((t) => t.id === tab)?.label}
            </h1>
            <p>
              {tab === "projects"
                ? "Qui trovi stato del lavoro, materiali, conversazioni e consegne."
                : tab === "leads"
                  ? "Dal primo contatto alla proposta: il prossimo passo è sempre chiaro."
                  : "Dati aggiornati, permessi personali e operazioni tracciate."}
            </p>
          </div>
          <span className="platform-secure">● Accesso personale</span>
        </div>
        {error ? (
          <p className="platform-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="platform-notice" role="status">
            {notice}
          </p>
        ) : null}
        {selected && ["projects", "leads", "quotes"].includes(tab) ? (
          <>
            <button className="platform-text-button" onClick={() => setSelected(null)}>
              ← Torna all’elenco
            </button>
            {tab === "projects" ? (
              <ProjectView id={selected} user={user} />
            ) : tab === "leads" ? (
              <LeadView id={selected} user={user} />
            ) : (
              <QuoteView id={selected} user={user} />
            )}
          </>
        ) : loading ? (
          <p role="status">Caricamento…</p>
        ) : (
          <>
            {tab === "projects" ? (
              <>
                <div className="platform-grid">
                  {data.projects?.map((p) => (
                    <button
                      className="platform-card platform-project"
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                    >
                      <State value={p.stage} />
                      <h2>{p.title}</h2>
                      <p>
                        {p.description?.slice(0, 130) || "Il tuo progetto, un passo alla volta."}
                      </p>
                      <small>Aggiornato il {date(p.updatedAt)}</small>
                      <span className="platform-project-arrow">Apri il progetto →</span>
                    </button>
                  ))}
                </div>
                {!data.projects?.length ? (
                  <Empty>
                    Non hai ancora progetti. Raccontaci l’idea per il tuo libro e raccogli i primi
                    materiali.
                  </Empty>
                ) : null}
                {hasPermission(user.grants, "project.write") ? (
                  <details className="platform-card">
                    <summary>Crea un progetto</summary>
                    <form
                      className="platform-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(() =>
                          platformApi("projects", "POST", {
                            title: f.get("title"),
                            description: f.get("description"),
                            type: f.get("type"),
                            ...(f.get("authorId") ? { authorId: f.get("authorId") } : {}),
                          }),
                        );
                      }}
                    >
                      <Field name="title" label="Titolo provvisorio" required />
                      <label>
                        Il progetto in poche righe
                        <textarea name="description" maxLength={5000} />
                      </label>
                      <label>
                        Tipo di libro
                        <select name="type">
                          <option value="romanzo">Romanzo</option>
                          <option value="saggio">Saggio</option>
                          <option value="memoir">Storia personale</option>
                          <option value="libro-professionale">Libro professionale</option>
                          <option value="solo-grafica">Grafica e pubblicazione</option>
                        </select>
                      </label>
                      {can(user.grants, "project.assign") ? (
                        <Field
                          label="ID account autore verificato (vuoto per il tuo account)"
                          name="authorId"
                        />
                      ) : null}
                      <button className="platform-button" disabled={busy}>
                        Crea progetto →
                      </button>
                    </form>
                  </details>
                ) : null}
              </>
            ) : null}
            {tab === "leads" ? (
              <>
                <section className="platform-card">
                  <form className="platform-form" key={crmQuery} onSubmit={event => { event.preventDefault(); setCrmQuery(String(new FormData(event.currentTarget).get("search") ?? "").trim().slice(0,100)); }}>
                    <Field label="Cerca nei contatti autorizzati" name="search" defaultValue={crmQuery} />
                    <button className="platform-button">Cerca</button>
                  </form>
                  <button className="platform-text-button" disabled={busy} onClick={() => run(async () => { const p = await platformApi<Collection>("preferences"); await platformApi("preferences", "PATCH", { optionalEmail: p.preferences?.optionalEmail ?? false, savedFilters: { ...(p.preferences?.savedFilters ?? {}), crm: crmQuery } }); }, "Ricerca salvata per il prossimo accesso.")}>Ricorda questa ricerca</button>
                  {crmQuery ? <button className="platform-text-button" onClick={() => setCrmQuery("")}>Mostra tutti i contatti autorizzati</button> : null}
                </section>
                <div className="platform-grid">
                  {PIPELINE_STATES.map((state) => (
                    <section className="platform-card" key={state}>
                      <h2>
                        {PIPELINE_LABELS[state]}{" "}
                        <small>{data.leads?.filter((l) => (l.pipeline ?? l.stage) === state).length ?? 0}</small>
                      </h2>
                      {data.leads
                        ?.filter((l) => (l.pipeline ?? l.stage) === state)
                        .map((l) => (
                          <button
                            className="platform-lead"
                            key={l.id}
                            onClick={() => setSelected(l.id)}
                          >
                            <strong>{l.nome}</strong>
                            <span>{l.email}</span>
                            <small>{l.fonte ?? "sito"}{l.sourceDetail ? ` · ${l.sourceDetail}` : ""}{l.assignedName ? ` · ${l.assignedName}` : " · non assegnato"}</small>
                            {l.nextActionAt ? <small>{l.nextAction ?? "Prossima azione"} · {new Date(l.nextActionAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</small> : null}
                          </button>
                        ))}
                    </section>
                  ))}
                </div>
                {!data.leads?.length ? (
                  <Empty>
                    Nessun contatto assegnato. Puoi aggiungerne uno o chiedere l’assegnazione al
                    responsabile.
                  </Empty>
                ) : null}
                {hasPermission(user.grants, "crm.write") ? (
                  <details className="platform-card">
                    <summary>Nuovo contatto</summary>
                    <form
                      className="platform-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(() =>
                          platformApi("leads", "POST", {
                            nome: f.get("nome"),
                            email: f.get("email"),
                            telefono: f.get("telefono"),
                            note: f.get("note"),
                          }),
                        );
                      }}
                    >
                      <Field label="Nome" name="nome" required />
                      <Field label="Email" name="email" type="email" required />
                      <Field label="Telefono" name="telefono" type="tel" />
                      <label>
                        Note
                        <textarea name="note" maxLength={5000} />
                      </label>
                      <button className="platform-button" disabled={busy}>
                        Salva contatto →
                      </button>
                    </form>
                  </details>
                ) : null}
                {can(user.grants, "crm.import") ? (
                  <details className="platform-card">
                    <summary>Importa contatti autorizzati (marketplace, file)</summary>
                    <p>Solo contatti che hanno risposto a un’offerta o hanno chiesto di essere ricontattati: l’import non invia nulla, non fa scraping e ignora i doppioni (email o riferimento). Colonne CSV: nome, email, telefono, note, ref, consenso.</p>
                    <form className="platform-form" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const file = f.get("file"); const origin = String(f.get("origine") || "file CSV"); const fonte = String(f.get("fonte") || "import"); await run(async () => { const text = file instanceof File ? await file.text() : String(f.get("testo") ?? ""); const response = await fetch(`/api/platform/leads/import?fonte=${encodeURIComponent(fonte)}&origine=${encodeURIComponent(origin)}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "text/csv" }, body: text }); const result = await response.json(); if (!response.ok) throw new Error(result.errore ?? "Import non riuscito."); setNotice(`Importati ${result.imported}, doppioni ${result.duplicates}, righe non valide ${result.invalid}.`); }, "Import completato."); }}>
                      <label>Origine<select name="fonte"><option value="marketplace">Marketplace (es. AddLance)</option><option value="import">Altra lista autorizzata</option></select></label>
                      <Field label="Dettaglio origine (es. AddLance · offerta 1234)" name="origine" required />
                      <label>File CSV<input name="file" type="file" accept=".csv,text/csv" /></label>
                      <label>Oppure incolla il CSV<textarea name="testo" rows={4} placeholder={"nome,email,telefono,ref,consenso\nMario Rossi,mario@esempio.it,+39…,addlance-1,true"} /></label>
                      <button className="platform-button" disabled={busy}>Importa</button>
                    </form>
                  </details>
                ) : null}
                {can(user.grants, "export") ? (
                  <a className="platform-text-button" href="/api/platform/leads/export" download>
                    Esporta CSV →
                  </a>
                ) : null}
              </>
            ) : null}
            {tab === "overview" ? (
              <TodayView data={data} />
            ) : null}
            {tab === "marketing" ? <MarketingView user={user} /> : null}
            {tab === "quotes" ? (
              <div className="platform-card">
                {data.quotes?.map((q) => (
                  <button className="platform-row" key={q.id} onClick={() => setSelected(q.id)}>
                    <span>
                      <strong>{q.name ?? "Il tuo preventivo"}</strong>
                      <small>{q.id.slice(0, 8)}</small>
                    </span>
                    <State value={q.acceptedAt ? "won" : q.stato} />
                    <strong>
                      {q.prezzoTotale ? money(q.prezzoTotale * 100) : "Da confermare"}
                    </strong>
                    <span>Apri →</span>
                  </button>
                ))}
                {!data.quotes?.length ? (
                  <Empty>
                    Le proposte collegate al tuo account appariranno qui. Se hai ricevuto un’email
                    con il preventivo, usa il collegamento personale.
                  </Empty>
                ) : null}
              </div>
            ) : null}
            {tab === "tasks" ? (
              <div className="platform-card">
                {data.tasks?.map((t) => (
                  <div className="platform-row" key={t.id}>
                    <span>
                      <strong>{t.title}</strong>
                      <small>
                        {date(t.dueAt)} {t.internal ? "· Team" : ""}
                      </small>
                    </span>
                    {hasPermission(user.grants, "task.write") ? (
                      <button
                        className="platform-text-button"
                        disabled={busy}
                        onClick={() =>
                          run(() => platformApi(`tasks/${t.id}`, "PATCH", { done: !t.done }))
                        }
                      >
                        {t.done ? "Riapri" : "Completa"}
                      </button>
                    ) : (
                      <State value={t.done ? "approved" : "pending"} />
                    )}
                  </div>
                ))}
                {!data.tasks?.length ? <Empty>Non ci sono attività assegnate.</Empty> : null}
              </div>
            ) : null}
            {tab === "affiliates" ? (
              <>
                <div className="platform-grid">
                  {data.profiles?.map((p) => (
                    <section className="platform-card" key={p.userId}>
                      <h2>Il tuo collegamento personale</h2>
                      <State value={p.active ? "ready" : "held"} />
                      <p>
                        Il codice viene associato al preventivo. I contatti restano privati e la
                        commissione dipende dalla regola approvata e dall’incasso confermato.
                      </p>
                      <label>
                        Link da condividere
                        <input value={p.link} readOnly onFocus={(e) => e.currentTarget.select()} />
                      </label>
                      <button
                        className="platform-text-button"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(p.link)
                            .then(() => setNotice("Collegamento copiato."))
                            .catch(() => setError("Seleziona e copia il collegamento."))
                        }
                      >
                        Copia collegamento
                      </button>
                    </section>
                  ))}
                </div>
                <section className="platform-card">
                  <h2>Conversioni</h2>
                  {data.conversions?.map((c) => (
                    <div className="platform-row" key={c.id}>
                      <span>Richiesta {c.id.slice(0, 8)}</span>
                      <span>{date(c.createdAt)}</span>
                      <small>Regola {c.ruleVersion}</small>
                    </div>
                  ))}
                  {!data.conversions?.length ? (
                    <Empty>Nessuna richiesta attribuita.</Empty>
                  ) : null}
                </section>
              </>
            ) : null}
            {tab === "commissions" ? <PayoutList items={data.commissions ?? []} /> : null}
            {tab === "finance" ? (
              <>
                <div className="platform-metrics">
                  <section className="platform-card">
                    <small>Registro incassi e rimborsi · saldo di tutti i movimenti</small>
                    <h2>{money(data.totals?.balanceCents ?? 0)}</h2>
                  </section>
                  <section className="platform-card">
                    <small>Ordini da verificare</small>
                    <h2>{data.orders?.filter((o) => o.status !== "paid").length ?? 0}</h2>
                  </section>
                </div>
                <div className="platform-card">
                  <h2>Ordini</h2>
                  {data.orders?.map((o) => (
                    <div className="platform-row" key={o.id}>
                      <span>
                        {o.id.slice(0, 8)} · {o.kind === "deposit" ? "Acconto" : o.plan === "company_installment" ? `Rata ${o.sequence ?? 1} del saldo` : "Saldo"}
                      </span>
                      <State value={o.status} />
                      <strong>{money(o.amountCents)}</strong>
                    </div>
                  ))}
                  {!data.orders?.length ? <Empty>Nessun ordine registrato.</Empty> : null}
                </div>
                <RefundPanel refunds={data.refunds ?? []} orders={data.orders ?? []} user={user} run={run} />
                <PayoutList
                  items={data.commissions ?? []}
                  onPay={
                    can(user.grants, "commission.pay")
                      ? (id, reference) =>
                          run(
                            () => platformApi(`commissions/${id}`, "PATCH", { reference }),
                            "Pagamento della commissione registrato.",
                          )
                      : undefined
                  }
                />
                <p className="platform-notice">Finance legge incassi, fatture e commissioni e prepara le rettifiche. Liquidare una commissione o autorizzare un rimborso richiede le deleghe esplicite «commission.pay» e «refund.authorize», assegnate dal proprietario in Persone e accessi.</p>
                <InvoicingPanel initial={data.invoicing} />
                <div className="platform-card">
                  <h2>Fatture emesse</h2>
                  <small>Ogni incasso confermato diventa una fattura su Fatture in Cloud. «creata»: da trasmettere allo SdI da Fatture in Cloud. «inviata»: già trasmessa.</small>
                  {data.invoices?.map((f) => (
                    <div className="platform-row" key={f.id}>
                      <span>
                        {f.number ? `n. ${f.number}` : "in emissione"} · {f.kind === "deposit" ? "Acconto" : "Saldo"}{f.issuedOn ? ` · ${date(f.issuedOn)}` : ""}
                      </span>
                      <State value={{ queued: "in coda", processing: "in corso", retry: "riprova", failed: "errore", created: "creata", sent: "inviata" }[f.status] ?? f.status} />
                      <strong>{money(f.grossCents)}</strong>
                      {["retry", "failed"].includes(f.status) ? (
                        <>
                          <small title={f.error ?? ""}>{(f.error ?? "").slice(0, 80)}</small>
                          <button className="platform-text-button" disabled={busy} onClick={() => run(() => platformApi(`invoices/${f.id}/retry`, "POST"), "Nuovo tentativo di emissione eseguito.")}>Riprova</button>
                        </>
                      ) : f.number ? (
                        <a className="platform-text-button" href={`/api/platform/invoices/${f.id}/pdf`}>PDF</a>
                      ) : null}
                    </div>
                  ))}
                  {!data.invoices?.length ? <Empty>Nessuna fattura emessa.</Empty> : null}
                </div>
                <div className="platform-card">
                  <h2>Movimenti contabili</h2>
                  {data.ledger?.map((l) => (
                    <div className="platform-row" key={l.id}>
                      <span>
                        {l.kind === "payment" ? "Incasso" : "Rimborso"} · {date(l.createdAt)}
                      </span>
                      <span>{l.reference}</span>
                      <strong>{money(l.amountCents)}</strong>
                    </div>
                  ))}
                </div>
                <div className="platform-actions">
                  {can(user.grants, "finance.record") ? (
                    <button
                      className="platform-button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => platformApi("finance/reconcile", "POST"),
                          "Verifica Stripe completata.",
                        )
                      }
                    >
                      Verifica incassi su Stripe
                    </button>
                  ) : null}
                  {can(user.grants, "export") ? (
                    <a
                      className="platform-text-button"
                      href="/api/platform/finance/export"
                      download
                    >
                      Esporta registro →
                    </a>
                  ) : null}
                </div>
              </>
            ) : null}
            {tab === "team" ? (
              <TeamView users={data.users ?? []} run={run} busy={busy} grants={user.grants} />
            ) : null}
            {tab === "settings" ? (
              <SettingsView settings={data.settings ?? []} defaults={data.defaults} run={run} busy={busy} />
            ) : null}
            {tab === "operations" ? (
              <>
                <section className="platform-card">
                  <h2>Servizi collegati</h2>
                  {Object.entries(data.readiness ?? {}).map(([name, ready]) => (
                    <div className="platform-row" key={name}>
                      <span>{name}</span>
                      <State value={ready ? "ready" : "pending"} />
                    </div>
                  ))}
                </section>
                <section className="platform-card">
                  <h2>Invii email</h2>
                  {data.mail?.map((m) => (
                    <div className="platform-row" key={m.id}>
                      <span>
                        {m.id.slice(0, 8)} · {m.attempts} tentativi
                      </span>
                      <span>{m.status}</span>
                      <span>{m.lastError}</span>
                      {m.status === "failed" && can(user.grants, "operations.write") ? <button disabled={busy} onClick={() => run(() => platformApi(`operations/${m.id}/retry`, "POST"))}>Riprova</button> : null}
                    </div>
                  ))}
                  {!data.mail?.length ? <Empty>Nessun invio in coda.</Empty> : null}
                </section>
                <section className="platform-card">
                  <h2>File in controllo</h2>
                  {data.quarantine?.map((f) => (
                    <p key={f.id}>{f.name}</p>
                  ))}
                </section>
                <section className="platform-card"><h2>Analisi automatiche</h2>{data.jobs?.map(j => <p key={j.id}>{j.id.slice(0,8)} · {j.status} · {j.attempts} tentativi {j.errorCode ? `· ${j.errorCode}` : ""} {j.status === "failed" && can(user.grants, "operations.write") ? <button disabled={busy} onClick={() => { if (window.confirm("Un nuovo tentativo può generare un costo del fornitore AI. Confermi dopo aver controllato l'errore?")) run(() => platformApi(`operations/${j.id}/analysis-retry`, "POST", { confirmProviderCost: true }), "Analisi rimessa in coda. Esegui la manutenzione per avviarla."); }}>Riprova dopo verifica</button> : null}</p>)}</section>
                <section className="platform-card">
                  <h2>Richieste privacy</h2>
                  {data.requests?.map((r) => (
                    <div className="platform-row" key={r.id}>
                      <span>
                        {r.id.slice(0, 8)} · {r.kind}
                      </span>
                      <span>{r.status}</span>
                    </div>
                  ))}
                </section>
                <section className="platform-card">
                  <h2>Registro delle operazioni</h2>
                  {data.events?.map((e) => (
                    <div className="platform-row" key={e.id}>
                      <span>{e.action}</span>
                      <span>{date(e.createdAt)}</span>
                    </div>
                  ))}
                </section>
                {can(user.grants, "operations.write") ? (
                  <button
                    className="platform-button"
                    disabled={busy}
                    onClick={() =>
                      run(() => platformApi("operations/run", "POST"), "Manutenzione completata.")
                    }
                  >
                    Riprova gli invii e i controlli dei file
                  </button>
                ) : null}
              </>
            ) : null}
            {tab === "notifications" ? (
              <section className="platform-card">
                {data.notifications?.map((n) => (
                  <article className="platform-row" key={n.id}>
                    <div>
                      <h2>{n.title}</h2>
                      <p>{n.body}</p>
                      <small>{date(n.createdAt)}</small>
                    </div>
                    {!n.read ? (
                      <button
                        className="platform-text-button"
                        onClick={() => run(() => platformApi(`notifications/${n.id}`, "PATCH"))}
                      >
                        Segna come letta
                      </button>
                    ) : (
                      <span>Letta</span>
                    )}
                  </article>
                ))}
                {!data.notifications?.length ? <Empty>Non ci sono notifiche.</Empty> : null}
              </section>
            ) : null}
            {tab === "preferences" ? <section className="platform-card"><h2>Preferenze del tuo account</h2><form className="platform-form" onSubmit={e => { e.preventDefault(); const values = new FormData(e.currentTarget); run(() => platformApi("preferences", "PATCH", { optionalEmail: values.get("optionalEmail") === "on", savedFilters: { crm: String(values.get("crm") ?? "") } })); }}><label className="platform-check"><input type="checkbox" name="optionalEmail" defaultChecked={data.preferences?.optionalEmail ?? false} />Ricevi notifiche facoltative via email</label><p>Le comunicazioni necessarie al progetto e alla sicurezza dell’account restano operative.</p><Field label="Ricerca CRM da ricordare" name="crm" defaultValue={data.preferences?.savedFilters.crm ?? ""} /><button className="platform-button" disabled={busy}>Salva preferenze</button></form><Link href="/aiuto">Come usare il tuo spazio →</Link></section> : null}
          </>
        )}
        <footer className="platform-bottom">
          <span>Ogni libro merita cura.</span>
          <details>
            <summary>Privacy del mio account</summary>
            <p>
              Puoi richiedere una copia dei tuoi dati o la chiusura dell’account. Il team
              verificherà gli obblighi di conservazione prima di procedere.
            </p>
            <div className="platform-actions">
              <button
                onClick={() =>
                  run(
                    () => platformApi("account-request", "POST", { kind: "export" }),
                    "Richiesta di copia dei dati registrata.",
                  )
                }
              >
                Richiedi i miei dati
              </button>
              <button
                onClick={() =>
                  run(
                    () => platformApi("account-request", "POST", { kind: "delete" }),
                    "Richiesta di chiusura registrata.",
                  )
                }
              >
                Richiedi la chiusura
              </button>
            </div>
          </details>
          <Link href="/privacy">Informativa privacy</Link>
        </footer>
      </main>
    </div>
  );
}
/**
 * Rettifiche: chi ha «refund.prepare» le prepara (nessun movimento), chi ha
 * «refund.authorize» le autorizza (quattro occhi: non la stessa persona). Il
 * denaro si muove solo via Stripe e la contabilità si aggiorna all'evento verificato.
 */
function RefundPanel({ refunds, orders, user, run }: { refunds: RefundRequest[]; orders: Order[]; user: Profile; run: (work: () => Promise<unknown>, success?: string) => Promise<void> }) {
  const refundable = orders.filter((o) => ["paid", "partially_refunded"].includes(o.status));
  const labels: Record<string, string> = { prepared: "preparata", authorized: "autorizzata, in corso", executed: "eseguita", failed: "errore" };
  return (
    <div className="platform-card">
      <h2>Rimborsi e rettifiche</h2>
      {can(user.grants, "refund.prepare") && refundable.length ? (
        <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; run(() => platformApi("refunds", "POST", { orderId: String(f.get("order")), amountCents: Math.round(Number(f.get("amount")) * 100), reason: String(f.get("reason")) }).then(() => form.reset()), "Rettifica preparata: serve l'autorizzazione di un secondo utente."); }}>
          <label>Ordine<select name="order" required>{refundable.map((o) => <option key={o.id} value={o.id}>{o.id.slice(0, 8)} · {money(o.amountCents)}</option>)}</select></label>
          <label>Importo (€)<input name="amount" type="number" min={0.01} step={0.01} required /></label>
          <label>Motivo<input name="reason" minLength={10} maxLength={2000} required /></label>
          <button className="platform-button">Prepara la rettifica</button>
        </form>
      ) : null}
      {refunds.map((r) => (
        <div className="platform-row" key={r.id}>
          <span>{r.orderId.slice(0, 8)} · {r.reason}{r.lastError ? ` · ${r.lastError}` : ""}</span>
          <State value={labels[r.status] ?? r.status} />
          <strong>{money(r.amountCents)}</strong>
          {["prepared", "failed"].includes(r.status) && can(user.grants, "refund.authorize") && r.preparedBy !== user.id ? (
            <button className="platform-text-button" onClick={() => { if (window.confirm(`Autorizzi il rimborso di ${money(r.amountCents)}? Stripe lo esegue subito.`)) run(() => platformApi(`refunds/${r.id}/authorize`, "POST"), "Rimborso richiesto a Stripe: la contabilità si aggiorna alla conferma."); }}>Autorizza</button>
          ) : null}
        </div>
      ))}
      {!refunds.length ? <Empty>Nessuna rettifica preparata.</Empty> : null}
    </div>
  );
}
function PayoutList({
  items,
  onPay,
}: {
  items: Payout[];
  onPay?: (id: string, reference: string) => void;
}) {
  return (
    <section className="platform-card">
      <h2>Commissioni</h2>
      {items.map((c) => (
        <div className="platform-row" key={c.id}>
          <span>
            {c.id.slice(0, 8)}
            <small>Regola {c.ruleVersion}</small>
          </span>
          <strong>{money(c.amountCents)}</strong>
          <State value={c.status} />
          {onPay && c.status === "pending" && c.amountCents > 0 ? (
            <form
              className="platform-inline"
              onSubmit={(e) => {
                e.preventDefault();
                onPay(c.id, String(new FormData(e.currentTarget).get("reference")));
              }}
            >
              <label className="sr-only" htmlFor={`ref-${c.id}`}>
                Riferimento del bonifico effettuato
              </label>
              <input
                id={`ref-${c.id}`}
                name="reference"
                placeholder="Riferimento del bonifico"
                required
                minLength={5}
              />
              <button>Registra pagamento</button>
            </form>
          ) : null}
        </div>
      ))}
      {!items.length ? (
        <Empty>
          Nessuna commissione maturata. Gli importi dipendono dagli incassi confermati e dalle
          regole approvate.
        </Empty>
      ) : null}
    </section>
  );
}

function ProjectView({ id, user }: { id: string; user: Profile }) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError("");
    platformApi<ProjectDetail>(`projects/${id}`)
      .then(async (d) => {
        if (!active) return;
        setDetail(d);
        const r = {
          own: d.project.authorId === user.id,
          assigned: d.members.some((m) => m.id === user.id),
        };
        if (can(user.grants, "message.read", r)) {
          const m = await platformApi<{ messages: Message[] }>(`projects/${id}/messages`);
          if (active) setMessages(m.messages);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, refresh, user]);
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  if (!detail)
    return <p role={error ? "alert" : "status"}>{error || "Caricamento del progetto…"}</p>;
  const resource = {
      own: detail.project.authorId === user.id,
      assigned: detail.members.some((m) => m.id === user.id),
    },
    allowed = (p: Permission) => can(user.grants, p, resource);
  return (
    <>
      <section className="platform-card">
        <State value={detail.project.stage} />
        <h2>{detail.project.title}</h2>
        <p>{detail.project.description}</p>
        <p>
          Il team: {detail.members.map((m) => m.name).join(", ") || "In attesa di assegnazione"}
        </p>
        {allowed("file.deliver") ? (
          <form
            className="platform-inline"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                platformApi(`projects/${id}`, "PATCH", {
                  stage: new FormData(e.currentTarget).get("stage"),
                }),
              );
            }}
          >
            <label>
              Passaggio editoriale
              <select name="stage">
                <option value="materials">Materiali</option>
                <option value="editing">Lavorazione</option>
                <option value="review">Revisione autore</option>
                <option value="delivered">Consegna finale</option>
              </select>
            </label>
            <button disabled={busy}>Aggiorna fase</button>
          </form>
        ) : null}
        {allowed("project.assign") ? (
          <form
            className="platform-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() =>
                platformApi(`projects/${id}/members`, "POST", {
                  userId: f.get("userId"),
                  remove: f.get("remove") === "on",
                }),
              );
            }}
          >
            <Field label="ID account del team" name="userId" required />
            <label className="platform-check">
              <input type="checkbox" name="remove" />
              Rimuovi assegnazione
            </label>
            <button disabled={busy}>Aggiorna assegnazione</button>
          </form>
        ) : null}
      </section>
      {error ? (
        <p role="alert" className="platform-error">
          {error}
        </p>
      ) : null}
      <div className="platform-detail-grid">
        <section className="platform-card">
          <h2>Materiali e consegne</h2>
          <p>
            I file sono privati. Una nuova versione conserva la precedente. DOCX e PDF diventano
            scaricabili solo dopo il controllo di sicurezza.
          </p>
          {detail.files.map((f) => (
            <div className="platform-file" key={f.id}>
              <div>
                <strong>{f.name}</strong>
                <small>
                  Versione {f.version} · {(f.size / 1024).toFixed(0)} KB ·{" "}
                  {f.kind === "delivery" ? "Consegna" : "Materiale"}
                </small>
              </div>
              <State value={f.status} />
              {f.status === "ready" ? (
                <a className="platform-text-button" href={`/api/platform/files/${f.id}/download`}>
                  Scarica →
                </a>
              ) : null}
              {f.kind === "delivery" && f.status === "ready" && allowed("approval.write") ? (
                <form
                  className="platform-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    run(() =>
                      platformApi(`files/${f.id}/approval`, "POST", {
                        decision: form.get("decision"),
                        comment: form.get("comment"),
                      }),
                    );
                  }}
                >
                  <label>
                    La tua decisione
                    <select name="decision">
                      <option value="approved">Approvo questa versione</option>
                      <option value="changes_requested">Richiedo modifiche</option>
                    </select>
                  </label>
                  <label>
                    Commento
                    <textarea name="comment" maxLength={5000} />
                  </label>
                  <button disabled={busy}>Conferma decisione</button>
                </form>
              ) : null}
              {detail.approvals
                .filter((a) => a.fileId === f.id)
                .map((a) => (
                  <span key={a.fileId}>
                    {a.decision === "approved" ? "Versione approvata" : "Modifiche richieste"}
                  </span>
                ))}
            </div>
          ))}
          {!detail.files.length ? <Empty>Carica il primo materiale per iniziare.</Empty> : null}
          {allowed("file.upload") ? (
            <form
              className="platform-form"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  platformApi(`projects/${id}/files`, "POST", new FormData(e.currentTarget)),
                );
              }}
            >
              <label>
                Documento · massimo 4 MB
                <input type="file" name="file" accept=".txt,.docx,.pdf" required />
              </label>
              <label>
                Tipo
                <select name="kind">
                  <option value="manuscript">Materiale dell’autore</option>
                  {allowed("file.deliver") ? (
                    <option value="delivery">Consegna editoriale</option>
                  ) : null}
                </select>
              </label>
              <button className="platform-button" disabled={busy}>
                Carica versione →
              </button>
            </form>
          ) : null}
        </section>
        <section className="platform-card">
          <h2>Conversazione sul progetto</h2>
          <div className="platform-messages">
            {messages.map((m) => (
              <article className={`platform-message ${m.internal ? "internal" : ""}`} key={m.id}>
                <strong>{m.name}</strong>
                <small>
                  {date(m.createdAt)}
                  {m.internal ? " · Solo team" : ""}
                </small>
                <p>{m.body}</p>
              </article>
            ))}
            {!messages.length ? (
              <Empty>
                Una domanda, un riferimento, un aggiornamento: la conversazione resta qui.
              </Empty>
            ) : null}
          </div>
          {allowed("message.write") ? (
            <form
              className="platform-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                run(async () => {
                  await platformApi(`projects/${id}/messages`, "POST", {
                    body: f.get("body"),
                    internal: f.get("internal") === "on",
                  });
                  form.reset();
                });
              }}
            >
              <label>
                Messaggio
                <textarea name="body" required maxLength={8000} />
              </label>
              {allowed("message.internal") ? (
                <label className="platform-check">
                  <input type="checkbox" name="internal" />
                  Nota visibile solo al team
                </label>
              ) : null}
              <button className="platform-button" disabled={busy}>
                Invia messaggio →
              </button>
            </form>
          ) : null}
        </section>
      </div>
      <section className="platform-card">
        <h2>Prossimi passi</h2>
        {detail.tasks.map((t) => (
          <div className="platform-row" key={t.id}>
            <span>{t.title}</span>
            <span>{date(t.dueAt)}</span>
            <State value={t.done ? "approved" : "pending"} />
          </div>
        ))}
        {allowed("task.write") ? (
          <form
            className="platform-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() =>
                platformApi("tasks", "POST", {
                  projectId: id,
                  title: f.get("title"),
                  internal: f.get("internal") === "on",
                }),
              );
            }}
          >
            <Field label="Nuova attività" name="title" required />
            <label className="platform-check">
              <input type="checkbox" name="internal" defaultChecked />
              Solo team
            </label>
            <button disabled={busy}>Aggiungi</button>
          </form>
        ) : null}
      </section>
    </>
  );
}
function LeadView({ id, user }: { id: string; user: Profile }) {
  const [detail, setDetail] = useState<LeadDetail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [team, setTeam] = useState<Person[]>([]);
  useEffect(() => {
    let active = true;
    platformApi<LeadDetail>(`leads/${id}`)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    if (hasPermission(user.grants, "role.manage")) platformApi<{ users: Person[] }>("team").then((t) => { if (active) setTeam(t.users ?? []); }).catch(() => {});
    return () => {
      active = false;
    };
  }, [id, refresh, user.grants]);
  async function run(work: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await work();
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  if (!detail) return <p role={error ? "alert" : "status"}>{error || "Caricamento…"}</p>;
  const lead = detail.lead, prefs = lead.contactPreferences, pipeline = lead.pipeline ?? "received";
  const writable = hasPermission(user.grants, "crm.write");
  const channelLabel: Record<string, string> = { call: "Telefonata", whatsapp: "WhatsApp", sms: "SMS", email: "Email", meeting: "Incontro", other: "Altro", automation: "Automazione", state: "Stato", assignment: "Assegnazione", import: "Import", created: "Creazione", consent: "Consenso", negotiation: "Negoziazione" };
  const toLocal = (iso: string | null | undefined) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  return (
    <>
      <section className="platform-card">
        <h2>{lead.nome} <State value={PIPELINE_LABELS[pipeline]} /></h2>
        <p>
          {lead.email} · {lead.telefono || "Nessun telefono"} · origine {lead.fonte ?? "sito"}{lead.sourceDetail ? ` (${lead.sourceDetail})` : ""}{lead.externalRef ? ` · rif. ${lead.externalRef}` : ""}
        </p>
        <p>Responsabile: {detail.ownership?.assignedName ?? "non assegnato"}{detail.ownership?.authorId ? " · account autore collegato" : ""}{lead.lastContactAt ? ` · ultimo contatto ${date(lead.lastContactAt)}` : ""}</p>
        {lead.nextAction || lead.nextActionAt ? <p><strong>Prossima azione:</strong> {lead.nextAction ?? "—"}{lead.nextActionAt ? ` · entro ${new Date(lead.nextActionAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : ""}</p> : null}
        {lead.lostReason ? <p><strong>Motivo chiusura:</strong> {lead.lostReason}</p> : null}
        <p>{lead.note}</p>
        <p><small>Consensi: informativa {lead.consensoPrivacy ? "accettata" : "non registrata"} · comunicazioni facoltative {lead.consensoMarketing ? "sì" : lead.marketingRevokedAt ? "revocate" : "no"} · canali ammessi: {prefs ? (["email", "phone", "whatsapp", "sms"] as const).filter((c) => prefs[c]).map((c) => ({ email: "email", phone: "telefono", whatsapp: "WhatsApp", sms: "SMS" })[c]).join(", ") || "nessuno" : "da verificare con la persona"}. Nessun messaggio automatico parte su WhatsApp o SMS.</small></p>
        {writable ? (
          <form
            className="platform-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() =>
                platformApi(`leads/${id}`, "PATCH", {
                  stage: f.get("stage"),
                  ...(f.get("reason") ? { lostReason: f.get("reason") } : {}),
                }),
              );
            }}
          >
            <label>
              Stato (solo quelli decisi dal team)
              <select name="stage" defaultValue={detail.manualStates.includes(pipeline) ? pipeline : "received"}>
                {detail.manualStates.map((s) => (
                  <option key={s} value={s}>
                    {PIPELINE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Motivo se perso o non contattabile" name="reason" />
            <button disabled={busy}>Salva stato</button>
            <small>Gli altri stati (proposta, accettata, checkout, pagamento) derivano dai fatti e non si impostano a mano. «Acquisto concluso» arriva solo da un incasso verificato.</small>
          </form>
        ) : null}
        {writable ? (
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => platformApi(`leads/${id}`, "PATCH", { nextAction: String(f.get("next") ?? "") || null, nextActionAt: f.get("due") ? new Date(String(f.get("due"))).toISOString() : null })); }}>
            <Field label="Prossima azione" name="next" defaultValue={lead.nextAction ?? ""} />
            <Field label="Entro" name="due" type="datetime-local" defaultValue={toLocal(lead.nextActionAt)} />
            <button disabled={busy}>Aggiorna</button>
          </form>
        ) : null}
        {writable ? (
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => platformApi(`leads/${id}`, "PATCH", { contactPreferences: { email: f.get("email") === "on", phone: f.get("phone") === "on", whatsapp: f.get("whatsapp") === "on", sms: f.get("sms") === "on", note: String(f.get("prefnote") ?? "") || null } })); }}>
            <span>Canali ammessi (come dichiarato dalla persona):</span>
            {(["email", "phone", "whatsapp", "sms"] as const).map((c) => <label className="platform-check" key={c}><input type="checkbox" name={c} defaultChecked={prefs ? prefs[c] : c === "email"} />{({ email: "Email", phone: "Telefono", whatsapp: "WhatsApp", sms: "SMS" })[c]}</label>)}
            <Field label="Nota (orari, lingua…)" name="prefnote" defaultValue={prefs?.note ?? ""} />
            <button disabled={busy}>Salva canali</button>
          </form>
        ) : null}
        {writable ? (
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const grant = f.get("consent") === "grant"; run(() => platformApi(`leads/${id}`, "PATCH", { marketingConsent: grant, ...(grant ? { consentEvidence: String(f.get("evidence") ?? "") } : {}) })); }}>
            <label>Comunicazioni facoltative<select name="consent" defaultValue={lead.consensoMarketing ? "grant" : "revoke"}><option value="grant">Consenso registrato</option><option value="revoke">Revocato / non dato</option></select></label>
            <Field label="Prova del consenso (data e testo della richiesta)" name="evidence" />
            <button disabled={busy}>Registra</button>
          </form>
        ) : null}
        {hasPermission(user.grants, "crm.assign") && team.length ? (
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => platformApi(`leads/${id}`, "PATCH", { assignedTo: String(f.get("assignee")) })); }}>
            <label>Responsabile<select name="assignee" defaultValue={detail.ownership?.assignedTo ?? ""}>{team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <button disabled={busy}>Assegna</button>
          </form>
        ) : null}
      </section>
      {error ? (
        <p className="platform-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="platform-card">
        <h2>Storia del contatto</h2>
        {detail.activities.map((a) => (
          <article key={a.id}>
            <strong>{channelLabel[a.kind] ?? a.kind}{a.direction === "inbound" ? " · ricevuto" : ""}{a.purpose ? ` · ${a.purpose}` : ""}</strong>
            <small> · {a.name ?? "automazione"} · {new Date(a.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}{a.outcome ? ` · ${a.outcome}` : ""}</small>
            {a.body ? <p>{a.body}</p> : null}
          </article>
        ))}
        {!detail.activities.length ? <Empty>Nessuna attività registrata.</Empty> : null}
        {writable ? (
          <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; run(() => platformApi(`leads/${id}/activities`, "POST", { kind: f.get("kind"), direction: f.get("direction"), body: f.get("body"), outcome: f.get("outcome"), ...(f.get("next") ? { nextAction: f.get("next") } : {}), ...(f.get("due") ? { nextActionAt: new Date(String(f.get("due"))).toISOString() } : {}) }).then(() => form.reset())); }}>
            <label>Attività<select name="kind"><option value="call">Telefonata</option><option value="whatsapp">WhatsApp (manuale)</option><option value="sms">SMS (manuale)</option><option value="email">Email</option><option value="meeting">Incontro</option><option value="other">Altro</option></select></label>
            <label>Direzione<select name="direction"><option value="outbound">Fatta da noi</option><option value="inbound">Ricevuta dalla persona</option></select></label>
            <label>Cosa è successo<textarea name="body" required maxLength={5000} /></label>
            <label>Esito<select name="outcome"><option value="reached">Raggiunto</option><option value="no-answer">Nessuna risposta</option><option value="callback">Richiamare</option><option value="replied">Ha risposto</option><option value="declined">Ha rifiutato</option><option value="other">Altro</option></select></label>
            <Field label="Prossima azione (facoltativa)" name="next" />
            <Field label="Entro" name="due" type="datetime-local" />
            <button disabled={busy}>Registra attività</button>
            <small>Qui si registra ciò che è stato fatto: WhatsApp e SMS si inviano dal telefono aziendale, solo sui canali ammessi.</small>
          </form>
        ) : null}
      </section>
      <section className="platform-card">
        <h2>Note e follow-up</h2>
        {detail.notes.map((n) => (
          <article key={n.id}>
            <strong>{n.name}</strong>
            <small> · {date(n.createdAt)}</small>
            <p>{n.body}</p>
          </article>
        ))}
        {detail.tasks.length ? <ul>{detail.tasks.map((t) => <li key={t.id}>{t.title}{t.dueAt ? ` · entro ${date(t.dueAt)}` : ""}</li>)}</ul> : null}
        <form
          className="platform-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              platformApi(`leads/${id}/notes`, "POST", {
                body: new FormData(e.currentTarget).get("body"),
              }),
            );
          }}
        >
          <label>
            Nota interna
            <textarea name="body" required maxLength={5000} />
          </label>
          <button disabled={busy}>Aggiungi nota</button>
        </form>
        <form
          className="platform-inline"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              platformApi("tasks", "POST", {
                leadId: id,
                title: f.get("title"),
                dueAt: new Date(String(f.get("due"))).toISOString(),
              }),
            );
          }}
        >
          <Field label="Prossimo passo" name="title" required />
          <Field label="Quando" name="due" type="datetime-local" required />
          <button disabled={busy}>Pianifica</button>
        </form>
      </section>
      <details className="platform-card">
        <summary>Genera una proposta dal listino</summary>
        <p>
          Usa lo stesso motore del configuratore pubblico. Le condizioni fiscali e le commissioni
          sono quelle approvate al momento della creazione.
        </p>
        <form
          className="platform-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              platformApi(`leads/${id}/quotes`, "POST", {
                input: {
                  projectType: f.get("type"),
                  textState: f.get("state"),
                  wordCount: Number(f.get("words")),
                  requestedServices: f.getAll("services"),
                  urgency: "standard",
                },
              }),
            );
          }}
        >
          <label>
            Progetto
            <select name="type">
              <option value="romanzo">Romanzo</option>
              <option value="saggio">Saggio</option>
              <option value="memoir">Storia personale</option>
              <option value="libro-professionale">Libro professionale</option>
              <option value="solo-grafica">Grafica e pubblicazione</option>
            </select>
          </label>
          <label>
            Stato
            <select name="state">
              <option value="finito-da-revisionare">Finito, da revisionare</option>
              <option value="finito-revisionato">Finito e revisionato</option>
              <option value="bozza-incompleta">Bozza incompleta</option>
              <option value="solo-materiali">Solo materiali</option>
            </select>
          </label>
          <Field label="Parole" name="words" type="number" min={1} required />
          {["editing", "proofreading", "layout", "cover", "epub", "kdp"].map((s) => (
            <label className="platform-check" key={s}>
              <input name="services" type="checkbox" value={s} />
              {
                {
                  editing: "Editing",
                  proofreading: "Correzione bozze",
                  layout: "Impaginazione",
                  cover: "Copertina",
                  epub: "EPUB",
                  kdp: "Pubblicazione",
                }[s]
              }
            </label>
          ))}
          <button className="platform-button" disabled={busy}>
            Genera proposta →
          </button>
        </form>
      </details>
      <section className="platform-card">
        <h2>Proposte</h2>
        {detail.quotes.map((q) => (
          <div className="platform-row" key={q.id}>
            <span>{q.id.slice(0, 8)}{detail.contracts.some((c) => c.quoteId === q.id) ? " · contratto" : ""}</span>
            <State value={q.journey ?? q.stato} />
            <strong>{money((q.prezzoTotale ?? 0) * 100)}</strong>
            <button
              disabled={busy}
              onClick={() => run(() => platformApi(`quotes/${q.id}/send`, "POST"))}
            >
              Invia per email
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
function QuoteView({ id, user }: { id: string; user: Profile }) {
  const [detail, setDetail] = useState<QuoteDetail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    platformApi<QuoteDetail>(`quotes/${id}`)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, refresh]);
  async function run(work: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await work();
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  if (!detail) return <p role={error ? "alert" : "status"}>{error || "Caricamento…"}</p>;
  return (
    <>
      {hasPermission(user.grants, "quote.write") && !detail.record.acceptedAt ? <details className="platform-card"><summary>Rivedi la proposta prima dell’accettazione</summary>
        <p>Il prezzo viene ricalcolato dal listino. La versione precedente rimane in cronologia.</p>
        <form className="platform-form" key={detail.record.version} onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); run(() => platformApi(`quotes/${id}`, "PATCH", { version: detail.record.version, input: { ...detail.quote.input, wordCount: Number(f.get("words")), urgency: f.get("urgency") }, ...(f.get("expiry") ? { expiresAt: new Date(String(f.get("expiry"))).toISOString() } : {}) })); }}>
          <Field label="Conteggio parole aggiornato" name="words" type="number" min={1} defaultValue={detail.quote.input.wordCount} required />
          <label>Tempi<select name="urgency" defaultValue={detail.quote.input.urgency ?? "standard"}><option value="standard">Standard</option><option value="prioritaria">Prioritari, con maggiorazione</option></select></label>
          <Field label="Validità concordata della proposta (facoltativa)" name="expiry" type="datetime-local" />
          <button className="platform-button" disabled={busy}>Salva nuova versione</button>
        </form>
        <p><strong>Prima di uno sconto</strong>, proponi in ordine: pagamento dilazionato (rate del saldo, qui sotto), servizio a fasi, un pacchetto più essenziale, un confronto con il consulente. Lo sconto resta entro la soglia della regola «Cosa è acquistabile subito»; oltre serve l’approvazione e ogni variazione è una nuova versione, mai una sovrascrittura.</p>
        <form className="platform-inline" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); run(() => platformApi(`quotes/${id}`, "PATCH", { version: detail.record.version, input: detail.quote.input, discountBps: Math.round(Number(f.get("discount") || 0) * 100), ...(f.get("why") ? { discountNote: String(f.get("why")) } : {}) })); }}>
          <label>Sconto commerciale (%)<input name="discount" type="number" min={0} max={50} step={0.5} defaultValue={0} /></label>
          <Field label="Motivo (visibile nella storia del contatto)" name="why" />
          <button className="platform-button" disabled={busy}>Nuova versione con sconto</button>
        </form>
      </details> : null}
      <section className="platform-card">
        <h2>Stato commerciale</h2>
        <p>
          <State value={`journey-${detail.journey}`} />{" "}
          {detail.record.commercialState === "review" ? `L'autore ha chiesto la proposta definitiva${detail.record.reviewRequestedAt ? ` il ${date(detail.record.reviewRequestedAt)}` : ""}.${detail.record.reviewNote ? ` Nota: "${detail.record.reviewNote}"` : ""}` : detail.record.commercialState === "estimate" ? "Stima dal listino: l'autore non può confermarla finché non la rendi acquistabile." : detail.record.commercialState === "offer" ? `Proposta acquistabile${detail.record.expiresAt ? `, valida fino al ${date(detail.record.expiresAt)}` : ""}.` : "Accettata: condizioni bloccate, contano i pagamenti."}
          {detail.record.preferredTier && !detail.record.acceptedAt ? ` Pacchetto scelto dall'autore: ${detail.record.preferredTier}.` : ""}
        </p>
        {hasPermission(user.grants, "quote.write") && !detail.record.acceptedAt ? (
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => platformApi(`quotes/${id}/offer`, "POST", { validityDays: Number(f.get("days") || 30), ...(f.get("message") ? { message: String(f.get("message")) } : {}) })); }}>
            <label>Validità (giorni)<input name="days" type="number" min={1} max={365} defaultValue={30} /></label>
            <label>Messaggio per l’autore (facoltativo)<input name="message" maxLength={2000} /></label>
            <button className="platform-button" disabled={busy}>{detail.record.commercialState === "offer" ? "Rinnova l'offerta" : "Rendi acquistabile e avvisa"}</button>
          </form>
        ) : null}
        {hasPermission(user.grants, "quote.write") ? (
          <button className="platform-text-button" disabled={busy} onClick={() => run(() => platformApi(`quotes/${id}/reminders`, "POST", { paused: !detail.record.remindersPausedAt }))}>
            {detail.record.remindersPausedAt ? "Riattiva i promemoria automatici" : "Sospendi i promemoria automatici"}
          </button>
        ) : null}
        {hasPermission(user.grants, "quote.write") && !detail.record.acceptedAt ? (
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => platformApi(`quotes/${id}/plan`, "POST", { installments: Number(f.get("installments") || 1), ...(f.get("note") ? { note: String(f.get("note")) } : {}) })); }}>
            <label>Rate del saldo concesse da Proemios<input name="installments" type="number" min={1} max={12} defaultValue={detail.record.paymentPlan?.installments ?? 1} /></label>
            <label>Nota interna (facoltativa)<input name="note" maxLength={500} /></label>
            <button className="platform-button" disabled={busy}>Imposta il piano</button>
            <small>1 = acconto e saldo unico. Oltre la soglia della regola «Cosa è acquistabile subito» serve chi gestisce le regole economiche. Le rate Klarna/Scalapay le offre Stripe sulla singola operazione e non c’entrano con questo piano.</small>
          </form>
        ) : null}
        {detail.record.paymentPlan ? <p>Piano: saldo in {detail.record.paymentPlan.installments} rate{detail.record.paymentPlan.approvedBy ? " (eccezione approvata)" : ""}{detail.record.paymentPlan.note ? ` · ${detail.record.paymentPlan.note}` : ""}.</p> : null}
        {detail.contract ? (
          <div className="platform-notice">
            <strong>Contratto v{detail.contract.version}</strong> · condizioni {detail.contract.termsVersion} · accettato il {date(detail.contract.acceptedAt)}{detail.contract.acceptances.earlyStart ? " · avvio immediato richiesto" : ""}{detail.contract.acceptances.marketing ? " · consenso informativo dato" : ""} · {detail.contract.consumer ? "consumatore" : "impresa/professionista"}.{" "}
            <a href={detail.contract.pdfUrl}>Scarica il PDF</a>
            {detail.contract.withdrawalRequestedAt ? <> · <strong>Recesso richiesto il {date(detail.contract.withdrawalRequestedAt)}</strong>{can(user.grants, "finance.record") ? <> · <button className="platform-text-button" disabled={busy} onClick={() => run(() => platformApi(`contracts/${detail.contract!.id}/withdrawal`, "POST", { outcome: "accepted" }))}>Chiudi la pratica (accolto)</button></> : null}</> : null}
          </div>
        ) : null}
        {detail.attribution ? (
          <dl className="platform-attribution">
            <div><dt>Responsabile del contatto</dt><dd>{detail.attribution.responsible?.name ?? "In coda, non assegnato"}</dd></div>
            <div><dt>Origine</dt><dd>{detail.attribution.source.channel}{detail.attribution.source.attribution?.utmSource ? ` · ${detail.attribution.source.attribution.utmSource}${detail.attribution.source.attribution.utmCampaign ? ` / ${detail.attribution.source.attribution.utmCampaign}` : ""}` : ""}</dd></div>
            <div><dt>Affiliazione</dt><dd>{detail.attribution.affiliate ? `Sì, regola ${detail.attribution.affiliate.ruleVersion}` : "Nessuna"}</dd></div>
            <div><dt>Intervento commerciale</dt><dd>{detail.attribution.salesAssisted ? `Sì${detail.attribution.offeredBy ? ` (offerta di ${detail.attribution.offeredBy.name})` : ""}` : "No: vendita autonoma"}</dd></div>
            <div><dt>Regola provvigionale congelata</dt><dd>{detail.attribution.commissionRule ? `${detail.attribution.commissionRule.version} · venditore ${detail.attribution.commissionRule.sellerBps / 100}% · affiliato ${detail.attribution.commissionRule.affiliateBps / 100}%${detail.attribution.commissionRule.assistedSalesOnly ? " · solo vendite assistite" : ""}` : "Nessuna regola al momento della proposta"}</dd></div>
          </dl>
        ) : null}
      </section>
      <section className="platform-card">
        <h2>La tua proposta editoriale</h2>
        <div className="platform-actions">
          <a className="platform-text-button" href={`/api/platform/quotes/${id}/pdf`}>Scarica il PDF →</a>
          <button className="platform-text-button" onClick={() => run(async () => { await navigator.clipboard.writeText(`${location.origin}/spazio?preventivo=${id}`); })}>Copia link protetto</button>
        </div>
        <p>
          Versione {detail.record.version}. Scegli un percorso, leggi le condizioni e conferma. Il
          pagamento è disponibile dopo l’accettazione.
        </p>
        {detail.history?.length ? <details><summary>Versioni precedenti</summary><ul>{detail.history.map(v => <li key={v.version}>Versione {v.version} · archiviata il {date(v.createdAt)}</li>)}</ul></details> : null}
        {detail.paymentPolicy ? (
          <p>
            IVA{" "}
            {detail.paymentPolicy.vatMode === "exempt"
              ? "esente"
              : `${detail.paymentPolicy.vatRateBps / 100}% ${detail.paymentPolicy.vatMode === "included" ? "inclusa" : "esclusa nel listino, inclusa nel totale da pagare"}`}
            . Condizioni {detail.paymentPolicy.termsVersion}.
          </p>
        ) : (
          <p className="platform-notice">
            Le condizioni economiche devono essere confermate dal team. L’accettazione e i pagamenti
            saranno disponibili dopo questa verifica.
          </p>
        )}
        {hasPermission(user.grants, "quote.accept") && !detail.record.acceptedAt ? (
          <label className="platform-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Ho letto e accetto i{" "}
            <Link href="/termini" target="_blank">
              termini
            </Link>{" "}
            e i servizi di questa proposta.
          </label>
        ) : null}
      </section>
      {error ? (
        <p role="alert" className="platform-error">
          {error}
        </p>
      ) : null}
      <div className="platform-grid">
        {detail.packages.map((p) => (
          <section className="platform-card" key={p.tier}>
            <p className="platform-eyebrow">{p.name}</p>
            <h2>{money(p.money?.grossCents ?? p.total * 100)}</h2>
            <p>
              {p.money
                ? `Imponibile ${money(p.money.netCents)} · IVA ${money(p.money.taxCents)}`
                : "Stima di listino, condizioni da confermare"}
            </p>
            <ul>
              {p.lineItems.map((s, i) => (
                <li key={i}>{s.label}</li>
              ))}
            </ul>
            <p>
              Acconto di listino: {money(p.deposit * 100)}. L’IVA è applicata secondo le condizioni
              sopra.
            </p>
            {hasPermission(user.grants, "quote.accept") && !detail.record.acceptedAt ? (
              <button
                disabled={busy || !accepted || !detail.paymentPolicy}
                className="platform-button"
                onClick={() =>
                  run(() =>
                    platformApi(`quotes/${id}/accept`, "POST", {
                      tier: p.tier,
                      version: detail.record.version,
                      policyVersion: detail.paymentPolicy!.version,
                      termsAccepted: true,
                    }),
                  )
                }
              >
                Accetta {p.name}
              </button>
            ) : null}
            {detail.record.selectedTier === p.tier && hasPermission(user.grants, "quote.accept") ? (
              <div className="platform-actions">
                {["deposit", "balance"].map((kind) => (
                  <button
                    key={kind}
                    disabled={busy}
                    className="platform-button"
                    onClick={() =>
                      run(async () => {
                        const r = await platformApi<{ url: string }>("checkout", "POST", {
                          quoteId: id,
                          kind,
                        });
                        location.assign(r.url);
                      })
                    }
                  >
                    {kind === "deposit" ? "Paga acconto" : "Paga saldo"} →
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      {hasPermission(user.grants, "quote.send") ? (
        <button
          className="platform-button"
          disabled={busy}
          onClick={() => run(() => platformApi(`quotes/${id}/send`, "POST"))}
        >
          Invia al cliente per email →
        </button>
      ) : null}
    </>
  );
}
type Runner = (work: () => Promise<unknown>, message?: string) => Promise<void>;
const MARKETING_LABELS: Partial<Record<Permission, string>> = { "marketing.read": "Dashboard marketing", "marketing.campaigns": "Campagne e link tracciati", "marketing.contacts": "Contatti autorizzati", "automation.draft": "Bozze delle automazioni", "automation.activate": "Attivazione delle automazioni", "crm.assign": "Assegnazione dei contatti", "revenue.aggregate": "Ricavi aggregati", "export": "Export", "integrations.manage": "Gestione dei collegamenti (solo amministratori)" };
type Metric = { key: string; label: string; value: number | string | null; unit?: "count" | "cents" | "pct" | "text"; definition: string; source: string; updatedAt: string | null; status: "ok" | "to_connect" | "unavailable" | "unauthorized"; demo: boolean };
type Campaign = { id: string; name: string; channel: string; status: string; startsAt: string | null; endsAt: string | null; destination: string; utmSource: string; utmMedium: string; utmCampaign: string; utmContent: string | null; utmTerm: string | null; partnerId: string | null; sellerId: string | null; budgetCents: number; notes: string | null; link: string; results: { leads: number; quotes: number; purchases: number; collectedCents: number | null; spendCents: number; spendDays: number; clicks: number; impressions: number; budgetUsedPct: number | null; costPerLeadCents: number | null; costPerPurchaseCents: number | null; roas: number | null } };
type MarketingContact = { id: string; nome: string; email: string; fonte: string; sourceDetail: string | null; consentAt: string; stage: string; assignedName: string | null; campaign: string | null };
/**
 * Area marketing: dashboard con definizione, fonte e aggiornamento per ogni
 * numero; registro campagne con link tracciati e spesa; contatti autorizzati;
 * bozze di automazione. Tutto ciò che non è collegato lo dichiara.
 */
function MarketingView({ user }: { user: Profile }) {
  const [metrics, setMetrics] = useState<{ days: number; demo: boolean; metrics: Metric[] } | null>(null), [campaigns, setCampaigns] = useState<Campaign[]>([]), [contacts, setContacts] = useState<MarketingContact[]>([]), [automation, setAutomation] = useState<{ draft: Record<string, unknown> | null; active: Record<string, unknown> | null; defaults: Record<string, unknown>; canActivate: boolean } | null>(null), [integrations, setIntegrations] = useState<Record<string, { label: string; configured: boolean; detail: string; mode: string }> | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0), [days, setDays] = useState(30);
  useEffect(() => {
    let active = true;
    platformApi<{ days: number; demo: boolean; metrics: Metric[] }>(`marketing?giorni=${days}`).then((m) => { if (active) setMetrics(m); }).catch((e) => { if (active) setError(e.message); });
    platformApi<{ campaigns: Campaign[] }>("campaigns").then((c) => { if (active) setCampaigns(c.campaigns); }).catch(() => {});
    if (hasPermission(user.grants, "marketing.contacts")) platformApi<{ contacts: MarketingContact[] }>("marketing/contacts").then((c) => { if (active) setContacts(c.contacts); }).catch(() => {});
    if (hasPermission(user.grants, "automation.draft") || hasPermission(user.grants, "automation.activate")) platformApi<typeof automation>("automations").then((a) => { if (active) setAutomation(a); }).catch(() => {});
    if (hasPermission(user.grants, "integrations.manage")) platformApi<{ integrations: NonNullable<typeof integrations> }>("integrations").then((i) => { if (active) setIntegrations(i.integrations); }).catch(() => {});
    return () => { active = false; };
  }, [user.grants, refresh, days]);
  async function run(work: () => Promise<unknown>, message = "Salvato.") {
    setError(""); setNotice(""); setBusy(true);
    try { await work(); setNotice(message); setRefresh((r) => r + 1); } catch (e) { setError(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); }
  }
  const show = (m: Metric) => m.status === "to_connect" ? "Da collegare" : m.status === "unauthorized" ? "Non autorizzato" : m.value === null || m.status === "unavailable" ? "Non disponibile" : m.unit === "cents" ? money(Number(m.value)) : m.unit === "pct" ? `${m.value}%` : String(m.value);
  const statusLabel: Record<string, string> = { draft: "bozza", active: "attiva", paused: "in pausa", ended: "conclusa" };
  return (
    <>
      {error ? <p className="platform-error" role="alert">{error}</p> : null}
      {notice ? <p className="platform-notice" role="status">{notice}</p> : null}
      <section className="platform-card">
        <h2>Dashboard marketing {metrics?.demo ? <small>· dati dimostrativi</small> : <small>· dati reali</small>}</h2>
        <label>Periodo<select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 giorni</option><option value={30}>30 giorni</option><option value={90}>90 giorni</option><option value={365}>12 mesi</option></select></label>
        <div className="platform-metrics">
          {metrics?.metrics.map((m) => (
            <section className="platform-card" key={m.key}>
              <small>{m.label}</small>
              <h2>{show(m)}</h2>
              <p><small>{m.definition}<br />Fonte: {m.source}{m.updatedAt ? ` · aggiornato ${new Date(m.updatedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : ""}</small></p>
            </section>
          ))}
        </div>
        {!metrics ? <p role="status">Caricamento…</p> : null}
      </section>
      <section className="platform-card">
        <h2>Registro campagne</h2>
        <p>Ogni campagna ha UTM propri e un link tracciato (senza dati personali). Risultati attribuiti per link o per UTM corrispondenti; spesa via import CSV o inserimento manuale, mai da collegamenti pubblicitari automatici.</p>
        {campaigns.map((c) => (
          <details key={c.id} className="platform-card">
            <summary>{c.name} · {c.channel} · {statusLabel[c.status] ?? c.status}{c.startsAt ? ` · dal ${date(c.startsAt)}` : ""}{c.endsAt ? ` al ${date(c.endsAt)}` : ""}</summary>
            <p>Budget {money(c.budgetCents)} · speso {money(c.results.spendCents)}{c.results.budgetUsedPct !== null ? ` (${c.results.budgetUsedPct}%)` : ""} · contatti {c.results.leads} · proposte {c.results.quotes} · acquisti {c.results.purchases}{c.results.collectedCents !== null ? ` · incassato ${money(c.results.collectedCents)}` : ""}{c.results.costPerLeadCents !== null ? ` · costo/contatto ${money(c.results.costPerLeadCents)}` : ""}{c.results.costPerPurchaseCents !== null ? ` · costo/acquisto ${money(c.results.costPerPurchaseCents)}` : ""}{c.results.roas !== null ? ` · ROAS ${c.results.roas}` : ""}</p>
            <p><small>UTM: {c.utmSource} / {c.utmMedium} / {c.utmCampaign}{c.utmContent ? ` / ${c.utmContent}` : ""} · destinazione {c.destination}</small></p>
            <div className="platform-actions">
              <button className="platform-text-button" onClick={() => navigator.clipboard.writeText(c.link).then(() => setNotice("Link tracciato copiato."))}>Copia il link tracciato</button>
              <code>{c.link}</code>
            </div>
            {hasPermission(user.grants, "marketing.campaigns") ? (
              <>
                <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => platformApi(`campaigns/${c.id}`, "PATCH", { status: f.get("status") })); }}>
                  <label>Stato<select name="status" defaultValue={c.status}><option value="draft">bozza</option><option value="active">attiva</option><option value="paused">in pausa</option><option value="ended">conclusa</option></select></label>
                  <button disabled={busy}>Aggiorna</button>
                </form>
                <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => platformApi(`campaigns/${c.id}/spend`, "POST", { source: "manual", rows: [{ day: f.get("day"), spend: Number(f.get("spend")), clicks: f.get("clicks") ? Number(f.get("clicks")) : undefined, impressions: f.get("impressions") ? Number(f.get("impressions")) : undefined }] }), "Spesa registrata (i giorni già presenti non vengono sovrascritti)."); }}>
                  <Field label="Giorno" name="day" type="date" required />
                  <label>Spesa (€)<input name="spend" type="number" min={0} step={0.01} required /></label>
                  <label>Clic<input name="clicks" type="number" min={0} /></label>
                  <label>Impressioni<input name="impressions" type="number" min={0} /></label>
                  <button disabled={busy}>Aggiungi spesa</button>
                </form>
                <form className="platform-inline" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const file = f.get("file"); await run(async () => { const text = file instanceof File ? await file.text() : ""; if (!text) throw new Error("Scegli un file CSV."); const response = await fetch(`/api/platform/campaigns/${c.id}/spend?origine=${encodeURIComponent(String(f.get("origine") || "csv"))}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "text/csv" }, body: text }); const result = await response.json(); if (!response.ok) throw new Error(result.errore ?? "Import non riuscito."); }, "Spesa importata: i giorni già presenti sono stati ignorati."); }}>
                  <label>CSV spesa (colonne: day, spend, clicks, impressions)<input name="file" type="file" accept=".csv,text/csv" /></label>
                  <Field label="Origine (es. google-ads)" name="origine" />
                  <button disabled={busy}>Importa CSV</button>
                </form>
              </>
            ) : null}
          </details>
        ))}
        {!campaigns.length ? <Empty>Nessuna campagna nel registro.</Empty> : null}
        {hasPermission(user.grants, "marketing.campaigns") ? (
          <details className="platform-card">
            <summary>Nuova campagna</summary>
            <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; run(() => platformApi("campaigns", "POST", { name: f.get("name"), channel: f.get("channel"), status: "draft", destination: f.get("destination") || "/preventivo", utmSource: f.get("source"), utmMedium: f.get("medium"), utmCampaign: f.get("campaign"), ...(f.get("content") ? { utmContent: f.get("content") } : {}), budgetCents: Math.round(Number(f.get("budget") || 0) * 100), ...(f.get("starts") ? { startsAt: new Date(String(f.get("starts"))).toISOString() } : {}), ...(f.get("ends") ? { endsAt: new Date(String(f.get("ends"))).toISOString() } : {}), ...(f.get("notes") ? { notes: f.get("notes") } : {}) }).then(() => form.reset()), "Campagna creata in bozza."); }}>
              <Field label="Nome" name="name" required />
              <label>Canale<select name="channel"><option value="google_ads">Google Ads</option><option value="meta">Meta</option><option value="email">Email</option><option value="marketplace">Marketplace</option><option value="partner">Partner</option><option value="organic">Organico</option><option value="referral">Referral</option><option value="other">Altro</option></select></label>
              <Field label="Destinazione (percorso interno)" name="destination" defaultValue="/preventivo" />
              <Field label="utm_source" name="source" required />
              <Field label="utm_medium" name="medium" required />
              <Field label="utm_campaign" name="campaign" required />
              <Field label="utm_content (facoltativo)" name="content" />
              <label>Budget (€)<input name="budget" type="number" min={0} step={0.01} /></label>
              <Field label="Inizio" name="starts" type="date" />
              <Field label="Fine" name="ends" type="date" />
              <label>Note<textarea name="notes" maxLength={2000} /></label>
              <button className="platform-button" disabled={busy}>Crea la campagna</button>
            </form>
          </details>
        ) : null}
      </section>
      {hasPermission(user.grants, "marketing.contacts") ? (
        <section className="platform-card">
          <h2>Contatti autorizzati alle comunicazioni facoltative</h2>
          <p>Solo chi ha dato il consenso e non lo ha revocato: nome, email, origine, data del consenso. Nessuna nota, telefono o documento.</p>
          {contacts.map((c) => <div className="platform-row" key={c.id}><span><strong>{c.nome}</strong><small>{c.email} · {c.fonte}{c.campaign ? ` · ${c.campaign}` : ""} · consenso {date(c.consentAt)}</small></span><State value={c.stage} /><span>{c.assignedName ?? "non assegnato"}</span></div>)}
          {!contacts.length ? <Empty>Nessun contatto con consenso attivo.</Empty> : null}
          {can(user.grants, "export") ? <a className="platform-text-button" href="/api/platform/leads/export" download>Esporta CSV →</a> : null}
        </section>
      ) : null}
      {automation ? (
        <section className="platform-card">
          <h2>Automazioni di recupero</h2>
          <p>La bozza non invia nulla. Attiva: {automation.active ? `versione ${(automation.active as { version?: string }).version ?? "?"}` : "regole predefinite"}. {automation.canActivate ? "Puoi attivare la bozza." : "L’attivazione richiede la delega «automation.activate»."}</p>
          <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const raw = String(new FormData(e.currentTarget).get("draft")); run(async () => { let value: unknown; try { value = JSON.parse(raw); } catch { throw new Error("La bozza deve essere JSON valido."); } return platformApi("automations", "PUT", { value }); }, "Bozza salvata (non attiva)."); }}>
            <label>Bozza (JSON)<textarea name="draft" rows={12} defaultValue={JSON.stringify(automation.draft ?? automation.active ?? automation.defaults, null, 2)} /></label>
            <button disabled={busy || !hasPermission(user.grants, "automation.draft")}>Salva la bozza</button>
          </form>
          {automation.canActivate && automation.draft ? <button className="platform-button" disabled={busy} onClick={() => { if (window.confirm("Attivi la bozza? Da questo momento i recuperi seguono queste regole.")) run(() => platformApi("automations/activate", "POST"), "Automazione attivata."); }}>Attiva la bozza</button> : null}
        </section>
      ) : null}
      {integrations ? (
        <section className="platform-card">
          <h2>Collegamenti esterni</h2>
          {Object.entries(integrations).map(([key, i]) => <div className="platform-row" key={key}><span>{i.label}</span><State value={i.configured ? "ready" : i.mode === "prepared" ? "pending" : "attention"} /><small>{i.detail}</small></div>)}
          <p><small>Le credenziali si impostano nelle variabili d’ambiente del progetto (vedi docs/INTEGRAZIONI.md), mai da qui.</small></p>
        </section>
      ) : null}
    </>
  );
}
function TeamView({
  users,
  run,
  busy,
  grants,
}: {
  users: Person[];
  run: Runner;
  busy: boolean;
  grants: Grant[];
}) {
  const [role, setRole] = useState<Role>("editor"),
    [custom, setCustom] = useState(false),
    [selected, setSelected] = useState<Grant[]>(ROLE_GRANTS.editor);
  return (
    <>
      <section className="platform-card">
        <h2>Persone e permessi</h2>
        {users.map((u) => (
          <article key={u.id} className="platform-team-person">
            <strong>{u.name}</strong>
            <p>
              {u.email} · {u.emailVerified ? "Email verificata" : "Da verificare"} ·{" "}
              {u.twoFactorEnabled ? "2FA attiva" : "2FA da attivare"}
            </p>
            <small>ID per assegnazioni: {u.id}</small>
            {u.memberships.map((m) => (
              <details key={m.id}>
                <summary>
                  {ROLE_NAMES[m.role]} · {m.active ? "Attivo" : "Sospeso"}
                </summary>
                <p>
                  {(m.grants ?? ROLE_GRANTS[m.role])
                    .map((g) => `${g.permission} (${g.scope})`)
                    .join(", ")}
                </p>
                <form
                  className="platform-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const raw = String(form.get("grants"));
                    run(async () => {
                      let next: unknown;
                      try {
                        next = JSON.parse(raw);
                      } catch {
                        throw new Error("La lista di permessi deve essere JSON valido.");
                      }
                      return platformApi(`memberships/${m.id}`, "PATCH", {
                        active: form.get("active") === "on",
                        grants: next,
                      });
                    });
                  }}
                >
                  <label>
                    Permessi specifici (null per il ruolo standard)
                    <textarea
                      name="grants"
                      defaultValue={JSON.stringify(m.grants, null, 2)}
                      maxLength={12000}
                    />
                  </label>
                  <label className="platform-check">
                    <input type="checkbox" name="active" defaultChecked={m.active} />
                    Accesso attivo
                  </label>
                  <button disabled={busy}>Salva e revoca le sessioni</button>
                </form>
                {m.role === "admin" || m.role === "marketing" ? (
                  <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const chosen = f.getAll("mkt").map(String) as Permission[]; const base = (m.grants ?? ROLE_GRANTS[m.role]).filter((g) => !(MARKETING_PERMISSIONS as string[]).includes(g.permission)); run(() => platformApi(`memberships/${m.id}`, "PATCH", { active: m.active, grants: [...base, ...chosen.map((permission) => ({ permission, scope: "organization" as const }))] }), "Permessi marketing aggiornati."); }}>
                    <p><strong>Permessi marketing per questo profilo</strong> (uno per uno; l’attivazione delle automazioni, i ricavi aggregati, l’export e i collegamenti sono deleghe separate):</p>
                    {MARKETING_PERMISSIONS.map((perm) => <label className="platform-check" key={perm}><input type="checkbox" name="mkt" value={perm} defaultChecked={(m.grants ?? ROLE_GRANTS[m.role]).some((g) => g.permission === perm)} />{MARKETING_LABELS[perm] ?? perm}</label>)}
                    <button disabled={busy}>Salva permessi marketing</button>
                  </form>
                ) : null}
              </details>
            ))}
          </article>
        ))}
      </section>
      {can(grants, "invite.manage") ? (
        <details className="platform-card">
          <summary>Invita una persona</summary>
          <form
            className="platform-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(
                () =>
                  platformApi("invitations", "POST", {
                    email: f.get("email"),
                    role,
                    grants: custom || role === "admin" ? selected : null,
                    projectIds: String(f.get("projects") ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }),
                "Invito registrato. L’email è in coda di invio.",
              );
            }}
          >
            <Field label="Email personale" name="email" type="email" required />
            <label>
              Ruolo
              <select
                value={role}
                onChange={(e) => {
                  const value = e.target.value as Role;
                  setRole(value);
                  setSelected(ROLE_GRANTS[value]);
                  setCustom(value === "admin");
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_NAMES[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="platform-check">
              <input
                type="checkbox"
                checked={custom}
                onChange={(e) => setCustom(e.target.checked)}
              />
              Personalizza i permessi
            </label>
            {custom
              ? (role === "admin" ? PERMISSIONS.map(permission => ({ permission, scope: "organization" as const })) : ROLE_GRANTS[role]).map((g) => (
                  <div className="platform-inline" key={g.permission}>
                    <label className="platform-check">
                      <input
                        type="checkbox"
                        checked={selected.some((s) => s.permission === g.permission)}
                        onChange={(e) =>
                          setSelected((all) =>
                            e.target.checked
                              ? [...all, g]
                              : all.filter((s) => s.permission !== g.permission),
                          )
                        }
                      />
                      {g.permission}
                    </label>
                    <select
                      aria-label={`Ambito di ${g.permission}`}
                      value={selected.find((s) => s.permission === g.permission)?.scope ?? g.scope}
                      onChange={(e) =>
                        setSelected((all) =>
                          all.map((s) =>
                            s.permission === g.permission
                              ? { ...s, scope: e.target.value as Grant["scope"] }
                              : s,
                          ),
                        )
                      }
                    >
                      <option value="own">Solo propri dati</option>
                      <option value="assigned">Solo assegnati</option>
                      <option value="organization">Organizzazione</option>
                    </select>
                  </div>
                ))
              : null}
            <Field
              label="ID progetti da assegnare, separati da virgola (facoltativo)"
              name="projects"
            />
            <button disabled={busy} className="platform-button">
              Invia invito personale →
            </button>
          </form>
        </details>
      ) : null}
    </>
  );
}
function TodayView({ data }: { data: Collection }) {
  const labels: Record<string, string> = { quote_started: "Preventivo avviato", estimate_viewed: "Stima vista", package_chosen: "Pacchetto scelto", proposal_viewed: "Proposta vista", checkout_opened: "Checkout aperto (interfaccia)", quote_saved: "Proposte salvate", email_verified: "Email verificate", review_requested: "Valutazioni richieste", offer_made: "Offerte del team", quote_accepted: "Accettazioni", checkout_started: "Checkout avviati", payment_confirmed: "Pagamenti confermati" };
  const items = data.today ?? [];
  return (
    <>
      {data.summary ? (
        <div className="platform-metrics">
          {[["Nuovi contatti (24h)", data.summary.newLeads24h], ["Da valutare", data.summary.awaitingReview], ["Proposte aperte", data.summary.openOffers], ["Accettate senza acconto", data.summary.acceptedUnpaid], ["Progetti bloccati", data.summary.blockedProjects], ["Fatture non emesse", data.summary.failedInvoices]].map(([label, value]) => (
            <section className="platform-card" key={String(label)}><small>{label}</small><h2>{value}</h2></section>
          ))}
        </div>
      ) : null}
      {data.decisions?.length ? (
        <section className="platform-card">
          <h2>Decisioni che aspettano te</h2>
          {data.decisions.map((d) => <div className="platform-row" key={d.title}><span><strong>{d.title}</strong><small>{d.detail}</small></span><Link className="platform-text-button" href="/spazio">Regole economiche →</Link></div>)}
        </section>
      ) : null}
      <section className="platform-card">
        <h2>Oggi</h2>
        {items.map((item) => (
          <div className="platform-row" key={`${item.kind}-${item.title}`}>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            <State value={item.urgency === "high" ? "attention" : item.urgency === "normal" ? "pending" : "ready"} />
            {item.href ? <Link className="platform-text-button" href={item.href as Route}>Apri →</Link> : null}
          </div>
        ))}
        {!items.length ? <Empty>Niente in sospeso per te: il lavoro è in carico ad altri o non c’è ancora.</Empty> : null}
      </section>
      {data.capacity?.length ? (
        <section className="platform-card">
          <h2>Carico del team</h2>
          {data.capacity.map((c) => <div className="platform-row" key={c.name}><span>{c.name}</span><strong>{c.count} {c.count === 1 ? "progetto" : "progetti"}</strong></div>)}
        </section>
      ) : null}
      {data.funnel ? (
        <section className="platform-card">
          <h2>Percorso di acquisto · ultimi {data.funnel.days} giorni</h2>
          <p>Eventi d’interfaccia (segnali dal browser, anonimi) e fatti economici verificati dal server, tenuti distinti.</p>
          {["ui", "economic"].map((kind) => (
            <div key={kind}>
              <h3>{kind === "ui" ? "Interfaccia" : "Fatti verificati"}</h3>
              {data.funnel!.events.filter((e) => e.kind === kind).map((e) => <div className="platform-row" key={e.name}><span>{labels[e.name] ?? e.name}</span><strong>{e.count}</strong></div>)}
              {!data.funnel!.events.some((e) => e.kind === kind) ? <Empty>Nessun evento registrato.</Empty> : null}
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
type InvoicingStatus = {
  configured: boolean;
  sendsToSdi: boolean;
  env: { token: boolean; company: boolean; vatId: string | null; vatIdExempt: string | null; paymentAccountId: string | null; cron: boolean };
  queue: Record<string, number>;
  lastIssued: { number: string | null; issuedOn: string | null; status: string } | null;
  probe: {
    company: { id: number; name: string } | null;
    companies: Array<{ id: number; name: string }>;
    vatTypes: Array<{ id: number; value: number; description: string; isDefault: boolean }>;
    paymentAccounts: Array<{ id: number; name: string }>;
    errors: Record<string, string>;
  } | null;
};
/**
 * Stato della fatturazione automatica e verifica del collegamento a Fatture
 * in Cloud: nessun documento viene creato, si leggono solo azienda, aliquote
 * e conti d'incasso per completare la configurazione.
 */
function InvoicingPanel({ initial }: { initial?: { configured: boolean; sendsToSdi: boolean } }) {
  const [status, setStatus] = useState<InvoicingStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const configured = status?.configured ?? initial?.configured ?? false;
  const sendsToSdi = status?.sendsToSdi ?? initial?.sendsToSdi ?? false;
  async function verify() {
    setChecking(true);
    setProblem(null);
    try {
      setStatus(await platformApi<InvoicingStatus>("invoices/status?verifica=1"));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Verifica non riuscita.");
    } finally {
      setChecking(false);
    }
  }
  const pending = (status?.queue.queued ?? 0) + (status?.queue.retry ?? 0);
  return (
    <section className="platform-card platform-invoicing">
      <h2>Fatturazione automatica</h2>
      <State value={configured ? (sendsToSdi ? "ready" : "held") : "blocked"} />
      <p>
        {configured
          ? sendsToSdi
            ? "Attiva: ogni incasso confermato da Stripe diventa una fattura su Fatture in Cloud e viene trasmessa allo SdI."
            : "Attiva in modalità di controllo: ogni incasso diventa una fattura su Fatture in Cloud, ma la trasmissione allo SdI va fatta a mano finché FIC_SEND_TO_SDI non è impostata a 1."
          : "Non ancora collegata: le fatture degli incassi restano in coda finché FIC_ACCESS_TOKEN e FIC_COMPANY_ID non sono impostate nell’ambiente. Nessun incasso va perso."}
      </p>
      <div className="platform-actions">
        <button type="button" className="platform-text-button" disabled={checking} onClick={verify}>
          {checking ? "Verifica in corso…" : "Verifica il collegamento"}
        </button>
      </div>
      {problem ? <p className="platform-error">{problem}</p> : null}
      {status ? (
        <dl className="platform-attribution">
          <dt>Token e azienda</dt>
          <dd>{status.env.token ? "token presente" : "token mancante"} · {status.env.company ? "azienda impostata" : "azienda mancante"}</dd>
          <dt>Aliquota e conto d’incasso</dt>
          <dd>
            FIC_VAT_ID {status.env.vatId ?? "non impostata (usa 0 = 22%)"} · FIC_PAYMENT_ACCOUNT_ID {status.env.paymentAccountId ?? "non impostato (pagamento senza conto)"}
          </dd>
          <dt>Cron notturno</dt>
          <dd>{status.env.cron ? "configurato: riprova le fatture in attesa ogni notte" : "CRON_SECRET mancante: le fatture in attesa vengono riprovate solo dai pagamenti successivi o da questa scheda"}</dd>
          <dt>Coda</dt>
          <dd>
            {pending} in attesa · {status.queue.failed ?? 0} in errore · {(status.queue.created ?? 0) + (status.queue.sent ?? 0)} emesse
            {status.lastIssued?.number ? ` · ultima n. ${status.lastIssued.number}${status.lastIssued.issuedOn ? ` del ${date(status.lastIssued.issuedOn)}` : ""}` : ""}
          </dd>
          {status.probe ? (
            <>
              <dt>Azienda su Fatture in Cloud</dt>
              <dd>{status.probe.company ? `${status.probe.company.name} (id ${status.probe.company.id})` : status.probe.errors.company ?? "non raggiungibile"}</dd>
              <dt>Aliquote disponibili</dt>
              <dd>
                {status.probe.vatTypes.length
                  ? status.probe.vatTypes.map((v) => `${v.id} → ${v.value}%${v.description ? ` ${v.description}` : ""}${v.isDefault ? " (predefinita)" : ""}`).join(" · ")
                  : status.probe.errors.vatTypes ?? "nessuna"}
              </dd>
              <dt>Conti d’incasso</dt>
              <dd>
                {status.probe.paymentAccounts.length
                  ? status.probe.paymentAccounts.map((a) => `${a.id} → ${a.name}`).join(" · ")
                  : status.probe.errors.paymentAccounts ?? "nessuno"}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      <small>
        Per completare: in Fatture in Cloud → Impostazioni → API crea un token con ambiti «Fatture emesse: lettura e scrittura» e «Impostazioni: lettura»; copia token e id azienda nelle variabili d’ambiente, verifica qui, poi scegli l’aliquota e il conto Stripe fra quelli elencati. Attiva FIC_SEND_TO_SDI=1 solo dopo aver controllato le prime fatture.
      </small>
    </section>
  );
}
function SettingsView({
  settings,
  defaults,
  run,
  busy,
}: {
  settings: NonNullable<Collection["settings"]>;
  defaults?: Collection["defaults"];
  run: Runner;
  busy: boolean;
}) {
  return (
    <>
      <section className="platform-card">
        <h2>Condizioni economiche da approvare</h2>
        <p>
          Questi valori incidono sulle nuove proposte. Le proposte già generate conservano la
          versione precedente. Il salvataggio registra il responsabile e la data di approvazione.
        </p>
      </section>
      {["payment-policy", "commission-rule", "purchase-rule", "reminder-rules", "recovery-rules"].map((key) => (
        <details className="platform-card" key={key}>
          <summary>
            {{ "payment-policy": "IVA e termini", "commission-rule": "Commissioni e attribuzione", "purchase-rule": "Cosa è acquistabile subito", "reminder-rules": "Promemoria automatici", "recovery-rules": "Recupero dei pagamenti non conclusi" }[key]}
          </summary>
          <form
            className="platform-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                let value: unknown;
                try {
                  value = JSON.parse(String(f.get("value")));
                } catch {
                  throw new Error("Inserisci una configurazione JSON valida.");
                }
                return platformApi("settings", "PUT", { key, value });
              });
            }}
          >
            <p>
              {{
                "payment-policy": "Valori richiesti: version, vatMode (included, excluded o exempt), vatRateBps (100 = 1%), termsVersion. Senza una policy salvata vale quella predefinita mostrata qui sotto.",
                "commission-rule": 'Valori richiesti: version, sellerBps, affiliateBps (100 = 1%), base "collected-excluding-tax", attributionDays (1–365), attribution "code-on-quote". Facoltativo: assistedSalesOnly (true = provvigione al venditore solo con un intervento tracciato: revisione, invio o offerta; la sola assegnazione del contatto non basta).',
                "purchase-rule": "Quali richieste pubbliche nascono già acquistabili: autoOfferSingleServices (elenco di servizi singoli a prezzo fisso), autoOfferFullPath (percorsi completi), validityDays. maxInstallments: rate del saldo che un venditore può concedere da solo (1 = nessuna). startAfter: per servizio, se la lavorazione parte dopo l'acconto (predefinito) o dopo il saldo, es. {\"cover\":\"balance\"}. balanceBeforeDelivery: la consegna finale richiede il saldo. Tutto il resto resta una stima finché il team non la rende acquistabile. Predefinito prudente: solo copertina, EPUB, KDP, ISBN e scheda Amazon.",
                "reminder-rules": "enabled, unconfirmedDays, expiryDays, unpaidDays, materialsDays, approvalDays. I promemoria si fermano al cambio di stato, non si ripetono e si possono sospendere sulla singola proposta o progetto.",
                "recovery-rules": "enabled, triggers (checkout_started, payment_failed), steps [{key, afterHours, channel: email|task, purpose: assistance|contractual|cart|marketing, subject, body}], maxPerWeek, stopOnSellerActivity. Prima di ogni passo si rilegge lo stato: pagamento, risposta, presa in carico, chiusura o revoca fermano tutto. Lo scopo «marketing» richiede il consenso esplicito; «task» crea un'attività manuale per il venditore (telefonata, WhatsApp, SMS) e non invia nulla.",
              }[key]}
            </p>
            <label>
              Configurazione approvata
              <textarea
                name="value"
                defaultValue={JSON.stringify(
                  settings.find((s) => s.key === key)?.value ?? defaults?.[key] ?? {},
                  null,
                  2,
                )}
                required
                maxLength={6000}
                rows={10}
              />
            </label>
            <label className="platform-check">
              <input type="checkbox" required />
              Confermo che questi valori sono le condizioni approvate per Proemios.
            </label>
            <button className="platform-button" disabled={busy}>
              Approva e salva
            </button>
          </form>
        </details>
      ))}
    </>
  );
}
