"use client";
/**
 * Home del venditore e assistente commerciale. Ogni indicatore si apre sulle
 * trattative che lo compongono; l'assistente restituisce solo una bozza da
 * rileggere e inviare a mano: niente invii, sconti o impegni automatici.
 */
import { useState } from "react";
import { api, useLoad, useRun, Tag, Card } from "./crm-views";

type DealCard = { id: string; title: string; contact: string; stage: string; nextAction: string | null; nextActionAt: string | null; amount: number | null };
type Home = {
  buckets: Array<{ key: string; label: string; hint: string; deals: DealCard[] }>;
  totals: { open: number; won: number; lost: number };
  commissions: { expected: { count: number; valueCents: number; note: string }; accrued: { count: number; cents: number }; held: Array<{ id: string; cents: number; reason: string; at: string }>; paid: { count: number; cents: number }; adjustments: { count: number; cents: number }; conflicts: Array<{ quoteId: string; detail: string }> };
  assistant: { enabled: boolean };
};
const eur = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100);
const when = (v: string | null) => (v ? new Date(v).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "senza data");

export function SellerHomeView() {
  const h = useLoad<Home>("crm/seller");
  const [open, setOpen] = useState<string | null>(null);
  if (h.error) return <p className="platform-error">{h.error}</p>;
  if (!h.data) return <p role="status">Caricamento…</p>;
  const d = h.data, c = d.commissions;
  const current = d.buckets.find((b) => b.key === open);
  return (
    <>
      <p>{d.totals.open} trattative aperte · {d.totals.won} vinte · {d.totals.lost} perse. Le fasi vengono dai fatti (proposte, accettazioni, incassi), come nel Kanban.</p>
      <div className="studio-indicators">
        {d.buckets.map((b) => (
          <button key={b.key} className={`studio-indicator seller-indicator${open === b.key ? " seller-indicator-on" : ""}`} aria-pressed={open === b.key} onClick={() => setOpen(open === b.key ? null : b.key)}>
            <span>{b.label}</span><strong>{b.deals.length}</strong><small>{b.hint}</small>
          </button>
        ))}
      </div>
      {current ? (
        <Card title={current.label}>
          {!current.deals.length ? <p className="platform-empty">Niente qui.</p> : current.deals.map((x) => (
            <div className="platform-row" key={x.id}>
              <span><strong><a href={`/spazio?tab=deals&deal=${x.id}`}>{x.title}</a></strong><small>{x.contact} · {x.stage}{x.amount ? ` · ${x.amount.toLocaleString("it-IT")} € + IVA` : ""}</small><small>{x.nextAction ? `Prossima azione: ${x.nextAction} (${when(x.nextActionAt)})` : "Nessuna prossima azione"}</small></span>
            </div>
          ))}
        </Card>
      ) : null}
      <Card title="Le tue provvigioni">
        <div className="studio-indicators">
          <div className="studio-indicator"><span>Previste</span><strong>{c.expected.count}</strong><small>{c.expected.count ? `vendite per ${eur(c.expected.valueCents)} di imponibile. ` : ""}{c.expected.note}</small></div>
          <div className="studio-indicator"><span>Maturate</span><strong>{eur(c.accrued.cents)}</strong><small>{c.accrued.count} su incassi verificati, da liquidare</small></div>
          <div className="studio-indicator"><span>Trattenute</span><strong>{eur(c.held.reduce((t, x) => t + x.cents, 0))}</strong><small>{c.held.length} in attesa di un esito</small></div>
          <div className="studio-indicator"><span>Pagate</span><strong>{eur(c.paid.cents)}</strong><small>{c.paid.count} liquidate</small></div>
          {c.adjustments.count ? <div className="studio-indicator"><span>Rettifiche</span><strong>{eur(c.adjustments.cents)}</strong><small>{c.adjustments.count} per rimborsi</small></div> : null}
        </div>
        {c.held.length ? <><h3>Perché sono trattenute</h3><ul>{c.held.map((x) => <li key={x.id}>{eur(x.cents)}: {x.reason}</li>)}</ul></> : null}
        {c.conflicts.length ? <><h3>Attribuzioni da chiarire</h3><ul>{c.conflicts.map((x) => <li key={x.quoteId}>{x.detail}</li>)}</ul><p><small>Finché il responsabile non decide, la provvigione non viene accreditata a nessuno.</small></p></> : null}
      </Card>
    </>
  );
}

type Draft = { channel: string; subject: string | null; draft: string; points: string[]; cautions: string[] };
export function SalesAssistant({ dealId }: { dealId: string }) {
  const { run, busy, feedback } = useRun();
  const [draft, setDraft] = useState<Draft | null>(null);
  const PURPOSES: Array<[string, string]> = [["follow_up", "Ricontatto"], ["reply", "Risposta all'ultimo messaggio"], ["objection", "Risposta a un dubbio"], ["call_summary", "Sintesi di una telefonata"]];
  return (
    <Card title="Assistente commerciale" action={<Tag>Solo bozze</Tag>}>
      <p><small>Scrive una bozza a partire dalla trattativa e dalle ultime attività. Non invia nulla, non propone sconti né impegni: rileggi, correggi e invia tu dal canale che il cliente ha autorizzato.</small></p>
      {feedback}
      <form className="platform-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const notes = String(f.get("notes") ?? "").trim(); run(async () => { const r = await api<{ draft: Draft }>(`crm/deals/${dealId}/assistant`, "POST", { purpose: f.get("purpose"), ...(notes ? { notes } : {}) }); setDraft(r.draft); }, "Bozza pronta."); }}>
        <label>Cosa ti serve<select name="purpose">{PURPOSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Indicazioni (facoltative)<textarea name="notes" rows={2} maxLength={3000} placeholder="Es. ha chiesto i tempi dell'editing" /></label>
        <button className="platform-button" disabled={busy}>Prepara la bozza</button>
      </form>
      {draft ? (
        <div className="crm-preview" role="region" aria-label="Bozza dell'assistente">
          <h3>Bozza ({draft.channel}){draft.subject ? `: ${draft.subject}` : ""}</h3>
          <textarea className="crm-pre" rows={8} defaultValue={draft.draft} aria-label="Testo della bozza" style={{ width: "100%" }} />
          {draft.points.length ? <ul>{draft.points.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
          {draft.cautions.length ? <><strong>Da verificare prima di inviare</strong><ul>{draft.cautions.map((p, i) => <li key={i}>{p}</li>)}</ul></> : null}
          <button className="platform-text-button" onClick={() => navigator.clipboard?.writeText(draft.draft)}>Copia il testo</button>
        </div>
      ) : null}
    </Card>
  );
}
