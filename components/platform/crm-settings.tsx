"use client";
/**
 * Configurazione guidata e impostazioni del CRM. Ogni modifica passa da
 * un'anteprima (cosa cambia e da quando vale) prima dell'approvazione; il
 * server valida, versiona e impedisce di togliere ciò che i record usano.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { hasPermission, type Grant, type Role } from "@/lib/platform/permissions";
import { api, useLoad, useRun, Tag, Card, IntegrationKeys, ReportsCard } from "./crm-views";

type Profile = { id: string; name: string; roles: Role[]; grants: Grant[]; staff: boolean };
type Change = { path: string; from: unknown; to: unknown };
const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 38) || "voce";
const nextVersion = (v: string) => { const m = /(.*-v)(\d+)$/.exec(v); return m ? `${m[1]}${Number(m[2]) + 1}` : `${v}-v2`; };
const cents = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n / 100);
const STATUS: Record<string, { label: string; tone?: "ok" | "warn" }> = { configured: { label: "Configurata", tone: "ok" }, todo: { label: "Da completare", tone: "warn" }, not_needed: { label: "Non necessaria" }, error: { label: "Errore da risolvere", tone: "warn" }, verified: { label: "Verificata", tone: "ok" }, not_configured: { label: "Non configurata" } };
const StateTag = ({ s }: { s: string }) => <Tag tone={STATUS[s]?.tone}>{STATUS[s]?.label ?? s}</Tag>;

/** Anteprima e approvazione di una regola versionata. */
function useVersioned(key: string, after: () => void) {
  const [pending, setPending] = useState<{ value: Record<string, unknown>; changes: Change[]; effect: string } | null>(null);
  const { run, busy, feedback } = useRun(after);
  const preview = (value: Record<string, unknown>) => run(async () => { const r = await api<{ changes: Change[]; effect: string }>("crm/settings", "PUT", { key, value, preview: true }); setPending({ value, changes: r.changes, effect: r.effect }); }, "Anteprima pronta: controlla e approva.");
  const real = Boolean(pending?.changes.some((c) => c.path !== "version"));
  const panel = pending ? (
    <div className="crm-preview" role="region" aria-label="Anteprima delle modifiche">
      <h3>Cosa cambia</h3>
      {real ? <ul>{pending.changes.map((c, i) => <li key={i}><code>{c.path}</code>: {show(c.from)} → <strong>{show(c.to)}</strong></li>)}</ul> : <p>Nessuna modifica rispetto alla versione in vigore: non c&apos;è niente da approvare.</p>}
      {real ? <p>{pending.effect}</p> : null}
      {real ? <button className="platform-button" disabled={busy} onClick={() => run(async () => { await api("crm/settings", "PUT", { key, value: pending.value }); setPending(null); }, "Approvata e salvata come nuova versione.")}>Approva e salva</button> : null} <button className="platform-text-button" onClick={() => setPending(null)}>{real ? "Annulla" : "Chiudi"}</button>
    </div>
  ) : null;
  return { preview, panel, busy, feedback };
}
function VersionField({ value }: { value: string }) {
  return <label>Nuova versione<input name="version" required defaultValue={nextVersion(value)} /><small>Ogni approvazione crea una versione; le precedenti restano nello storico.</small></label>;
}

// ── Configurazione CRM (guidata) ────────────────────────────────────────────
type Setup = { ready: boolean; flows: Record<string, boolean | string>; flowsDecided: boolean; canEdit: boolean; sections: Array<{ key: string; title: string; status: string; summary: string; href: string; items: Array<{ label: string; status: string; detail?: string }> }>; decisions: Array<{ key: string; question: string; proposal: string; href: string }> };
const FLOWS: Array<[string, string]> = [["siteRequests", "Richieste dal sito (preventivo, contatti)"], ["assistedSales", "Vendite assistite da venditori"], ["packageLinks", "Link a pacchetti standard"], ["production", "Passaggio alla produzione e operatori"], ["externalApi", "Moduli esterni o integrazioni via API"]];
export function SetupView() {
  const setup = useLoad<Setup>("crm/setup");
  const { run, busy, feedback } = useRun(setup.reload);
  const d = setup.data;
  if (setup.error) return <p className="platform-error">{setup.error}</p>;
  if (!d) return <p role="status">Caricamento…</p>;
  const done = d.sections.filter((s) => s.status === "configured" || s.status === "not_needed").length;
  return (
    <>
      <Card title={d.ready ? "Il CRM è pronto per i flussi scelti" : "Il CRM non è ancora pronto"} action={<Tag tone={d.ready ? "ok" : "warn"}>{done}/{d.sections.length} sezioni</Tag>}>
        <progress max={d.sections.length} value={done} aria-label="Avanzamento della configurazione" className="crm-progress" />
        <p>I valori predefiniti sono proposte da verificare: finché non li approvi la sezione resta «da completare».</p>
      </Card>
      {feedback}
      <Card title="Quali flussi userete">
        <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api("crm/setup", "PUT", Object.fromEntries(FLOWS.map(([k]) => [k, f.get(k) === "on"]))), "Flussi salvati."); }}>
          {FLOWS.map(([k, label]) => <label key={k} className="platform-check"><input type="checkbox" name={k} defaultChecked={Boolean(d.flows[k])} disabled={!d.canEdit} />{label}</label>)}
          {d.canEdit ? <button className="platform-button" disabled={busy}>{d.flowsDecided ? "Aggiorna i flussi" : "Conferma i flussi"}</button> : null}
        </form>
      </Card>
      <ol className="crm-setup">
        {d.sections.map((s, i) => (
          <li key={s.key} className="platform-card">
            <div className="crm-card-head"><h2>{i + 1}. {s.title}</h2><StateTag s={s.status} /></div>
            <p>{s.summary}</p>
            <ul>{s.items.map((it, j) => <li key={j}><StateTag s={it.status} /> {it.label}{it.detail ? <small> · {it.detail}</small> : null}</li>)}</ul>
            <a href={s.href}>Apri →</a>
          </li>
        ))}
      </ol>
      <Card title="Decisioni aziendali ancora da prendere">
        {d.decisions.length ? <ol>{d.decisions.map((x) => <li key={x.key}><strong>{x.question}</strong><br /><small>Proposta da verificare: {x.proposal}</small> · <a href={x.href}>dove si decide</a></li>)}</ol> : <p className="platform-empty">Nessuna decisione in sospeso.</p>}
      </Card>
    </>
  );
}

