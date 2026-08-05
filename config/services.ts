/**
 * I sei pacchetti di servizio — contenuto di progetto (§3.2 del brief).
 * Ogni pagina servizio si genera da qui: problema → include → processo → prezzo → FAQ.
 */

export type ServiceFaq = { q: string; a: string };

export type ServicePackage = {
  slug: string;
  name: string;
  claim: string;
  /** Il problema del cliente, in prima battuta. */
  problem: string;
  /** Cosa include, concreto. */
  includes: string[];
  /** Il processo in 4-5 passaggi. */
  process: { title: string; desc: string }[];
  /** Fascia di prezzo pubblica. `null` = nessun prezzo pubblico (white label). */
  priceRange: { min: number; max: number } | null;
  /** Cosa fa variare il prezzo. */
  priceDrivers: string;
  faq: ServiceFaq[];
  /** Preseleziona il configuratore con questo tipo progetto. */
  quotePrefill?: string;
};

export const SERVICES: ServicePackage[] = [
  {
    slug: "valutazione-editoriale",
    name: "Valutazione editoriale",
    claim: "Un giudizio professionale sul tuo manoscritto, per sapere dove intervenire.",
    problem:
      "Hai scritto un testo ma non sai se è pronto, cosa funziona e cosa va rivisto. Ti serve un parere competente, non l'opinione di un amico.",
    includes: [
      "Lettura professionale integrale del manoscritto",
      "Relazione scritta con analisi di struttura, stile, voce e ritmo",
      "Punti di forza e aree di intervento prioritarie",
      "Livello di intervento consigliato (correzione, editing leggero o profondo)",
      "Indicazioni concrete e una call di restituzione",
    ],
    process: [
      { title: "Invio del testo", desc: "Ci mandi il manoscritto e ci racconti il progetto." },
      { title: "Lettura", desc: "Un editor legge integralmente e prende nota." },
      { title: "Relazione", desc: "Ricevi un documento scritto con l'analisi e le priorità." },
      { title: "Restituzione", desc: "Ne parliamo in una call: cosa fare, in che ordine." },
    ],
    priceRange: { min: 149, max: 349 },
    priceDrivers:
      "La fascia dipende dalla lunghezza del manoscritto e dalla profondità della relazione richiesta.",
    faq: [
      {
        q: "In quanto tempo ricevo la valutazione?",
        a: "In genere entro 7-10 giorni lavorativi dalla ricezione del testo completo.",
      },
      {
        q: "La valutazione include la correzione?",
        a: "No: è un'analisi con indicazioni. Editing e correzione sono servizi a parte, che possiamo attivare dopo.",
      },
      {
        q: "Va bene anche per una bozza incompleta?",
        a: "Sì, ma lo diciamo con chiarezza: su una bozza la valutazione riguarda l'impianto e la direzione, non i dettagli.",
      },
    ],
    quotePrefill: "romanzo",
  },
  {
    slug: "revisione-e-pubblicazione",
    name: "Revisione e pubblicazione",
    claim: "Dal manoscritto revisionato al libro online, senza sei interlocutori diversi.",
    problem:
      "Il testo c'è, ma tra editing, impaginazione, EPUB, copertina, KDP e ISBN devi coordinare troppe persone. Vuoi un unico interlocutore che porti il libro fino alla pubblicazione.",
    includes: [
      "Editing o correzione bozze (in base allo stato del testo)",
      "Impaginazione cartacea professionale",
      "Conversione EPUB validata",
      "Pubblicazione su Amazon KDP",
      "Assistenza per l'ISBN (Amazon o esterno)",
      "Scheda Amazon curata",
    ],
    process: [
      { title: "Analisi", desc: "Definiamo il livello di intervento sul testo." },
      { title: "Lavorazione editoriale", desc: "Editing o correzione, con revisioni condivise." },
      { title: "Produzione", desc: "Impaginazione, copertina ed EPUB." },
      { title: "Pubblicazione", desc: "KDP, ISBN e scheda, con verifica finale." },
    ],
    priceRange: { min: 700, max: 3_500 },
    priceDrivers:
      "Dipende dalla lunghezza, dal livello di revisione (correzione vs editing profondo) e dai servizi di produzione inclusi.",
    faq: [
      {
        q: "Pubblicate sul mio account Amazon?",
        a: "Possiamo affiancarti sul tuo account o gestire la pubblicazione per te. Il libro resta tuo.",
      },
      {
        q: "L'ISBN è incluso?",
        a: "L'assistenza sì. Il costo dell'ISBN esterno, se lo scegli, è a parte e te lo spieghiamo prima.",
      },
      {
        q: "Quante revisioni sono comprese?",
        a: "Un giro di revisione sull'editing e uno sull'impaginazione. Ulteriori giri si concordano.",
      },
    ],
    quotePrefill: "romanzo",
  },
  {
    slug: "dal-diario-al-libro",
    name: "Dal diario al libro",
    claim: "Diari, vocali e appunti diventano un memoir pubblicato.",
    problem:
      "Hai una storia da raccontare e molti materiali — diari, registrazioni, appunti — ma non il tempo o il mestiere per farne un libro. Ti serve chi lo scriva con te, nella tua voce.",
    includes: [
      "Raccolta e ordinamento dei materiali (diari, vocali, appunti)",
      "Interviste per catturare voce e contenuti",
      "Struttura narrativa e stesura capitolo per capitolo",
      "Editing, impaginazione e copertina",
      "Pubblicazione completa con ISBN",
      "Massima riservatezza: l'opera resta interamente tua",
    ],
    process: [
      { title: "Ascolto", desc: "Raccogliamo materiali e facciamo le prime interviste." },
      { title: "Struttura", desc: "Costruiamo l'impianto del libro prima di scrivere." },
      { title: "Stesura", desc: "Scriviamo con consegne progressive e il tuo feedback." },
      { title: "Produzione", desc: "Editing, copertina, impaginazione." },
      { title: "Pubblicazione", desc: "Il libro va online, con ISBN e scheda." },
    ],
    priceRange: { min: 3_000, max: 15_000 },
    priceDrivers:
      "Dipende dalla lunghezza del libro finale e dalla quantità di materiale già disponibile: più materiale grezzo c'è, meno lavoro di creazione serve.",
    faq: [
      {
        q: "Il libro risulta scritto da me?",
        a: "Sì. Il ghostwriting è riservato: l'autore sei tu, a tutti gli effetti.",
      },
      {
        q: "Come garantite la riservatezza?",
        a: "Con un accordo di riservatezza e un trattamento dei materiali strettamente confidenziale.",
      },
      {
        q: "Posso partire solo da un'idea?",
        a: "Sì, ma il percorso è più lungo: in quel caso il lavoro di costruzione è maggiore e incide sul preventivo.",
      },
    ],
    quotePrefill: "memoir",
  },
  {
    slug: "libro-per-professionisti",
    name: "Libro per professionisti",
    claim: "Il libro come strumento di autorevolezza, dal contenuto al lancio.",
    problem:
      "Sei un consulente, un formatore o un imprenditore: un libro ti posizionerebbe come riferimento, ma non hai tempo per scriverlo né una strategia per lanciarlo.",
    includes: [
      "Definizione del posizionamento e dell'indice",
      "Stesura o revisione del contenuto",
      "Editing, copertina e impaginazione professionali",
      "Pubblicazione e scheda Amazon ottimizzata",
      "Strategia e materiali di lancio",
    ],
    process: [
      { title: "Posizionamento", desc: "Definiamo tema, pubblico e obiettivo del libro." },
      { title: "Contenuto", desc: "Scriviamo o revisioniamo insieme a te." },
      { title: "Produzione", desc: "Editing, copertina, impaginazione." },
      { title: "Pubblicazione", desc: "Online, con scheda curata." },
      { title: "Lancio", desc: "Piano e materiali per presentarlo al tuo pubblico." },
    ],
    priceRange: { min: 5_000, max: 20_000 },
    priceDrivers:
      "Dipende dal fatto che il contenuto esista già o vada scritto, dalla lunghezza e dall'ampiezza del lancio.",
    faq: [
      {
        q: "Non ho tempo di scrivere: è un problema?",
        a: "No. Lavoriamo con interviste e materiali esistenti; a scrivere pensiamo noi, nella tua voce.",
      },
      {
        q: "Il lancio garantisce le vendite?",
        a: "No, e diffidiamo da chi lo promette. Il lancio ti dà metodo, materiali e visibilità presso il pubblico giusto.",
      },
      {
        q: "Posso usarlo come biglietto da visita?",
        a: "È esattamente lo scopo: un libro autorevole a supporto della tua attività professionale.",
      },
    ],
    quotePrefill: "libro-professionale",
  },
  {
    slug: "copertina-e-impaginazione",
    name: "Copertina e impaginazione",
    claim: "Solo la produzione grafica ed editoriale, fatta come si deve.",
    problem:
      "Il testo è pronto e revisionato: ti serve solo una copertina professionale e un interno impaginato a regola d'arte, con file pronti per la stampa e per gli store.",
    includes: [
      "Concept e realizzazione della copertina (cartaceo ed ebook)",
      "Impaginazione cartacea professionale",
      "File pronti per la stampa e per KDP",
      "Conversione EPUB su richiesta",
    ],
    process: [
      { title: "Brief", desc: "Genere, riferimenti e posizionamento del libro." },
      { title: "Concept copertina", desc: "Proposte da valutare insieme." },
      { title: "Impaginazione", desc: "Realizziamo l'interno con un giro di revisione." },
      { title: "Esecutivi", desc: "Consegna dei file finali per ogni formato." },
    ],
    priceRange: { min: 300, max: 1_200 },
    priceDrivers: "Dipende dalla lunghezza (pagine) e dalla complessità della copertina.",
    faq: [
      {
        q: "Serve che il testo sia già corretto?",
        a: "Sì. Questo pacchetto è produzione: se il testo va ancora revisionato, meglio partire da 'Revisione e pubblicazione'.",
      },
      {
        q: "La copertina è originale?",
        a: "Sì, realizzata su misura per il tuo libro, non un template.",
      },
      {
        q: "Consegnate i sorgenti?",
        a: "Consegniamo i file finali pronti per stampa e store. I sorgenti si concordano.",
      },
    ],
    quotePrefill: "solo-grafica",
  },
  {
    slug: "partner-white-label",
    name: "Partner white label",
    claim: "Il reparto editoriale esterno della tua agenzia. In riservatezza totale.",
    problem:
      "Gestisci un'agenzia di ghostwriting, comunicazione o personal branding e ti servono capacità produttiva editoriale nei picchi, senza assumere e senza esporre i tuoi clienti.",
    includes: [
      "Produzione editoriale white label (nessun nostro contatto col cliente finale)",
      "Accordo di riservatezza (NDA)",
      "Referente dedicato e SLA sui tempi",
      "Cartelle e workflow separati per cliente",
    ],
    process: [
      { title: "Accordo", desc: "NDA e definizione del perimetro di collaborazione." },
      { title: "Onboarding", desc: "Referente dedicato, cartelle separate, SLA concordati." },
      { title: "Produzione", desc: "Lavoriamo come tuo reparto interno, in background." },
      { title: "Consegna", desc: "Ti consegniamo, tu presenti al tuo cliente." },
    ],
    priceRange: null, // nessun prezzo pubblico
    priceDrivers:
      "Listino riservato, definito sul volume e sulla ricorrenza. Contattaci per un accordo dedicato.",
    faq: [
      {
        q: "I nostri clienti sapranno di voi?",
        a: "No. Operiamo in white label totale: nessun contatto e nessuna menzione verso il cliente finale.",
      },
      { q: "Firmate un NDA?", a: "Sì, sempre. La riservatezza è la base della collaborazione." },
      {
        q: "Gestite volumi ricorrenti?",
        a: "Sì. Con un referente dedicato e SLA definiti per reggere i picchi.",
      },
    ],
    quotePrefill: "romanzo",
  },
];

export const SERVICE_SLUGS = SERVICES.map((s) => s.slug);

export function getService(slug: string): ServicePackage | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
