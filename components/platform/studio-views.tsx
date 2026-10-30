"use client";
/**
 * Cabina di regia, cruscotto di produzione e Document Studio nello spazio del
 * team. Come le altre viste, leggono e scrivono solo tramite le API: i
 * permessi li decide il server, i pulsanti assenti non autorizzano niente.
 * Claude non modifica il testo: qui una persona accetta, rifiuta o modifica.
 */
import { useEffect, useMemo, useState } from "react";
import { hasPermission, type Grant, type Role } from "@/lib/platform/permissions";
import { api, useLoad, useRun, Tag, Card } from "./crm-views";

type Profile = { id: string; name: string; roles: Role[]; grants: Grant[]; staff: boolean };
const eur = (c: number | null | undefined) => (c == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100));
const usd = (micros: number | null | undefined) => (micros == null ? "—" : `${(micros / 1_000_000).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`);
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const day = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "—");
const ask = (question: string) => { const r = window.prompt(question); return r && r.trim().length >= 3 ? r.trim() : null; };

const OPS: Record<string, string> = { waiting_materials: "In attesa dei materiali", ready_for_assignment: "Da assegnare", assigned: "Assegnato", in_progress: "In lavorazione", quality_check: "Controllo qualità", client_review: "Revisione del cliente", concluded: "Concluso" };
const JOB: Record<string, [string, "ok" | "warn" | undefined]> = { queued: ["In coda", undefined], running: ["In corso", undefined], paused: ["Sospesa", "warn"], needs_review: ["Revisione AI completata — Controllo umano richiesto", "ok"], completed: ["Chiusa", "ok"], failed: ["Non riuscita", "warn"], cancelled: ["Annullata", undefined], blocked: ["Bloccata", "warn"] };
const CYCLE: Record<string, string> = { collecting: "Il cliente sta raccogliendo osservazioni", submitted: "Da lavorare", needs_decision: "Da valutare (cicli non indicati)", needs_quote: "Fuori contratto: serve un preventivo", ai_running: "Lavorazione AI in corso", human_review: "Controllo umano richiesto", quality_check: "Controllo qualità", approved: "Approvata", delivered: "Consegnata", rejected: "Non accolta" };
const KIND: Record<string, string> = { included: "Inclusa", error_fix: "Correzione dovuta", extra: "Extra", pending_decision: "Da valutare" };
const SERVICES: Array<[string, string]> = [["proofreading", "Correzione di bozze"], ["light_edit", "Editing leggero"], ["deep_edit", "Editing profondo"], ["style_edit", "Revisione di stile"], ["structural_review", "Valutazione strutturale (solo note)"], ["analysis", "Analisi del testo (solo note)"], ["rewrite", "Riscrittura"], ["brief_writing", "Scheda e brief (solo note)"], ["client_revision", "Revisione richiesta dal cliente"]];
const JobTag = ({ s }: { s: string }) => <Tag tone={JOB[s]?.[1]}>{JOB[s]?.[0] ?? s}</Tag>;