// ── Impostazioni CRM ────────────────────────────────────────────────────────
type SettingsData = { settings: Record<string, Record<string, unknown>>; defaults: string[]; canEdit: boolean; effects: Record<string, string> };
const SECTIONS: Array<[string, string]> = [["brand", "Marchio"], ["catalog", "Catalogo"], ["pipelines", "Pipeline"], ["fields", "Campi personalizzati"], ["loss", "Motivi di perdita"], ["templates", "Modelli e checklist"], ["attribution", "Attribuzione"], ["assignment", "Assegnazione e scadenze"], ["simulator", "Prova assegnazione"], ["ai", "AI, costi e revisioni"], ["sellers", "Home venditori"], ["automation", "Attività automatiche"], ["diagnostics", "Diagnostica"], ["api", "API e webhook"], ["history", "Storico"]];
export function CrmSettingsView({ user }: { user: Profile }) {
  const [section, setSection] = useState("brand");
  useEffect(() => { const s = new URLSearchParams(location.search).get("section"); if (s && SECTIONS.some(([k]) => k === s)) setSection(s); }, []);
  const settings = useLoad<SettingsData>("crm/settings");
  const s = settings.data;
  const isDefault = (k: string) => s?.defaults.includes(k);
  const body = (): ReactNode => {
    if (!s) return <p role="status">Caricamento…</p>;
    const common = { data: s, reload: settings.reload };
    switch (section) {
      case "brand": return <BrandSection {...common} />;
      case "catalog": return <CatalogSection {...common} />;
      case "pipelines": return <PipelinesSection {...common} />;
      case "fields": return <FieldsSection canEdit={s.canEdit} />;
      case "loss": return <LossSection {...common} />;
      case "templates": return <TemplatesSection canEdit={s.canEdit} />;
      case "attribution": return <AttributionSection {...common} />;
      case "assignment": return <AssignmentSection {...common} />;
      case "simulator": return <SimulatorSection current={s.settings["assignment-rules"]!} canAssign={hasPermission(user.grants, "crm.assign") || s.canEdit} />;
      case "ai": return <AiSection {...common} />;
      case "sellers": return <SellerRulesSection {...common} />;
      case "automation": return <AutomationSection />;
      case "diagnostics": return <DiagnosticsSection />;
      case "api": return hasPermission(user.grants, "integrations.manage") ? <IntegrationKeys /> : <p className="platform-empty">Le chiavi API e i webhook li gestisce solo chi ha il permesso sulle integrazioni.</p>;
      case "history": return <HistorySection />;
    }
    return null;
  };
  return (
    <>
      <nav className="crm-tabs" aria-label="Sezioni delle impostazioni">
        {SECTIONS.map(([k, label]) => <button key={k} className={section === k ? "crm-tab crm-tab-on" : "crm-tab"} aria-current={section === k ? "page" : undefined} onClick={() => setSection(k)}>{label}{["brand", "catalog", "loss", "attribution", "assignment", "ai"].includes(k) && isDefault(({ brand: "brand", catalog: "catalog", loss: "loss-reasons", attribution: "attribution-rules", assignment: "assignment-rules", ai: "ai-rules" } as Record<string, string>)[k]!) ? " •" : ""}</button>)}
      </nav>
      {s && !s.canEdit ? <p className="platform-notice">Puoi consultare le impostazioni; per cambiarle serve il permesso sulle regole economiche.</p> : null}
      <p><small>• = valori ancora proposti, da verificare e approvare.</small></p>
      {settings.error ? <p className="platform-error">{settings.error}</p> : null}
      {hasPermission(user.grants, "report.read") && section === "history" ? <ReportsCard /> : null}
      {body()}
    </>
  );
}
type SectionProps = { data: SettingsData; reload: () => void };

function BrandSection({ data, reload }: SectionProps) {
  const brand = data.settings.brand as { name: string; supportEmail: string | null; version: string };
  const v = useVersioned("brand", reload);
  return (
    <Card title={`Marchio · ${brand.version}`} action={data.defaults.includes("brand") ? <Tag tone="warn">Da confermare</Tag> : <Tag tone="ok">Approvato</Tag>}>
      <p>Come vi presentate ai clienti nei modelli e nelle comunicazioni del CRM. Il marchio non separa dati: è sempre la stessa azienda.</p>
      {v.feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); v.preview({ name: String(f.get("name")), supportEmail: String(f.get("supportEmail") || "") || null, version: String(f.get("version")) }); }}>
        <label>Nome del marchio<input name="name" required minLength={1} maxLength={80} defaultValue={brand.name} disabled={!data.canEdit} /></label>
        <label>Email di assistenza ai clienti<input name="supportEmail" type="email" defaultValue={brand.supportEmail ?? ""} disabled={!data.canEdit} /></label>
        <VersionField value={brand.version} />
        {data.canEdit ? <button className="platform-button" disabled={v.busy}>Vedi cosa cambia</button> : null}
      </form>
      {v.panel}
      <p><small>Ragione sociale, partita IVA e sede compaiono nei contratti: si modificano solo con revisione legale nella configurazione dell&apos;azienda, non da qui.</small></p>
    </Card>
  );
}

type CatalogItem = { key: string; name: string; input: Record<string, unknown> & { singleService?: string }; active: boolean; price: { grossCents: number; netCents: number; depositGrossCents: number }; standard: boolean; purchasableAlone: boolean; links: number };
const SERVICE_NAMES: Record<string, string> = { cover: "Copertina", epub: "Ebook ePub", kdp: "Pubblicazione Amazon KDP", isbn: "Codice ISBN", amazonListing: "Scheda prodotto Amazon", editing: "Editing", proofreading: "Correzione bozze", layout: "Impaginazione" };
function CatalogSection({ data, reload }: SectionProps) {
  const catalog = useLoad<{ version: string; items: CatalogItem[]; services: string[]; note: string; pricingVersion: string }>("crm/catalog");
  const v = useVersioned("catalog", () => { reload(); catalog.reload(); });
  const c = catalog.data;
  if (!c) return <p role="status">Caricamento…</p>;
  const items = c.items.map(({ key, name, input, active }) => ({ key, name, input, active }));
  const submit = (next: typeof items, version: string) => v.preview({ version, items: next });
  return (
    <Card title={`Catalogo · ${c.version}`} action={data.defaults.includes("catalog") ? <Tag tone="warn">Proposta da verificare</Tag> : <Tag tone="ok">Approvato</Tag>}>
      <p>Pacchetti che un venditore può mandare con un link dalla trattativa. {c.note} Listino in vigore: {c.pricingVersion}.</p>
      {v.feedback}
      <div className="crm-table" role="table" aria-label="Pacchetti">
        {c.items.map((item) => (
          <div className="platform-row" role="row" key={item.key}>
            <span role="cell"><strong>{item.name}</strong><small>{SERVICE_NAMES[item.input.singleService ?? ""] ?? item.input.singleService} · {cents(item.price.grossCents)} IVA inclusa · acconto {cents(item.price.depositGrossCents)} · {item.links} link inviati</small></span>
            <span role="cell">{item.active ? <Tag tone="ok">Attivo</Tag> : <Tag>Archiviato</Tag>} {item.purchasableAlone ? null : <Tag tone="warn">Richiede valutazione</Tag>}</span>
            {data.canEdit ? <button className="platform-text-button" onClick={() => submit(items.map((i) => (i.key === item.key ? { ...i, active: !i.active } : i)), nextVersion(c.version))}>{item.active ? "Archivia" : "Riattiva"}</button> : null}
          </div>
        ))}
      </div>
      {data.canEdit ? (
        <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const service = String(f.get("service")); const name = String(f.get("name")); submit([...items, { key: slug(name), name, active: true, input: { projectType: "romanzo", textState: "finito-revisionato", wordCount: 60000, requestedServices: [service], singleService: service, urgency: "standard" } }], String(f.get("version"))); }}>
          <label>Nome del pacchetto<input name="name" required minLength={2} maxLength={120} /></label>
          <label>Servizio<select name="service">{c.services.map((s) => <option key={s} value={s}>{SERVICE_NAMES[s] ?? s}</option>)}</select></label>
          <VersionField value={c.version} />
          <button className="platform-button" disabled={v.busy}>Aggiungi e vedi cosa cambia</button>
        </form>
      ) : null}
      {v.panel}
      <p><small>Si possono aggiungere solo servizi che la regola d&apos;acquisto rende acquistabili senza valutazione. Un pacchetto già usato in un link si archivia, non si elimina; proposte e contratti già creati non cambiano.</small></p>
    </Card>
  );
}

