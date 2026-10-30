"use client";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, PenLine, Wrench } from "lucide-react";
import Link from "./link";
import { Eyebrow } from "./elements";
import { computeQuote } from "@/lib/pricing";
import { DEPOSIT_RATE, RUSH_SURCHARGE } from "@/config/pricing";
import { euro } from "@/lib/format";

/** Tre ingressi: la domanda giusta per chi ha un manoscritto, un'idea o un bisogno preciso. */
export function EntryPoints() {
  const entries = [
    { icon: BookOpen, title: "Ho un manoscritto", text: "Editing o correzione, poi copertina, impaginazione e pubblicazione.", href: "/preventivo?stato=finito-da-revisionare", cta: "Parti dal testo" },
    { icon: PenLine, title: "Voglio scrivere un libro", text: "Da appunti, diari o un’idea: lo costruiamo insieme, per fasi.", href: "/preventivo?stato=solo-materiali&tipo=memoir", cta: "Parti dall’idea" },
    { icon: Wrench, title: "Mi serve un servizio preciso", text: "Una sola lavorazione, prezzo di listino, senza pacchetti aggiunti.", href: "/preventivo?singolo=1", cta: "Scegli il servizio" },
  ] as const;
  return (
    <section className="section entry-section" aria-labelledby="entry-title">
      <div className="container">
        <div className="section-heading">
          <div>
            <Eyebrow>DA DOVE PARTI?</Eyebrow>
            <h2 id="entry-title">Tre porte,<br />una <em>sola</em> risposta chiara.</h2>
          </div>
          <p>Ogni ingresso apre il preventivo con le risposte giuste già date.</p>
        </div>
        <div className="entry-grid">
          {entries.map(({ icon: Icon, title, text, href, cta }) => (
            <Link key={href} href={href} className="entry-card">
              <Icon size={26} />
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="text-link">{cta} <ArrowRight size={16} /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
/**
 * Prezzi di partenza ricavati dal listino con il motore condiviso, con le
 * ipotesi scritte accanto. Nessuna cifra scritta a mano: cambia il listino,
 * cambiano questi numeri.
 */
export function PricingGuide() {
  const rows = [
    { label: "Correzione bozze", hypothesis: "testo finito, 50.000 parole", total: computeQuote({ projectType: "romanzo", textState: "finito-revisionato", wordCount: 50_000, singleService: "proofreading" }).packages[0].total },
    { label: "Editing", hypothesis: "testo da revisionare, 50.000 parole", total: computeQuote({ projectType: "romanzo", textState: "finito-da-revisionare", wordCount: 50_000, singleService: "editing" }).packages[0].total },
    { label: "Impaginazione cartacea", hypothesis: "circa 170 pagine (50.000 parole)", total: computeQuote({ projectType: "romanzo", textState: "finito-revisionato", wordCount: 50_000, singleService: "layout" }).packages[0].total },
    { label: "Copertina originale", hypothesis: "fronte, retro e dorso", total: computeQuote({ projectType: "romanzo", textState: "finito-revisionato", wordCount: 50_000, singleService: "cover" }).packages[0].total },
    { label: "Conversione EPUB", hypothesis: "ebook validato", total: computeQuote({ projectType: "romanzo", textState: "finito-revisionato", wordCount: 50_000, singleService: "epub" }).packages[0].total },
    { label: "Percorso completo, pacchetto Consigliato", hypothesis: "romanzo da revisionare, 50.000 parole", total: computeQuote({ projectType: "romanzo", textState: "finito-da-revisionare", wordCount: 50_000 }).packages.find((p) => p.recommended)!.total },
  ];
  return (
    <section className="section pricing-section" aria-labelledby="pricing-title">
      <div className="container">
        <div className="section-heading">
          <div>
            <Eyebrow>QUANTO COSTA</Eyebrow>
            <h2 id="pricing-title">Prezzi di partenza,<br />con le ipotesi <em>scritte accanto.</em></h2>
          </div>
          <p>Calcolati dal listino in vigore. Il tuo preventivo dipende da lunghezza e stato del testo: lo vedi in due minuti, senza lasciare dati.</p>
        </div>
        <ul className="pricing-list">
          {rows.map((r) => (
            <li key={r.label}>
              <div><strong>{r.label}</strong><small>{r.hypothesis}</small></div>
              <span><em>da</em> {euro(r.total)}</span>
            </li>
          ))}
        </ul>
        <p className="pricing-note">Importi IVA esclusa. Acconto del {Math.round(DEPOSIT_RATE * 100)}% alla conferma, saldo alla consegna. Tempi prioritari con maggiorazione del {Math.round(RUSH_SURCHARGE * 100)}%. I servizi a parola hanno sconti oltre certe soglie di lunghezza; i progetti di scrittura (memoir, ghostwriting) si definiscono con il team dopo aver visto i materiali.</p>
        <Link href="/preventivo" className="button">Calcola il tuo preventivo <ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}
/** Domande che precedono un acquisto, con risposte che descrivono come funziona davvero la piattaforma. */
export function Faq() {
  const items: [string, string][] = [
    ["Cosa è incluso nel prezzo?", "Ogni proposta elenca le lavorazioni comprese e quelle escluse, voce per voce, prima della conferma. Un servizio singolo non aggiunge pacchetti o prestazioni non richieste."],
    ["Quante revisioni sono comprese?", "I giri di revisione sono indicati nella proposta. Ogni consegna passa dalla tua approvazione nell’area autore: la approvi o chiedi una revisione, e ogni nuova versione richiede una nuova decisione."],
    ["Quanto tempo ci vuole?", `Dipende da lunghezza e servizi. Con tempi prioritari il lavoro entra in corsia veloce con una maggiorazione del ${Math.round(RUSH_SURCHARGE * 100)}%. La data di consegna la conferma il team nel progetto: finché non è confermata, resta una stima.`],
    ["Come funzionano acconto e saldo?", `Alla conferma paghi un acconto del ${Math.round(DEPOSIT_RATE * 100)}% del totale; il saldo è dovuto alla consegna. Il totale con IVA lo vedi prima di confermare. I pagamenti passano dalla pagina sicura di Stripe, con i metodi disponibili al momento; a ogni incasso ricevi la fattura.`],
    ["Che file devo mandare e come?", "Dalla tua area carichi manoscritto e materiali, fino a 4 MB per file. I file TXT sono disponibili subito; DOCX e PDF restano in controllo di sicurezza prima di essere aperti dal team. Una nuova versione con lo stesso nome conserva la precedente."],
    ["Cosa succede dopo l’acquisto?", "Nell’area autore vedi chi ti segue, la fase in corso e il prossimo passo: caricare i materiali, leggere un messaggio, approvare una versione, pagare il saldo. Quando non devi fare nulla, te lo diciamo."],
    ["La stima che vedo è già il prezzo?", "No. La stima è calcolata dal listino sui dati che inserisci. Diventa una proposta acquistabile dopo la verifica del team, oppure subito per i servizi singoli a prezzo fisso. Non si paga mai una stima."],
  ];
  return (
    <section className="section faq-section" aria-labelledby="faq-title">
      <div className="container">
        <div className="section-heading">
          <div>
            <Eyebrow>DOMANDE FREQUENTI</Eyebrow>
            <h2 id="faq-title">Prima di <em>confermare.</em></h2>
          </div>
        </div>
        <div className="faq">
          {items.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </div>
    </section>
  );
}
/** CTA fissa su schermi piccoli: non copre i controlli grazie al margine sul corpo della pagina. */
export function MobileCta({ hidden = false }: { hidden?: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setVisible(media.matches);
    update();
    media.addEventListener("change", update);
    document.body.classList.toggle("has-mobile-cta", media.matches);
    return () => { media.removeEventListener("change", update); document.body.classList.remove("has-mobile-cta"); };
  }, []);
  if (!visible || hidden) return null;
  return (
    <div className="mobile-cta" role="region" aria-label="Calcola il preventivo">
      <span>Stima in due minuti, senza dati personali.</span>
      <Link href="/preventivo" className="button">Calcola il preventivo <ArrowRight size={18} /></Link>
    </div>
  );
}
