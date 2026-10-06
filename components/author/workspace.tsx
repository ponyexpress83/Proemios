"use client";
import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import {
  BookOpen,
  Folder,
  CheckCircle2,
  Package,
  LogOut,
  ArrowRight,
  Download,
  X,
  Check,
  Menu,
  RotateCcw,
  Send,
} from "lucide-react";
import { Logo } from "@/components/editorial/brand";
import { Book } from "@/components/editorial/book";
import { BeforeAfter } from "@/components/editorial/before-after";
import {
  initialDemoState,
  restoreDemoState,
  validDemoSession,
  addDemoMessage,
  DEMO_SESSION_KEY,
  DEMO_STATE_KEY,
  DEMO_ORIGINAL,
  DEMO_REVISED,
  type DemoState,
} from "@/lib/author-demo";
import { computeQuote } from "@/lib/pricing";
import { euro } from "@/lib/format";
import {
  AUTHOR_SECTIONS as sections,
  authorSection,
  type AuthorSection as Section,
} from "./navigation";
const stages = [
  "Manoscritto",
  "Editing",
  "Revisione",
  "Copertina",
  "Impaginazione",
  "Pubblicazione",
];
export function AuthorWorkspace() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<DemoState>(initialDemoState);
  const [section, setSection] = useState<Section>("overview");
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<"original" | "revised" | null>(null);
  const [approval, setApproval] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      if (!validDemoSession(sessionStorage.getItem(DEMO_SESSION_KEY))) {
        window.location.replace("/accedi");
        return;
      }
      setState(restoreDemoState(sessionStorage.getItem(DEMO_STATE_KEY)));
      setSection(authorSection(new URLSearchParams(window.location.search).get("sezione")));
      setReady(true);
    } catch {
      window.location.replace("/accedi");
    }
  }, []);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
      } catch {
        setNotice(
          "Le modifiche restano visibili, ma questo browser non consente di salvarle nella scheda.",
        );
      }
  }, [ready, state]);
  useEffect(() => {
    if (!menu) return;
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [menu]);
  function go(next: Section) {
    setSection(next);
    setMenu(false);
    setNotice("");
  }
  function logout() {
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      sessionStorage.removeItem(DEMO_STATE_KEY);
    } finally {
      window.location.assign("/accedi");
    }
  }
  function download(revised = true) {
    const url = URL.createObjectURL(
      new Blob(
        [
          "PROEMIOS — ESEMPIO DIMOSTRATIVO\n\nCAPITOLO PRIMO — IL RITORNO\n\n" +
            (revised ? DEMO_REVISED : DEMO_ORIGINAL),
        ],
        { type: "text/plain;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = revised
      ? "proemios-capitolo-revisionato-demo.txt"
      : "proemios-manoscritto-demo.txt";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("File di esempio scaricato. Non contiene un manoscritto reale.");
  }
  const quote = computeQuote({
    projectType: "romanzo",
    textState: "finito-da-revisionare",
    wordCount: 50000,
  }).packages[1];
  if (!ready)
    return (
      <div className="workspace-loading" role="status">
        Apertura dello spazio demo…
      </div>
    );
  return (
    <div className="author-workspace">
      <aside className={"author-sidebar" + (menu ? " is-open" : "")}>
        <Logo />
        <div className="sidebar-label">IL TUO SPAZIO</div>
        <nav aria-label="Area autore">
          {sections.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              aria-current={section === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              {name}
              {id === "approvals" && !state.approved && <span className="sidebar-counter">1</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-project">
          <BookOpen size={23} />
          <strong>La forma delle storie</strong>
          <span>Romanzo · progetto demo</span>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          <LogOut size={18} /> Esci dalla demo
        </button>
      </aside>
      <div className="author-main">
        <header className="author-topbar">
          <button
            className="icon-button workspace-menu"
            aria-label={menu ? "Chiudi navigazione" : "Apri navigazione"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <span>Il tuo spazio / {sections.find((s) => s.id === section)?.name}</span>
          <div>
            <span className="demo-label">DEMO</span>
            <span className="author-avatar">AD</span>
            <strong>Autore demo</strong>
          </div>
        </header>
        <main id="contenuto" className="author-content">
          <div className="workspace-intro">
            <div>
              <p className="eyebrow">UNA STORIA, UN PERCORSO</p>
              <h1>
                {section === "overview" ? (
                  <>
                    La tua storia
                    <br />
                    <em>prende forma.</em>
                  </>
                ) : (
                  sections.find((s) => s.id === section)?.name
                )}
              </h1>
              <p>
                {section === "overview"
                  ? "Tutto quello che serve per il tuo prossimo passo, in un unico spazio."
                  : "Progetto dimostrativo · La forma delle storie"}
              </p>
            </div>
            <button
              className="text-link"
              onClick={() => {
                setState(initialDemoState());
                setNotice("Demo ripristinata: puoi provare di nuovo tutti i passaggi.");
              }}
            >
              <RotateCcw size={15} /> Ripristina demo
            </button>
          </div>
          <div className="workspace-demo-note">
            Ambiente di prova: progetto, messaggi e documenti sono esempi. Le azioni restano in
            questa scheda; nessuna email o transazione reale.
          </div>
          {notice && (
            <p className="workspace-notice" role="status">
              {notice}
            </p>
          )}
          {section === "overview" && (
            <>
              <div className="workspace-stat-grid">
                <article className="workspace-card">
                  <span>Fase del progetto</span>
                  <strong>{state.approved ? "Copertina" : "Revisione"}</strong>
                  <small className="status-pill lavender">
                    {state.approved ? "Pronto per il prossimo passo" : "In corso"}
                  </small>
                </article>
                <article className="workspace-card">
                  <span>Approvazioni</span>
                  <strong>{state.approved ? "Tutto aggiornato" : "Una tua scelta"}</strong>
                  <button className="text-link" onClick={() => go("approvals")}>
                    {state.approved ? "Rivedi la conferma" : "Leggi e approva"} →
                  </button>
                </article>
                <article className="workspace-card">
                  <span>Il tuo editor</span>
                  <strong>Team editoriale demo</strong>
                  <button className="text-link" onClick={() => go("messages")}>
                    Apri i messaggi →
                  </button>
                </article>
              </div>
              <div className="workspace-two-columns">
                <article className="workspace-card project-card">
                  <div>
                    <span className="eyebrow">IL TUO LIBRO</span>
                    <h2>La forma delle storie.</h2>
                    <p>Romanzo · 50.000 parole di esempio</p>
                    <div className="project-progress">
                      <span style={{ width: state.approved ? "50%" : "33%" }} />
                    </div>
                    <p>
                      {state.approved
                        ? "Revisione approvata. Passiamo alla copertina."
                        : "Editing completato. La revisione aspetta il tuo sguardo."}
                    </p>
                    <button className="button" onClick={() => go("project")}>
                      Segui il percorso <ArrowRight size={17} />
                    </button>
                  </div>
                  <Book small />
                </article>
                <article className="workspace-card">
                  <span className="eyebrow">ATTIVITÀ DEL PROGETTO</span>
                  <h2>Le ultime tappe.</h2>
                  <ul className="activity-list">
                    <li>
                      <Check size={17} />
                      <div>
                        <strong>Editing completato</strong>
                        <span>Il testo è pronto per il confronto.</span>
                      </div>
                    </li>
                    <li>
                      <Folder size={17} />
                      <div>
                        <strong>Nuova revisione disponibile</strong>
                        <span>Capitolo primo · versione 02</span>
                      </div>
                    </li>
                    {state.approved && (
                      <li>
                        <CheckCircle2 size={17} />
                        <div>
                          <strong>Hai approvato la revisione</strong>
                          <span>Conferma simulata in questa demo.</span>
                        </div>
                      </li>
                    )}
                  </ul>
                  <button className="text-link" onClick={() => go("files")}>
                    Apri i file →
                  </button>
                </article>
              </div>
            </>
          )}
          {section === "project" && (
            <>
              <article className="workspace-card">
                <div className="project-heading">
                  <div>
                    <span className="eyebrow">IL PERCORSO EDITORIALE</span>
                    <h2>La forma delle storie.</h2>
                    <p>Ogni consegna, condivisa. Ogni fase, visibile.</p>
                  </div>
                  <span className="status-pill lavender">
                    {state.approved ? "Copertina da avviare" : "Revisione in corso"}
                  </span>
                </div>
                <ol className="author-timeline">
                  {stages.map((s, i) => (
                    <li
                      key={s}
                      className={
                        i < (state.approved ? 3 : 2)
                          ? "done"
                          : i === (state.approved ? 3 : 2)
                            ? "current"
                            : ""
                      }
                    >
                      <span>{i < (state.approved ? 3 : 2) ? <Check size={18} /> : i + 1}</span>
                      <div>
                        <strong>{s}</strong>
                        <small>
                          {i < (state.approved ? 3 : 2)
                            ? "Completato"
                            : i === (state.approved ? 3 : 2)
                              ? "Prossimo passo"
                              : "Da iniziare"}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
                <button className="button" onClick={() => go("approvals")}>
                  {state.approved ? "Rivedi le approvazioni" : "Vai alla revisione da approvare"}
                  <ArrowRight size={17} />
                </button>
              </article>
              <div className="workspace-two-columns">
                <article className="workspace-card">
                  <h2>Il brief.</h2>
                  <p>
                    Un romanzo sul ritorno a casa, sulla memoria e sulle cose che cambiano.
                    Copertina corallo, formato cartaceo ed ebook. Brief inventato esclusivamente per
                    questa demo.
                  </p>
                </article>
                <article className="workspace-card">
                  <h2>Le consegne concordate.</h2>
                  <p>
                    Testo revisionato, proposta di copertina, interni per la stampa e file EPUB. Le
                    versioni definitive saranno visibili dopo l’approvazione delle rispettive fasi.
                  </p>
                </article>
              </div>
            </>
          )}
          {section === "messages" && (
            <article className="workspace-card messages-card">
              <h2>Una conversazione, tutto il progetto.</h2>
              <p>
                Risposte automatiche di esempio. Nessun messaggio viene inviato a persone reali.
              </p>
              <div
                className="demo-conversation"
                role="log"
                aria-label="Messaggi del progetto"
                aria-live="polite"
              >
                {state.messages.map((m) => (
                  <div key={m.id} className={"demo-message " + m.from}>
                    <span>{m.from === "author" ? "Tu · autore demo" : "Editor demo"}</span>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
              <form
                className="message-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  setState((s) => addDemoMessage(s, draft, crypto.randomUUID()));
                  setDraft("");
                }}
              >
                <label htmlFor="demo-message">Prova a scrivere al team</label>
                <textarea
                  id="demo-message"
                  value={draft}
                  maxLength={3000}
                  rows={3}
                  placeholder="Scrivi un messaggio di esempio, senza dati personali…"
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button className="button" type="submit" disabled={!draft.trim()}>
                  Invia nella demo <Send size={17} />
                </button>
              </form>
            </article>
          )}
          {section === "files" && (
            <article className="workspace-card">
              <h2>I file del tuo libro.</h2>
              <p>
                Versioni ordinate, senza cercare allegati. I documenti qui sotto sono esempi
                scaricabili in formato testo.
              </p>
              <div className="author-file-list">
                {[
                  {
                    id: "original" as const,
                    title: "Manoscritto · versione 01",
                    note: "Punto di partenza",
                  },
                  {
                    id: "revised" as const,
                    title: "Capitolo primo · revisione 02",
                    note: state.approved ? "Approvato" : "Da approvare",
                  },
                ].map((f) => (
                  <div className="author-file" key={f.id}>
                    <Folder size={24} />
                    <div>
                      <strong>{f.title}</strong>
                      <span>{f.note} · TXT di esempio</span>
                    </div>
                    <button className="text-link" onClick={() => setPreview(f.id)}>
                      Leggi
                    </button>
                    <button
                      className="icon-button"
                      aria-label={"Scarica " + f.title}
                      onClick={() => download(f.id === "revised")}
                    >
                      <Download size={20} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="button secondary" onClick={() => go("approvals")}>
                Vai alle approvazioni →
              </button>
            </article>
          )}
          {section === "approvals" && (
            <>
              <article className="workspace-card approval-card">
                <div>
                  <span className={"status-pill " + (state.approved ? "sage" : "peach")}>
                    {state.approved ? "Revisione approvata" : "In attesa del tuo parere"}
                  </span>
                  <h2>Il capitolo primo.</h2>
                  <p>
                    Confronta la versione originale e quella revisionata. La scelta finale resta
                    tua.
                  </p>
                </div>
                {state.approved ? (
                  <p role="status">
                    <CheckCircle2 size={20} /> Approvazione simulata registrata in questa scheda.
                  </p>
                ) : (
                  <button className="button" onClick={() => setApproval(true)}>
                    Approva la revisione <Check size={17} />
                  </button>
                )}
                <button className="text-link" onClick={() => go("messages")}>
                  Chiedi una modifica all’editor →
                </button>
              </article>
              <BeforeAfter />
            </>
          )}
          {section === "payments" && (
            <article className="workspace-card">
              <span className="eyebrow">COSTI CHIARI</span>
              <h2>Il preventivo del progetto demo.</h2>
              <p>
                Esempio calcolato con il listino reale: romanzo da 50.000 parole, finito da
                revisionare, percorso Consigliato. Non è un contratto o una fattura.
              </p>
              <div className="payment-summary">
                <div>
                  <span>Totale del percorso</span>
                  <strong>{euro(quote.total)}</strong>
                </div>
                <div>
                  <span>Acconto previsto</span>
                  <strong>{euro(quote.deposit)}</strong>
                </div>
                <span className="status-pill peach">Pagamento simulato: nessun addebito</span>
              </div>
              <details>
                <summary>Vedi i servizi del preventivo</summary>
                <ul className="payment-items">
                  {quote.lineItems.map((l) => (
                    <li key={l.key}>
                      <span>{l.label}</span>
                      <strong>{euro(l.amount)}</strong>
                    </li>
                  ))}
                </ul>
              </details>
              <button
                className="button secondary"
                onClick={() =>
                  setNotice(
                    "Nella demo non si apre alcun pagamento. Il checkout operativo richiede la configurazione del servizio di pagamento.",
                  )
                }
              >
                Prova il riepilogo pagamento →
              </button>
            </article>
          )}
          {section === "deliveries" && (
            <article className="workspace-card">
              <span className="eyebrow">LE TUE CONSEGNE</span>
              <h2>Dal testo ai file pronti.</h2>
              <p>
                I file definitivi arrivano dopo la tua approvazione. In questa demo puoi scaricare
                il capitolo revisionato; copertina ed EPUB sono tappe successive.
              </p>
              <div className="author-file-list">
                <div className="author-file">
                  <CheckCircle2 size={24} />
                  <div>
                    <strong>Capitolo revisionato · esempio</strong>
                    <span>
                      {state.approved
                        ? "Consegna demo approvata"
                        : "Disponibile per la tua revisione"}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Scarica capitolo revisionato"
                    onClick={() => download()}
                  >
                    <Download size={20} />
                  </button>
                </div>
                {["Copertina definitiva", "Interni per la stampa", "Ebook EPUB"].map((f) => (
                  <div className="author-file pending" key={f}>
                    <Package size={24} />
                    <div>
                      <strong>{f}</strong>
                      <span>Disponibile dopo la relativa fase</span>
                    </div>
                    <span className="status-pill">Da preparare</span>
                  </div>
                ))}
              </div>
            </article>
          )}
        </main>
      </div>
      <Dialog.Root
        open={preview !== null}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="assistant-overlay" />
          <Dialog.Content className="proemios-public document-dialog">
            <Dialog.Title>
              {preview === "original" ? "Manoscritto originale" : "Capitolo revisionato"}
            </Dialog.Title>
            <Dialog.Description>
              Documento dimostrativo · nessun manoscritto reale
            </Dialog.Description>
            <Dialog.Close className="document-close icon-button" aria-label="Chiudi documento">
              <X />
            </Dialog.Close>
            <div className="document-paper">
              <span>CAPITOLO PRIMO</span>
              <h2>Il ritorno</h2>
              <p>{preview === "original" ? DEMO_ORIGINAL : DEMO_REVISED}</p>
            </div>
            <button className="button" onClick={() => download(preview === "revised")}>
              Scarica l’esempio <Download size={18} />
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={approval} onOpenChange={setApproval}>
        <Dialog.Portal>
          <Dialog.Overlay className="assistant-overlay" />
          <Dialog.Content className="proemios-public document-dialog">
            <Dialog.Title>Confermi questa versione?</Dialog.Title>
            <Dialog.Description>
              Simuleremo l’approvazione del capitolo e l’avanzamento alla copertina. Puoi
              ripristinare la demo in ogni momento.
            </Dialog.Description>
            <div className="dialog-actions">
              <button
                className="button"
                onClick={() => {
                  setState((s) => ({ ...s, approved: true }));
                  setApproval(false);
                  setNotice(
                    "Revisione approvata nella demo. Il percorso ora passa alla copertina.",
                  );
                }}
              >
                Conferma approvazione <Check size={17} />
              </button>
              <Dialog.Close className="button secondary">Rileggi prima</Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