type Pipeline = { key: string; name: string; archived?: boolean; stages: Array<{ key: string; label: string; kind: "open" | "won" | "lost"; manual: boolean }> };
function PipelinesSection({ data, reload }: SectionProps) {
  const p = data.settings.pipelines as { version: string; pipelines: Pipeline[] };
  const extra = p.pipelines.filter((x) => x.key !== "vendite");
  const [draft, setDraft] = useState<Pipeline[]>(extra);
  const v = useVersioned("pipelines", reload);
  const [version, setVersion] = useState(nextVersion(p.version));
  const update = (i: number, next: Pipeline) => setDraft(draft.map((x, j) => (j === i ? next : x)));
  return (
    <Card title={`Pipeline · ${p.version}`}>
      <p>La pipeline «Vendite» è quella predefinita e non si modifica: le sue fasi vengono dai fatti (proposta, accettazione, incasso). Qui aggiungi pipeline per altri percorsi (es. agenzie). Una fase «vinta» arriva solo da un incasso verificato; una fase usata da trattative esistenti non si toglie.</p>
      {v.feedback}
      {draft.map((pl, i) => (
        <fieldset key={i} className="crm-fieldset">
          <legend>{pl.name || "Nuova pipeline"}</legend>
          <label>Nome<input value={pl.name} onChange={(e) => update(i, { ...pl, name: e.target.value, key: extra.some((x) => x.key === pl.key) ? pl.key : slug(e.target.value) })} disabled={!data.canEdit} /></label>
          <label className="platform-check"><input type="checkbox" checked={Boolean(pl.archived)} onChange={(e) => update(i, { ...pl, archived: e.target.checked })} disabled={!data.canEdit} />Archiviata (niente nuove trattative)</label>
          {pl.stages.map((st, j) => (
            <div className="platform-inline" key={j}>
              <label>Fase<input value={st.label} onChange={(e) => update(i, { ...pl, stages: pl.stages.map((x, k) => (k === j ? { ...x, label: e.target.value, key: extra.find((ex) => ex.key === pl.key)?.stages.some((es) => es.key === x.key) ? x.key : slug(e.target.value) } : x)) })} disabled={!data.canEdit} /></label>
              <label>Tipo<select value={st.kind} onChange={(e) => update(i, { ...pl, stages: pl.stages.map((x, k) => (k === j ? { ...x, kind: e.target.value as "open" } : x)) })} disabled={!data.canEdit}><option value="open">Aperta</option><option value="won">Vinta (da incasso)</option><option value="lost">Persa</option></select></label>
            </div>
          ))}
          {data.canEdit ? <button type="button" className="platform-text-button" onClick={() => update(i, { ...pl, stages: [...pl.stages.slice(0, -2), { key: `fase_${pl.stages.length}`, label: "Nuova fase", kind: "open", manual: true }, ...pl.stages.slice(-2)] })}>Aggiungi una fase</button> : null}
        </fieldset>
      ))}
      {data.canEdit ? (
        <>
          <button className="platform-text-button" onClick={() => setDraft([...draft, { key: `pipeline_${draft.length + 1}`, name: "Nuova pipeline", archived: false, stages: [{ key: "nuovo", label: "Nuovo contatto", kind: "open", manual: true }, { key: "proposta", label: "Proposta inviata", kind: "open", manual: true }, { key: "vinta", label: "Vinta", kind: "won", manual: true }, { key: "persa", label: "Persa", kind: "lost", manual: true }] }])}>Nuova pipeline</button>
          <label>Nuova versione<input value={version} onChange={(e) => setVersion(e.target.value)} /></label>
          <button className="platform-button" disabled={v.busy} onClick={() => v.preview({ version, pipelines: draft })}>Vedi cosa cambia</button>
        </>
      ) : null}
      {v.panel}
    </Card>
  );
}

