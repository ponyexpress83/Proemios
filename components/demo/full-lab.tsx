"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
 DEMO_STORAGE_KEY, roles, offerings, initialDemoState, createOrder, paymentAction,
 leadAction, progressAction, demoStats, estimateOffer, paidCents, euro,
 type DemoRole, type DemoKind, type DemoPlan, type DemoState, type DemoLeadStage
} from "@/lib/demo-business";

const colors={navy:"#171A31",coral:"#F16650",plum:"#3B2943",ivory:"#FAF8F5",grey:"#756B78"};
const card:React.CSSProperties={background:"#fff",border:"1px solid #ebe5e0",borderRadius:20,padding:22,boxShadow:"0 8px 26px rgba(29,22,43,.04)"};
const control:React.CSSProperties={border:"1px solid #ded5d2",padding:"11px 13px",background:"white",borderRadius:11,minHeight:42,color:colors.navy};
const primary:React.CSSProperties={...control,background:colors.coral,color:"white",border:"none",fontWeight:750,cursor:"pointer"};
const soft:React.CSSProperties={...control,fontWeight:700,cursor:"pointer"};
const muted:React.CSSProperties={color:colors.grey,fontSize:13,lineHeight:1.6};
const allPlans: {id:DemoPlan;label:string}[]=[
 {id:"unica",label:"Pagamento unico"},
 {id:"acconto",label:"Acconto 40% e saldo 60%"},
 {id:"tre_rate",label:"Tre rate · 34/33/33"},
 {id:"quattro_rate",label:"Quattro rate · 40/30/20/10"},
 {id:"mensile",label:"Prima mensilità, demo non ricorrente"},
];
function Section({title,children,description}:{title:string;children:React.ReactNode;description?:string}){
 return <section style={{...card,marginTop:18}}><h2 style={{fontFamily:"Georgia,serif",fontSize:27,margin:"0 0 8px"}}>{title}</h2>{description&&<p style={muted}>{description}</p>}{children}</section>
}
function Chip({children}:{children:React.ReactNode}){return <span style={{borderRadius:99,padding:"5px 10px",background:"#f6ebe6",color:colors.plum,fontSize:12,fontWeight:750}}>{children}</span>}
export default function DemoLab(){
 const [state,setState]=useState<DemoState>(initialDemoState);
 const [role,setRole]=useState<DemoRole>("autore");
 const [service,setService]=useState<DemoKind>("proofreading");
 const [words,setWords]=useState(35000);
 const [plan,setPlan]=useState<DemoPlan>("acconto");
 const [parentId,setParentId]=useState("");
 const [referral,setReferral]=useState(false);
 const [selected,setSelected]=useState<string>("");
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{const raw=window.sessionStorage.getItem(DEMO_STORAGE_KEY);if(raw){const obj=JSON.parse(raw) as DemoState;if(obj.version===1&&Array.isArray(obj.orders)&&Array.isArray(obj.leads))setState(obj)}}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)try{window.sessionStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(state))}catch{}},[state,ready]);
 const current=state.orders.find(o=>o.id===selected)??state.orders[0];
 const chosen=offerings.find(o=>o.id===service)!;
 const stats=demoStats(state);
 const roleTitle=roles.find(r=>r.id===role)?.title??role;
 const isSeller=role==="sales1"||role==="sales2";
 const sellerLabel=role==="sales1"?"Sales 1":"Sales 2";
 const allowedOrders=role==="autore"?state.orders:role==="affiliato"?state.orders.filter(o=>o.affiliate):isSeller?state.orders.filter(o=>o.seller===sellerLabel):state.orders;
 const summary=(label:string,value:string)=> <div style={card}><p style={{...muted,margin:0}}>{label}</p><strong style={{fontFamily:"Georgia,serif",fontSize:27,display:"block",marginTop:12}}>{value}</strong></div>;
 const change=(fn:(s:DemoState)=>DemoState)=>setState(fn);
 const orderForm=<>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginTop:20}}>
   <label style={{display:"grid",gap:8,fontWeight:650}}>Servizio
    <select style={control} value={service} onChange={e=>setService(e.target.value as DemoKind)}>{offerings.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>
   </label>
   {chosen.requiresWords&&<label style={{display:"grid",gap:8,fontWeight:650}}>Parole del testo
    <input style={control} type="number" value={words} min={1} max={2_000_000} onChange={e=>setWords(Math.max(1,Math.min(2_000_000,Number(e.target.value)||1)))}/>
   </label>}
   <label style={{display:"grid",gap:8,fontWeight:650}}>Piano pagamenti dimostrativo
    <select style={control} value={plan} onChange={e=>setPlan(e.target.value as DemoPlan)}>{allPlans.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>
   </label>
   <label style={{display:"grid",gap:8,fontWeight:650}}>Ordine precedente
    <select style={control} value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Nuovo cliente / progetto</option>{state.orders.map(o=><option key={o.id} value={o.id}>{o.id} · {o.title}</option>)}</select>
   </label>
  </div>
  <label style={{display:"flex",gap:10,alignItems:"center",marginTop:16,fontSize:14}}><input type="checkbox" checked={referral} onChange={e=>setReferral(e.target.checked)}/> Simula acquisizione con codice affiliato</label>
  <div style={{display:"flex",justifyContent:"space-between",gap:15,flexWrap:"wrap",alignItems:"center",marginTop:22,padding:"20px",borderRadius:14,background:"#F9F3EF"}}>
   <div><p style={{...muted,margin:"0 0 5px"}}>Valore simulazione · IVA esclusa</p><b style={{fontFamily:"Georgia,serif",fontSize:35}}>{euro(estimateOffer(service,words))}</b><p style={{...muted,margin:"7px 0 0"}}>{chosen.automated?"Servizio standard: ipotesi di acquisto online":"Servizio soggetto a conferma manuale"} · {chosen.subtitle}</p></div>
   <button style={primary} onClick={()=>{
    const next=createOrder(state,{kind:service,words,plan,parentOrderId:parentId||undefined,affiliate:referral});
    if(next!==state){setSelected(next.orders[0]?.id??"");setState(next);setRole("autore");}
   }}>Crea ordine di prova →</button>
  </div>
  <p style={muted}>Nessun contratto viene accettato, nessuna fattura o transazione viene prodotta. Per le traduzioni e i contratti mensili, i valori sono esclusivamente scenari di esempio.</p>
 </>;
 const orderDetails=current&&<div style={{...card,marginTop:17}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"start"}}>
   <div><Chip>{current.id}</Chip><h3 style={{fontFamily:"Georgia,serif",fontSize:24,margin:"10px 0"}}>{current.title}</h3><p style={muted}>{current.source} · {current.seller}{current.parentOrderId?` · Aggiuntivo a ${current.parentOrderId}`:""}</p></div>
   <Chip>{current.stage.replaceAll("_"," ")}</Chip>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginTop:14}}>
   {summary("Totale previsto",euro(current.totalCents))}
   {summary("Pagato (simulato)",euro(paidCents(current)))}
   {summary("Da pagare",euro(current.totalCents-paidCents(current)))}
  </div>
  {(role==="autore"||role==="finance"||role==="admin")&&<>
  <h4 style={{fontSize:17,margin:"24px 0 14px"}}>Scadenziario e pagamento test</h4>
  {current.installments.map(x=><div key={x.id} style={{display:"flex",alignItems:"center",gap:12,justifyContent:"space-between",borderTop:"1px solid #eee",padding:"13px 2px",flexWrap:"wrap"}}>
    <span style={{fontSize:14}}>{x.label}</span><b>{euro(x.amountCents)}</b>
    {x.status==="pagata"?<Chip>Pagata nella demo</Chip>:role==="autore"?<div style={{display:"flex",gap:8}}><button style={primary} onClick={()=>change(s=>paymentAction(s,current.id,x.id,true))}>Simula pagamento riuscito</button><button style={soft} onClick={()=>change(s=>paymentAction(s,current.id,x.id,false))}>Simula rifiuto</button></div>:<Chip>Da pagare</Chip>}
   </div>)}
   <p style={muted}>Questo è un emulatore di pagamento: non contiene Stripe Checkout né elabora carte. Le rate vengono segnate nel browser della demo.</p>
  </>}
  {(role==="operatore"||role==="redattore")&&<div style={{marginTop:20,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <b>Stato operativo: {current.stage.replaceAll("_"," ")}</b>
   <button style={primary} onClick={()=>change(s=>progressAction(s,current.id,role))} disabled={role==="operatore"?!((current.stage==="in_lavorazione")||(current.stage==="approvato"&&paidCents(current)===current.totalCents)):current.stage!=="in_revisione"}>
     {role==="redattore"?"Approva contenuto (simulato)":current.stage==="approvato"?"Consegna (simulata)":"Invia in revisione"}
   </button>
   <p style={muted}>Nella versione reale il passaggio richiede file/versione, revisione effettiva e approvazioni tracciabili da persone autorizzate.</p>
  </div>}
  {role==="affiliato"&&<p style={muted}>Referral associato a codice dimostrativo. Nessun nome cliente e nessuna commissione è effettivamente esigibile.</p>}
 </div>;
 return <main id="contenuto" style={{minHeight:"100vh",background:colors.ivory,color:colors.navy,fontFamily:"Inter,Arial,sans-serif"}}>
  <div style={{background:colors.plum,color:"white",padding:"12px 22px",textAlign:"center",fontSize:12,fontWeight:800,letterSpacing:1}}>SANDBOX PROEMIOS · DATI FITTIZI · NESSUNA AUTENTICAZIONE O TRANSAZIONE REALE</div>
  <div style={{maxWidth:1280,margin:"0 auto",padding:"35px 24px 80px"}}>
   <Link href="/" style={{color:colors.plum,fontSize:14}}>← Vai alla landing Proemios</Link>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap",marginTop:25}}>
    <div><p style={{letterSpacing:3,fontSize:12,fontWeight:800,color:colors.coral}}>DEMO END-TO-END · TEAM</p><h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(35px,5vw,58px)",lineHeight:1.1,margin:"12px 0"}}>Dalla richiesta al libro.</h1><p style={{fontSize:16,color:colors.grey,maxWidth:720}}>Prova preventivo, ordine, pagamento, CRM, operazioni e affiliazione in un unico ambiente interattivo.</p></div>
    <button style={soft} onClick={()=>{setState(initialDemoState());setSelected("");if(typeof window!=="undefined")window.sessionStorage.removeItem(DEMO_STORAGE_KEY)}}>Ricomincia demo</button>
   </div>
   <Section title="Scegli quale account esplorare" description="Questi sono profili dimostrativi locali, non account reali: le autorizzazioni vere sono gestite separatamente nell’applicazione.">
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginTop:19}}>
     {roles.map(r=><button key={r.id} onClick={()=>setRole(r.id)} aria-pressed={role===r.id} style={{...control,cursor:"pointer",textAlign:"left",border:role===r.id?`2px solid ${colors.coral}`:"1px solid #e8ddda",background:role===r.id?"#FFF0E9":"white"}}>
      <b style={{display:"block",fontSize:14}}>{r.title}</b><span style={{display:"block",fontSize:11,color:colors.grey,marginTop:6,lineHeight:1.4}}>{r.description}</span>
     </button>)}
    </div>
   </Section>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"20px 0"}}>
    {summary("Lead nella demo",String(stats.leads))}
    {summary("Ordini di prova",String(stats.orders))}
    {summary("Valore ordini",euro(stats.contracted))}
    {summary("Pagamenti simulati",euro(stats.collected))}
   </div>
   {role==="autore"&&<>
    <Section title="1 · Crea il tuo preventivo e ordine" description="Scegli una lavorazione reale del catalogo. La stima proviene dal motore prezzi Proemios esistente. Le condizioni commerciali personalizzate sono soltanto esempi nella sandbox.">{orderForm}</Section>
    <Section title="2 · I tuoi progetti e pagamenti" description="Dopo aver creato un ordine, selezionalo e simula un pagamento riuscito oppure rifiutato.">
     {state.orders.length===0?<p style={muted}>Non hai ancora creato ordini. Utilizza il form sopra.</p>:<>
     <select aria-label="Scegli ordine" style={{...control,width:"100%",marginTop:12}} value={current?.id??""} onChange={e=>setSelected(e.target.value)}>{state.orders.map(o=><option key={o.id} value={o.id}>{o.id} · {o.title}</option>)}</select>
     {orderDetails}</>}
    </Section>
   </>}
   {isSeller&&<Section title={`CRM · ${roleTitle}`} description="I contatti vengono assegnati fra due venditori. Nella demo puoi cambiare la fase; nel CRM reale ogni cambio deve essere autenticato e registrato.">
    <div style={{display:"grid",gap:12,marginTop:18}}>
     {state.leads.filter(l=>l.seller===sellerLabel).map(l=><div key={l.id} style={{...card,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div><b>{l.title}</b><p style={muted}>{l.id} · {l.source} · Prossima azione: {l.nextAction}</p></div>
      <select aria-label={`Fase ${l.id}`} style={control} value={l.stage} onChange={e=>change(s=>leadAction(s,l.id,e.target.value as DemoLeadStage))}><option>Nuovo</option><option>Qualificato</option><option>Proposta</option><option>Acquisito</option></select>
     </div>)}
    </div></Section>}
   {role==="admin"&&<Section title="Direzione · Panoramica commerciale" description="La stessa anagrafica tiene insieme trattativa, incarichi e ordini aggiuntivi. Non ci sono dati di clienti autentici.">
    <div style={{display:"grid",gap:10,marginTop:18}}>{state.leads.map(l=><div key={l.id} style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"12px",borderBottom:"1px solid #eee"}}><span>{l.title} <span style={muted}>· {l.source}</span></span><Chip>{l.seller} · {l.stage}</Chip></div>)}</div>
   </Section>}
   {(role==="operatore"||role==="redattore"||role==="finance"||role==="admin"||role==="affiliato")&&<Section title={role==="finance"?"Finance · Incassi e scadenziario":role==="affiliato"?"Portale affiliato · I miei referral":role==="admin"?"Commesse e ordini":"Produzione editoriale · Coda di lavoro"}
    description={role==="affiliato"?"Per generare un ordine affiliato, torna nell’area autore e spunta l’opzione codice affiliato.":role==="redattore"?"Il revisore approva la fase editoriale, l’operatore si occupa della consegna.":"Seleziona un ordine per esplorare attività e stati previsti."}>
    {allowedOrders.length===0?<p style={muted}>Non ci sono ordini per questo profilo. Crea un ordine come Autore per procedere.</p>:<>
     <select aria-label="Seleziona ordine" value={allowedOrders.some(o=>o.id===current?.id)?current?.id:allowedOrders[0]!.id} style={{...control,width:"100%"}} onChange={e=>setSelected(e.target.value)}>
      {allowedOrders.map(o=><option key={o.id} value={o.id}>{o.id} · {o.title}</option>)}
     </select>
     {allowedOrders.some(o=>o.id===current?.id)?orderDetails:(<div style={{marginTop:15}}><b>{allowedOrders[0]?.title}</b><p style={muted}>Seleziona questo ordine per esaminarlo.</p></div>)}
    </>}
   </Section>}
   <Section title="Registro delle attività simulate" description="La timeline è conservata soltanto nella sessione del browser; non è un registro contabile o audit trail reale.">
    {state.events.length===0?<p style={muted}>Crea un ordine per far comparire gli eventi.</p>:<div style={{marginTop:15}}>{state.events.map(e=><div key={e.id} style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"13px 0",borderTop:"1px solid #eee"}}><div><b style={{fontSize:14}}>{e.label}</b><p style={muted}>{e.detail}</p></div><Chip>{e.valueCents?euro(e.valueCents):e.eventType}</Chip></div>)}</div>}
   </Section>
   <div style={{...card,background:"#f4e8e2",marginTop:20}}><b>Che cosa è reale e che cosa no?</b><p style={{...muted,color:colors.plum}}>Le tariffe standard utilizzano il listino attuale; la landing e il configuratore pubblico esistono. In questa pagina, invece, identità, ordini, pagamenti, stati editoriali e referral sono <strong>simulati localmente</strong>. Nessuna carta viene richiesta, non vengono inviate email o fatture e non si contattano API di pagamento. Le sessioni e i permessi produttivi non sono testati con questi profili.</p><div style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/preventivo" style={{...primary,textDecoration:"none"}}>Apri il preventivo pubblico ↗</Link><Link href="/presentazione" style={{...soft,textDecoration:"none"}}>Presentazione del team ↗</Link></div></div>
  </div>
 </main>;
}
