"use client";
/**
 * Il testo nell'area del cliente: ultima versione consegnata, commenti e
 * proposte di modifica raccolti in una richiesta di revisione, cicli inclusi e
 * download delle versioni autorizzate. Nessuna informazione interna: niente
 * lavorazioni AI, costi, note del team o file di lavoro.
 */
import { useEffect, useState } from "react";
import { MessageSquare, Send, FileText } from "lucide-react";
import { platformApi } from "@/components/platform/workspace";

type Paragraph = { id: string; text: string; style: string | null };
type ClientDoc = {
  id: string; title: string; access: "read" | "comment" | "suggest" | "edit";
  version: { label: string; approvedAt: string | null } | null;
  paragraphs: Paragraph[];
  comments: Array<{ id: string; paragraphId: string | null; quote: string | null; body: string; cycleId: string | null }>;
  suggestions: Array<{ id: string; paragraphId: string; originalText: string; suggestedText: string; status: string; cycleId: string | null }>;
  versions: Array<{ id: string; label: string; number: number; approvedAt: string | null; docxFileId: string | null; pdfFileId: string | null }>;
  cycles: Array<{ id: string; number: number; status: string; kind: string; submittedAt: string | null; open: boolean }>;
};
type Data = { documents: ClientDoc[]; rounds: { included: number | null; used: number } };
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("it-IT") : "");
const SUGGESTION: Record<string, string> = { pending: "in attesa", accepted: "accolta", modified: "accolta con modifiche", rejected: "non accolta", stale: "superata" };