type FieldDef = { id: string; entity: string; key: string; label: string; type: string; options: string[]; required: boolean; active: boolean };
const ENTITY: Record<string, string> = { contact: "Cliente", deal: "Trattativa", lead: "Richiesta", company: "Azienda" };
const FTYPE: Record<string, string> = { text: "Testo", number: "Numero", date: "Data", select: "Elenco a scelta", boolean: "Sì/No" };
function FieldsSection({ canEdit }: { canEdit: boolean }) {
  const list = useLoad<{ fields: FieldDef[]; history: Array<{ action: string; createdAt: string; name: string | null; detail: { changes?: Change[] } | null }> }>("crm/fields");
  const { run, busy, feedback } = useRun(list.reload);
  return (
    <Card title="Campi personalizzati">
      <p>Informazioni in più su clienti, trattative, richieste o aziende. Il server controlla tipo e valori. Un campo non si elimina: si archivia, e i valori già inseriti restano.</p>
      {feedback}
      {list.data?.fields.map((f) => (
        <div className="platform-row" key={f.id}>
          <span><strong>{f.label}</strong><small>{ENTITY[f.entity]} · {FTYPE[f.type]}{f.options.length ? ` · ${f.options.join(", ")}` : ""}{f.required ? " · obbligatorio" : ""}</small></span>
          {f.active ? <Tag tone="ok">Attivo</Tag> : <Tag>Archiviato</Tag>}
          {canEdit ? <span><button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`crm/fields/${f.id}`, "PATCH", { active: !f.active }), f.active ? "Campo archiviato." : "Campo riattivato.")}>{f.active ? "Archivia" : "Riattiva"}</button>{f.type === "select" ? <button className="platform-text-button" disabled={busy} onClick={() => { const o = prompt("Nuova opzione"); if (o) run(() => api(`crm/fields/${f.id}`, "PATCH", { options: [...f.options, o] }), "Opzione aggiunta."); }}>Aggiungi opzione</button> : null}</span> : null}
        </div>
      ))}
      {canEdit ? (
        <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const label = String(f.get("label")); const type = String(f.get("type")); const options = String(f.get("options") ?? "").split(",").map((x) => x.trim()).filter(Boolean); if (!confirm(`Creare il campo «${label}» (${FTYPE[type]}) su ${ENTITY[String(f.get("entity"))]}?${options.length ? ` Opzioni: ${options.join(", ")}.` : ""} Le schede esistenti lo avranno vuoto.`)) return; run(() => api("crm/fields", "POST", { entity: String(f.get("entity")), key: slug(label).replace(/^[^a-z]+/, "c_"), label, type, options, required: f.get("required") === "on" }), "Campo creato."); }}>
          <label>Dove<select name="entity">{Object.entries(ENTITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Nome del campo<input name="label" required minLength={2} maxLength={80} /></label>
          <label>Tipo<select name="type">{Object.entries(FTYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Opzioni (per l&apos;elenco a scelta, separate da virgola)<input name="options" /></label>
          <label className="platform-check"><input type="checkbox" name="required" />Obbligatorio</label>
          <button className="platform-button" disabled={busy}>Crea il campo</button>
        </form>
      ) : null}
      <details><summary>Storico dei campi e dei modelli</summary>{list.data?.history.map((h, i) => <p key={i}><small>{new Date(h.createdAt).toLocaleString("it-IT")} · {h.name ?? "—"} · {h.action}</small> {h.detail?.changes?.map((c) => `${c.path}: ${show(c.from)} → ${show(c.to)}`).join("; ")}</p>)}</details>
    </Card>
  );
}

function LossSection({ data, reload }: SectionProps) {
  const lr = data.settings["loss-reasons"] as { version: string; reasons: Array<{ key: string; label: string; active: boolean }> };
  const v = useVersioned("loss-reasons", reload);
  return (
    <Card title={`Motivi di perdita · ${lr.version}`} action={data.defaults.includes("loss-reasons") ? <Tag tone="warn">Proposta da verificare</Tag> : <Tag tone="ok">Approvati</Tag>}>
      <p>L&apos;elenco tra cui scegliere quando una trattativa si chiude persa. Un motivo già usato si archivia, non si elimina.</p>
      {v.feedback}
      {lr.reasons.map((r) => (
        <div className="platform-row" key={r.key}><span>{r.label}</span>{r.active ? <Tag tone="ok">Attivo</Tag> : <Tag>Archiviato</Tag>}{data.canEdit ? <button className="platform-text-button" onClick={() => v.preview({ version: nextVersion(lr.version), reasons: lr.reasons.map((x) => (x.key === r.key ? { ...x, active: !x.active } : x)) })}>{r.active ? "Archivia" : "Riattiva"}</button> : null}</div>
      ))}
      {data.canEdit ? <form className="platform-inline" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const label = String(f.get("label")); v.preview({ version: String(f.get("version")), reasons: [...lr.reasons, { key: slug(label), label, active: true }] }); }}><label>Nuovo motivo<input name="label" required minLength={2} maxLength={120} /></label><VersionField value={lr.version} /><button className="platform-button" disabled={v.busy}>Vedi cosa cambia</button></form> : null}
      {v.panel}
    </Card>
  );
}

type Template = { id: string; kind: string; key: string; name: string; subject: string | null; body: string | null; items: string[]; version: number; active: boolean };
const SAMPLE = { nome: "Maria", responsabile: "Sara", prossima_azione: "Chiamata di qualifica", marchio: "il vostro marchio" } as Record<string, string>;
const fill = (t: string) => t.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => SAMPLE[k] ?? m);
function TemplatesSection({ canEdit }: { canEdit: boolean }) {
  const list = useLoad<{ templates: Template[]; variables: string[] }>("crm/templates?all=1");
  const { run, busy, feedback } = useRun(list.reload);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [edit, setEdit] = useState<Template | null>(null);
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const kind = String(f.get("kind") ?? edit?.kind ?? "email");
    const payload = { name: String(f.get("name")), subject: kind === "email" ? String(f.get("subject") ?? "") || null : null, body: kind === "email" ? String(f.get("body") ?? "") || null : null, items: kind === "checklist" ? String(f.get("items") ?? "").split("\n").map((x) => x.trim()).filter(Boolean) : [] };
    if (edit) run(async () => { await api(`crm/templates/${edit.id}`, "PATCH", payload); setEdit(null); }, "Nuova versione del modello salvata; la precedente resta nello storico.");
    else run(() => api("crm/templates", "POST", { ...payload, kind, key: slug(payload.name).replace(/_/g, "-") }), "Modello creato.");
  };
  return (
    <Card title="Modelli di email e checklist">
      <p>I modelli preparano una bozza da rivedere: nessun messaggio parte da qui. Variabili: {list.data?.variables.map((x) => `{{${x}}}`).join(", ")}.</p>
      {feedback}
      {list.data?.templates.map((t) => (
        <div className="platform-row" key={t.id}>
          <span><strong>{t.name}</strong><small>{t.kind === "email" ? "Email" : "Checklist"} · versione {t.version}</small></span>
          {t.active ? <Tag tone="ok">Attivo</Tag> : <Tag>Archiviato</Tag>}
          <span>
            <button className="platform-text-button" onClick={() => setPreview({ subject: fill(t.subject ?? ""), body: t.kind === "email" ? fill(t.body ?? "") : t.items.map((x) => `☐ ${x}`).join("\n") })}>Anteprima</button>
            {canEdit ? <><button className="platform-text-button" onClick={() => setEdit(t)}>Modifica</button><button className="platform-text-button" disabled={busy} onClick={() => run(() => api(`crm/templates/${t.id}`, "PATCH", { active: !t.active }), t.active ? "Modello archiviato." : "Modello riattivato.")}>{t.active ? "Archivia" : "Riattiva"}</button></> : null}
          </span>
        </div>
      ))}
      {preview ? <div className="crm-preview"><h3>Anteprima con dati di esempio</h3>{preview.subject ? <p><strong>{preview.subject}</strong></p> : null}<pre className="crm-pre">{preview.body}</pre><button className="platform-text-button" onClick={() => setPreview(null)}>Chiudi</button></div> : null}
      {canEdit ? (
        <form key={edit?.id ?? "new"} className="platform-form" onSubmit={save}>
          <h3>{edit ? `Modifica «${edit.name}»` : "Nuovo modello"}</h3>
          {edit ? null : <label>Tipo<select name="kind"><option value="email">Email (bozza)</option><option value="checklist">Checklist</option></select></label>}
          <label>Nome<input name="name" required minLength={2} defaultValue={edit?.name} /></label>
          <label>Oggetto (email)<input name="subject" defaultValue={edit?.subject ?? ""} /></label>
          <label>Testo (email)<textarea name="body" rows={5} defaultValue={edit?.body ?? ""} /></label>
          <label>Voci (checklist, una per riga)<textarea name="items" rows={4} defaultValue={edit?.items.join("\n") ?? ""} /></label>
          <button className="platform-button" disabled={busy}>{edit ? "Salva nuova versione" : "Crea modello"}</button> {edit ? <button type="button" className="platform-text-button" onClick={() => setEdit(null)}>Annulla</button> : null}
        </form>
      ) : null}
    </Card>
  );
}

