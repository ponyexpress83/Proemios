"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Pipeline = "Nuovo" | "Da contattare" | "Qualificato" | "Call" | "Proposta" | "Acquisito" | "Perso";
type Opportunity = { id: string; title: string; category: string; owner: "Sales 1" | "Sales 2"; source: string; amount: number; stage: Pipeline; next: string; mode: string; installments: string };
const seed: Opportunity[] = [
  { id:"OP-1042",title:"Romanzo da revisionare",category:"Editing e pubblicazione",owner:"Sales 1",source:"Google Ads",amount:1350,stage:"Qualificato",next:"Chiamata diagnostica",mode:"Consulenziale",installments:"40% acconto / saldo" },
  { id:"OP-1043",title:"Memorie di famiglia",category:"Memoir e ghostwriting",owner:"Sales 2",source:"Meta Ads",amount:3800,stage:"Proposta",next:"Conferma percorso e scadenze",mode:"Consulenziale",installments:"40% + 30% + 20% + 10%" },
  { id:"OP-1044",title:"Conversione EPUB",category:"Produzione digitale",owner:"Sales 1",source:"Google Ads",amount:120,stage:"Nuovo",next:"Acquisto online (se idoneo)",mode:"Automatizzabile",installments:"Pagamento singolo" },
  { id:"OP-1045",title:"Traduzione russo-italiano",category:"Traduzione",owner:"Sales 2",source:"Referral",amount:300,stage:"Acquisito",next:"Assegnare traduttore",mode:"Su valutazione",installments:"50% + 50%" },
  { id:"OP-1046",title:"Edizione Kindle + cartaceo",category:"KDP e impaginazione",owner:"Sales 1",source:"Organico",amount:540,stage:"Acquisito",next:"Inizio produzione",mode:"Ibrido",installments:"3 rate da 180 €" },
  { id:"OP-1047",title:"Libro professionale",category:"Scrittura e consulenza",owner:"Sales 2",source:"LinkedIn",amount:6500,stage:"Call",next:"Inviare proposta personalizzata",mode:"Consulenziale",installments:"Milestone da concordare" },
  { id:"OP-1048",title:"Aggiornamento scheda Amazon",category:"Servizio aggiuntivo",owner:"Sales 1",source:"Cliente esistente",amount:150,stage:"Proposta",next:"Confermare modifica",mode:"Cross-sell",installments:"Pagamento singolo" },
  { id:"OP-1049",title:"Supporto editoriale mensile",category:"Retainer B2B",owner:"Sales 2",source:"Referral",amount:500,stage:"Qualificato",next:"Valutare contratto quadro",mode:"Ricorrente",installments:"500 €/mese (esempio)" },
];
const stages: Pipeline[] = ["Nuovo","Da contattare","Qualificato","Call","Proposta","Acquisito","Perso"];
const euros = (n:number) => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
const coral="#F16650",navy="#171A31",ivory="#FAF8F5",plum="#3B2943";
export default function TeamDemo(){
 const [items,setItems]=useState(seed);
 const [owner,setOwner]=useState("Tutti");
 const [query,setQuery]=useState("");
 const [tab,setTab]=useState<"pipeline"|"contratti"|"funnel">("pipeline");
 const [selected,setSelected]=useState<string|null>(null);
 const [noted,setNoted]=useState<Record<string,string>>({});
 const filtered=items.filter(x=>(owner==="Tutti"||x.owner===owner)&&(`${x.title} ${x.category} ${x.source}`.toLowerCase().includes(query.toLowerCase())));
 const counts=useMemo(()=>({total:items.length,open:items.filter(x=>!["Acquisito","Perso"].includes(x.stage)).length,won:items.filter(x=>x.stage==="Acquisito").length,proposal:items.filter(x=>x.stage==="Proposta").length}),[items]);
 const active=items.find(x=>x.id===selected);
 const card:React.CSSProperties={background:"white",border:"1px solid #ece7e4",borderRadius:18,padding:20,boxShadow:"0 8px 28px rgba(27,22,40,.04)"};
 const pill:React.CSSProperties={fontSize:12,fontWeight:700,background:"#f5ece8",color:"#5a4457",borderRadius:99,padding:"6px 10px"};
 const button:React.CSSProperties={padding:"10px 14px",borderRadius:12,border:"1px solid #e8ddd9",background:"white",color:navy,cursor:"pointer",fontWeight:650};
 const tag=(s:string)=> <span style={pill}>{s}</span>;
 return <div style={{fontFamily:"Inter,Arial,sans-serif",background:ivory,color:navy,minHeight:"100vh"}}>
 <div style={{background:navy,color:"white",padding:"12px max(20px,calc((100vw - 1300px)/2))",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
  <span style={{fontSize:12,letterSpacing:1.5,fontWeight:800}}>PROEMIOS · AMBIENTE DIMOSTRATIVO</span><span style={{fontSize:12,opacity:.85}}>Dati sintetici, nessun cliente o pagamento reale</span>
 </div>
 <div style={{maxWidth:1340,margin:"0 auto",padding:"28px 24px 60px"}}>
  <div style={{display:"flex",gap:16,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
   <div><Link href="/" style={{color:plum,fontSize:13}}>← Torna al sito</Link><h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(30px,4vw,47px)",margin:"12px 0 7px"}}>Il lavoro editoriale, sotto controllo.</h1><p style={{margin:0,color:"#746b77",fontSize:15}}>Anteprima per il team · Vendite, ordini, produzione e ricavi ricorrenti</p></div>
   <span style={{background:"#FEE5DC",color:"#9a382b",padding:"10px 16px",borderRadius:99,fontSize:13,fontWeight:800}}>DEMO · Non è il CRM live</span>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,margin:"28px 0 25px"}}>
   {[["Opportunità",counts.total,"cart"],["Da lavorare",counts.open,"calendar"],["Proposte inviate",counts.proposal,"file"],["Acquisiti",counts.won,"check"]].map(([label,num],i)=><div key={String(label)} style={card}><div style={{fontSize:13,color:"#736c75"}}>{label}</div><div style={{fontFamily:"Georgia,serif",fontSize:34,fontWeight:700,marginTop:10,color:i===3?coral:navy}}>{num}</div></div>)}
  </div>
  <div style={{display:"flex",gap:10,flexWrap:"wrap",borderBottom:"1px solid #e5ddd9",paddingBottom:13,marginBottom:22}}>
  {([["pipeline","Pipeline commerciale"],["contratti","Modelli di vendita"],["funnel","Percorso operativo"]] as const).map(([v,label])=><button key={v} onClick={()=>setTab(v)} style={{...button,background:tab===v?plum:"white",color:tab===v?"white":navy,borderColor:tab===v?plum:"#e8ddd9"}}>{label}</button>)}
  </div>
  {tab==="pipeline" && <>
   <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",marginBottom:18}}>
   <div><b>Le opportunità</b><p style={{fontSize:13,color:"#746b77",margin:"5px 0 0"}}>Apri una scheda per simulare il cambio fase e il follow-up.</p></div>
   <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
    <input aria-label="Cerca opportunità" placeholder="Cerca progetto o fonte…" value={query} onChange={e=>setQuery(e.target.value)} style={{...button,minWidth:210}}/>
    <select aria-label="Filtra venditore" value={owner} onChange={e=>setOwner(e.target.value)} style={button}><option>Tutti</option><option>Sales 1</option><option>Sales 2</option></select>
    <button style={button} onClick={()=>{setItems(seed);setNoted({});setSelected(null);}}>Ripristina demo</button>
   </div></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(205px,1fr))",gap:12,alignItems:"start"}}>
    {stages.map(stage=><section key={stage} style={{background:"#eee9e7",borderRadius:16,padding:12,minHeight:170}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:5,alignItems:"center",marginBottom:12,fontWeight:750,fontSize:14}}>{stage}<span style={{borderRadius:30,background:"white",padding:"4px 9px",fontSize:11}}>{filtered.filter(x=>x.stage===stage).length}</span></div>
     {filtered.filter(x=>x.stage===stage).map(x=><button key={x.id} onClick={()=>setSelected(x.id)} style={{...card,textAlign:"left",cursor:"pointer",padding:15,width:"100%",display:"block",marginBottom:9}}><span style={{fontSize:10,color:"#7c6e7e",fontWeight:700}}>{x.id} · {x.owner}</span><div style={{fontWeight:780,margin:"9px 0",fontSize:14}}>{x.title}</div><div style={{fontSize:12,color:"#766f7d"}}>{x.category}</div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12,gap:5}}><span style={{fontSize:12,color:"#765e72"}}>{x.source}</span><b style={{color:coral,fontSize:15}}>{euros(x.amount)}</b></div></button>)}
    </section>)}
   </div>
  </>}
  {tab==="contratti" && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(255px,1fr))",gap:15}}>
   {[
    ["01","Acquisto automatico","Correzione, EPUB, impaginazione semplice e servizi standard","Prezzo definito, condizioni approvate, checkout e avvio"],["02","Progetto personalizzato","Ghostwriting, memoir, editing approfondito e libri business","Call, diagnosi, preventivo versionato e milestones"],["03","Servizi successivi","Nuova traduzione, copertina, KDP, aggiornamento, marketing","Secondo ordine collegato al cliente e primo progetto"],["04","Contratto ricorrente","Supporto editoriale e accordi quadro B2B","Canone, ore incluse, extra, scadenze e rinnovi"],["05","Pagamento a rate","Acconto, milestone 40/30/20/10, 3 rate o condizioni custom","Scadenziario per contratto, incassi e solleciti"],["06","Traduzioni","Russo → italiano e altre combinazioni linguistiche","Prezzo da valutare su parole, lingua, revisione e tempi"],
   ].map(([id,title,description,route])=><div key={id} style={card}><span style={{fontFamily:"Georgia,serif",fontSize:32,color:coral}}>{id}</span><h2 style={{fontFamily:"Georgia,serif",fontSize:23,margin:"10px 0"}}>{title}</h2><p style={{lineHeight:1.55,color:"#655e69",fontSize:14}}>{description}</p><div style={{paddingTop:14,borderTop:"1px solid #eee6e3",fontSize:13,fontWeight:750,color:plum}}>{route}</div></div>)}
   </div>}
  {tab==="funnel" && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:15}}>
   {[
   ["1","Acquisizione","Google Search · Meta · SEO · AddLance · B2B · referral"],
   ["2","Ingresso","Preventivo o contatto → CRM. Servizi semplici verso checkout, progetti complessi verso sales."],
   ["3","Assegnazione","Due venditori: distribuzione inbound sui lead aperti. Notifiche e SLA ancora da completare."],
   ["4","Qualifica e call","Materiale, obiettivo, parole, tempi, compatibilità economica e decisore."],
   ["5","Proposta","Servizi e fasi, prezzo, condizioni, revisioni, acconti e scadenze."],
   ["6","Conferma","Contratto accettato → pagamento riconciliato → progetto in operations."],
   ["7","Produzione","Redazione, approvazioni, revisioni tracciate, consegne, saldo."],
   ["8","Crescita cliente","Nuovo servizio, traduzione, publishing, retainer, referral."],
   ].map(([n,title,desc])=><div key={n} style={{...card,borderTop:`4px solid ${coral}`}}><span style={{fontSize:12,fontWeight:850,color:coral}}>FASE {n}</span><h2 style={{fontFamily:"Georgia,serif",fontSize:23,margin:"10px 0"}}>{title}</h2><p style={{fontSize:14,lineHeight:1.6,color:"#6d6871"}}>{desc}</p></div>)}
   </div>}
  <div style={{marginTop:25,background:plum,color:"white",padding:"18px 22px",borderRadius:17,fontSize:13,lineHeight:1.6}}>
   <b>Nota di presentazione</b> · Le cifre e le opportunità della demo sono esempi sintetici dei tipi di contratto, non un riepilogo degli incassi reali. Il progetto candidato conserva accessi e infrastruttura protetti; notifiche sales, pagamenti ricorrenti e provider live devono essere ancora configurati e testati.
  </div>
 </div>
 {active && <div role="dialog" aria-modal="true" aria-label="Scheda opportunità" onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"rgba(20,15,27,.52)",display:"flex",justifyContent:"flex-end",zIndex:50}}>
  <div onClick={e=>e.stopPropagation()} style={{width:"min(100%,520px)",height:"100%",background:ivory,padding:30,overflow:"auto",boxShadow:"-15px 0 50px #0002"}}>
   <button onClick={()=>setSelected(null)} style={{...button,float:"right"}}>Chiudi ×</button>
   <span style={{fontSize:12,fontWeight:750,color:coral}}>{active.id} · {active.owner}</span><h2 style={{fontFamily:"Georgia,serif",fontSize:34,margin:"18px 0 8px"}}>{active.title}</h2><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:25}}>{tag(active.category)}{tag(active.source)}{tag(active.mode)}</div>
   <div style={{...card,marginBottom:17}}><div style={{color:"#706879",fontSize:13}}>Valore opportunità (demo)</div><div style={{fontFamily:"Georgia,serif",fontSize:38,margin:"8px 0",color:coral}}>{euros(active.amount)}</div><p style={{margin:0,fontSize:13}}>Pagamenti: {active.installments}</p></div>
   <label style={{fontWeight:750,display:"block",marginBottom:8}}>Fase commerciale</label>
   <select value={active.stage} onChange={e=>setItems(xs=>xs.map(x=>x.id===active.id?{...x,stage:e.target.value as Pipeline}:x))} style={{...button,width:"100%",marginBottom:22}}>{stages.map(s=><option key={s}>{s}</option>)}</select>
   <label style={{fontWeight:750,display:"block",marginBottom:8}}>Prossima azione</label><p style={{marginTop:0,color:"#645b68",fontSize:14}}>{active.next}</p>
   <label style={{fontWeight:750,display:"block",margin:"22px 0 8px"}}>Note dimostrative</label>
   <textarea rows={5} value={noted[active.id]??""} onChange={e=>setNoted(x=>({...x,[active.id]:e.target.value}))} placeholder="Esempio: cliente da richiamare venerdì; inviare versione 2 del preventivo…" style={{width:"100%",border:"1px solid #e0d7d4",borderRadius:12,padding:12,background:"white",color:navy}}/>
   <p style={{fontSize:12,color:"#897e8c"}}>Le modifiche sono soltanto nello stato locale della pagina e si perdono ricaricandola. Nessuna email o transazione viene inviata.</p>
  </div>
 </div>}
 </div>
}
