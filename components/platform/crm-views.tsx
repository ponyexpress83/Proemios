"use client";
/**
 * Viste del CRM nello spazio del team. Ogni vista legge e scrive solo
 * tramite le API del server: i pulsanti nascosti non autorizzano niente, i
 * permessi li controlla il server. Lo spostamento di una scheda chiama
 * l'aggiornamento del record vero.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { hasPermission, ROLE_NAMES, type Grant, type Role } from "@/lib/platform/permissions";
import { PIPELINE_LABELS } from "@/lib/platform/pipeline";

type Profile = { id: string; name: string; roles: Role[]; grants: Grant[]; staff: boolean };
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/platform/${path}`, { method, credentials: "same-origin", cache: "no-store", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error([result.errore ?? "Operazione non riuscita.", ...Object.values(result.fields ?? {})].filter(Boolean).join(" "));
  return result as T;
}
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    setError("");
    api<T>(path).then((r) => active && setData(r)).catch((e: Error) => active && setError(e.message));
    return () => { active = false; };
  }, [path, tick]);
  return { data, error, reload: useCallback(() => setTick((t) => t + 1), []) };
}
export function useRun(after?: () => void) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const run = async (work: () => Promise<unknown>, ok = "Fatto.") => {
    setBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(ok); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); }
  };
  const feedback = (<>{error ? <p className="platform-error" role="alert">{error}</p> : null}{message ? <p className="platform-notice" role="status">{message}</p> : null}</>);
  return { run, busy, feedback };
}
const day = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "senza data");
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const euro = (n: number | null | undefined) => (n == null ? "—" : `€ ${n.toLocaleString("it-IT")}`);
const cents = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n / 100);
const SOURCE: Record<string, string> = { form: "modulo del sito", campaign: "campagna", social: "social", manual: "inserimento del team", seller: "portato da un venditore", marketplace: "marketplace", partner: "partner", api: "integrazione API", preventivo: "preventivo dal sito", contatto: "modulo contatti", agenzie: "agenzie", import: "importazione", analisi: "analisi del manoscritto" };
const stageName = (k: string) => (PIPELINE_LABELS as Record<string, string>)[k] ?? k;
const sourceName = (k: string | null | undefined) => (k ? SOURCE[k] ?? k : "sconosciuta");
const OPS_NAME: Record<string, string> = { waiting_materials: "in attesa dei materiali", ready_for_assignment: "pronto per l'assegnazione", assigned: "assegnato", in_progress: "in lavorazione", quality_check: "controllo qualità", client_review: "revisione del cliente", concluded: "concluso" };
const PRIORITY: Record<string, string> = { low: "bassa", normal: "normale", high: "alta", urgent: "urgente" };
const TYPE: Record<string, string> = { lead: "Contatto", deal: "Trattativa", task: "Compito", project: "Progetto", approval: "Eccezione", question: "Domanda", support: "Assistenza" };
const TASK_STATUS: Record<string, string> = { todo: "Da fare", in_progress: "In corso", blocked: "Bloccato", done: "Fatto" };
const MISSING: Record<string, string> = { materials: "Materiali del cliente", billing_profile: "Dati di fatturazione", client_phone: "Telefono del cliente", contractual_due_date: "Data contrattuale" };
export function Tag({ children, tone }: { children: ReactNode; tone?: "warn" | "ok" }) {
  return <span className={`crm-tag${tone ? ` crm-tag-${tone}` : ""}`}>{children}</span>;
}
export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="platform-card"><div className="crm-card-head"><h2>{title}</h2>{action}</div>{children}</section>;
}
const go = (href: string) => href as Route;

// ── Il mio lavoro ───────────────────────────────────────────────────────────
type WorkItem = { type: string; id: string; title: string; dueAt: string | null; priority: string; status: string; column: string; href: string; movable: boolean; overdue: boolean };
type WorkData = { items: WorkItem[]; columns: { deal: Array<{ key: string; label: string; manual: boolean }>; task: string[]; project: Array<{ key: string; label: string }> } };
export function WorkView() {
  const [view, setView] = useState<"list" | "kanban" | "calendar">("list");
  const list = useLoad<WorkData>("crm/work");
  const calendar = useLoad<{ days: Record<string, WorkItem[]>; undated: number }>(view === "calendar" ? "crm/work?view=calendar" : null);
  const summary = useLoad<{ summary: Record<string, number> }>("crm/work/summary");
  const { run, busy, feedback } = useRun(() => { list.reload(); summary.reload(); });
  const s = summary.data?.summary;
  const move = (item: WorkItem, to: string) => run(() => api(`crm/work/${item.type}/${item.id}`, "PATCH", { to }), "Stato aggiornato nel record.");
  const options = (item: WorkItem) => (item.type === "deal" ? (list.data?.columns.deal ?? []).filter((c) => c.manual).map((c) => ({ key: c.key, label: c.label })) : item.type === "task" ? (list.data?.columns.task ?? []).map((k) => ({ key: k, label: TASK_STATUS[k] ?? k })) : item.type === "project" ? list.data?.columns.project ?? [] : []);
  return (
    <>
      {s ? <div className="platform-metrics crm-summary"><p><strong>{s.overdue}</strong> in ritardo</p><p><strong>{s.dueToday}</strong> in scadenza oggi</p><p><strong>{s.firstContacts}</strong> primi contatti</p><p><strong>{s.newLeads}</strong> nuovi contatti da ieri</p><p><strong>{s.newOrders}</strong> nuovi incassi</p><p><strong>{s.waiting}</strong> in attesa di te</p></div> : null}
      <div className="crm-toolbar" role="group" aria-label="Vista">
        {(["list", "kanban", "calendar"] as const).map((v) => <button key={v} className={view === v ? "platform-button" : "platform-text-button"} aria-pressed={view === v} onClick={() => setView(v)}>{v === "list" ? "Elenco" : v === "kanban" ? "Kanban" : "Calendario"}</button>)}
      </div>
      {feedback}
      {list.error ? <p className="platform-error">{list.error}</p> : null}
      {view === "list" ? (
        <Card title="Le tue prossime cose">
          {list.data?.items.length ? list.data.items.map((i) => (
            <div className="platform-row" key={`${i.type}-${i.id}`}>
              <div><Tag>{TYPE[i.type] ?? i.type}</Tag> <Link href={go(i.href)}>{i.title}</Link><small>{i.dueAt ? `Scadenza ${when(i.dueAt)}` : "Senza scadenza"} · priorità {PRIORITY[i.priority] ?? i.priority}</small></div>
              {i.overdue ? <Tag tone="warn">In ritardo</Tag> : null}
            </div>
          )) : <p className="platform-empty">Niente in sospeso.</p>}
        </Card>
      ) : null}
      {view === "kanban" ? (
        <div className="crm-board">
          {(["deal", "task", "project"] as const).map((type) => {
            const items = list.data?.items.filter((i) => i.type === type) ?? [];
            if (!items.length) return null;
            const columns = type === "deal" ? (list.data?.columns.deal ?? []).map((c) => ({ key: c.key, label: c.label })) : type === "task" ? (list.data?.columns.task ?? []).map((k) => ({ key: k, label: TASK_STATUS[k] ?? k })) : list.data?.columns.project ?? [];
            return columns.filter((c) => items.some((i) => i.column === c.key)).map((c) => (
              <section className="crm-column" key={`${type}-${c.key}`} aria-label={`${TYPE[type]}: ${c.label}`}>
                <h3>{TYPE[type]} · {c.label}</h3>
                {items.filter((i) => i.column === c.key).map((i) => (
                  <article className="crm-card" key={i.id}>
                    <Link href={go(i.href)}>{i.title}</Link>
                    <small>{day(i.dueAt)} · {PRIORITY[i.priority]}</small>
                    {i.movable ? <label>Sposta in<select disabled={busy} value="" onChange={(e) => e.target.value && move(i, e.target.value)}><option value="">—</option>{options(i).filter((o) => o.key !== i.column).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label> : null}
                  </article>
                ))}
              </section>
            ));
          })}
        </div>
      ) : null}
      {view === "calendar" ? (
        <Card title="Calendario">
          {calendar.data ? Object.entries(calendar.data.days).sort(([a], [b]) => a.localeCompare(b)).map(([d, items]) => (
            <div key={d} className="crm-day"><h3>{new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</h3>{items.map((i) => <p key={i.id}><Tag>{TYPE[i.type]}</Tag> <Link href={go(i.href)}>{i.title}</Link> <small>{when(i.dueAt)}</small></p>)}</div>
          )) : <p role="status">Caricamento…</p>}
          {calendar.data?.undated ? <p className="platform-empty">{calendar.data.undated} attività senza data restano nell’elenco.</p> : null}
        </Card>
      ) : null}
      <Card title="Nuova attività personale">
        <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const dueAt = String(f.get("dueAt") ?? ""); run(() => api("crm/work", "POST", { title: String(f.get("title")), priority: String(f.get("priority")), ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}) }), "Attività aggiunta."); e.currentTarget.reset(); }}>
          <label>Cosa<input name="title" required minLength={2} maxLength={200} /></label>
          <label>Quando<input name="dueAt" type="datetime-local" /></label>
          <label>Priorità<select name="priority" defaultValue="normal">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <button className="platform-button" disabled={busy}>Aggiungi</button>
        </form>
      </Card>
    </>
  );
}

// ── Trattative ──────────────────────────────────────────────────────────────
type Deal = { id: string; title: string; contact: string; owner: string | null; ownerId: string | null; stage: string; status: string; nextAction: string | null; nextActionAt: string | null; overdue: boolean; amount: number | null; priority: string };
type Pipeline = { key: string; name: string; stages: Array<{ key: string; label: string; kind: string; manual: boolean }> };
export function DealsView({ user }: { user: Profile }) {
  const [filters, setFilters] = useState<Record<string, string>>({ owner: hasPermission(user.grants, "crm.assign") ? "" : "me", status: "open" });
  const [layout, setLayout] = useState<"table" | "kanban">("table");
  const [selected, setSelected] = useState<string | null>(null);
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const deals = useLoad<{ deals: Deal[]; pipeline: Pipeline }>(`crm/deals?${query}`);
  const views = useLoad<{ views: Array<{ id: string; name: string; filters: Record<string, string>; layout: string; entity: string }> }>("crm/views");
  const { run, busy, feedback } = useRun(() => { deals.reload(); views.reload(); });
  useEffect(() => { const id = new URLSearchParams(location.search).get("deal"); if (id) setSelected(id); }, []);
  if (selected) return <><button className="platform-text-button" onClick={() => { setSelected(null); deals.reload(); }}>← Torna alle trattative</button><DealDetail id={selected} user={user} /></>;
  const stageLabel = (k: string) => deals.data?.pipeline.stages.find((s) => s.key === k)?.label ?? k;
  return (
    <>
      <div className="crm-toolbar">
        <label>Cerca<input value={filters.q ?? ""} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Titolo o cliente" /></label>
        <label>Responsabile<select value={filters.owner ?? ""} onChange={(e) => setFilters({ ...filters, owner: e.target.value })}><option value="">Tutti quelli che vedo</option><option value="me">Le mie</option>{hasPermission(user.grants, "crm.assign") ? <option value="none">Senza responsabile</option> : null}</select></label>
        <label>Stato<select value={filters.status ?? "open"} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="open">Aperte</option><option value="won">Vinte</option><option value="lost">Perse</option><option value="all">Tutte</option></select></label>
        <label className="platform-check"><input type="checkbox" checked={filters.overdue === "1"} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked ? "1" : "" })} />In ritardo</label>
        <label className="platform-check"><input type="checkbox" checked={filters.noNext === "1"} onChange={(e) => setFilters({ ...filters, noNext: e.target.checked ? "1" : "" })} />Senza prossima azione</label>
        <button className={layout === "table" ? "platform-button" : "platform-text-button"} aria-pressed={layout === "table"} onClick={() => setLayout("table")}>Tabella</button>
        <button className={layout === "kanban" ? "platform-button" : "platform-text-button"} aria-pressed={layout === "kanban"} onClick={() => setLayout("kanban")}>Kanban</button>
      </div>
      <div className="crm-toolbar">
        {views.data?.views.filter((v) => v.entity === "deals").map((v) => <span key={v.id}><button className="platform-text-button" onClick={() => { setFilters(v.filters); setLayout(v.layout === "kanban" ? "kanban" : "table"); }}>{v.name}</button> <button className="platform-text-button" aria-label={`Elimina la vista ${v.name}`} onClick={() => run(() => api(`crm/views/${v.id}`, "DELETE"), "Vista eliminata.")}>×</button></span>)}
        <button className="platform-text-button" disabled={busy} onClick={() => { const name = prompt("Nome della vista"); if (name) run(() => api("crm/views", "POST", { entity: "deals", name, filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), layout }), "Vista salvata."); }}>Salva questa vista</button>
      </div>
      {feedback}
      {deals.error ? <p className="platform-error">{deals.error}</p> : null}
      {layout === "table" ? (
        <Card title={`${deals.data?.deals.length ?? 0} trattative`}>
          {deals.data?.deals.map((d) => (
            <button className="platform-row" key={d.id} onClick={() => setSelected(d.id)}>
              <span><strong>{d.title}</strong><small>{d.contact} · {stageLabel(d.stage)} · {d.owner ?? "senza responsabile"}</small></span>
              <span><small>{d.nextAction ?? "Prossima azione mancante"} · {day(d.nextActionAt)}</small>{d.overdue ? <Tag tone="warn">In ritardo</Tag> : null} <small>{euro(d.amount)}</small></span>
            </button>
          )) ?? <p role="status">Caricamento…</p>}
        </Card>
      ) : (
        <div className="crm-board">
          {deals.data?.pipeline.stages.filter((s) => filters.status === "all" || (filters.status === "open" ? s.kind === "open" : s.kind === filters.status)).map((s) => (
            <section className="crm-column" key={s.key} aria-label={s.label}>
              <h3>{s.label} <small>{deals.data!.deals.filter((d) => d.stage === s.key).length}</small></h3>
              {deals.data!.deals.filter((d) => d.stage === s.key).map((d) => (
                <article className="crm-card" key={d.id}>
                  <button className="platform-text-button" onClick={() => setSelected(d.id)}>{d.title}</button>
                  <small>{d.contact} · {d.nextAction ?? "—"} · {day(d.nextActionAt)}</small>
                  {d.status === "open" ? <label>Sposta in<select disabled={busy} value="" onChange={(e) => e.target.value && run(() => api(`crm/work/deal/${d.id}`, "PATCH", { to: e.target.value }), "Fase aggiornata.")}><option value="">—</option>{deals.data!.pipeline.stages.filter((x) => x.manual && x.kind === "open" && x.key !== d.stage).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label> : null}
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
      <NewDeal onDone={deals.reload} user={user} />
    </>
  );
}
function NewDeal({ onDone, user }: { onDone: () => void; user: Profile }) {
  const { run, busy, feedback } = useRun(onDone);
  if (!hasPermission(user.grants, "crm.write")) return null;
  return (
    <Card title="Nuova trattativa">
      <p>Per un cliente portato da te. Se la persona è già seguita da un collega, la richiesta passa a chi gestisce l’assegnazione.</p>
      {feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api("crm/deals", "POST", { contact: { name: String(f.get("name")), email: String(f.get("email")), ...(f.get("phone") ? { phone: String(f.get("phone")) } : {}) }, title: String(f.get("title")), nextAction: String(f.get("nextAction")), nextActionAt: new Date(String(f.get("nextActionAt"))).toISOString() }), "Trattativa aperta."); }}>
        <label>Nome del cliente<input name="name" required minLength={2} /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Telefono (facoltativo)<input name="phone" /></label>
        <label>Titolo della trattativa<input name="title" required minLength={2} /></label>
        <label>Prossima azione<input name="nextAction" required minLength={3} /></label>
        <label>Entro<input name="nextActionAt" type="datetime-local" required /></label>
        <button className="platform-button" disabled={busy}>Apri la trattativa</button>
      </form>
    </Card>
  );
}
type DealDetailData = { deal: Deal & { pipelineKey: string; lostReasonKey: string | null; owner: { name: string } | null; custom: Record<string, unknown> }; contact: { id: string; name: string; email: string; phone: string | null } | null; quotes: Array<{ id: string; version: number; commercialState: string; acceptedAt: string | null; total: number | null; paid: boolean }>; activities: Array<{ id: string; kind: string; body: string | null; createdAt: string; name: string | null }>; assignments: Array<{ at: string; to: string | null; method: string; reason: string }>; attributions: Array<{ quoteId: string; version: number; current: boolean; path: string; status: string; closing: string; creditedSellerId: string | null; reasons: Array<{ detail: string }> }>; pipeline: Pipeline; lossReasons: Array<{ key: string; label: string }> };
function DealDetail({ id, user }: { id: string; user: Profile }) {
  const detail = useLoad<DealDetailData>(`crm/deals/${id}`);
  const { run, busy, feedback } = useRun(detail.reload);
  const [link, setLink] = useState("");
  const d = detail.data;
  if (detail.error) return <p className="platform-error">{detail.error}</p>;
  if (!d) return <p role="status">Caricamento…</p>;
  const open = d.deal.status === "open";
  const submit = (e: FormEvent<HTMLFormElement>, build: (f: FormData) => unknown, ok: string) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api(`crm/deals/${id}`, "PATCH", build(f)), ok); };
  return (
    <>
      <Card title={d.deal.title}>
        <p>{d.contact?.name} · {d.contact?.email}{d.contact?.phone ? ` · ${d.contact.phone}` : ""}</p>
        <p><Tag>{d.pipeline.stages.find((s) => s.key === d.deal.stage)?.label ?? d.deal.stage}</Tag> Responsabile: {d.deal.owner?.name ?? "nessuno"}</p>
        {d.contact ? <Link href={go(`/spazio?tab=contacts&contact=${d.contact.id}`)}>Apri la scheda del cliente →</Link> : null}
      </Card>
      {feedback}
      {open ? (
        <Card title="Prossima azione">
          <form className="platform-inline" onSubmit={(e) => submit(e, (f) => ({ nextAction: String(f.get("nextAction")), nextActionAt: new Date(String(f.get("nextActionAt"))).toISOString() }), "Prossima azione salvata.")}>
            <label>Cosa<input name="nextAction" required minLength={3} defaultValue={d.deal.nextAction ?? ""} /></label>
            <label>Entro<input name="nextActionAt" type="datetime-local" required defaultValue={d.deal.nextActionAt ? new Date(d.deal.nextActionAt).toISOString().slice(0, 16) : ""} /></label>
            <button className="platform-button" disabled={busy}>Salva</button>
          </form>
          <details><summary>Segna come persa</summary>
            <form className="platform-form" onSubmit={(e) => submit(e, (f) => ({ stage: d.pipeline.stages.find((s) => s.kind === "lost")!.key, lostReasonKey: String(f.get("reason")), ...(f.get("note") ? { lostNote: String(f.get("note")) } : {}) }), "Trattativa chiusa.")}>
              <label>Motivo<select name="reason" required>{d.lossReasons.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
              <label>Nota<textarea name="note" maxLength={1000} /></label>
              <button className="platform-button" disabled={busy}>Chiudi come persa</button>
            </form>
          </details>
        </Card>
      ) : null}
      {open && hasPermission(user.grants, "quote.send") ? (
        <Card title="Link a un pacchetto standard">
          <p>Il link porta al pacchetto del catalogo, senza dati personali. Per comprare il cliente accede con la sua email verificata.</p>
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(async () => { const r = await api<{ url: string }>(`crm/deals/${id}/package-link`, "POST", { catalogKey: String(f.get("key")), validityDays: Number(f.get("days")) }); setLink(r.url); }, "Link creato: copialo e mandalo al cliente."); }}>
            <label>Pacchetto<select name="key">{[["cover", "Copertina"], ["epub", "Ebook ePub"], ["kdp", "Pubblicazione Amazon KDP"], ["isbn", "Codice ISBN"], ["amazonListing", "Scheda prodotto Amazon"]].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Validità (giorni)<input name="days" type="number" min={1} max={90} defaultValue={14} /></label>
            <button className="platform-button" disabled={busy}>Crea link</button>
          </form>
          {link ? <p><input readOnly value={link} aria-label="Link da copiare" onFocus={(e) => e.currentTarget.select()} /></p> : null}
        </Card>
      ) : null}
      <Card title="Proposte">
        {d.quotes.length ? d.quotes.map((q) => <p key={q.id}><Link href={go(`/spazio?preventivo=${q.id}`)}>Versione {q.version} · {euro(q.total)}</Link> · {q.paid ? "incassata" : q.acceptedAt ? "accettata" : q.commercialState}</p>) : <p className="platform-empty">Nessuna proposta.</p>}
      </Card>
      {d.attributions.length ? (
        <Card title="Attribuzione alla vendita">
          {d.attributions.map((a) => <div key={`${a.quoteId}-${a.version}`} className="platform-row"><span><strong>v{a.version}{a.current ? " (in vigore)" : ""}</strong> · {a.path} · {a.closing === "assisted" ? "vendita assistita" : "acquisto autonomo"}<small>{a.reasons.map((r) => r.detail).join(" ")}</small></span>{a.status === "conflict" ? <Tag tone="warn">Da decidere</Tag> : <Tag tone="ok">Definita</Tag>}</div>)}
        </Card>
      ) : null}
      <Card title="Storia">
        {d.assignments.map((a, i) => <p key={i}><small>{when(a.at)}</small> Assegnata a {a.to ?? "coda"} · {a.method} · {a.reason}</p>)}
        {d.activities.map((a) => <p key={a.id}><small>{when(a.createdAt)} · {a.name ?? "sistema"}</small> {a.kind}: {a.body}</p>)}
      </Card>
    </>
  );
}

// ── Contatti ───────────────────────────────────────────────────────────────
type ContactRow = { id: string; name: string; email: string; phone: string | null; company: string | null; openDeals: number; owners: string[]; verified: boolean };
type ContactDetailData = { contact: ContactRow & { language: string }; summary: { requests: number; openDeals: number; paidCents: number; projects: number; firstSource: { kind: string } | null; lastSource: { kind: string } | null }; related: { deals: Array<{ id: string; title: string; owner: string | null; stage: string; status: string }>; projects: Array<{ id: string; title: string; opsStatus: string }> }; duplicates: Array<{ a: string; b: string; bName: string; reasons: string[]; mergeable: boolean }>; timeline: Array<{ at: string; kind: string; title: string; detail?: string | null; href?: string | null; actor?: string | null }> };
export function ContactsView({ user }: { user: Profile }) {
  const [q, setQ] = useState(""), [selected, setSelected] = useState<string | null>(null);
  const list = useLoad<{ contacts: ContactRow[] }>(`crm/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  useEffect(() => { const id = new URLSearchParams(location.search).get("contact"); if (id) setSelected(id); }, []);
  if (selected) return <><button className="platform-text-button" onClick={() => setSelected(null)}>← Torna ai contatti</button><ContactDetail id={selected} user={user} /></>;
  return (
    <>
      <div className="crm-toolbar"><label>Cerca<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, email o telefono" /></label></div>
      {list.error ? <p className="platform-error">{list.error}</p> : null}
      <Card title="Clienti e contatti">
        {list.data?.contacts.map((c) => (
          <button className="platform-row" key={c.id} onClick={() => setSelected(c.id)}>
            <span><strong>{c.name}</strong><small>{c.email}{c.company ? ` · ${c.company}` : ""}</small></span>
            <span><small>{c.openDeals} trattative aperte{c.owners.length ? ` · ${c.owners.join(", ")}` : ""}</small>{c.verified ? <Tag tone="ok">Account verificato</Tag> : null}</span>
          </button>
        )) ?? <p role="status">Caricamento…</p>}
      </Card>
    </>
  );
}
function ContactDetail({ id, user }: { id: string; user: Profile }) {
  const detail = useLoad<ContactDetailData>(`crm/contacts/${id}`);
  const { run, busy, feedback } = useRun(detail.reload);
  const d = detail.data;
  if (detail.error) return <p className="platform-error">{detail.error}</p>;
  if (!d) return <p role="status">Caricamento…</p>;
  return (
    <>
      <Card title={d.contact.name}>
        <p>{d.contact.email}{d.contact.phone ? ` · ${d.contact.phone}` : ""} · lingua {d.contact.language}</p>
        <div className="platform-metrics crm-summary"><p><strong>{d.summary.requests}</strong> richieste</p><p><strong>{d.summary.openDeals}</strong> trattative aperte</p><p><strong>{cents(d.summary.paidCents)}</strong> incassati</p><p><strong>{d.summary.projects}</strong> progetti</p></div>
        <p>Prima origine: {sourceName(d.summary.firstSource?.kind)} · ultima: {sourceName(d.summary.lastSource?.kind)}</p>
      </Card>
      {feedback}
      {d.duplicates.length ? (
        <Card title="Possibili doppioni">
          {d.duplicates.map((x) => (
            <div className="platform-row" key={x.b}>
              <span>{x.bName}<small>In comune: {x.reasons.map((r) => (r === "name_only" ? "solo il nome (non si uniscono)" : r)).join(", ")}</small></span>
              {x.mergeable && hasPermission(user.grants, "crm.merge") ? <button className="platform-button" disabled={busy} onClick={() => { const reason = prompt("Perché sono la stessa persona? (resta nella storia)"); if (reason) run(() => api(`crm/contacts/${id}/merge`, "POST", { sourceId: x.b, reason }), "Schede unite: collegamenti e storia conservati."); }}>Unisci qui</button> : null}
            </div>
          ))}
        </Card>
      ) : null}
      <Card title="Trattative e progetti">
        {d.related.deals.map((x) => <p key={x.id}><Link href={go(`/spazio?tab=deals&deal=${x.id}`)}>{x.title}</Link> · {stageName(x.stage)} · {x.owner ?? "senza responsabile"}</p>)}
        {d.related.projects.map((x) => <p key={x.id}><Link href={go(`/spazio?progetto=${x.id}`)}>{x.title}</Link> · {OPS_NAME[x.opsStatus] ?? x.opsStatus}</p>)}
      </Card>
      <Card title="Cronologia">
        <ol className="crm-timeline">
          {d.timeline.map((t, i) => <li key={i} className={`crm-t-${t.kind}`}><small>{when(t.at)}{t.actor ? ` · ${t.actor}` : ""}</small> {t.href ? <Link href={go(t.href)}>{t.title}</Link> : t.title}{t.detail && t.kind !== "origin" ? <p>{t.detail}</p> : null}</li>)}
        </ol>
      </Card>
    </>
  );
}

// ── Coda libera e approvazioni ──────────────────────────────────────────────
export function PoolView() {
  const pool = useLoad<{ items: Array<{ id: string; firstName: string; source: string; service: string | null; words: string | null; priority: string; language: string; createdAt: string; slaDueAt: string | null }>; reserved: number; rules: { maxReservations: number; reservationMinutes: number } }>("crm/pool");
  const { run, busy, feedback } = useRun(pool.reload);
  return (
    <Card title="Richieste da prendere in carico">
      <p>Prima della presa in carico vedi solo i dati minimi. Puoi tenere {pool.data?.rules.maxReservations ?? "—"} richieste prenotate alla volta; senza una prima risposta entro {pool.data?.rules.reservationMinutes ?? "—"} minuti tornano in coda.</p>
      {feedback}
      {pool.data?.items.length ? pool.data.items.map((i) => (
        <div className="platform-row" key={i.id}>
          <span><strong>{i.firstName}</strong><small>{sourceName(i.source)} · {i.service ?? "servizio da definire"}{i.words ? ` · ${i.words} parole` : ""} · {i.language} · priorità {PRIORITY[i.priority]} · risposta entro {when(i.slaDueAt)}</small></span>
          <button className="platform-button" disabled={busy} onClick={() => run(() => api(`crm/pool/${i.id}/claim`, "POST", {}), "Presa in carico: rispondi per confermarla.")}>Prendo io</button>
        </div>
      )) : <p className="platform-empty">La coda è vuota.</p>}
    </Card>
  );
}
export function ApprovalsView() {
  const list = useLoad<{ approvals: Array<{ id: string; kind: string; quoteId: string | null; payload: Record<string, unknown>; status: string; createdAt: string }>; canDecide: boolean }>("crm/approvals");
  const { run, busy, feedback } = useRun(list.reload);
  return (
    <Card title="Eccezioni">
      {feedback}
      {list.data?.approvals.length ? list.data.approvals.map((a) => (
        <div className="platform-row" key={a.id}>
          <span><strong>{a.kind === "discount" ? `Sconto ${Number(a.payload.discountBps) / 100}%` : a.kind === "custom_line" ? `Voce «${String(a.payload.label)}» € ${Number(a.payload.amount) * Number(a.payload.quantity ?? 1)}` : a.kind}</strong><small>{when(a.createdAt)}{a.quoteId ? <> · <Link href={go(`/spazio?preventivo=${a.quoteId}`)}>proposta</Link></> : null}</small></span>
          {a.status === "pending" && list.data!.canDecide ? <span><button className="platform-button" disabled={busy} onClick={() => run(() => api(`crm/approvals/${a.id}`, "POST", { decision: "approved" }), "Approvata: nuova versione della proposta.")}>Approva</button> <button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`crm/approvals/${a.id}`, "POST", { decision: "rejected" }), "Respinta.")}>Respingi</button></span> : <Tag>{a.status}</Tag>}
        </div>
      )) : <p className="platform-empty">Nessuna eccezione.</p>}
    </Card>
  );
}

// ── Persone, profili e carichi ──────────────────────────────────────────────
type Person = { id: string; name: string; email?: string; roles: Array<{ role: Role; active: boolean }>; active: boolean; profile: { team: string | null; skills: string[]; languages: string[]; capacity: number | null; participates: boolean; maxDiscountBps: number | null; absences: Array<{ from: string; to: string; reason?: string | null }>; external: boolean } | null; load: { openDeals: number; openTasks: number }; now: { inHours: boolean; absent: boolean }; gaps: string[]; assignment: { eligible: boolean; why: string; load?: number; capacity?: number } };
type Invitation = { id: string; email: string; role: Role; template: string | null; status: "pending" | "expired" | "accepted" | "revoked"; expiresAt: string; createdAt: string; mail: { status: string; error: string | null } | null };
const INVITE: Record<Invitation["status"], [string, "ok" | "warn" | undefined]> = { pending: ["In attesa", undefined], expired: ["Scaduto", "warn"], accepted: ["Accettato", "ok"], revoked: ["Revocato", undefined] };
const MAIL: Record<string, string> = { pending: "email in coda", retry: "invio da ritentare", accepted: "email consegnata al servizio", failed: "invio non riuscito", sent: "email inviata" };
export function PeopleView({ user }: { user: Profile }) {
  const people = useLoad<{ people: Person[]; templates: Array<{ key: string; label: string }>; invitations: Invitation[] }>("crm/team");
  const { run, busy, feedback } = useRun(people.reload);
  const [edit, setEdit] = useState<string | null>(null);
  const manage = hasPermission(user.grants, "role.manage");
  const csv = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return (
    <>
      {feedback}
      {hasPermission(user.grants, "invite.manage") ? (
        <Card title="Aggiungi una persona">
          <p>Scegli il modello: i permessi vengono dal ruolo e non possono superare i tuoi. Servono solo i dati qui sotto.</p>
          <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const profile: Record<string, unknown> = {}; if (csv(f.get("languages")).length) profile.languages = csv(f.get("languages")); if (csv(f.get("skills")).length) profile.skills = csv(f.get("skills")); if (f.get("capacity")) profile.capacity = Number(f.get("capacity")); run(() => api("crm/team/invite", "POST", { template: String(f.get("template")), email: String(f.get("email")), profile }), "Invito inviato: scade tra 48 ore."); }}>
            <label>Ruolo<select name="template">{people.data?.templates.map((t) => <option key={t.key} value={t.key}>{t.key === "seller" ? "Aggiungi venditore" : t.label}</option>)}</select></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>Lingue (separate da virgola)<input name="languages" placeholder="it, en" /></label>
            <label>Competenze o servizi<input name="skills" placeholder="editing, cover" /></label>
            <label>Capacità (trattative o fasi aperte)<input name="capacity" type="number" min={0} max={1000} /></label>
            <button className="platform-button" disabled={busy}>Invia invito</button>
          </form>
        </Card>
      ) : null}
      {people.data?.invitations.length ? (
        <Card title="Inviti">
          <p>Un invito vale 48 ore e si accetta solo con l&apos;email verificata e la verifica in due passaggi. Per le prove usa solo indirizzi di test.</p>
          {people.data.invitations.map((i) => (
            <div className="platform-row" key={i.id}>
              <span><strong>{i.email}</strong><small>{i.template ?? ROLE_NAMES[i.role]} · inviato {when(i.createdAt)} · scade {when(i.expiresAt)}{i.mail ? ` · ${MAIL[i.mail.status] ?? i.mail.status}` : ""}</small>{i.mail?.error ? <small className="platform-error">Errore di invio: {i.mail.error}</small> : null}</span>
              <Tag tone={INVITE[i.status][1]}>{INVITE[i.status][0]}</Tag>
              {i.status === "pending" ? <button className="platform-text-button" disabled={busy} onClick={() => { if (confirm(`Revocare l'invito a ${i.email}?`)) run(() => api(`invitations/${i.id}`, "DELETE"), "Invito revocato."); }}>Revoca</button> : null}
            </div>
          ))}
        </Card>
      ) : null}
      <Card title="Team, disponibilità e carico">
        <p>La disponibilità viene da orari e assenze dichiarati, non dalla presenza online.</p>
        {people.data?.people.map((p) => (
          <div key={p.id} className="crm-person">
            <div className="platform-row">
              <span><strong>{p.name}</strong><small>{p.roles.map((r) => `${ROLE_NAMES[r.role]}${r.active ? "" : " (disattivato)"}`).join(" · ")}{p.profile?.team ? ` · ${p.profile.team}` : ""}{p.profile?.external ? " · esterno" : ""}</small><small>Competenze: {p.profile?.skills.join(", ") || "—"} · lingue: {p.profile?.languages.join(", ") || "it"} · capacità {p.profile?.capacity ?? "predefinita"}</small></span>
              <span><small>{p.load.openDeals} trattative · {p.load.openTasks} compiti</small> {!p.active ? <Tag>Disattivato</Tag> : p.now.absent ? <Tag tone="warn">Assente</Tag> : p.now.inHours ? <Tag tone="ok">In orario</Tag> : <Tag>Fuori orario</Tag>} {p.profile?.participates === false ? <Tag>Non riceve contatti</Tag> : null} {p.gaps.length ? <Tag tone="warn">Profilo incompleto: {p.gaps.join(", ")}</Tag> : null}<small>Assegnazione: {p.assignment.eligible ? "idoneo" : "escluso"} · {p.assignment.why}{p.assignment.capacity != null ? ` · carico ${p.assignment.load}/${p.assignment.capacity}` : ""}</small></span>
              {manage || p.id === user.id ? <button className="platform-text-button" onClick={() => setEdit(edit === p.id ? null : p.id)}>{edit === p.id ? "Chiudi" : "Modifica"}</button> : null}
            </div>
            {edit === p.id ? (
              <div className="crm-person-edit">
                <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body: Record<string, unknown> = { languages: csv(f.get("languages")).length ? csv(f.get("languages")) : ["it"] }; if (f.get("absenceFrom") && f.get("absenceTo")) body.absences = [...(p.profile?.absences ?? []), { from: new Date(String(f.get("absenceFrom"))).toISOString(), to: new Date(String(f.get("absenceTo"))).toISOString(), reason: String(f.get("absenceReason") ?? "") || null }]; if (manage) { body.team = String(f.get("team") ?? "") || null; body.skills = csv(f.get("skills")); body.capacity = f.get("capacity") ? Number(f.get("capacity")) : null; body.participates = f.get("participates") === "on"; body.maxDiscountBps = f.get("discount") ? Math.round(Number(f.get("discount")) * 100) : null; } run(() => api(`crm/team/${p.id}/profile`, "PUT", body), "Profilo aggiornato."); }}>
                  <label>Lingue<input name="languages" defaultValue={p.profile?.languages.join(", ") ?? "it"} /></label>
                  {manage ? <>
                    <label>Team<input name="team" defaultValue={p.profile?.team ?? ""} /></label>
                    <label>Competenze<input name="skills" defaultValue={p.profile?.skills.join(", ") ?? ""} /></label>
                    <label>Capacità<input name="capacity" type="number" min={0} defaultValue={p.profile?.capacity ?? ""} /></label>
                    <label>Sconto massimo personale (%)<input name="discount" type="number" min={0} max={50} step="0.5" defaultValue={p.profile?.maxDiscountBps != null ? p.profile.maxDiscountBps / 100 : ""} /></label>
                    <label className="platform-check"><input type="checkbox" name="participates" defaultChecked={p.profile?.participates ?? p.roles.some((r) => r.role === "seller")} />Riceve contatti in assegnazione</label>
                  </> : null}
                  <fieldset><legend>Nuova assenza</legend><label>Dal<input name="absenceFrom" type="datetime-local" /></label><label>Al<input name="absenceTo" type="datetime-local" /></label><label>Motivo<input name="absenceReason" maxLength={200} /></label></fieldset>
                  <button className="platform-button" disabled={busy}>Salva profilo</button>
                </form>
                {manage && p.id !== user.id && p.active ? (
                  <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (!confirm(`Disattivare ${p.name}? Gli accessi si chiudono subito; la storia resta.`)) return; run(() => api(`crm/team/${p.id}/deactivate`, "POST", { reason: String(f.get("reason")), reassignTo: String(f.get("to") ?? "") || null }), "Persona disattivata, lavoro riassegnato."); }}>
                    <label>Motivo<input name="reason" required minLength={3} /></label>
                    <label>Passa il lavoro a<select name="to"><option value="">Rimetti in coda</option>{people.data!.people.filter((x) => x.active && x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    <button className="platform-button" disabled={busy}>Disattiva</button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </Card>
    </>
  );
}

// ── Integrazioni e report ───────────────────────────────────────────────────
export function IntegrationKeys() {
  const keys = useLoad<{ keys: Array<{ id: string; name: string; kind: string; prefix: string; scopes: string[]; allowedOrigins: string[]; lastUsedAt: string | null; revokedAt: string | null }> }>("crm/api-keys");
  const hooks = useLoad<{ endpoints: Array<{ id: string; url: string; events: string[]; active: boolean }>; events: string[] }>("crm/webhooks");
  const [secret, setSecret] = useState("");
  const { run, busy, feedback } = useRun(() => { keys.reload(); hooks.reload(); });
  return (
    <Card title="API e webhook">
      <p>Le chiavi si vedono una volta sola e restano sul server come impronta. Una chiave «modulo» va nel sito e può solo acquisire richieste dalle origini indicate; le chiavi server non vanno mai nel frontend.</p>
      {feedback}
      {secret ? <p><input readOnly value={secret} aria-label="Segreto da copiare" onFocus={(e) => e.currentTarget.select()} /></p> : null}
      {keys.data?.keys.map((k) => <div className="platform-row" key={k.id}><span><strong>{k.name}</strong><small>{k.kind} · {k.prefix} · {k.scopes.join(", ")}{k.allowedOrigins.length ? ` · ${k.allowedOrigins.join(", ")}` : ""} · ultimo uso {when(k.lastUsedAt)}</small></span>{k.revokedAt ? <Tag>Revocata</Tag> : <button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`crm/api-keys/${k.id}`, "DELETE"), "Chiave revocata.")}>Revoca</button>}</div>)}
      <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const kind = String(f.get("kind")); run(async () => { const r = await api<{ key: string }>("crm/api-keys", "POST", { name: String(f.get("name")), kind, ...(kind === "form" ? { allowedOrigins: [String(f.get("origin"))] } : { scopes: ["leads:write", "leads:read"] }) }); setSecret(r.key); }, "Chiave creata: copiala adesso."); }}>
        <label>Nome<input name="name" required minLength={3} /></label>
        <label>Tipo<select name="kind"><option value="server">Server (acquisizione e lettura)</option><option value="form">Modulo pubblico</option></select></label>
        <label>Origine del modulo<input name="origin" type="url" placeholder="https://sito.example" /></label>
        <button className="platform-button" disabled={busy}>Crea chiave</button>
      </form>
      {hooks.data?.endpoints.map((h) => <div className="platform-row" key={h.id}><span>{h.url}<small>{h.events.join(", ")}</small></span>{h.active ? <button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`crm/webhooks/${h.id}`, "DELETE"), "Webhook disattivato.")}>Disattiva</button> : <Tag>Disattivato</Tag>}</div>)}
      <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(async () => { const r = await api<{ secret: string }>("crm/webhooks", "POST", { url: String(f.get("url")), events: hooks.data?.events ?? [] }); setSecret(r.secret); }, "Webhook registrato: copia il segreto di firma."); }}>
        <label>Indirizzo HTTPS<input name="url" type="url" required /></label>
        <button className="platform-button" disabled={busy}>Registra webhook</button>
      </form>
      <p><a href="/api/v1/openapi.json">Descrizione dell’API (OpenAPI)</a></p>
    </Card>
  );
}
export function ReportsCard() {
  const report = useLoad<{ responseTimes: { requests: number; responded: number; medianMinutes: number | null; withinSlaShare: number | null; escalated: number; unassigned: number }; conversion: { deals: number; won: number; rate: number | null; bySource: Record<string, { leads: number; won: number; lost: number; open: number }> }; load: { sales: Array<{ name: string | null; openDeals: number; capacity: number | null }>; operations: Array<{ name: string | null; openTasks: number; capacity: number | null }> }; delays: Record<string, number>; lossReasons: Array<{ label: string; count: number }> }>("crm/reports");
  const r = report.data;
  if (!r) return null;
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  return (
    <Card title="Report (ultimi 90 giorni)">
      <div className="platform-metrics crm-summary"><p><strong>{r.responseTimes.medianMinutes ?? "—"}</strong> min alla prima risposta (mediana)</p><p><strong>{pct(r.responseTimes.withinSlaShare)}</strong> entro il tempo previsto</p><p><strong>{r.responseTimes.escalated}</strong> escalation</p><p><strong>{pct(r.conversion.rate)}</strong> trattative vinte</p></div>
      <h3>Per origine</h3>{Object.entries(r.conversion.bySource).map(([k, v]) => <p key={k}>{k}: {v.leads} richieste · {v.won} vinte · {v.lost} perse · {v.open} aperte</p>)}
      <h3>Carico</h3>{r.load.sales.map((s, i) => <p key={i}>{s.name ?? "senza responsabile"}: {s.openDeals} trattative{s.capacity ? ` su ${s.capacity}` : ""}</p>)}{r.load.operations.map((s, i) => <p key={`o${i}`}>{s.name}: {s.openTasks} compiti{s.capacity ? ` su ${s.capacity}` : ""}</p>)}
      <h3>Ritardi</h3><p>{r.delays.overdueNextActions} prossime azioni scadute · {r.delays.dealsWithoutNextAction} trattative senza prossima azione · {r.delays.overdueTasks} compiti scaduti · {r.delays.projectsPastContractualDate} progetti oltre la data contrattuale</p>
      <h3>Motivi di perdita</h3>{r.lossReasons.filter((x) => x.count).map((x) => <p key={x.label}>{x.label}: {x.count}</p>)}
      <p>Solo conteggi sui dati registrati, nessun punteggio automatico.</p>
    </Card>
  );
}

// ── Passaggio alla produzione (nel progetto) ───────────────────────────────
type Handoff = { phases: Array<{ id: string; phase: string; skill: string | null; title: string; status: string; claimable: boolean; dueAt: string | null; assignee: string | null }>; status: string; opsStatus: string; opsLabel: string; ready: boolean; conditions: Record<string, boolean>; missing: string[]; inconsistencies: Array<{ code: string; detail: string }>; package: { service: string | null; contractual: { includes: string[]; excludes: string[]; revisions: string; deadlines: string } | null; amounts: { grossCents: number; depositCents: number } | null; client?: { name: string; email: string; phone: string | null } | null; extraRequests: Array<{ id: string; body: string; status: string }>; unapprovedPromises: Array<{ id: string; body: string; by: string | null }>; risks: Array<{ id: string; body: string }>; approvedNotes: Array<{ id: string; body: string }>; callDecisions: Array<{ summary: string | null; decisions: string[] }>; questions: Array<{ id: string; body: string; status: string; by: string | null; answers: Array<{ body: string; by: string | null }> }> } };
const OPS = [["waiting_materials", "In attesa dei materiali"], ["ready_for_assignment", "Pronto per l'assegnazione"], ["assigned", "Assegnato"], ["in_progress", "In lavorazione"], ["quality_check", "Controllo qualità"], ["client_review", "Revisione del cliente"], ["concluded", "Concluso"]];
export function HandoffPanel({ projectId, user }: { projectId: string; user: Profile }) {
  const handoff = useLoad<Handoff>(`crm/handoffs/${projectId}`);
  const { run, busy, feedback } = useRun(handoff.reload);
  const [suggest, setSuggest] = useState<{ skill: string; list: Array<{ userId: string; name?: string; load: number; capacity: number }> } | null>(null);
  const h = handoff.data;
  if (!h) return null;
  const ops = hasPermission(user.grants, "project.assign");
  const item = (kind: string, body: string, parentId?: string) => run(() => api(`crm/handoffs/${projectId}/items`, "POST", { kind, body, ...(parentId ? { parentId } : {}) }), "Registrato nel passaggio.");
  return (
    <Card title="Passaggio alla produzione" action={<Tag tone={h.ready ? "ok" : "warn"}>{h.opsLabel}</Tag>}>
      {feedback}
      <p>Condizioni: {Object.entries({ contractAccepted: "contratto", orderConfirmed: "ordine", depositVerified: "incasso verificato", billingProfile: "fatturazione" }).map(([k, v]) => `${h.conditions[k] ? "✓" : "✗"} ${v}`).join(" · ")}</p>
      {h.missing.length ? <p>Mancano: {h.missing.map((m) => MISSING[m] ?? m).join(", ")}</p> : null}
      {h.inconsistencies.length ? <ul>{h.inconsistencies.map((x, i) => <li key={i}>{x.detail}</li>)}</ul> : null}
      {h.package.contractual ? <details><summary>Fatti contrattuali</summary><p>Incluso: {h.package.contractual.includes.join(", ")}</p><p>Escluso: {h.package.contractual.excludes.join(", ")}</p><p>{h.package.contractual.revisions}</p><p>{h.package.contractual.deadlines}</p>{h.package.amounts ? <p>Totale {cents(h.package.amounts.grossCents)} · acconto {cents(h.package.amounts.depositCents)}</p> : null}</details> : null}
      {h.package.client ? <p>Cliente: {h.package.client.name} · {h.package.client.email}{h.package.client.phone ? ` · ${h.package.client.phone}` : ""}</p> : null}
      {h.package.callDecisions.length ? <details><summary>Decisioni delle chiamate</summary>{h.package.callDecisions.map((c, i) => <p key={i}>{c.summary} {c.decisions.join("; ")}</p>)}</details> : null}
      <h3>Richieste extra e promesse</h3>
      {h.package.extraRequests.map((x) => <p key={x.id}>Extra: {x.body} <Tag>{x.status}</Tag> {ops && x.status === "pending" ? <button className="platform-text-button" onClick={() => run(() => api(`crm/handoff-items/${x.id}/decide`, "POST", { decision: "rejected" }), "Segnata come fuori contratto.")}>Fuori contratto</button> : null}</p>)}
      {h.package.unapprovedPromises.map((x) => <p key={x.id}>Promessa da approvare: {x.body} {ops ? <><button className="platform-text-button" onClick={() => run(() => api(`crm/handoff-items/${x.id}/decide`, "POST", { decision: "approved" }), "Approvata.")}>Approva</button> <button className="platform-text-button" onClick={() => run(() => api(`crm/handoff-items/${x.id}/decide`, "POST", { decision: "rejected" }), "Respinta.")}>Respingi</button></> : null}</p>)}
      <h3>Domande</h3>
      {h.package.questions.map((q) => <div key={q.id}><p><strong>{q.by}:</strong> {q.body} <Tag>{q.status === "answered" ? "risposta data" : "aperta"}</Tag></p>{q.answers.map((a, i) => <p key={i}>↳ {a.by}: {a.body}</p>)}{q.status === "open" ? <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); item("answer", String(new FormData(e.currentTarget).get("body")), q.id); }}><label>Risposta<input name="body" required minLength={3} /></label><button className="platform-button" disabled={busy}>Rispondi</button></form> : null}</div>)}
      <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); item(String(f.get("kind")), String(f.get("body"))); e.currentTarget.reset(); }}>
        <label>Aggiungi<select name="kind">{ops ? <option value="question">Domanda al venditore</option> : null}<option value="note">Nota operativa</option><option value="decision">Decisione presa in chiamata</option><option value="promise">Promessa fatta al cliente</option><option value="extra_request">Richiesta extra del cliente</option><option value="risk">Rischio</option></select></label>
        <label>Testo<input name="body" required minLength={3} /></label>
        <button className="platform-button" disabled={busy}>Registra</button>
      </form>
      {ops ? (
        <>
          <h3>Produzione</h3>
          <label>Stato operativo<select value={h.opsStatus} disabled={busy} onChange={(e) => run(() => api(`crm/projects/${projectId}/ops`, "PATCH", { opsStatus: e.target.value }), "Stato aggiornato.")}>{OPS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {h.status !== "accepted" ? <button className="platform-button" disabled={busy || !h.ready} onClick={() => run(() => api(`crm/handoffs/${projectId}/accept`, "POST", {}), "Passaggio accettato.")}>Accetta il passaggio</button> : <p>Passaggio accettato.</p>}
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api(`crm/projects/${projectId}/phases`, "POST", { queue: f.get("queue") === "on", phases: [{ phase: String(f.get("skill")), skill: String(f.get("skill")), title: String(f.get("title")), ...(f.get("due") ? { dueAt: new Date(String(f.get("due"))).toISOString() } : {}) }] }), "Fase aggiunta."); }}>
            <label>Fase<select name="skill"><option value="editing">Editing</option><option value="proofreading">Correzione bozze</option><option value="layout">Impaginazione</option><option value="cover">Copertina</option><option value="epub">Ebook</option><option value="qa">Controllo qualità</option></select></label>
            <label>Titolo<input name="title" required minLength={3} /></label>
            <label>Scadenza interna<input name="due" type="datetime-local" /></label>
            <label className="platform-check"><input type="checkbox" name="queue" />In coda reclamabile (solo categorie standard)</label>
            <button className="platform-button" disabled={busy}>Aggiungi fase</button>
          </form>
          <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const skill = String(new FormData(e.currentTarget).get("skill")); run(async () => { const r = await api<{ suggestions: Array<{ userId: string; name?: string; load: number; capacity: number }> }>(`crm/projects/${projectId}/suggestions?skill=${skill}`); setSuggest({ skill, list: r.suggestions }); }, "Suggerimento pronto: conferma tu l'assegnazione."); }}>
            <label>Suggerisci per<select name="skill"><option value="editing">Editing</option><option value="proofreading">Correzione bozze</option><option value="layout">Impaginazione</option><option value="qa">Controllo qualità</option></select></label>
            <button className="platform-text-button" disabled={busy}>Chi è disponibile?</button>
          </form>
          {suggest ? <ul>{suggest.list.map((s) => <li key={s.userId}>{s.name} · carico {s.load}/{s.capacity}</li>)}</ul> : null}
          <h3>Fasi</h3>
          {h.phases.length ? h.phases.map((t) => (
            <div className="platform-row" key={t.id}>
              <span><strong>{t.title}</strong><small>{t.skill ?? "—"} · {TASK_STATUS[t.status] ?? t.status} · {t.assignee ?? (t.claimable ? "in coda reclamabile" : "da assegnare")} · interna {day(t.dueAt)}</small></span>
              {!t.assignee && suggest && suggest.skill === t.skill ? <label>Assegna a<select value="" disabled={busy} onChange={(e) => e.target.value && run(() => api(`crm/tasks/${t.id}/assign`, "POST", { userId: e.target.value, confirm: true }), "Fase assegnata: materiali accessibili alla persona.")}><option value="">—</option>{suggest.list.map((s) => <option key={s.userId} value={s.userId}>{s.name} ({s.load}/{s.capacity})</option>)}</select></label> : null}
            </div>
          )) : <p className="platform-empty">Nessuna fase pianificata.</p>}
        </>
      ) : null}
    </Card>
  );
}