function AttributionSection({ data, reload }: SectionProps) {
  const at = data.settings["attribution-rules"] as { version: string; relationshipWindowDays: number; laterPurchase: string; affiliateAndSeller: string };
  const v = useVersioned("attribution-rules", reload);
  return (
    <Card title={`Attribuzione · ${at.version}`} action={data.defaults.includes("attribution-rules") ? <Tag tone="warn">Proposta da verificare</Tag> : <Tag tone="ok">Approvata</Tag>}>
      <p>Chi viene accreditato di una vendita. Vale per le vendite accettate da ora in poi: le attribuzioni già registrate e le provvigioni maturate non cambiano. Le percentuali delle provvigioni sono nelle regole economiche.</p>
      {v.feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); v.preview({ ...at, version: String(f.get("version")), relationshipWindowDays: Number(f.get("days")), laterPurchase: String(f.get("later")), affiliateAndSeller: String(f.get("stack")) }); }}>
        <label>Per quanti giorni un venditore resta referente del cliente<input name="days" type="number" min={0} max={730} defaultValue={at.relationshipWindowDays} disabled={!data.canEdit} /></label>
        <label>Acquisto successivo senza link<select name="later" defaultValue={at.laterPurchase} disabled={!data.canEdit}><option value="credit_recent_owner">Accredita il venditore che lo segue (solo con identità verificata)</option><option value="autonomous">Acquisto autonomo, senza venditore</option></select></label>
        <label>Venditore e affiliato sulla stessa vendita<select name="stack" defaultValue={at.affiliateAndSeller} disabled={!data.canEdit}><option value="both">Provvigione a entrambi</option><option value="seller_only">Solo al venditore</option><option value="affiliate_only">Solo all&apos;affiliato</option></select></label>
        <VersionField value={at.version} />
        {data.canEdit ? <button className="platform-button" disabled={v.busy}>Vedi cosa cambia</button> : null}
      </form>
      {v.panel}
      <p><small>Trattative aperte con responsabili diversi sullo stesso cliente: sempre segnalate come conflitto, mai decise in silenzio.</small></p>
    </Card>
  );
}

type Rules = { version: string; mode: string; sourceModes: Record<string, string>; defaultLanguage: string; defaultCapacity: number; hours: { timezone: string; days: number[]; start: string; end: string; holidays: string[] }; sla: { responseMinutes: Record<string, number>; escalateAfterMinutes: number }; pool: { maxReservations: number; reservationMinutes: number } };
const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const SOURCES: Record<string, string> = { form: "Modulo del sito", campaign: "Campagne", social: "Social", manual: "Inserimento del team", seller: "Portati dai venditori", marketplace: "Marketplace", partner: "Partner e agenzie", api: "API" };
const MODES: Record<string, string> = { automatic: "Automatica", manual: "Manuale", pool: "Coda a scelta libera" };
const PRI: Record<string, string> = { urgent: "Urgente", high: "Alta", normal: "Normale", low: "Bassa" };
function rulesFromForm(f: FormData, base: Rules): Rules {
  return {
    ...base,
    version: String(f.get("version")),
    mode: String(f.get("mode")),
    sourceModes: Object.fromEntries(Object.keys(SOURCES).map((k) => [k, String(f.get(`src_${k}`))]).filter(([, m]) => m !== "inherit")),
    defaultCapacity: Number(f.get("capacity")),
    defaultLanguage: String(f.get("language")),
    hours: { timezone: String(f.get("timezone")), days: DAYS.map((_, i) => i).filter((i) => f.get(`day_${i}`) === "on"), start: String(f.get("start")), end: String(f.get("end")), holidays: String(f.get("holidays") ?? "").split(/[\s,]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) },
    sla: { responseMinutes: Object.fromEntries(Object.keys(PRI).map((k) => [k, Number(f.get(`sla_${k}`))])), escalateAfterMinutes: Number(f.get("escalate")) },
    pool: { maxReservations: Number(f.get("maxRes")), reservationMinutes: Number(f.get("resMin")) },
  };
}
function AssignmentSection({ data, reload }: SectionProps) {
  const a = data.settings["assignment-rules"] as Rules;
  const v = useVersioned("assignment-rules", reload);
  const [impact, setImpact] = useState<{ queued: number; pending: number; open: number } | null>(null);
  const d = !data.canEdit;
  return (
    <Card title={`Assegnazione e scadenze · ${a.version}`} action={data.defaults.includes("assignment-rules") ? <Tag tone="warn">Proposta da verificare</Tag> : <Tag tone="ok">Approvata</Tag>}>
      <p>Ordine fisso: responsabile della trattativa aperta → competenza e lingua → assenze, capacità e orario → carico. La presenza online non conta. Le trattative in corso non vengono mai spostate da sole.</p>
      {v.feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const next = rulesFromForm(new FormData(e.currentTarget), a); v.preview(next); api<{ impact: { queuedLeads: { count: number }; pendingDeadlines: { count: number }; openDeals: { count: number } } }>("crm/assignment/simulate", "POST", { source: "form", draft: next }).then((r) => setImpact({ queued: r.impact.queuedLeads.count, pending: r.impact.pendingDeadlines.count, open: r.impact.openDeals.count })).catch(() => setImpact(null)); }}>
        <fieldset className="crm-fieldset"><legend>Orario di servizio</legend>
          <label>Fuso orario<input name="timezone" defaultValue={a.hours.timezone} disabled={d} /></label>
          <div className="crm-days">{DAYS.map((name, i) => <label key={i} className="platform-check"><input type="checkbox" name={`day_${i}`} defaultChecked={a.hours.days.includes(i)} disabled={d} />{name}</label>)}</div>
          <label>Dalle<input name="start" type="time" defaultValue={a.hours.start} disabled={d} /></label>
          <label>Alle<input name="end" type="time" defaultValue={a.hours.end} disabled={d} /></label>
          <label>Giorni di chiusura (AAAA-MM-GG, separati da virgola)<input name="holidays" defaultValue={a.hours.holidays.join(", ")} disabled={d} /></label>
        </fieldset>
        <fieldset className="crm-fieldset"><legend>Prima risposta entro (minuti di servizio)</legend>{Object.entries(PRI).map(([k, l]) => <label key={k}>{l}<input name={`sla_${k}`} type="number" min={5} defaultValue={a.sla.responseMinutes[k]} disabled={d} /></label>)}<label>Escalation dopo la scadenza (minuti)<input name="escalate" type="number" min={0} defaultValue={a.sla.escalateAfterMinutes} disabled={d} /></label></fieldset>
        <fieldset className="crm-fieldset"><legend>Modalità</legend>
          <label>Predefinita<select name="mode" defaultValue={a.mode} disabled={d}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {Object.entries(SOURCES).map(([k, l]) => <label key={k}>{l}<select name={`src_${k}`} defaultValue={a.sourceModes[k] ?? "inherit"} disabled={d}><option value="inherit">Come la predefinita</option>{Object.entries(MODES).map(([m, ml]) => <option key={m} value={m}>{ml}</option>)}</select></label>)}
        </fieldset>
        <fieldset className="crm-fieldset"><legend>Coda e capacità</legend>
          <label>Prenotazioni per persona nella coda libera<input name="maxRes" type="number" min={1} defaultValue={a.pool.maxReservations} disabled={d} /></label>
          <label>Durata della prenotazione senza risposta (minuti)<input name="resMin" type="number" min={5} defaultValue={a.pool.reservationMinutes} disabled={d} /></label>
          <label>Capacità per chi non ne ha una propria (trattative aperte)<input name="capacity" type="number" min={1} defaultValue={a.defaultCapacity} disabled={d} /></label>
          <label>Lingua predefinita delle richieste<input name="language" defaultValue={a.defaultLanguage} disabled={d} /></label>
        </fieldset>
        <VersionField value={a.version} />
        {data.canEdit ? <button className="platform-button" disabled={v.busy}>Vedi cosa cambia</button> : null}
      </form>
      {impact ? <p className="platform-notice">Conseguenze: le nuove richieste seguiranno la nuova regola; {impact.queued} richieste in coda verranno riprovate al prossimo giro; {impact.pending} scadenze già calcolate restano invariate; {impact.open} trattative aperte non vengono riassegnate.</p> : null}
      {v.panel}
    </Card>
  );
}