export function ClientDocuments({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    platformApi<Data>(`studio/client/${projectId}`).then((r) => active && setData(r)).catch((e: Error) => active && setError(e.message));
    return () => { active = false; };
  }, [projectId, tick]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); setError(""); setNotice(""); try { await fn(); setNotice(ok); setTick((t) => t + 1); } catch (e) { setError(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); } };
  if (!data || !data.documents.length) return error ? <p className="platform-error">{error}</p> : null;
  return (
    <>
      {data.documents.map((doc) => <ClientDocument key={doc.id} doc={doc} rounds={data.rounds} busy={busy} run={run} />)}
      {error ? <p className="platform-error" role="alert">{error}</p> : null}
      {notice ? <p className="platform-notice" role="status">{notice}</p> : null}
    </>
  );
}
function ClientDocument({ doc, rounds, busy, run }: { doc: ClientDoc; rounds: Data["rounds"]; busy: boolean; run: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [active, setActive] = useState<string | null>(null), [mode, setMode] = useState<"comment" | "suggest">("comment");
  const open = doc.cycles.find((c) => c.open);
  const pendingComments = doc.comments.filter((c) => open && c.cycleId === open.id);
  const pendingSuggestions = doc.suggestions.filter((s) => open && s.cycleId === open.id);
  const canComment = doc.access !== "read", canSuggest = doc.access === "suggest" || doc.access === "edit";
  return (
    <article className="workspace-card client-doc">
      <span className="eyebrow">IL TUO TESTO</span>
      <h2>{doc.title}</h2>
      {!doc.version ? <p>La prima versione lavorata comparirà qui dopo la consegna del team.</p> : (
        <>
          <p>Stai leggendo <strong>{doc.version.label}</strong>{doc.version.approvedAt ? `, consegnata il ${date(doc.version.approvedAt)}` : ""}. {canComment ? "Seleziona un paragrafo per lasciare un'osservazione" : "Puoi leggere e scaricare il testo"}{canSuggest ? " o proporre una modifica" : ""}. Le osservazioni si raccolgono e partono insieme quando invii la richiesta di revisione.</p>
          <p><small>{rounds.included === null ? "I giri di revisione inclusi nel tuo contratto vengono confermati dal team alla prima richiesta." : `Giri di revisione inclusi: ${rounds.included}, usati: ${rounds.used}. Oltre quelli inclusi ti proporremo un preventivo prima di lavorare.`}</small></p>
          <div>
            {doc.paragraphs.map((p) => (
              <div key={p.id} className={`studio-paragraph${active === p.id ? " studio-paragraph-on" : ""}${p.style && /heading|titolo/i.test(p.style) ? " studio-heading" : ""}`}>
                <p onClick={() => canComment && setActive(active === p.id ? null : p.id)}>{p.text}</p>
                {doc.comments.filter((c) => c.paragraphId === p.id).map((c) => <p key={c.id} className="studio-comment studio-comment-client"><MessageSquare size={13} /> {c.body}</p>)}
                {doc.suggestions.filter((s) => s.paragraphId === p.id).map((s) => <p key={s.id} className="studio-comment studio-comment-client"><span className="studio-diff"><del>{s.originalText}</del> → <ins>{s.suggestedText || "(eliminare)"}</ins></span> · {SUGGESTION[s.status] ?? s.status}</p>)}
                {active === p.id ? (
                  <form className="author-upload" onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (mode === "comment") run(() => platformApi(`studio/client-docs/${doc.id}/comments`, "POST", { paragraphId: p.id, body: String(f.get("body")) }), "Osservazione aggiunta alla richiesta in preparazione.");
                    else run(() => platformApi(`studio/client-docs/${doc.id}/suggestions`, "POST", { paragraphId: p.id, originalText: String(f.get("original")), suggestedText: String(f.get("suggested")) }), "Proposta aggiunta alla richiesta in preparazione.");
                    setActive(null);
                  }}>
                    {canSuggest ? <span role="group" aria-label="Tipo di osservazione"><button type="button" className={mode === "comment" ? "author-cta" : "author-text-link"} onClick={() => setMode("comment")}>Commento</button> <button type="button" className={mode === "suggest" ? "author-cta" : "author-text-link"} onClick={() => setMode("suggest")}>Proponi una modifica</button></span> : null}
                    {mode === "comment" || !canSuggest ? <label>La tua osservazione<textarea name="body" required minLength={2} maxLength={5000} rows={3} /></label> : (
                      <>
                        <label>Testo da cambiare (copialo dal paragrafo)<input name="original" required maxLength={5000} /></label>
                        <label>Come vorresti che diventasse<input name="suggested" maxLength={5000} /></label>
                      </>
                    )}
                    <button className="author-cta" disabled={busy}>Aggiungi</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
          {canComment ? (
            <form className="author-upload" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const notes = String(f.get("notes") ?? "").trim(); if (!window.confirm("Inviare la richiesta di revisione? Le osservazioni raccolte partono insieme e non si possono più modificare.")) return; run(() => platformApi(`studio/client-docs/${doc.id}/revision-request`, "POST", { level: String(f.get("level")), ...(notes ? { notes } : {}) }), "Richiesta inviata: il team ti aggiornerà qui e per email."); }}>
              <h3>Richiesta di revisione</h3>
              <p>{pendingComments.length + pendingSuggestions.length ? `${pendingComments.length} osservazioni e ${pendingSuggestions.length} proposte pronte da inviare.` : "Nessuna osservazione raccolta: puoi anche descrivere qui cosa vorresti rivedere."}</p>
              <label>Descrizione generale (facoltativa)<textarea name="notes" rows={3} maxLength={5000} /></label>
              <label>Dove intervenire<select name="level" defaultValue="paragraph"><option value="paragraph">Solo i paragrafi indicati</option><option value="chapter">L&apos;intero capitolo dei paragrafi indicati</option><option value="document">Tutto il testo</option></select></label>
              <button className="author-cta" disabled={busy}><Send size={16} /> Invia richiesta di revisione</button>
            </form>
          ) : null}
        </>
      )}
      {doc.cycles.length ? <><h3>Le tue richieste</h3><ul>{doc.cycles.filter((c) => !c.open).map((c) => <li key={c.id}>Revisione n. {c.number}: {c.status} · {c.kind}{c.submittedAt ? ` · inviata il ${date(c.submittedAt)}` : ""}</li>)}</ul></> : null}
      {doc.versions.length ? <><h3>Versioni da scaricare</h3>{doc.versions.map((v) => <div className="author-action-line" key={v.id}><FileText size={18} /><span><strong>{v.label}</strong><small>{date(v.approvedAt)}</small></span>{v.docxFileId ? <a href={`/api/platform/files/${v.docxFileId}/download`}>DOCX</a> : null}{v.pdfFileId ? <a href={`/api/platform/files/${v.pdfFileId}/download`}>PDF</a> : null}</div>)}</> : null}
    </article>
  );
}
