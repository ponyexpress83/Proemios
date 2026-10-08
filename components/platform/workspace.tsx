"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { PricingInput } from "@/lib/pricing";
import { authClient } from "@/lib/auth-client";
import {
  can,
  hasPermission,
  ROLE_NAMES,
  ROLES,
  ROLE_GRANTS,
  PERMISSIONS,
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
type Lead = {
  id: string;
  nome: string;
  email: string;
  telefono: string | null;
  stage: string;
  leadScore: number;
  note: string | null;
  assignedTo: string | null;
};
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
type Order = { id: string; quoteId: string; kind: string; amountCents: number; status: string };
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
  ledger?: Ledger[];
  notifications?: Notification[];
  profiles?: Array<{ userId: string; code: string; active: boolean; link: string }>;
  conversions?: Array<{ id: string; createdAt: string; ruleVersion: string }>;
  settings?: Array<{ key: string; value: Record<string, unknown> }>;
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
  record: { version: number; selectedTier: string | null; acceptedAt: string | null };
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
  notes: Array<{ id: string; body: string; name: string; createdAt: string }>;
  quotes: Quote[];
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
    throw new Error(
      [result.errore, ...Object.values(result.fields ?? {})].filter(Boolean).join(" "),
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
function State({ value }: { value: string }) {
  return <span className={`platform-state state-${value}`}>{stages[value] ?? value}</span>;
}
const tabRules: Array<{ id: string; label: string; permission?: Permission }> = [
  { id: "projects", label: "I miei libri", permission: "project.read" },
  { id: "leads", label: "Contatti", permission: "crm.read" },
  { id: "quotes", label: "Preventivi", permission: "quote.read" },
  { id: "tasks", label: "Attività", permission: "task.read" },
  { id: "affiliates", label: "Affiliazione", permission: "affiliate.read" },
  { id: "commissions", label: "Commissioni", permission: "commission.read" },
  { id: "finance", label: "Finance", permission: "finance.read" },
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
    const params = new URLSearchParams(location.search), quote = params.get("preventivo"), project = params.get("progetto");
    if (quote && hasPermission(user.grants, "quote.read")) { setTab("quotes"); setSelected(quote); }
    else if (project && hasPermission(user.grants, "project.read")) { setTab("projects"); setSelected(project); }
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
              <LeadView id={selected} />
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
                  {["new", "contacted", "qualified", "proposal", "won", "lost"].map((stage) => (
                    <section className="platform-card" key={stage}>
                      <h2>
                        {stages[stage]}{" "}
                        <small>{data.leads?.filter((l) => l.stage === stage).length ?? 0}</small>
                      </h2>
                      {data.leads
                        ?.filter((l) => l.stage === stage)
                        .map((l) => (
                          <button
                            className="platform-lead"
                            key={l.id}
                            onClick={() => setSelected(l.id)}
                          >
                            <strong>{l.nome}</strong>
                            <span>{l.email}</span>
                            <small>Priorità {l.leadScore}/100</small>
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
                {can(user.grants, "export") ? (
                  <a className="platform-text-button" href="/api/platform/leads/export" download>
                    Esporta CSV →
                  </a>
                ) : null}
              </>
            ) : null}
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
                        {o.id.slice(0, 8)} · {o.kind === "deposit" ? "Acconto" : "Saldo"}
                      </span>
                      <State value={o.status} />
                      <strong>{money(o.amountCents)}</strong>
                    </div>
                  ))}
                  {!data.orders?.length ? <Empty>Nessun ordine registrato.</Empty> : null}
                </div>
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
              <SettingsView settings={data.settings ?? []} run={run} busy={busy} />
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
function LeadView({ id }: { id: string }) {
  const [detail, setDetail] = useState<LeadDetail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    platformApi<LeadDetail>(`leads/${id}`)
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
      <section className="platform-card">
        <h2>{detail.lead.nome}</h2>
        <p>
          {detail.lead.email} · {detail.lead.telefono || "Nessun telefono"}
        </p>
        <p>{detail.lead.note}</p>
        <form
          className="platform-inline"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              platformApi(`leads/${id}`, "PATCH", {
                stage: f.get("stage"),
                lostReason: f.get("reason"),
              }),
            );
          }}
        >
          <label>
            Fase
            <select name="stage" defaultValue={detail.lead.stage}>
              {["new", "contacted", "qualified", "proposal", "won", "lost"].map((s) => (
                <option key={s} value={s}>
                  {stages[s]}
                </option>
              ))}
            </select>
          </label>
          <Field label="Motivo se chiuso" name="reason" />
          <button disabled={busy}>Salva fase</button>
        </form>
      </section>
      {error ? (
        <p className="platform-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="platform-card">
        <h2>Note e follow-up</h2>
        {detail.notes.map((n) => (
          <article key={n.id}>
            <strong>{n.name}</strong>
            <small> · {date(n.createdAt)}</small>
            <p>{n.body}</p>
          </article>
        ))}
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
            <span>{q.id.slice(0, 8)}</span>
            <State value={q.stato} />
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
      </details> : null}
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
function SettingsView({
  settings,
  run,
  busy,
}: {
  settings: NonNullable<Collection["settings"]>;
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
      {["payment-policy", "commission-rule"].map((key) => (
        <details className="platform-card" key={key}>
          <summary>
            {key === "payment-policy" ? "IVA e termini" : "Commissioni e attribuzione"}
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
              {key === "payment-policy"
                ? "Valori richiesti: version, vatMode (included, excluded o exempt), vatRateBps (100 = 1%), termsVersion."
                : 'Valori richiesti: version, sellerBps, affiliateBps (100 = 1%), base "collected-excluding-tax", attributionDays (1–365), attribution "code-on-quote".'}
            </p>
            <label>
              Configurazione approvata
              <textarea
                name="value"
                defaultValue={JSON.stringify(
                  settings.find((s) => s.key === key)?.value ?? {},
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