type Sim = { ruleVersion: string; mode: string; proposed: { name: string | null } | null; reason: string; explanation: string; availableAt: string; firstResponseDue: string; considered: Array<{ name: string | null; excluded: string | null; why: string; load: number; capacity: number; inHours: boolean }> };
function SimView({ s, title }: { s: Sim; title: string }) {
  return (
    <div className="crm-preview">
      <h3>{title} · regola {s.ruleVersion}</h3>
      <p><strong>{s.proposed ? `Responsabile proposto: ${s.proposed.name}` : "Nessun responsabile"}</strong> · modalità {MODES[s.mode] ?? s.mode}</p>
      <p>{s.explanation}</p>
      <p>Prima risposta entro: {new Date(s.firstResponseDue).toLocaleString("it-IT")}</p>
      {s.considered.length ? <ul>{s.considered.map((c, i) => <li key={i}>{c.name}: {c.why}{c.excluded ? "" : ` · carico ${c.load}/${c.capacity}${c.inHours ? "" : " · fuori orario"}`}</li>)}</ul> : null}
    </div>
  );
}
function SimulatorSection({ current, canAssign }: { current: Record<string, unknown>; canAssign: boolean }) {
  const [result, setResult] = useState<{ simulation: Sim; draft?: Sim; writes: string } | null>(null);
  const { run, busy, feedback } = useRun();
  if (!canAssign) return <p className="platform-empty">La prova è riservata a chi gestisce le assegnazioni.</p>;
  return (
    <Card title="Prova assegnazione">
      <p>Usa lo stesso motore dell&apos;assegnazione reale, ma non crea richieste, notifiche o attività. Regola in vigore: {String(current.version)}.</p>
      {feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const at = String(f.get("at") ?? ""); run(async () => setResult(await api("crm/assignment/simulate", "POST", { source: String(f.get("source")), service: String(f.get("service")) || null, language: String(f.get("language")), priority: String(f.get("priority")), ...(at ? { at: new Date(at).toISOString() } : {}), ...(f.get("email") ? { contactEmail: String(f.get("email")) } : {}) })), "Simulazione eseguita."); }}>
        <label>Origine<select name="source">{Object.entries(SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Servizio richiesto<select name="service"><option value="">Nessuno in particolare</option>{Object.entries(SERVICE_NAMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Lingua<input name="language" defaultValue="it" /></label>
        <label>Priorità<select name="priority" defaultValue="normal">{Object.entries(PRI).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Data e ora simulate<input name="at" type="datetime-local" /></label>
        <label>Email del cliente (facoltativa, per controllare una trattativa aperta)<input name="email" type="email" /></label>
        <button className="platform-button" disabled={busy}>Prova</button>
      </form>
      {result ? <><SimView s={result.simulation} title="Con la regola in vigore" />{result.draft ? <SimView s={result.draft} title="Con la regola in bozza" /> : null}<p><small>Scritture effettuate: {result.writes}.</small></p></> : null}
    </Card>
  );
}

type AiRules = { version: string; model: string; effort: string; maxJobUsd: number; monthlyCapUsd: number; autoStartServices: string[]; salesAssistant: boolean };
const MODELS: Array<[string, string]> = [["claude-opus-5-5", "Claude Opus 5.5 (consigliato per l'editing)"], ["claude-sonnet-5-5", "Claude Sonnet 5.5 (più economico)"], ["claude-haiku-5-5", "Claude Haiku 5.5 (solo correzioni semplici)"]];
const EFFORT: Record<string, string> = { low: "Basso", medium: "Medio", high: "Alto", xhigh: "Molto alto", max: "Massimo" };
/** Regole dell'AI editoriale, cambio per i costi e cicli di revisione: tre regole versionate, ognuna con anteprima e approvazione. */
function AiSection({ data, reload }: SectionProps) {
  const ai = data.settings["ai-rules"] as AiRules;
  const cost = data.settings["cost-rules"] as { version: string; usdToEurRate: number };
  const rev = data.settings["revision-rules"] as { version: string; roundsIncludedByService: Record<string, number>; autoStartIncluded: boolean };
  const va = useVersioned("ai-rules", reload), vc = useVersioned("cost-rules", reload), vr = useVersioned("revision-rules", reload);
  const state = (k: string) => (data.defaults.includes(k) ? <Tag tone="warn">Proposta da verificare</Tag> : <Tag tone="ok">Approvata</Tag>);
  return (
    <>
      <Card title={`AI editoriale · ${ai.version}`} action={state("ai-rules")}>
        <p>Finché queste regole non sono approvate nessuna lavorazione AI può partire. Serve anche <code>EDITORIAL_AI_ENABLED=1</code> e la chiave Anthropic nell&apos;ambiente (vedi Diagnostica). Claude produce solo proposte: il testo cambia quando una persona le accetta.</p>
        {va.feedback}
        <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); va.preview({ ...ai, version: String(f.get("version")), model: String(f.get("model")), effort: String(f.get("effort")), maxJobUsd: Number(f.get("maxJobUsd")), monthlyCapUsd: Number(f.get("monthlyCapUsd")), autoStartServices: f.get("autoRevision") === "on" ? ["client_revision"] : [], salesAssistant: f.get("salesAssistant") === "on" }); }}>
          <label>Modello<select name="model" defaultValue={ai.model} disabled={!data.canEdit}>{MODELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Impegno di ragionamento<select name="effort" defaultValue={ai.effort} disabled={!data.canEdit}>{Object.entries(EFFORT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><small>Più impegno = qualità maggiore e costo più alto.</small></label>
          <label>Tetto per singola lavorazione (USD)<input name="maxJobUsd" type="number" step="0.5" min={0.5} max={500} defaultValue={ai.maxJobUsd} disabled={!data.canEdit} /><small>Raggiunto il tetto la lavorazione si ferma: le proposte già fatte restano, per continuare serve una ripresa approvata.</small></label>
          <label>Tetto mensile complessivo (USD)<input name="monthlyCapUsd" type="number" step="1" min={1} max={20000} defaultValue={ai.monthlyCapUsd} disabled={!data.canEdit} /></label>
          <label className="platform-check"><input type="checkbox" name="autoRevision" defaultChecked={ai.autoStartServices.includes("client_revision")} disabled={!data.canEdit} />Le revisioni richieste dal cliente e incluse nel contratto possono avviare l&apos;AI da sole</label>
          <label className="platform-check"><input type="checkbox" name="salesAssistant" defaultChecked={ai.salesAssistant} disabled={!data.canEdit} />Assistente commerciale per i venditori (solo bozze, mai invii)</label>
          <VersionField value={ai.version} />
          {data.canEdit ? <button className="platform-button" disabled={va.busy}>Vedi cosa cambia</button> : null}
        </form>
        {va.panel}
      </Card>
      <Card title={`Cambio per i costi AI · ${cost.version}`} action={state("cost-rules")}>
        <p>Anthropic fattura in dollari. Il cambio serve solo a esprimere in euro il costo AI nella marginalità dei progetti: senza un cambio approvato il margine dei progetti con lavorazioni AI non viene calcolato.</p>
        {vc.feedback}
        <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); vc.preview({ version: String(f.get("version")), usdToEurRate: Number(f.get("rate")) }); }}>
          <label>1 USD in EUR<input name="rate" type="number" step="0.0001" min={0.0001} required defaultValue={cost.usdToEurRate || ""} disabled={!data.canEdit} /></label>
          <VersionField value={cost.version} />
          {data.canEdit ? <button className="platform-button" disabled={vc.busy}>Vedi cosa cambia</button> : null}
        </form>
        {vc.panel}
      </Card>
      <Card title={`Cicli di revisione inclusi · ${rev.version}`} action={state("revision-rules")}>
        <p>Quanti giri di revisione richiesti dal cliente sono inclusi per servizio. Il valore indicato sul singolo progetto prevale. Se per un servizio non è indicato nulla, ogni richiesta resta «da valutare» e decide una persona: nessuna lavorazione a pagamento parte da sola.</p>
        {vr.feedback}
        <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const rounds: Record<string, number> = {}; for (const line of String(f.get("rounds")).split("\n")) { const m = /^\s*([^=]+?)\s*=\s*(\d+)\s*$/.exec(line); if (m) rounds[m[1]!] = Number(m[2]); } vr.preview({ version: String(f.get("version")), roundsIncludedByService: rounds, autoStartIncluded: f.get("auto") === "on" }); }}>
          <label>Servizio = cicli inclusi (uno per riga)<textarea name="rounds" rows={4} defaultValue={Object.entries(rev.roundsIncludedByService).map(([k, n]) => `${k} = ${n}`).join("\n")} disabled={!data.canEdit} placeholder={"editing = 2\nproofreading = 1"} /><small>Il nome del servizio è quello del foglio d&apos;ordine del contratto.</small></label>
          <label className="platform-check"><input type="checkbox" name="auto" defaultChecked={rev.autoStartIncluded} disabled={!data.canEdit} />Avvia la revisione AI mirata quando la richiesta è inclusa (serve anche l&apos;opzione nelle regole dell&apos;AI)</label>
          <VersionField value={rev.version} />
          {data.canEdit ? <button className="platform-button" disabled={vr.busy}>Vedi cosa cambia</button> : null}
        </form>
        {vr.panel}
      </Card>
    </>
  );
}
/** Soglie della home dei venditori: raggruppano le trattative, non cambiano alcun record. */
function SellerRulesSection({ data, reload }: SectionProps) {
  const r = data.settings["seller-rules"] as { version: string; newLeadHours: number; unansweredDays: number; abandonedCheckoutHours: number; expiringDays: number };
  const v = useVersioned("seller-rules", reload);
  return (
    <Card title={`Home dei venditori · ${r.version}`} action={data.defaults.includes("seller-rules") ? <Tag tone="warn">Proposta da verificare</Tag> : <Tag tone="ok">Approvata</Tag>}>
      <p>Quando una trattativa compare tra i nuovi contatti, le proposte senza risposta, i pagamenti abbandonati o le proposte in scadenza nella scheda «Le mie vendite».</p>
      {v.feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); v.preview({ version: String(f.get("version")), newLeadHours: Number(f.get("newLeadHours")), unansweredDays: Number(f.get("unansweredDays")), abandonedCheckoutHours: Number(f.get("abandonedCheckoutHours")), expiringDays: Number(f.get("expiringDays")) }); }}>
        <label>Un contatto è «nuovo» per (ore)<input name="newLeadHours" type="number" min={1} max={336} defaultValue={r.newLeadHours} disabled={!data.canEdit} /></label>
        <label>Proposta «senza risposta» dopo (giorni senza attività)<input name="unansweredDays" type="number" min={1} max={60} defaultValue={r.unansweredDays} disabled={!data.canEdit} /></label>
        <label>Checkout «abbandonato» dopo (ore)<input name="abandonedCheckoutHours" type="number" min={1} max={336} defaultValue={r.abandonedCheckoutHours} disabled={!data.canEdit} /></label>
        <label>Proposta «in scadenza» entro (giorni)<input name="expiringDays" type="number" min={1} max={60} defaultValue={r.expiringDays} disabled={!data.canEdit} /></label>
        <VersionField value={r.version} />
        {data.canEdit ? <button className="platform-button" disabled={v.busy}>Vedi cosa cambia</button> : null}
      </form>
      {v.panel}
    </Card>
  );
}
function AutomationSection() {
  const st = useLoad<{ jobs: Array<{ job: string; label: string; expectedMinutes: number; lastAttempt: { at: string; status: string; trigger: string } | null; lastSuccess: string | null; lateMinutes: number | null; state: string; lastError: { at: string; error: string | null } | null }>; pending: Record<string, number> }>("crm/automation");
  const STATE: Record<string, [string, "ok" | "warn" | undefined]> = { ok: ["In regola", "ok"], late: ["In ritardo", "warn"], error: ["Errore", "warn"], never: ["Mai eseguito", "warn"] };
  const PENDING: Record<string, string> = { mail: "email in coda", mailFailed: "email non riuscite", webhooks: "consegne webhook in attesa", queuedLeads: "richieste senza responsabile", expiredReservations: "prenotazioni scadute da rilasciare", lateFirstResponses: "prime risposte in ritardo senza escalation", invoices: "fatture in coda" };
  return (
    <Card title="Attività automatiche">
      {st.data?.jobs.map((j) => (
        <div className="platform-row" key={j.job}>
          <span><strong>{j.label}</strong><small>Frequenza attesa: {j.expectedMinutes >= 1440 ? "una volta al giorno" : `ogni ${j.expectedMinutes} minuti`} · ultimo tentativo {j.lastAttempt ? `${new Date(j.lastAttempt.at).toLocaleString("it-IT")} (${j.lastAttempt.status}, ${j.lastAttempt.trigger === "manual" ? "manuale" : "pianificato"})` : "mai"} · ultima riuscita {j.lastSuccess ? new Date(j.lastSuccess).toLocaleString("it-IT") : "mai"}{j.lateMinutes ? ` · ritardo ${j.lateMinutes} min` : ""}</small>{j.lastError ? <small>Ultimo errore: {j.lastError.error}</small> : null}</span>
          <Tag tone={STATE[j.state]?.[1]}>{STATE[j.state]?.[0] ?? j.state}</Tag>
        </div>
      ))}
      <h3>In attesa</h3>
      <ul>{Object.entries(st.data?.pending ?? {}).map(([k, n]) => <li key={k}>{n} {PENDING[k] ?? k}</li>)}</ul>
      <h3>Come attivare la manutenzione frequente</h3>
      <p>Il cron di Vercel su piano Hobby gira al massimo una volta al giorno: copre le attività giornaliere (<code>/api/cron</code>). Per scadenze, code, prenotazioni e webhook serve una chiamata a <code>/api/cron/frequent</code> ogni 10–15 minuti, con l&apos;intestazione <code>Authorization: Bearer CRON_SECRET</code>. Opzioni senza costi: il workflow GitHub già incluso nel repository (pubblico, quindi gratuito; parte solo dal ramo predefinito, ogni 5 minuti al massimo e senza garanzie di puntualità) oppure cron-job.org (gratuito). Vercel Pro permette cron al minuto ma è a pagamento: non attivato.</p>
    </Card>
  );
}
function DiagnosticsSection() {
  const d = useLoad<{ checkedAt: string; items: Array<{ key: string; label: string; state: string; optional: boolean; detail: string; action?: string }> }>("crm/diagnostics");
  return (
    <Card title="Diagnostica delle integrazioni" action={d.data ? <small>Controllato {new Date(d.data.checkedAt).toLocaleString("it-IT")}</small> : null}>
      <p>«Configurata» vuol dire che le impostazioni ci sono; «verificata» che un fatto recente dimostra che funziona. Nessun segreto viene mostrato e nessun test invasivo viene eseguito.</p>
      {d.error ? <p className="platform-error">{d.error}</p> : null}
      {d.data?.items.map((i) => (
        <div className="platform-row" key={i.key}>
          <span><strong>{i.label}</strong>{i.optional ? <small> (facoltativa)</small> : null}<small>{i.detail}</small>{i.action ? <small>Da fare: {i.action}</small> : null}</span>
          <StateTag s={i.state} />
          {i.key === "google" && !/non impostato/.test(i.detail) ? <GoogleConnect /> : null}
        </div>
      ))}
    </Card>
  );
}
function GoogleConnect() {
  const { run, busy, feedback } = useRun();
  return <span>{feedback}<button className="platform-text-button" disabled={busy} onClick={() => run(async () => { const r = await api<{ url: string }>("studio/google/connect", "POST", {}); location.href = r.url; }, "Apertura di Google…")}>Collega o ricollega l&apos;account Google</button></span>;
}
function HistorySection() {
  const [key, setKey] = useState("assignment-rules");
  const h = useLoad<{ history: Array<{ key: string; version: string; approvedBy: string | null; createdAt: string; changes?: Change[] }> }>(`crm/settings/history?key=${key}`);
  return (
    <Card title="Storico delle regole">
      <label>Regola<select value={key} onChange={(e) => setKey(e.target.value)}>{["assignment-rules", "attribution-rules", "catalog", "pipelines", "loss-reasons", "brand", "crm-flows", "ops-rules", "ai-rules", "cost-rules", "revision-rules", "seller-rules"].map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      {h.data?.history.length ? h.data.history.map((x) => <details key={x.version}><summary>{x.version} · {new Date(x.createdAt).toLocaleString("it-IT")} · {x.approvedBy ?? "—"}</summary><ul>{x.changes?.map((c, i) => <li key={i}><code>{c.path}</code>: {show(c.from)} → {show(c.to)}</li>)}</ul></details>) : <p className="platform-empty">Nessuna versione approvata: sono in uso i valori proposti.</p>}
    </Card>
  );
}
