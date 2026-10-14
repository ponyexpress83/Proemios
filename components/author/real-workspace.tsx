"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { BookOpen,FolderOpen,CreditCard,MessageSquare,ClipboardCheck,FileText,ArrowRight,CheckCircle2,Clock3,LogOut,PlusCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { platformApi } from "@/components/platform/workspace";
import type { Grant } from "@/lib/platform/permissions";
type Props={user:{id:string;name:string;email:string;grants:Grant[]}};
type Project={id:string;title:string;type:string;description:string|null;stage:string;updatedAt:string;quoteId:string|null};
type Quote={id:string;stato:string;prezzoTotale:number|null;pacchettoScelto:string|null;acceptedAt:string|null;name?:string;version?:number;input?:{singleService?:string;requestedServices?:string[]}};
type FileEntry={id:string;name:string;version:number;status:string;kind:string};
type Detail={project:Project;files:FileEntry[];tasks:{id:string;title:string;done:boolean}[];approvals:unknown[]};
type QuoteDetail={quote:Quote&{input:{singleService?:string;requestedServices?:string[]}};packages:{tier:string;name:string;total:number;deposit:number;lineItems:{key:string;label:string;amount:number}[]}[];record:{version:number;acceptedAt:string|null;selectedTier:string|null};paymentPolicy:{version:string}|null};
const format=(v:number)=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(v);
const date=(s:string)=>new Date(s).toLocaleDateString("it-IT");
const stages=[{id:"brief",label:"Brief"},{id:"estimate",label:"Preventivo"},{id:"materials",label:"Materiali"},{id:"editing",label:"Lavorazione"},{id:"review",label:"Revisione"},{id:"approved",label:"Approvazione"},{id:"delivered",label:"Consegna"}];
const labels:Record<string,string>={brief:"Definizione del progetto",estimate:"Preventivo",materials:"Materiali da raccogliere",editing:"Lavorazione editoriale",review:"Revisione",approved:"Approvato",delivered:"Consegnato"};
const serviceNames:Record<string,string>={proofreading:"Correzione bozze",editing:"Editing",layout:"Impaginazione",epub:"EPUB",cover:"Copertina",kdp:"Pubblicazione KDP",isbn:"Assistenza ISBN",amazonListing:"Scheda Amazon"};
type View="overview"|"projects"|"quotes"|"payments"|"messages";
const nav:[View,string,typeof BookOpen][]=[["overview","Panoramica",BookOpen],["projects","I miei libri",FolderOpen],["quotes","Preventivi e servizi",FileText],["payments","Pagamenti",CreditCard],["messages","Messaggi e supporto",MessageSquare]];
export function RealAuthorWorkspace({user}:Props){
 const [view,setView]=useState<View>("overview"),[projects,setProjects]=useState<Project[]>([]),[quotes,setQuotes]=useState<Quote[]>([]),[selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null),[quote,setQuote]=useState<QuoteDetail|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[reload,setReload]=useState(0),[termsOk,setTermsOk]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);Promise.all([platformApi<{projects:Project[]}>("projects"),platformApi<{quotes:Quote[]}>("quotes")]).then(([a,b])=>{if(active){setProjects(a.projects??[]);setQuotes(b.quotes??[]);}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false}},[reload]);
 useEffect(()=>{if(!selected){setDetail(null);setQuote(null);return;}let active=true; const fn=view==="quotes"?platformApi<QuoteDetail>("quotes/"+selected):platformApi<Detail>("projects/"+selected);fn.then(data=>{if(active){if(view==="quotes")setQuote(data as QuoteDetail);else setDetail(data as Detail);}}).catch(e=>active&&setError(e.message));return()=>{active=false}},[selected,view,reload]);
 async function action(fn:()=>Promise<unknown>){setError("");setBusy(true);try{await fn();setReload(x=>x+1)}catch(e){setError(e instanceof Error?e.message:"Operazione non riuscita.")}finally{setBusy(false)}}
 const open=(v:View,id?:string)=>{setView(v);setSelected(id??null);setError("")};
 const latest=projects[0];const pending=quotes.filter(q=>!q.acceptedAt).length;
 const selectedProject=detail?.project;
 const linkedQuote=selectedProject?.quoteId?quotes.find(q=>q.id===selectedProject.quoteId):undefined;
 const qlines=quote?.packages.find(x=>x.tier===quote.record.selectedTier)?.lineItems??quote?.packages[0]?.lineItems??[];
 const serviceSummary=(q:Quote)=>q.input?.singleService?serviceNames[q.input.singleService]??q.input.singleService:"Percorso editoriale";
 return <div className="author-workspace proemios-author-real">
 <aside className="author-sidebar">
  <Link href="/" className="author-logo">proemios<span>Dalle idee alle opere</span></Link>
  <p className="sidebar-label">IL TUO SPAZIO</p>
  <nav aria-label="Navigazione autore">{nav.map(([id,label,Icon])=><button type="button" key={id} className={view===id?"active":""} onClick={()=>open(id)}><Icon size={19}/>{label}{id==="quotes"&&pending>0?<span className="sidebar-counter">{pending}</span>:null}</button>)}</nav>
  <div className="sidebar-project"><BookOpen size={22}/><strong>{latest?.title??"Il tuo prossimo libro"}</strong><span>{latest?labels[latest.stage]??latest.stage:"Il tuo progetto inizia da qui"}</span></div>
  <button className="sidebar-logout" onClick={()=>authClient.signOut().then(()=>window.location.assign("/accedi"))}><LogOut size={18}/> Esci</button>
 </aside>
 <div className="author-main">
  <header className="author-topbar"><span>Il tuo spazio / {nav.find(([v])=>v===view)?.[1]}</span><div><span className="author-avatar">{user.name.slice(0,2).toUpperCase()}</span><strong>{user.name}</strong></div></header>
  <main id="contenuto" className="author-content">
   <div className="workspace-intro"><div><p className="eyebrow">PROEMIOS · AREA AUTORE</p><h1>{view==="overview"?<>La tua storia <em>prende forma.</em></>:nav.find(([v])=>v===view)?.[1]}</h1><p>{view==="overview"?"Tieni sotto controllo i progetti, le lavorazioni acquistate e ogni prossimo passo.":"Il tuo percorso editoriale, dall'idea alla consegna."}</p></div><Link className="author-cta" href="/preventivo">Nuovo preventivo <ArrowRight size={16}/></Link></div>
   {error&&<div className="platform-error" role="alert">{error}</div>}
   {loading?<p role="status">Caricamento dei tuoi progetti e preventivi…</p>:<>
   {view==="overview"&&<>
    <div className="workspace-stat-grid">
     <article className="workspace-card"><span>Progetti editoriali</span><strong>{projects.length}</strong><button className="author-text-link" onClick={()=>open("projects")}>Vai ai progetti →</button></article>
     <article className="workspace-card"><span>Preventivi da valutare</span><strong>{pending}</strong><button className="author-text-link" onClick={()=>open("quotes")}>Apri i preventivi →</button></article>
     <article className="workspace-card"><span>Prossimo passo</span><strong>{latest?labels[latest.stage]??"In lavorazione":"Scegli il tuo servizio"}</strong><button className="author-text-link" onClick={()=>latest?open("projects",latest.id):window.location.assign("/preventivo")}>{latest?"Segui il progetto →":"Calcola un preventivo →"}</button></article>
    </div>
    <div className="workspace-two-columns">
     <article className="workspace-card project-card"><div><span className="eyebrow">IL TUO LIBRO</span><h2>{latest?.title??"Ogni libro comincia da un'idea."}</h2><p>{latest?.description??"Anche se desideri soltanto una correzione bozze, il percorso segue unicamente i servizi concordati."}</p>{latest&&<div className="project-progress"><span style={{width:`${Math.max(8,(stages.findIndex(s=>s.id===latest.stage)+1)/stages.length*100)}%`}}/></div>}<button className="author-cta" onClick={()=>latest?open("projects",latest.id):window.location.assign("/preventivo")}>{latest?"Segui il percorso":"Scegli un servizio"} <ArrowRight size={16}/></button></div><BookOpen className="author-book-symbol" size={120} strokeWidth={1}/></article>
     <article className="workspace-card"><span className="eyebrow">PROSSIME ATTIVITÀ</span><h2>Le cose importanti.</h2>{quotes.filter(q=>!q.acceptedAt).slice(0,3).map(q=><button className="author-action-line" key={q.id} onClick={()=>open("quotes",q.id)}><Clock3 size={18}/><span><strong>Preventivo da valutare</strong><small>{serviceSummary(q)} · {q.prezzoTotale?format(q.prezzoTotale):"Da confermare"}</small></span></button>)}{latest&&<button className="author-action-line" onClick={()=>open("projects",latest.id)}><CheckCircle2 size={18}/><span><strong>Stato del libro</strong><small>{labels[latest.stage]??latest.stage}</small></span></button>}{!quotes.length&&!projects.length&&<p>Non ci sono ancora attività. Puoi iniziare dal preventivatore.</p>}</article>
    </div>
   </>}
   {view==="projects"&&<>{selected?<>
    <button className="author-text-link" onClick={()=>setSelected(null)}>← Tutti i progetti</button>
    {detail?<><article className="workspace-card"><span className="eyebrow">IL PERCORSO EDITORIALE</span><h2>{detail.project.title}</h2><p>{detail.project.description}</p><ol className="author-timeline">{stages.map((s,i)=>{const current=stages.findIndex(x=>x.id===detail.project.stage),done=i<current,now=i===current;return <li key={s.id} className={done?"done":now?"current":""}><span>{done?<CheckCircle2 size={18}/>:i+1}</span><div><strong>{s.label}</strong><small>{done?"Completato":now?"Fase attuale":"Da iniziare"}</small></div></li>})}</ol>{linkedQuote&&<p>Servizio acquistato: {serviceSummary(linkedQuote)}</p>}<p>Queste sono le fasi operative della piattaforma; la produzione esegue esclusivamente le lavorazioni concordate.</p></article><div className="workspace-two-columns"><article className="workspace-card"><h2>File e revisioni</h2>{detail.files.length?detail.files.map(f=><div className="author-action-line" key={f.id}><FolderOpen size={18}/><span><strong>{f.name}</strong><small>Versione {f.version} · {f.status}</small></span><a href={`/api/platform/files/${f.id}/download`}>Scarica</a></div>):<p>Il team non ha ancora caricato documenti.</p>}</article><article className="workspace-card"><h2>Attività</h2>{detail.tasks.length?detail.tasks.map(t=><p key={t.id}>{t.done?"✓":"○"} {t.title}</p>):<p>Non ci sono attività aperte.</p>}</article></div></>:<p>Caricamento progetto…</p>}
   </>:<div className="author-real-grid">{projects.map(p=><button className="workspace-card author-project-choice" key={p.id} onClick={()=>setSelected(p.id)}><span className="status-pill peach">{labels[p.stage]??p.stage}</span><h2>{p.title}</h2><p>{p.description??"Il tuo progetto editoriale."}</p><small>Aggiornato il {date(p.updatedAt)}</small><strong>Apri il progetto →</strong></button>)}{!projects.length&&<article className="workspace-card"><h2>Non hai ancora progetti.</h2><p>Una volta accettato un preventivo, il tuo percorso comparirà qui.</p><Link className="author-cta" href="/preventivo">Richiedi un preventivo <ArrowRight size={16}/></Link></article>}</div>}</>}
   {view==="quotes"&&<>{selected?<>
    <button className="author-text-link" onClick={()=>setSelected(null)}>← Tutti i preventivi</button>
    {quote?<article className="workspace-card"><span className="eyebrow">PROPOSTA PERSONALE</span><h2>{quote.quote.input.singleService?serviceNames[quote.quote.input.singleService]:"Il tuo percorso editoriale"}</h2><p>{quote.record.acceptedAt?"Proposta accettata":"Verifica lavorazioni, importo e condizioni prima della conferma."}</p>{!quote.record.acceptedAt&&<label className="author-terms"><input type="checkbox" checked={termsOk} onChange={e=>setTermsOk(e.target.checked)}/> Confermo di aver letto e accettato le condizioni contrattuali e di pagamento associate alla proposta.</label>}<div className="author-real-grid">{quote.packages.filter((p,i,all)=>all.findIndex(o=>o.tier===p.tier)===i).map(p=><div className="author-quote-card" key={p.tier}><strong>{p.name}</strong><h2>{format(p.total)}</h2><small>Acconto indicativo {format(p.deposit)}</small><ul>{p.lineItems.map(li=><li key={li.key}>{li.label} · {format(li.amount)}</li>)}</ul>{!quote.record.acceptedAt&&<button className="author-cta" disabled={busy||!quote.paymentPolicy||!termsOk} onClick={()=>action(()=>platformApi(`quotes/${selected}/accept`,"POST",{tier:p.tier,version:quote.record.version,policyVersion:quote.paymentPolicy?.version,termsAccepted:true}))}>Accetta questa proposta →</button>}</div>)}</div>{!quote.paymentPolicy&&<p className="platform-notice">Le condizioni fiscali non sono ancora state validate dal team. L'accettazione e il pagamento restano disabilitati.</p>}<Link href="/contatti">Hai domande? Scrivi a Proemios →</Link></article>:<p>Caricamento preventivo…</p>}
   </>:<div className="author-real-grid">{quotes.map(q=><button className="workspace-card author-project-choice" key={q.id} onClick={()=>setSelected(q.id)}><span className="status-pill lavender">{q.acceptedAt?"Accettato":"Da valutare"}</span><h2>{serviceSummary(q)}</h2><p>{q.prezzoTotale?format(q.prezzoTotale):"Importo da confermare"} · {serviceSummary(q)}</p><strong>Apri i dettagli →</strong></button>)}{!quotes.length&&<article className="workspace-card"><h2>Nessun preventivo.</h2><p>Vuoi una sola correzione bozze o un percorso completo? Puoi scegliere il servizio.</p><Link className="author-cta" href="/preventivo">Calcola il preventivo <PlusCircle size={16}/></Link></article>}</div>}</>}
   {view==="payments"&&<article className="workspace-card"><span className="eyebrow">PAGAMENTI E SCADENZE</span><h2>Le tue proposte accettate.</h2><p>Puoi aprire il pagamento soltanto dopo aver accettato le condizioni della tua proposta. Il saldo è verificato da Stripe e non viene marcato pagato dal solo ritorno alla pagina.</p>{quotes.filter(q=>q.acceptedAt).map(q=><div className="author-action-line" key={q.id}><CreditCard size={20}/><span><strong>{serviceSummary(q)}</strong><small>{q.prezzoTotale?format(q.prezzoTotale):"Importo da definire"}</small></span><button disabled={busy} className="author-cta" onClick={()=>action(async()=>{const r=await platformApi<{url:string}>("checkout","POST",{quoteId:q.id,kind:"deposit"});if(r.url)window.location.assign(r.url)})}>Vai al pagamento →</button></div>)}{!quotes.some(q=>q.acceptedAt)&&<p>Non hai ancora proposte accettate.</p>}</article>}
   {view==="messages"&&<article className="workspace-card"><h2>Messaggi con il team editoriale</h2>{projects.length?<AuthorMessages projects={projects}/>:<><p>Non ci sono ancora progetti collegati al tuo account. Per informazioni generali puoi scriverci.</p><Link className="author-cta" href="/contatti">Contatta Proemios <ArrowRight size={16}/></Link></>}</article>}
   </>}
  </main>
 </div></div>
}

function AuthorMessages({projects}:{projects:Project[]}){
 const [projectId,setProjectId]=useState(projects[0]?.id??"");
 const [items,setItems]=useState<{id:string;body:string;name:string;createdAt:string}[]>([]);
 const [draft,setDraft]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [reload,setReload]=useState(0);
 useEffect(()=>{let live=true;setError("");platformApi<{messages:typeof items}>(`projects/${projectId}/messages`).then(v=>{if(live)setItems(v.messages??[])}).catch(e=>live&&setError(e.message));return()=>{live=false}},[projectId,reload]);
 return <div className="author-conversation">
  <label>Il progetto <select value={projectId} onChange={e=>setProjectId(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
  {error&&<p role="alert" className="platform-error">{error}</p>}
  <div className="author-message-thread" role="log">{items.length?items.map(m=><div key={m.id} className="author-message"><strong>{m.name}</strong><small>{date(m.createdAt)}</small><p>{m.body}</p></div>):<p>Nessun messaggio ancora. Scrivi al team per iniziare.</p>}</div>
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await platformApi(`projects/${projectId}/messages`,"POST",{body:draft,internal:false});setDraft("");setReload(x=>x+1)}catch(err){setError(err instanceof Error?err.message:"Invio non riuscito")}finally{setBusy(false)}}}>
   <label htmlFor="author-message-draft">Il tuo messaggio</label>
   <textarea id="author-message-draft" rows={4} maxLength={8000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Scrivi al team editoriale…"/>
   <button type="submit" className="author-cta" disabled={busy||!draft.trim()}><MessageSquare size={16}/> Invia messaggio</button>
  </form>
 </div>;
}
