"use client";
import { useState, type ReactNode } from "react";
import Link from "@/components/editorial/link";
import { ArrowRight, BookOpen, Check, Layers, PenLine } from "lucide-react";
import {
  Shell,
  Eyebrow,
  CTA,
  PathCards,
  Timeline,
  ServicesGrid,
  Platform,
  Team,
  Agency,
  BeforeAfter,
} from "./proemios";
import { services, paths, articles } from "@/lib/editorial-content";

export const routeTitles: Record<string, string> = {
  servizi: "Servizi editoriali",
  percorsi: "Il tuo percorso editoriale",
  "come-funziona": "Come funziona",
  "per-agenzie": "Proemios per agenzie",
  preventivo: "Richiedi un preventivo",
  "analisi-manoscritto": "Analisi del manoscritto",
  "chi-siamo": "Chi siamo",
  "casi-studio": "Casi studio",
  blog: "Guide editoriali",
  contatti: "Parla con noi",
  accedi: "Area riservata",
  privacy: "Informazioni sul trattamento dei dati",
  "note-legali": "Note legali",
};
services.forEach((s) => (routeTitles["servizi/" + s.slug] = s.title));
paths.forEach((p) => (routeTitles["percorsi/" + p.slug] = p.title));
articles.forEach((a) => (routeTitles["blog/" + a.slug] = a.title));
function Intro({
  eyebrow,
  title,
  description,
  aside,
  crumb,
  cta = true,
  ctaHref = "/preventivo",
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  aside?: ReactNode;
  crumb: string;
  cta?: boolean;
  ctaHref?: string;
}) {
  return (
    <section className="inner-hero">
      <div className="container">
        <div className="breadcrumbs">
          <Link href="/">Home</Link>
          <span>/</span>
          {crumb.includes("/") && (
            <>
              <Link href={"/" + crumb.split("/")[0]!}>{routeTitles[crumb.split("/")[0]!]}</Link>
              <span>/</span>
            </>
          )}
          <span>{routeTitles[crumb]}</span>
        </div>
        <div className={aside ? "inner-grid" : ""}>
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1>{title}</h1>
            <p className="intro">{description}</p>
            {cta && (
              <Link className="button" href={ctaHref}>
                Parliamo del tuo progetto <ArrowRight size={18} />
              </Link>
            )}
          </div>
          {aside && <aside className="inner-aside">{aside}</aside>}
        </div>
      </div>
    </section>
  );
}
function FAQ({ items }: { items: [string, string][] }) {
  return (
    <div className="faq">
      {items.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
const sharedFAQ: [string, string][] = [
  [
    "Quanto costa il servizio?",
    "Il preventivo dipende da lunghezza, stato del testo, tipo di intervento e consegne. Il configuratore usa i nostri listini reali e propone percorsi secondo i servizi selezionati. Possiamo verificarli insieme.",
  ],
  [
    "Posso richiedere solo una fase?",
    "Sì. Il percorso può iniziare da un singolo intervento, come editing o copertina. Valutiamo insieme le dipendenze tra le fasi per evitare di rifare il lavoro.",
  ],
  [
    "Come vengono gestite le revisioni?",
    "Il numero di passaggi, le modalità di feedback e le approvazioni vengono stabiliti nel preventivo. Ogni fase ha una consegna riconoscibile.",
  ],
];
function ServicePage({ slug }: { slug: string }) {
  const s = services.find((x) => x.slug === slug)!;
  return (
    <Shell>
      <Intro
        eyebrow={s.group.toUpperCase()}
        title={
          <>
            {s.title}.<br />
            <em>{s.lead}</em>
          </>
        }
        description={s.description}
        crumb={"servizi/" + slug}
        ctaHref={"/preventivo?servizio=" + slug}
        aside={
          <>
            <div className="big-icon">
              <PenLine size={33} />
            </div>
            <h3>
              Un lavoro definito.
              <br />
              Una voce rispettata.
            </h3>
            <p>
              Il perimetro si concorda prima. Le decisioni editoriali si condividono durante il
              percorso.
            </p>
            <small>Preventivo basato sulle tariffe configurate</small>
          </>
        }
      />
      <section className="section">
        <div className="detail-grid container">
          <div>
            <Eyebrow>IL PERIMETRO DEL LAVORO</Eyebrow>
            <h2>Cosa comprende.</h2>
            <ul className="included">
              {s.includes.map((x) => (
                <li key={x}>
                  <Check />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <div className="note">{s.note}</div>
          </div>
          <div className="detail-sidebar">
            <div className="detail-panel">
              <h3>Da cosa partiamo</h3>
              <p>{s.needs}</p>
            </div>
            <div className="detail-panel">
              <h3>Cosa ricevi</h3>
              <p>{s.result}</p>
            </div>
            <Link href={"/preventivo?servizio=" + s.slug} className="button">
              Richiedi una proposta <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      {slug === "editing" && <BeforeAfter />}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <h2>Prima di iniziare.</h2>
          <FAQ items={sharedFAQ} />
          <div className="related-links">
            {services
              .filter((x) => x.slug !== slug && x.group === s.group)
              .concat(services.filter((x) => x.slug !== slug && x.group !== s.group).slice(0, 2))
              .map((x) => (
                <Link key={x.slug} href={"/servizi/" + x.slug}>
                  {x.title} ↗
                </Link>
              ))}
          </div>
        </div>
      </section>
      <CTA />
    </Shell>
  );
}
function PathPage({ slug }: { slug: string }) {
  const p = paths.find((x) => x.slug === slug)!;
  return (
    <Shell>
      <Intro
        eyebrow="UN PERCORSO, IL TUO"
        title={
          <>
            {p.title}.<br />
            <em>{p.short}</em>
          </>
        }
        description={p.description}
        crumb={"percorsi/" + slug}
        aside={
          <>
            <div className="big-icon">
              <BookOpen size={34} />
            </div>
            <h3>Partiamo da dove sei.</h3>
            <p>
              Puoi avere un’idea, una bozza o un testo completo. Definiamo insieme il punto di
              partenza e le fasi che servono.
            </p>
            <Link
              href={"/preventivo?percorso=" + p.slug}
              className="text-link"
              style={{ marginTop: 20 }}
            >
              Scegli questo percorso <ArrowRight size={17} />
            </Link>
          </>
        }
      />
      <section className="section">
        <div className="detail-grid container">
          <div>
            <Eyebrow>LE TAPPE POSSIBILI</Eyebrow>
            <h2>
              Come prende forma
              <br />
              <em>il tuo libro.</em>
            </h2>
            {"materials" in p && p.materials && (
              <div className="path-starting-materials">
                <h3>I materiali da cui partire</h3>
                <ul>
                  {p.materials.map((material) => (
                    <li key={material}>{material}</li>
                  ))}
                </ul>
                <p>
                  Non serve averli tutti: definiamo insieme come raccoglierli e quali autorizzazioni
                  verificare.
                </p>
              </div>
            )}
            <ol className="path-detail-steps">
              {p.steps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <p>
              Queste tappe sono una traccia. Il piano effettivo viene adattato al progetto e
              condiviso prima dell’avvio.
            </p>
          </div>
          <div className="detail-sidebar">
            <div className="detail-panel">
              <h3>Tu resti al centro.</h3>
              <p>
                Condividi materiali, rileggi il lavoro e approvi ogni fase. Non perdi la tua voce:
                trovi gli strumenti per esprimerla meglio.
              </p>
            </div>
            <div className="detail-panel">
              <h3>Un unico interlocutore.</h3>
              <p>
                Un progetto coordinato collega scrittura, revisione e produzione, con consegne e
                responsabilità definite.
              </p>
            </div>
            <Link href={"/preventivo?percorso=" + p.slug} className="button">
              Inizia da qui <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <Platform />
      <CTA />
    </Shell>
  );
}
function BlogPage() {
  const [filter, setFilter] = useState("Tutte");
  return (
    <Shell>
      <Intro
        eyebrow="IL TACCUINO PROEMIOS"
        title={
          <>
            Fare un libro.
            <br />
            <em>Capire il percorso.</em>
          </>
        }
        description="Guide concrete per orientarti tra scrittura, revisione e produzione. Le domande giuste, al momento giusto."
        crumb="blog"
        cta={false}
      />
      <section className="section">
        <div className="container">
          <div className="article-filter" aria-label="Filtra le guide">
            {["Tutte", ...articles.map((a) => a.tag)].map((x) => (
              <button
                aria-pressed={filter === x}
                className={filter === x ? "active" : ""}
                onClick={() => setFilter(x)}
                key={x}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="article-grid">
            {articles
              .filter((a) => filter === "Tutte" || a.tag === filter)
              .map((a) => (
                <Link className="article-card" href={"/blog/" + a.slug} key={a.slug}>
                  <span>{a.tag}</span>
                  <h3>{a.title}</h3>
                  <p>{a.summary}</p>
                  <span className="text-link">
                    Leggi la guida <ArrowRight size={18} />
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </section>
      <CTA />
    </Shell>
  );
}
export function InternalPage({ route }: { route: string }) {
  if (route.startsWith("servizi/")) return <ServicePage slug={route.split("/")[1]!} />;
  if (route.startsWith("percorsi/")) return <PathPage slug={route.split("/")[1]!} />;
  if (route === "blog") return <BlogPage />;
  if (route.startsWith("blog/")) {
    const a = articles.find((x) => x.slug === route.split("/")[1]!)!;
    return (
      <Shell>
        <Intro
          eyebrow={a.tag.toUpperCase()}
          title={a.title}
          description={a.summary}
          crumb={route}
          cta={false}
        />
        <section className="section">
          <article className="article-body container">
            {a.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <div className="note">
              Le attività e le consegne del singolo progetto vengono sempre definite nella proposta
              personalizzata.
            </div>
            <Link href="/blog" className="text-link" style={{ marginTop: 35 }}>
              Torna alle guide <ArrowRight size={18} />
            </Link>
          </article>
        </section>
        <CTA />
      </Shell>
    );
  }
  if (route === "servizi")
    return (
      <Shell>
        <Intro
          eyebrow="CURA, DALLA PRIMA ALL’ULTIMA PAGINA"
          title={
            <>
              Tutto ciò che serve.
              <br />
              <em>Solo ciò che serve.</em>
            </>
          }
          description="Scrittura, revisione, design e pubblicazione: scegli un intervento o costruisci un percorso completo. Prima capiamo il testo, poi definiamo il lavoro."
          crumb={route}
          aside={
            <>
              <div className="big-icon">
                <Layers size={33} />
              </div>
              <h3>Una filiera, un progetto.</h3>
              <p>
                Ogni servizio ha una funzione precisa. Li colleghiamo quando serve, senza aggiungere
                passaggi inutili.
              </p>
            </>
          }
        />
        <section className="section">
          <div className="container">
            <ServicesGrid />
          </div>
        </section>
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <h2>Troviamo l’intervento giusto.</h2>
            <FAQ items={sharedFAQ} />
          </div>
        </section>
        <CTA />
      </Shell>
    );
  if (route === "percorsi")
    return (
      <Shell>
        <Intro
          eyebrow="DA DOVE PARTI?"
          title={
            <>
              Il tuo libro ha già
              <br />
              <em>un inizio.</em>
            </>
          }
          description="Può essere una storia scritta, un ricordo, una competenza o un’intuizione. Non esiste un percorso uguale per tutti: esiste quello che serve al tuo progetto."
          crumb={route}
          cta={false}
        />
        <section className="section">
          <div className="container">
            <PathCards />
            <div className="case-note">
              <h3>Non ti riconosci in un solo percorso?</h3>
              <p>
                Un progetto può attraversare più esigenze. Raccontaci il punto di partenza:
                definiamo una sequenza coerente senza forzarti in un pacchetto.
              </p>
              <Link href="/contatti" className="text-link" style={{ marginTop: 20 }}>
                Parla con un editor <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
        <CTA />
      </Shell>
    );
  if (route === "come-funziona")
    return (
      <Shell>
        <Intro
          eyebrow="IL METODO PROEMIOS"
          title={
            <>
              Un percorso chiaro.
              <br />
              <em>Dall’inizio alla fine.</em>
            </>
          }
          description="Definiamo il lavoro, condividiamo le tappe e rendiamo visibile ogni passaggio. Tu sai cosa sta succedendo, chi se ne occupa e cosa devi approvare."
          crumb={route}
        />
        <section className="section">
          <div className="container">
            <Timeline />
          </div>
        </section>
        <Platform />
        <section className="section">
          <div className="detail-grid container">
            <div>
              <Eyebrow>IL TUO RUOLO</Eyebrow>
              <h2>
                Ogni scelta
                <br />
                resta <em>condivisa.</em>
              </h2>
              <p>
                Carichi o condividi i materiali secondo le modalità concordate, commenti le
                revisioni e approvi le consegne. Le versioni precedenti aiutano a seguire il lavoro
                senza perdere il filo.
              </p>
              <ul className="included">
                <li>
                  <Check />
                  Feedback raccolto per fase
                </li>
                <li>
                  <Check />
                  Consegne definite nel piano di lavoro
                </li>
                <li>
                  <Check />
                  Approvazioni prima del passaggio successivo
                </li>
              </ul>
            </div>
            <div>
              <h2>Le domande frequenti.</h2>
              <FAQ
                items={[
                  [
                    "Quando inizia il lavoro?",
                    "Dopo la definizione e l’accettazione della proposta, con i materiali e le condizioni concordate.",
                  ],
                  [
                    "Quanto dura un progetto?",
                    "Dipende da lunghezza, interventi richiesti e tempi di feedback. Il calendario viene condiviso nel piano di lavoro.",
                  ],
                  [
                    "Posso cambiare il perimetro?",
                    "Sì, valutiamo insieme l’effetto della modifica su tempi e costi prima di procedere.",
                  ],
                ]}
              />
            </div>
          </div>
        </section>
        <CTA />
      </Shell>
    );
  if (route === "per-agenzie")
    return (
      <Shell>
        <Intro
          eyebrow="WHITE-LABEL · AGENZIE · PUBLISHER · PARTNER"
          title={
            <>
              Il tuo cliente.
              <br />
              Il tuo brand.
              <br />
              <em>Un percorso coordinato.</em>
            </>
          }
          description="Porta servizi editoriali ai tuoi clienti con un’infrastruttura dedicata. Mantieni la relazione e la tua identità; concordiamo insieme produzione, responsabilità e modalità di lavoro."
          crumb={route}
          aside={
            <>
              <div className="big-icon">
                <Layers size={34} />
              </div>
              <h3>Una collaborazione da costruire.</h3>
              <p>
                Brand, accessi, scambio dei file e approvazioni vengono definiti nel progetto
                white-label.
              </p>
              <small>Configurazione e disponibilità da verificare per ogni partner.</small>
            </>
          }
        />
        <Agency />
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="detail-grid container">
            <div>
              <Eyebrow>DIETRO IL TUO BRAND</Eyebrow>
              <h2>
                Un servizio editoriale
                <br />
                che si integra.
              </h2>
              <ul className="included">
                <li>
                  <Check />
                  Editing, scrittura e produzione coordinati
                </li>
                <li>
                  <Check />
                  Brief e consegne per ogni progetto
                </li>
                <li>
                  <Check />
                  Flusso di revisione e approvazione concordato
                </li>
                <li>
                  <Check />
                  Riservatezza e responsabilità definite per iscritto
                </li>
              </ul>
            </div>
            <div className="detail-panel">
              <h3>Partiamo dal tuo modello.</h3>
              <p>
                Raccontaci come lavori oggi, quali servizi vuoi proporre e chi gestisce il rapporto
                con il cliente. Valutiamo un flusso adatto alla tua struttura.
              </p>
              <Link href="/contatti?motivo=agenzia" className="button" style={{ marginTop: 25 }}>
                Parliamo di partnership <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
        <CTA />
      </Shell>
    );
  if (route === "chi-siamo")
    return (
      <Shell>
        <Intro
          eyebrow="IL NOSTRO APPROCCIO"
          title={
            <>
              Le storie contano.
              <br />
              <em>La cura, anche.</em>
            </>
          }
          description="Proemios nasce dall’idea di unire il lavoro editoriale a un percorso più chiaro. Le persone si occupano del libro; gli strumenti aiutano a organizzare file, revisioni e decisioni."
          crumb={route}
        />
        <Team />
        <section className="section">
          <div className="detail-grid container">
            <div>
              <Eyebrow>QUELLO IN CUI CREDIAMO</Eyebrow>
              <h2>
                Una voce da rispettare.
                <br />
                Una forma da trovare.
              </h2>
              <p>
                Non tutti i libri hanno lo stesso obiettivo. Prima di proporre un intervento
                ascoltiamo il progetto: a chi parla, cosa vuole lasciare, dove si trova oggi.
              </p>
              <p>
                La tecnologia editoriale può semplificare alcuni passaggi. La lettura, il confronto
                e le scelte professionali restano centrali.
              </p>
            </div>
            <div className="detail-sidebar">
              <div className="detail-panel">
                <h3>Chiarezza</h3>
                <p>Perimetro, revisioni e consegne definiti prima di iniziare.</p>
              </div>
              <div className="detail-panel">
                <h3>Accompagnamento</h3>
                <p>Feedback comprensibile, confronto e scelte condivise.</p>
              </div>
              <div className="detail-panel">
                <h3>Responsabilità</h3>
                <p>Nessuna promessa di vendite, premi o risultati che non possiamo verificare.</p>
              </div>
            </div>
          </div>
        </section>
        <CTA />
      </Shell>
    );
  if (route === "casi-studio")
    return (
      <Shell>
        <Intro
          eyebrow="I PROGETTI, RACCONTATI BENE"
          title={
            <>
              Dietro un libro,
              <br />
              <em>c’è un percorso.</em>
            </>
          }
          description="Esplora un esempio editoriale: il testo di partenza, una possibile revisione e le decisioni da condividere. È una dimostrazione, non un caso cliente."
          crumb={route}
          cta={false}
        />
        <BeforeAfter />
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="case-note container">
            <h3>Come leggere questo esempio.</h3>
            <p>
              Osserva come cambiano ritmo e chiarezza, senza perdere il senso del testo. I casi
              cliente saranno pubblicati solo con materiali verificati e autorizzati.
            </p>
            <Link href="/come-funziona" className="text-link" style={{ marginTop: 25 }}>
              Intanto, scopri il metodo <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <CTA />
      </Shell>
    );
  return (
    <Shell>
      <Intro
        eyebrow="INFORMAZIONI DEL SITO"
        title={
          route === "privacy" ? (
            <>
              I tuoi dati.
              <br />
              <em>Informazioni chiare.</em>
            </>
          ) : (
            <>
              Note <em>legali.</em>
            </>
          )
        }
        description="Questa sezione deve essere completata con i dati e le condizioni ufficiali di Proemios prima dell’apertura al pubblico."
        crumb={route}
        cta={false}
      />
      <section className="section">
        <div className="legal-body container">
          <div className="note">
            <strong>Bozza da completare.</strong> I dati del titolare, i recapiti ufficiali e le
            condizioni operative non sono stati forniti. Questa pagina non costituisce
            un’informativa definitiva.
          </div>
          {route === "privacy" ? (
            <>
              <h2>Cosa viene salvato in questa versione</h2>
              <p>
                I moduli salvano nome, email, messaggio, tipo di richiesta e informazioni sul
                progetto. La conferma di lettura viene registrata insieme alla data. Un
                identificativo derivato dall’indirizzo di rete viene utilizzato per limitare invii
                ripetuti.
              </p>
              <h2>Finalità dei moduli</h2>
              <p>
                Le informazioni vengono raccolte per permettere la valutazione della richiesta. Non
                avviene un’iscrizione automatica a newsletter e non è previsto l’invio di notifiche
                email in questa versione.
              </p>
              <h2>Informazioni da integrare prima dell’uso pubblico</h2>
              <p>
                Titolare e contatti, base giuridica, destinatari e fornitori, tempi di
                conservazione, eventuali trasferimenti e modalità di esercizio dei diritti devono
                essere definiti e verificati.
              </p>
              <h2>Contenuti riservati</h2>
              <p>
                Non inserire dati sensibili, informazioni private di terze persone o interi
                manoscritti nei moduli. L’invio dei file va concordato separatamente.
              </p>
            </>
          ) : (
            <>
              <h2>Identità del servizio</h2>
              <p>
                Ragione sociale, partita IVA, sede e recapiti ufficiali: dati da inserire dalla
                configurazione reale del progetto.
              </p>
              <h2>Proposte e acquisti</h2>
              <p>
                Il sito permette di esplorare servizi e salvare richieste. Non mostra un listino
                ufficiale, non incassa pagamenti e non genera contratti. Attività, prezzi e
                condizioni vengono concordati nella proposta.
              </p>
              <h2>Materiali dimostrativi</h2>
              <p>
                Le anteprime della dashboard e gli esempi di revisione sono dimostrativi. La
                copertina “La forma delle storie” è un’immagine illustrativa, non un caso studio. Le
                schede autore e le testimonianze in attesa di verifica sono identificate come tali.
              </p>
            </>
          )}
        </div>
      </section>
    </Shell>
  );
}