// ── Cabina di regia ──────────────────────────────────────────────────────────
type Indicator = { key: string; label: string; value: number | string | null; unit: "count" | "cents" | "pct" | "usd_micros" | "text"; source: string; status: "ok" | "unavailable"; reason?: string; href?: string };
type Admin = { days: number; generatedAt: string; owner: boolean; sections: Record<string, Indicator[] | null> };
type MarginRow = { projectId: string; title: string; service: string | null; opsStatus: string; priceCents: number | null; commissionCents: number; aiUsdMicros: number; aiCents: number | null; editorCents: number; otherCents: number; marginCents: number | null; marginPct: number | null; revisionCycles: number; missing: string[] };
type Margins = { rows: MarginRow[]; byService: Array<{ service: string; projects: number; price: number; margin: number; complete: number }>; fx: number | null; missing: string[] };
const SECTION_TITLE: Record<string, string> = { sales: "Vendite", finance: "Finanza", production: "Produzione", marketing: "Marketing", technology: "Tecnologia" };
function value(i: Indicator) {
  if (i.status !== "ok" || i.value === null) return "n.d.";
  if (i.unit === "cents") return eur(Number(i.value));
  if (i.unit === "pct") return `${Number(i.value).toLocaleString("it-IT")} %`;
  if (i.unit === "usd_micros") return usd(Number(i.value));
  return typeof i.value === "number" ? i.value.toLocaleString("it-IT") : i.value;
}
export function ControlRoomView({ user }: { user: Profile }) {
  const [days, setDays] = useState(30);
  const admin = useLoad<Admin>(`crm/admin?giorni=${days}`);
  const canMargins = hasPermission(user.grants, "finance.read") || hasPermission(user.grants, "settings.manage");
  const canOps = ["operations.read", "settings.manage", "integrations.manage"].some((p) => hasPermission(user.grants, p as "operations.read"));
  return (
    <>
      <div className="crm-toolbar" role="group" aria-label="Periodo">
        {[7, 30, 90].map((d) => <button key={d} className={days === d ? "platform-button" : "platform-text-button"} aria-pressed={days === d} onClick={() => setDays(d)}>Ultimi {d} giorni</button>)}
      </div>
      {admin.error ? <p className="platform-error">{admin.error}</p> : null}
      {!admin.data && !admin.error ? <p role="status">Caricamento…</p> : null}
      {admin.data ? <p><small>Dati reali del database, aggiornati {when(admin.data.generatedAt)}. Un indicatore «n.d.» dice perché manca: nessun valore viene stimato o inventato.</small></p> : null}
      {admin.data ? Object.entries(admin.data.sections).filter(([, list]) => list).map(([key, list]) => (
        <Card key={key} title={SECTION_TITLE[key] ?? key}>
          <div className="studio-indicators">
            {list!.map((i) => (
              <div key={i.key} className={i.status === "ok" ? "studio-indicator" : "studio-indicator studio-indicator-na"}>
                <span>{i.label}</span>
                <strong>{i.href && i.status === "ok" ? <a href={i.href}>{value(i)}</a> : value(i)}</strong>
                <small>{i.status === "ok" ? i.source : i.reason}</small>
              </div>
            ))}
          </div>
        </Card>
      )) : null}
      {canMargins ? <MarginsCard /> : null}
      {canOps ? <AutomationControlCard /> : null}
      {canOps || hasPermission(user.grants, "project.assign") ? <AiQueueCard /> : null}
    </>
  );
}
function MarginsCard() {
  const m = useLoad<Margins>("crm/admin/margins");
  const [project, setProject] = useState("");
  const { run, busy, feedback } = useRun(m.reload);
  if (m.error) return <Card title="Costi AI e marginalità"><p className="platform-error">{m.error}</p></Card>;
  if (!m.data) return null;
  return (
    <Card title="Costi AI e marginalità per progetto" action={m.data.fx ? <Tag tone="ok">Cambio 1 $ = {m.data.fx} €</Tag> : <Tag tone="warn">Cambio da approvare</Tag>}>
      <p>Margine di contribuzione = imponibile del contratto − provvigioni (escluse quelle trattenute) − costo AI − compenso editor − altri costi registrati. Se manca un dato il margine non viene calcolato e il progetto dice cosa manca.</p>
      {m.data.missing.map((x) => <p key={x} className="platform-notice">{x}</p>)}
      <div className="studio-table-wrap">
        <table className="studio-table">
          <thead><tr><th>Progetto</th><th>Servizio</th><th>Imponibile</th><th>Provvigioni</th><th>Costo AI</th><th>Editor</th><th>Altri costi</th><th>Margine</th><th>Cicli</th></tr></thead>
          <tbody>
            {m.data.rows.map((r) => (
              <tr key={r.projectId}>
                <td><a href={`/spazio?progetto=${r.projectId}`}>{r.title}</a><small>{OPS[r.opsStatus] ?? r.opsStatus}</small></td>
                <td>{r.service ?? "—"}</td>
                <td>{eur(r.priceCents)}</td>
                <td>{eur(r.commissionCents)}</td>
                <td>{r.aiUsdMicros ? <>{usd(r.aiUsdMicros)}<small>{r.aiCents == null ? "in € dopo il cambio" : eur(r.aiCents)}</small></> : "—"}</td>
                <td>{eur(r.editorCents)}</td>
                <td>{eur(r.otherCents)}</td>
                <td>{r.marginCents == null ? <small>non calcolabile: {r.missing.join(", ")}</small> : <><strong>{eur(r.marginCents)}</strong><small>{r.marginPct} %</small></>}</td>
                <td>{r.revisionCycles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m.data.byService.length ? <><h3>Per servizio</h3><ul>{m.data.byService.map((s) => <li key={s.service}><strong>{s.service}</strong>: {s.projects} progetti, imponibile {eur(s.price)}, margine {eur(s.margin)} su {s.complete} progetti con dati completi</li>)}</ul></> : null}
      <h3>Registra un costo del progetto</h3>
      {feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const amount = Math.round(Number(String(f.get("amount")).replace(",", ".")) * 100); run(() => api(`crm/projects/${project}/costs`, "POST", { kind: f.get("kind"), amountCents: amount, description: String(f.get("description")) }), "Costo registrato."); }}>
        <label>Progetto<select required value={project} onChange={(e) => setProject(e.target.value)}><option value="">Scegli…</option>{m.data.rows.map((r) => <option key={r.projectId} value={r.projectId}>{r.title}</option>)}</select></label>
        <label>Tipo<select name="kind"><option value="editor_fee">Compenso editor</option><option value="other">Altro costo diretto</option></select></label>
        <label>Importo in euro<input name="amount" inputMode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" /></label>
        <label>Descrizione<input name="description" required minLength={3} maxLength={300} /></label>
        <button className="platform-button" disabled={busy || !project}>Registra</button>
      </form>
    </Card>
  );
}
type AutomationData = { jobs: Array<{ job: string; label: string; state: string; lastSuccess: string | null; lastError: { at: string; error: string | null } | null }>; pending: Record<string, number>; control: { paused: Record<string, boolean>; changedAt: string | null }; canControl: boolean };
function AutomationControlCard() {
  const a = useLoad<AutomationData>("crm/automation");
  const { run, busy, feedback } = useRun(a.reload);
  const act = (job: string, action: "pause" | "resume" | "run") => { const reason = ask(action === "pause" ? "Perché sospendi?" : action === "resume" ? "Perché riprendi?" : "Perché esegui ora?"); if (reason) run(() => api(`crm/automation/${job}/${action}`, "POST", { reason }), "Registrato."); };
  if (!a.data) return null;
  const rows: Array<[string, string]> = [["frequent", "Lavoro frequente (code, scadenze, posta, AI)"], ["daily", "Lavoro giornaliero"], ["ai", "Lavorazioni AI"]];
  return (
    <Card title="Controllo delle automazioni">
      <p>Ogni sospensione, ripresa o esecuzione manuale chiede un motivo e resta nel registro.</p>
      {feedback}
      {rows.map(([job, label]) => {
        const info = a.data!.jobs.find((j) => j.job === job);
        const paused = a.data!.control.paused[job];
        return (
          <div className="platform-row" key={job}>
            <span><strong>{label}</strong>{info ? <small>Ultima riuscita {when(info.lastSuccess)}{info.lastError ? ` · ultimo errore ${when(info.lastError.at)}: ${info.lastError.error ?? ""}` : ""}</small> : null}</span>
            <Tag tone={paused ? "warn" : "ok"}>{paused ? "Sospeso" : "Attivo"}</Tag>
            {a.data!.canControl ? <span className="crm-toolbar">{paused ? <button className="platform-text-button" disabled={busy} onClick={() => act(job, "resume")}>Riprendi</button> : <button className="platform-text-button" disabled={busy} onClick={() => act(job, "pause")}>Sospendi</button>}{job !== "ai" ? <button className="platform-text-button" disabled={busy} onClick={() => act(job, "run")}>Esegui ora</button> : null}</span> : null}
          </div>
        );
      })}
    </Card>
  );
}
type QueueJob = { id: string; service: string; status: string; statusReason: string | null; chunksDone: number; chunksTotal: number; suggestions: number; discarded: number; spentMicros: number; budgetMicros: number; documentId: string; documentTitle: string; projectTitle: string; createdAt: string; model: string; attempts: number; lastError: string | null };
function JobControls({ job, after }: { job: { id: string; status: string }; after: () => void }) {
  const { run, busy, feedback } = useRun(after);
  const act = (action: string, question: string) => { const reason = ask(question); if (reason) run(() => api(`studio/jobs/${job.id}/${action}`, "POST", { reason }), "Registrato."); };
  return (
    <span className="crm-toolbar">
      {["queued", "running"].includes(job.status) ? <button className="platform-text-button" disabled={busy} onClick={() => act("pause", "Perché sospendi la lavorazione?")}>Sospendi</button> : null}
      {job.status === "paused" ? <button className="platform-text-button" disabled={busy} onClick={() => act("resume", "Perché riprendi? Se si era fermata per budget, viene aggiunto il tetto per lavorazione approvato.")}>Riprendi</button> : null}
      {["failed", "needs_review", "paused"].includes(job.status) ? <button className="platform-text-button" disabled={busy} onClick={() => act("retry", "Perché riprovi le porzioni non elaborate?")}>Riprova</button> : null}
      {!["completed", "cancelled"].includes(job.status) ? <button className="platform-text-button" disabled={busy} onClick={() => act("cancel", "Perché annulli? Le proposte già prodotte restano.")}>Annulla</button> : null}
      {feedback}
    </span>
  );
}
function AiQueueCard() {
  const q = useLoad<{ jobs: QueueJob[] }>("studio/queue");
  if (q.error) return null;
  return (
    <Card title="Coda delle lavorazioni AI">
      {!q.data?.jobs.length ? <p className="platform-empty">Nessuna lavorazione registrata.</p> : q.data.jobs.map((j) => (
        <div className="platform-row" key={j.id}>
          <span><strong><a href={`/spazio?tab=studio&doc=${j.documentId}`}>{j.documentTitle}</a></strong><small>{j.projectTitle} · {SERVICES.find(([k]) => k === j.service)?.[1] ?? j.service} · {j.model} · avviata {when(j.createdAt)}</small><small>{j.chunksDone}/{j.chunksTotal} porzioni · {j.suggestions} proposte{j.discarded ? ` · ${j.discarded} scartate` : ""} · costo {usd(Number(j.spentMicros))} su {usd(Number(j.budgetMicros))}{j.attempts ? ` · ${j.attempts} tentativi falliti` : ""}</small>{j.statusReason ? <small>{j.statusReason}</small> : null}</span>
          <JobTag s={j.status} />
          <JobControls job={j} after={q.reload} />
        </div>
      ))}
    </Card>
  );
}

// ── Produzione ──────────────────────────────────────────────────────────────
type ProdRow = { id: string; title: string; opsStatus: string; contractualDueAt: string | null; late: boolean; documents: Array<{ id: string; title: string; pending: number; job: { id: string; status: string; service: string; chunksDone: number; chunksTotal: number } | null }>; cycles: Array<{ id: string; documentId: string; number: number; status: string; kind: string }>; operators: string[]; handoff: string | null };
type Prod = { projects: ProdRow[]; sections: Record<string, string[]>; load: Array<{ name: string; open: number }>; problems: Array<{ kind: string; projectId: string; documentId: string | null; detail: string }>; canAssign?: boolean };
const PROD_SECTIONS: Array<[string, string]> = [["all", "Tutti"], ["newOrders", "Nuovi ordini"], ["toAssign", "Da assegnare"], ["missingMaterials", "Materiali mancanti"], ["aiRunning", "AI in corso"], ["aiDone", "AI completata"], ["toReview", "Proposte da controllare"], ["clientRevisions", "Revisioni del cliente"], ["qualityCheck", "Controllo qualità"], ["dueSoon", "In scadenza"], ["late", "In ritardo"]];
export function ProductionView() {
  const p = useLoad<Prod>("studio/production");
  const [section, setSection] = useState("all");
  if (p.error) return <p className="platform-error">{p.error}</p>;
  if (!p.data) return <p role="status">Caricamento…</p>;
  const ids = section === "all" ? null : new Set(p.data.sections[section] ?? []);
  const rows = p.data.projects.filter((r) => !ids || ids.has(r.id));
  const title = (id: string) => p.data!.projects.find((r) => r.id === id)?.title ?? "progetto";
  return (
    <>
      <nav className="crm-tabs" aria-label="Sezioni della produzione">
        {PROD_SECTIONS.map(([k, label]) => <button key={k} className={section === k ? "crm-tab crm-tab-on" : "crm-tab"} aria-pressed={section === k} onClick={() => setSection(k)}>{label} {k === "all" ? p.data!.projects.length : p.data!.sections[k]?.length ?? 0}</button>)}
      </nav>
      {p.data.problems.length ? (
        <Card title="Problemi da risolvere">
          <ul>{p.data.problems.map((x, i) => <li key={i}><a href={x.documentId ? `/spazio?tab=studio&doc=${x.documentId}` : `/spazio?progetto=${x.projectId}`}>{title(x.projectId)}</a>: {x.detail}</li>)}</ul>
        </Card>
      ) : null}
      <Card title={PROD_SECTIONS.find(([k]) => k === section)?.[1] ?? "Progetti"}>
        {!rows.length ? <p className="platform-empty">Niente in questa sezione.</p> : rows.map((r) => (
          <div className="platform-row studio-prod-row" key={r.id}>
            <span>
              <strong><a href={`/spazio?progetto=${r.id}`}>{r.title}</a></strong>
              <small>{OPS[r.opsStatus] ?? r.opsStatus}{r.contractualDueAt ? ` · consegna contrattuale ${day(r.contractualDueAt)}` : ""}{r.operators.length ? ` · ${r.operators.join(", ")}` : " · nessun operatore assegnato"}</small>
              {r.documents.map((d) => <small key={d.id}>Documento <a href={`/spazio?tab=studio&doc=${d.id}`}>{d.title}</a>{d.pending ? ` · ${d.pending} proposte da controllare` : ""}{d.job ? ` · AI: ${JOB[d.job.status]?.[0] ?? d.job.status} (${d.job.chunksDone}/${d.job.chunksTotal})` : ""}</small>)}
              {r.cycles.map((c) => <small key={c.id}>Revisione n. {c.number} ({KIND[c.kind] ?? c.kind}): {CYCLE[c.status] ?? c.status}</small>)}
            </span>
            {r.late ? <Tag tone="warn">In ritardo</Tag> : null}
            {!r.documents.length ? <ImportDocument projectId={r.id} after={p.reload} /> : null}
          </div>
        ))}
      </Card>
      <Card title="Carico per operatore">
        {p.data.load.length ? <ul>{p.data.load.map((l) => <li key={l.name}>{l.name}: {l.open} fasi aperte</li>)}</ul> : <p className="platform-empty">Nessuna fase aperta assegnata.</p>}
        <p><small>Le assegnazioni si fanno dal progetto, con i suggerimenti per competenze e carico e la conferma di chi assegna: nessuno riceve lavoro in automatico.</small></p>
      </Card>
    </>
  );
}
function ImportDocument({ projectId, after }: { projectId: string; after: () => void }) {
  const [open, setOpen] = useState(false);
  const d = useLoad<{ importable: Array<{ id: string; name: string; version: number }> }>(open ? `studio/projects/${projectId}` : null);
  const { run, busy, feedback } = useRun(after);
  if (!open) return <button className="platform-text-button" onClick={() => setOpen(true)}>Apri nello Studio</button>;
  return (
    <span>
      {feedback}
      {d.error ? <small className="platform-error">{d.error}</small> : null}
      {d.data && !d.data.importable.length ? <small>Nessun manoscritto pronto (controllato) da importare.</small> : null}
      {d.data?.importable.map((f) => <button key={f.id} className="platform-text-button" disabled={busy} onClick={() => run(async () => { const r = await api<{ document: { id: string } }>(`studio/projects/${projectId}`, "POST", { fileId: f.id }); location.href = `/spazio?tab=studio&doc=${r.document.id}`; }, "Documento creato.")}>Importa «{f.name}» v{f.version}</button>)}
    </span>
  );
}

// ── Document Studio ─────────────────────────────────────────────────────────
type Paragraph = { id: string; text: string; style: string | null };
type Proposal = { id: string; paragraphId: string; kind: string; originalText: string; suggestedText: string; reason: string | null; category: string | null; origin: "ai" | "editor" | "client"; applicable: boolean; cycleId: string | null };
type Comment = { id: string; paragraphId: string | null; quote: string | null; body: string; origin: string; visibility: string; authorName: string | null; createdAt: string; cycleId: string | null };
type Version = { id: string; number: number; label: string; kind: string; contentHash: string; docxFileId: string | null; pdfFileId: string | null; approvedAt: string | null; cycleId: string | null };
type Cycle = { id: string; number: number; kind: string; status: string; notes: string | null; submittedAt: string | null; decisionReason: string | null; scope: { paragraphIds: string[]; level: string } | null };
type StudioJob = { id: string; service: string; status: string; statusReason: string | null; chunksDone: number; chunksTotal: number; suggestions: number; discarded: number; spentMicros: number; budgetMicros: number; createdAt: string; cycleId: string | null };
type StudioDoc = {
  document: { id: string; title: string; status: string; provider: string; externalId: string | null; clientAccess: string; words: number; sourceFormat: string };
  project: { id: string; title: string; opsStatus: string; qaOwnerId: string | null; revisionRounds: number | null; contractRevisions: string | null; contractService: string | null };
  revision: { id: string; number: number; hash: string; paragraphs: Paragraph[] };
  proposals: Proposal[]; comments: Comment[]; versions: Version[]; cycles: Cycle[]; jobs: StudioJob[]; canEdit: boolean; canDeliver: boolean; finalDeliveryAllowed: boolean;
};
const ORIGIN: Record<string, string> = { ai: "AI", editor: "Editor", client: "Cliente" };
export function StudioView({ user }: { user: Profile }) {
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => { setDoc(new URLSearchParams(location.search).get("doc")); }, []);
  if (!doc) return <StudioIndex />;
  return <DocumentStudio id={doc} user={user} onBack={() => { history.replaceState(null, "", "/spazio?tab=studio"); setDoc(null); }} />;
}
function StudioIndex() {
  const p = useLoad<Prod>("studio/production");
  if (p.error) return <p className="platform-error">{p.error}</p>;
  const docs = (p.data?.projects ?? []).flatMap((r) => r.documents.map((d) => ({ ...d, project: r.title })));
  return (
    <Card title="Documenti di lavoro">
      <p>Proemios è l&apos;archivio ufficiale: originale immutabile, documento di lavoro con tutte le revisioni, versioni consegnate con impronta. Per importare un manoscritto apri la Produzione.</p>
      {!p.data ? <p role="status">Caricamento…</p> : !docs.length ? <p className="platform-empty">Nessun documento nei tuoi progetti.</p> : docs.map((d) => (
        <div className="platform-row" key={d.id}>
          <span><strong><a href={`/spazio?tab=studio&doc=${d.id}`}>{d.title}</a></strong><small>{d.project}{d.pending ? ` · ${d.pending} proposte da controllare` : ""}</small></span>
          {d.job ? <JobTag s={d.job.status} /> : null}
        </div>
      ))}
    </Card>
  );
}
function DocumentStudio({ id, user, onBack }: { id: string; user: Profile; onBack: () => void }) {
  const d = useLoad<StudioDoc>(`studio/documents/${id}`);
  const { run, busy, feedback } = useRun(d.reload);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ai" | "client" | "editor">("all");
  const byParagraph = useMemo(() => {
    const m = new Map<string, Proposal[]>();
    for (const p of d.data?.proposals ?? []) if (filter === "all" || p.origin === filter) m.set(p.paragraphId, [...(m.get(p.paragraphId) ?? []), p]);
    return m;
  }, [d.data, filter]);
  if (d.error) return <><button className="platform-text-button" onClick={onBack}>← Documenti</button><p className="platform-error">{d.error}</p></>;
  if (!d.data) return <p role="status">Caricamento…</p>;
  const s = d.data, rev = s.revision.number;
  const decide = (items: Array<{ id: string; decision: "accept" | "reject" | "modify"; text?: string }>, ok: string) => run(async () => { const r = await api<{ outcome: Record<string, string> }>(`studio/documents/${id}/decide`, "POST", { expectedRevision: rev, items }); const stale = Object.values(r.outcome).filter((o) => o === "stale").length; if (stale) window.alert(`${stale} proposte non più applicabili al testo corrente: segnate come superate.`); }, ok);
  const openJob = s.jobs.find((j) => ["queued", "running", "paused"].includes(j.status));
  const openCycles = s.cycles.filter((c) => !["delivered", "rejected", "collecting"].includes(c.status));
  const canAssign = hasPermission(user.grants, "project.assign");
  const commentsOf = (pid: string) => s.comments.filter((c) => c.paragraphId === pid);
  const applicable = s.proposals.filter((p) => p.applicable && (filter === "all" || p.origin === filter));
  return (
    <>
      <button className="platform-text-button" onClick={onBack}>← Documenti</button>
      <Card title={s.document.title} action={<Tag>{`Revisione ${rev}`}</Tag>}>
        <p><a href={`/spazio?progetto=${s.project.id}`}>{s.project.title}</a> · {OPS[s.project.opsStatus] ?? s.project.opsStatus} · {s.document.words.toLocaleString("it-IT")} parole · impronta <code>{s.revision.hash.slice(0, 12)}</code>{s.document.externalId ? " · collegato a Google Docs" : ""}</p>
        {openJob ? <p className="platform-notice"><JobTag s={openJob.status} /> {SERVICES.find(([k]) => k === openJob.service)?.[1]}: {openJob.chunksDone}/{openJob.chunksTotal} porzioni{openJob.statusReason ? ` — ${openJob.statusReason}` : ""}</p> : null}
        {s.jobs[0]?.status === "needs_review" && s.proposals.some((p) => p.origin === "ai") ? <p className="platform-notice" role="status"><strong>Revisione AI completata — Controllo umano richiesto.</strong> Accetta, rifiuta o modifica le proposte; poi invia al controllo qualità o approva la versione.</p> : null}
        {feedback}
        <div className="crm-toolbar">
          <a className="platform-text-button" href={`/api/platform/studio/documents/${id}/export?mode=tracked`}>DOCX con revisioni</a>
          <a className="platform-text-button" href={`/api/platform/studio/documents/${id}/export?mode=clean`}>DOCX pulito</a>
        </div>
      </Card>
      <div className="studio-layout">
        <section className="platform-card studio-text" aria-label="Testo del documento">
          <div className="crm-card-head">
            <h2>Testo e proposte</h2>
            <span className="crm-toolbar" role="group" aria-label="Filtra le proposte">
              {(["all", "ai", "client", "editor"] as const).map((f) => <button key={f} className={filter === f ? "crm-tab crm-tab-on" : "crm-tab"} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? `Tutte ${s.proposals.length}` : `${ORIGIN[f]} ${s.proposals.filter((p) => p.origin === f).length}`}</button>)}
            </span>
          </div>
          {s.canEdit && applicable.length ? <p><button className="platform-text-button" disabled={busy} onClick={() => { if (window.confirm(`Accettare ${applicable.length} proposte applicabili? Diventano una nuova revisione del testo.`)) decide(applicable.map((p) => ({ id: p.id, decision: "accept" })), "Proposte accettate."); }}>Accetta tutte le applicabili ({applicable.length})</button></p> : null}
          {s.revision.paragraphs.map((p) => (
            <div key={p.id} className={`studio-paragraph${selected.has(p.id) ? " studio-paragraph-on" : ""}${p.style && /heading|titolo/i.test(p.style) ? " studio-heading" : ""}`}>
              <label className="studio-select"><input type="checkbox" checked={selected.has(p.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(p.id); else n.delete(p.id); setSelected(n); }} aria-label="Seleziona il paragrafo per una lavorazione mirata" /></label>
              {editing === p.id ? (
                <form className="studio-edit" onSubmit={(e) => { e.preventDefault(); const text = String(new FormData(e.currentTarget).get("text")); run(async () => { await api(`studio/documents/${id}/edit`, "POST", { expectedRevision: rev, changes: [{ paragraphId: p.id, text }] }); setEditing(null); }, "Salvato come nuova revisione."); }}>
                  <textarea name="text" defaultValue={p.text} rows={Math.max(3, Math.ceil(p.text.length / 90))} />
                  <span className="crm-toolbar"><button className="platform-button" disabled={busy}>Salva</button><button type="button" className="platform-text-button" onClick={() => setEditing(null)}>Annulla</button></span>
                </form>
              ) : <p onDoubleClick={() => s.canEdit && setEditing(p.id)}>{p.text || <em>(paragrafo vuoto)</em>}</p>}
              {(byParagraph.get(p.id) ?? []).map((x) => <ProposalItem key={x.id} p={x} canEdit={s.canEdit} busy={busy} decide={decide} />)}
              {commentsOf(p.id).map((c) => <p key={c.id} className={`studio-comment studio-comment-${c.origin}`}><strong>{c.origin === "client" ? "Cliente" : c.authorName ?? "Team"}</strong>{c.visibility === "internal" ? " (interno)" : ""}: {c.quote ? <q>{c.quote}</q> : null} {c.body}</p>)}
              {s.canEdit && editing !== p.id ? <button className="platform-text-button studio-edit-link" onClick={() => setEditing(p.id)}>Modifica</button> : null}
            </div>
          ))}
        </section>
        <aside className="studio-side">
          {s.canEdit ? <AiStart id={id} selected={[...selected]} disabled={Boolean(openJob)} after={() => { setSelected(new Set()); d.reload(); }} cycles={openCycles} /> : null}
          {s.jobs.length ? (
            <Card title="Lavorazioni AI">
              {s.jobs.slice(0, 6).map((j) => (
                <div key={j.id} className="studio-job">
                  <JobTag s={j.status} /> <small>{SERVICES.find(([k]) => k === j.service)?.[1]} · {when(j.createdAt)} · {j.suggestions} proposte · {usd(Number(j.spentMicros))}</small>
                  {j.statusReason ? <small>{j.statusReason}</small> : null}
                  {canAssign ? <JobControls job={j} after={d.reload} /> : null}
                </div>
              ))}
            </Card>
          ) : null}
          <CyclesCard cycles={s.cycles} canDecide={canAssign} after={d.reload} />
          <DeliveryCard s={s} id={id} user={user} after={d.reload} openCycles={openCycles} />
          {canAssign ? <ClientSharing s={s} id={id} after={d.reload} /> : null}
          <Card title="Nota sul documento">
            <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const pid = [...selected][0] ?? null; run(() => api(`studio/documents/${id}/comments`, "POST", { body: String(f.get("body")), visibility: f.get("client") === "on" ? "client" : "internal", paragraphId: pid }), "Nota aggiunta."); e.currentTarget.reset(); }}>
              <label>Testo<textarea name="body" required rows={3} /></label>
              <label className="platform-check"><input type="checkbox" name="client" />Visibile al cliente (altrimenti resta interna)</label>
              <small>{selected.size ? "Collegata al primo paragrafo selezionato." : "Seleziona un paragrafo per collegarla, altrimenti vale per tutto il documento."}</small>
              <button className="platform-button" disabled={busy}>Aggiungi</button>
            </form>
            {s.comments.filter((c) => !c.paragraphId).map((c) => <p key={c.id} className={`studio-comment studio-comment-${c.origin}`}><strong>{c.origin === "client" ? "Cliente" : c.authorName ?? "Team"}</strong>{c.visibility === "internal" ? " (interno)" : ""}: {c.body}</p>)}
          </Card>
        </aside>
      </div>
    </>
  );
}
function ProposalItem({ p, canEdit, busy, decide }: { p: Proposal; canEdit: boolean; busy: boolean; decide: (items: Array<{ id: string; decision: "accept" | "reject" | "modify"; text?: string }>, ok: string) => void }) {
  const [modify, setModify] = useState(false);
  return (
    <div className={`studio-proposal studio-proposal-${p.origin}${p.applicable ? "" : " studio-proposal-stale"}`}>
      <span className="studio-diff"><del>{p.originalText || "—"}</del> → <ins>{p.suggestedText || "(eliminare)"}</ins></span>
      <small><Tag>{ORIGIN[p.origin]}</Tag> {p.category ?? ""}{p.reason ? ` · ${p.reason}` : ""}{p.applicable ? "" : " · superata: il testo è cambiato"}</small>
      {canEdit ? (
        modify ? (
          <form onSubmit={(e) => { e.preventDefault(); decide([{ id: p.id, decision: "modify", text: String(new FormData(e.currentTarget).get("text")) }], "Proposta modificata e applicata."); setModify(false); }}>
            <input name="text" defaultValue={p.suggestedText} aria-label="Testo modificato" /> <button className="platform-text-button" disabled={busy}>Applica</button> <button type="button" className="platform-text-button" onClick={() => setModify(false)}>Annulla</button>
          </form>
        ) : (
          <span className="crm-toolbar">
            {p.applicable ? <button className="platform-text-button" disabled={busy} onClick={() => decide([{ id: p.id, decision: "accept" }], "Proposta accettata.")}>Accetta</button> : null}
            {p.applicable ? <button className="platform-text-button" disabled={busy} onClick={() => setModify(true)}>Modifica</button> : null}
            <button className="platform-text-button" disabled={busy} onClick={() => decide([{ id: p.id, decision: "reject" }], "Proposta rifiutata.")}>Rifiuta</button>
          </span>
        )
      ) : null}
    </div>
  );
}
function AiStart({ id, selected, disabled, after, cycles }: { id: string; selected: string[]; disabled: boolean; after: () => void; cycles: Cycle[] }) {
  const { run, busy, feedback } = useRun(after);
  return (
    <Card title="Lavorazione AI">
      <p><small>Claude lavora sul testo corrente e produce proposte con motivazione; il testo cambia solo quando una persona le accetta. Prima di partire Proemios verifica incasso, contratto, regole e budget approvati.</small></p>
      {feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const instructions = String(f.get("instructions") ?? "").trim(); const cycleId = String(f.get("cycle") ?? "") || null; run(() => api(`studio/documents/${id}/ai`, "POST", { service: f.get("service"), paragraphIds: selected.length ? selected : null, instructions: instructions.length >= 2 ? [{ paragraphId: null, quote: null, text: instructions }] : [], cycleId }), "Lavorazione in coda: riceverai un avviso al termine."); }}>
        <label>Servizio<select name="service">{SERVICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Indicazioni per questa lavorazione (facoltative)<textarea name="instructions" rows={2} maxLength={4000} /></label>
        {cycles.length ? <label>Ciclo di revisione<select name="cycle"><option value="">Nessuno</option>{cycles.map((c) => <option key={c.id} value={c.id}>Revisione n. {c.number} ({KIND[c.kind] ?? c.kind})</option>)}</select></label> : null}
        <small>{selected.length ? `Solo i ${selected.length} paragrafi selezionati.` : "Tutto il documento (seleziona dei paragrafi per una lavorazione mirata)."}</small>
        <button className="platform-button" disabled={busy || disabled}>{disabled ? "C'è già una lavorazione aperta" : "Avvia"}</button>
      </form>
    </Card>
  );
}
function CyclesCard({ cycles, canDecide, after }: { cycles: Cycle[]; canDecide: boolean; after: () => void }) {
  const { run, busy, feedback } = useRun(after);
  if (!cycles.length) return null;
  return (
    <Card title="Richieste di revisione del cliente">
      {feedback}
      {cycles.map((c) => (
        <div key={c.id} className="studio-cycle">
          <p><strong>Revisione n. {c.number}</strong> · {KIND[c.kind] ?? c.kind} · {CYCLE[c.status] ?? c.status}{c.submittedAt ? ` · inviata ${when(c.submittedAt)}` : ""}</p>
          {c.notes ? <p><small>Note del cliente: {c.notes}</small></p> : null}
          {c.decisionReason ? <p><small>Decisione: {c.decisionReason}</small></p> : null}
          {canDecide && ["needs_decision", "needs_quote", "submitted"].includes(c.status) ? (
            <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const kind = String(f.get("kind")); if (kind === "extra_paid" && !String(f.get("quoteId"))) return; run(() => api(`studio/cycles/${c.id}/decide`, "POST", { kind, reason: String(f.get("reason")), startAi: f.get("startAi") === "on", ...(String(f.get("quoteId")) ? { quoteId: String(f.get("quoteId")) } : {}) }), "Decisione registrata."); }}>
              <label>Decisione<select name="kind" defaultValue={c.kind === "pending_decision" ? "included" : c.kind}><option value="included">Inclusa nel contratto</option><option value="error_fix">Correzione di un nostro errore (senza costi)</option><option value="extra">Extra: preparare un preventivo</option><option value="extra_paid">Extra già pagato (preventivo incassato)</option><option value="rejected">Non accolta</option></select></label>
              <label>Preventivo dell&apos;extra (solo se pagato)<input name="quoteId" placeholder="id del preventivo" pattern="[0-9a-f-]{36}" /></label>
              <label>Motivazione<input name="reason" required minLength={3} /></label>
              <label className="platform-check"><input type="checkbox" name="startAi" />Avvia subito la revisione AI mirata (solo se inclusa, dovuta o pagata)</label>
              <button className="platform-button" disabled={busy}>Registra</button>
            </form>
          ) : null}
        </div>
      ))}
      <p><small>Una richiesta fuori contratto non avvia mai lavorazioni a pagamento: l&apos;extra passa dal preventivo e dal pagamento esistenti.</small></p>
    </Card>
  );
}
function DeliveryCard({ s, id, user, after, openCycles }: { s: StudioDoc; id: string; user: Profile; after: () => void; openCycles: Cycle[] }) {
  const { run, busy, feedback } = useRun(after);
  const inQa = s.project.opsStatus === "quality_check";
  const qaIsMe = s.project.qaOwnerId === user.id;
  return (
    <Card title="Versioni e consegna">
      {feedback}
      <ul className="studio-versions">
        {s.versions.map((v) => (
          <li key={v.id}><strong>{v.label}</strong> <small>{v.kind === "original" ? "originale caricato" : v.approvedAt ? `approvata ${when(v.approvedAt)}` : ""} · <code>{v.contentHash.slice(0, 10)}</code></small>{v.docxFileId ? <> · <a href={`/api/platform/files/${v.docxFileId}/download`}>DOCX</a></> : null}{v.pdfFileId ? <> · <a href={`/api/platform/files/${v.pdfFileId}/download`}>PDF</a></> : null}</li>
        ))}
      </ul>
      {s.canEdit && !inQa ? <p><button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`studio/documents/${id}/qa`, "POST", {}), "Inviato al controllo qualità.")}>Invia al controllo qualità</button></p> : null}
      {inQa ? <p className="platform-notice">In controllo qualità{qaIsMe ? ": la consegna spetta a te." : ": consegna chi ne è responsabile."}</p> : null}
      {s.canDeliver ? (
        <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (!window.confirm("Approvare questa revisione come versione ufficiale? Diventa immutabile e, se scegli di consegnarla, il cliente la riceve.")) return; run(() => api(`studio/documents/${id}/versions`, "POST", { deliver: f.get("deliver") === "on", final: f.get("final") === "on", cycleId: String(f.get("cycle") ?? "") || null, ...(String(f.get("label")).trim() ? { label: String(f.get("label")).trim() } : {}) }), "Versione approvata."); }}>
          <label>Nome della versione (facoltativo)<input name="label" maxLength={80} placeholder={`V${s.versions.length}`} /></label>
          {openCycles.length ? <label>Chiude la revisione<select name="cycle"><option value="">Nessuna</option>{openCycles.map((c) => <option key={c.id} value={c.id}>Revisione n. {c.number}</option>)}</select></label> : null}
          <label className="platform-check"><input type="checkbox" name="deliver" defaultChecked />Consegna al cliente (DOCX pulito e PDF nella sua area)</label>
          <label className="platform-check"><input type="checkbox" name="final" />Versione definitiva</label>
          {!s.finalDeliveryAllowed ? <p className="platform-notice">La consegna definitiva si sblocca con il saldo confermato. Puoi approvarla senza consegnarla.</p> : null}
          <button className="platform-button" disabled={busy || (inQa && !qaIsMe && !user.roles.includes("owner"))}>Approva la revisione {s.revision.number}</button>
        </form>
      ) : null}
    </Card>
  );
}
function ClientSharing({ s, id, after }: { s: StudioDoc; id: string; after: () => void }) {
  const { run, busy, feedback } = useRun(after);
  const google = useLoad<{ configured: boolean; status: string; accountEmail: string | null }>("studio/google");
  const ACCESS: Record<string, string> = { read: "Solo lettura", comment: "Commenti", suggest: "Commenti e proposte di modifica", edit: "Proposte di modifica (mai scrittura diretta sul testo approvato)" };
  return (
    <Card title="Cliente e condivisione">
      {feedback}
      <label>Cosa può fare il cliente sull&apos;ultima versione consegnata<select value={s.document.clientAccess} disabled={busy} onChange={(e) => run(() => api(`studio/documents/${id}`, "PATCH", { clientAccess: e.target.value }), "Accesso aggiornato.")}>{Object.entries(ACCESS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <p><small>Il cliente non vede mai note interne, proposte del team, istruzioni o costi dell&apos;AI.</small></p>
      <h3>Cicli di revisione inclusi</h3>
      {s.project.contractRevisions ? <p className="crm-pre">Dal contratto: {s.project.contractRevisions}</p> : <p><small>Contratto non trovato.</small></p>}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api(`studio/projects/${s.project.id}/rounds`, "PUT", { rounds: Number(f.get("rounds")), reason: String(f.get("reason")) }), "Cicli registrati."); }}>
        <label>Cicli inclusi per questo progetto<input name="rounds" type="number" min={0} max={10} required defaultValue={s.project.revisionRounds ?? ""} /><small>{s.project.revisionRounds == null ? "Non indicati: le richieste del cliente restano da valutare." : ""}</small></label>
        <label>Motivazione<input name="reason" required minLength={3} placeholder="Come risulta dal contratto" /></label>
        <button className="platform-text-button" disabled={busy}>Registra</button>
      </form>
      <h3>Google Docs</h3>
      {google.data && !google.data.configured ? <p><small>Non configurato: si lavora nell&apos;editor di Proemios.</small></p> : null}
      {google.data?.configured && google.data.status !== "connected" ? <p><small>Account Google da collegare in Impostazioni CRM → Diagnostica.</small></p> : null}
      {google.data?.status === "connected" ? (
        s.document.externalId ? (
          <span className="crm-toolbar">
            <a className="platform-text-button" href={`https://docs.google.com/document/d/${s.document.externalId}/edit`} target="_blank" rel="noreferrer">Apri in Google Docs</a>
            <button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`studio/documents/${id}/google-pull`, "POST", { expectedRevision: s.revision.number }), "Sincronizzato da Google.")}>Porta qui le modifiche di Google</button>
            <button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`studio/documents/${id}/google-push`, "POST", {}), "Testo approvato applicato a Google.")}>Applica a Google il testo approvato</button>
            <button className="platform-text-button" disabled={busy} onClick={() => { if (window.confirm("Condividere il documento Google con il cliente in sola lettura con commenti?")) run(() => api(`studio/documents/${id}/google-share`, "POST", { mode: "commenter" }), "Condiviso con il cliente (commenti)."); }}>Condividi con il cliente (commenti)</button>
          </span>
        ) : <button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`studio/documents/${id}/google-link`, "POST", {}), "Collegato a un nuovo documento Google.")}>Crea il documento Google di lavoro</button>
      ) : null}
    </Card>
  );
}
