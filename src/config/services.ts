/**
 * Configurazione dei 6 pacchetti di servizio.
 * Fonte unica di verità per: /servizi, /servizi/[slug], JSON-LD Service,
 * precompilazione del configuratore, sitemap.
 *
 * i18n-ready: tutti i testi visibili sono qui, pronti per essere estratti
 * in un dizionario di localizzazione senza toccare i componenti.
 */

export type ProjectType = "romanzo" | "saggio" | "memoir" | "professionale" | "grafica";

export interface ProcessStep {
  titolo: string;
  descrizione: string;
}

export interface Faq {
  domanda: string;
  risposta: string;
}

export interface Service {
  slug: string;
  nome: string;
  /** Sottotitolo breve mostrato in elenco e in hero. */
  tagline: string;
  /** Il problema del cliente che il pacchetto risolve. */
  problema: string;
  /** Cosa include il pacchetto. */
  cosaInclude: string[];
  /** Processo in 4-5 step. */
  processo: ProcessStep[];
  /** Fascia di prezzo indicativa (in euro). null = prezzo riservato. */
  prezzo: { min: number; max: number; suffix?: string } | null;
  /** Etichetta prezzo per pacchetti riservati. */
  prezzoLabel?: string;
  faq: Faq[];
  /** Tipo di progetto con cui precompilare /preventivo. */
  prefillProjectType: ProjectType | null;
  /** Ordine di visualizzazione. */
  ordine: number;
  /** Evidenzia come pacchetto di punta. */
  inEvidenza?: boolean;
}

export const SERVICES: Service[] = [
  {
    slug: "valutazione-editoriale",
    nome: "Valutazione editoriale",
    tagline: "Un'analisi approfondita del manoscritto, prima di decidere come procedere.",
    problema:
      "Hai finito di scrivere e non sai se il testo è pronto. Serve uno sguardo esterno, competente e onesto, che dica cosa funziona, cosa no e quanto lavoro manca davvero.",
    cosaInclude: [
      "Lettura integrale del manoscritto da parte di un editor",
      "Scheda di valutazione dettagliata (10-15 pagine)",
      "Analisi di struttura, ritmo, voce, coerenza e target di lettori",
      "Individuazione dei punti di forza e delle aree di intervento",
      "Indicazione del livello di editing consigliato e stima dei costi",
      "Chiamata di restituzione di 45 minuti",
    ],
    processo: [
      {
        titolo: "Invio del manoscritto",
        descrizione: "Ci mandi il testo completo nel formato che preferisci.",
      },
      {
        titolo: "Lettura professionale",
        descrizione: "Un editor legge l'intero manoscritto, non un estratto.",
      },
      {
        titolo: "Scheda di valutazione",
        descrizione: "Redigiamo un documento strutturato con osservazioni puntuali.",
      },
      {
        titolo: "Restituzione",
        descrizione: "Ne parliamo in call: priorità, tempi, prossimi passi.",
      },
    ],
    prezzo: { min: 149, max: 349 },
    faq: [
      {
        domanda: "In quanto tempo ricevo la valutazione?",
        risposta: "In genere entro 10-15 giorni lavorativi, in base alla lunghezza del testo.",
      },
      {
        domanda: "La valutazione include già l'editing?",
        risposta:
          "No: è un'analisi diagnostica. Se decidi di procedere, il costo della valutazione viene scontato dal pacchetto di editing.",
      },
      {
        domanda: "Che differenza c'è con l'analisi AI gratuita?",
        risposta:
          "L'analisi automatica è una stima immediata su un estratto. La valutazione editoriale è una lettura integrale fatta da un professionista.",
      },
    ],
    prefillProjectType: null,
    ordine: 1,
  },
  {
    slug: "revisione-e-pubblicazione",
    nome: "Revisione e pubblicazione",
    tagline: "Dal testo grezzo al libro pubblicato su Amazon, in un unico percorso.",
    problema:
      "Hai un manoscritto ma non hai il tempo, gli strumenti o l'esperienza per trasformarlo in un libro vero: editing, impaginazione, copertina, EPUB, KDP, ISBN. Vuoi un interlocutore unico che gestisca tutto.",
    cosaInclude: [
      "Editing e/o correzione di bozze sul testo integrale",
      "Impaginazione professionale per la stampa (interni)",
      "Conversione ed export in formato EPUB validato",
      "Progettazione della copertina",
      "Pubblicazione su Amazon KDP (cartaceo + ebook)",
      "Assegnazione ISBN e configurazione metadata",
      "Scheda prodotto Amazon ottimizzata",
    ],
    processo: [
      {
        titolo: "Analisi e piano",
        descrizione: "Definiamo il livello di intervento e il calendario di lavorazione.",
      },
      {
        titolo: "Editing",
        descrizione: "Interveniamo sul testo con revisioni tracciate e condivise.",
      },
      {
        titolo: "Impaginazione e copertina",
        descrizione: "Costruiamo interni ed esterni coerenti con il genere.",
      },
      {
        titolo: "Export e validazione",
        descrizione: "Prepariamo file cartaceo ed EPUB conformi agli standard KDP.",
      },
      {
        titolo: "Pubblicazione",
        descrizione: "Carichiamo su Amazon, configuriamo ISBN, metadata e scheda.",
      },
    ],
    prezzo: { min: 700, max: 3500, suffix: "+" },
    inEvidenza: true,
    faq: [
      {
        domanda: "Il prezzo varia molto: da cosa dipende?",
        risposta:
          "Dalla lunghezza del testo, dal livello di editing necessario e dai servizi inclusi. Il configuratore ti dà una stima precisa in due minuti.",
      },
      {
        domanda: "Il libro sarà pubblicato a mio nome?",
        risposta:
          "Sì. Tu resti l'autore e il titolare dei diritti; noi curiamo la produzione e la pubblicazione.",
      },
      {
        domanda: "Posso usare un mio ISBN invece del vostro?",
        risposta:
          "Certo. Gestiamo sia l'ISBN gratuito di KDP sia un ISBN di tua proprietà, se preferisci.",
      },
    ],
    prefillProjectType: "romanzo",
    ordine: 2,
  },
  {
    slug: "dal-diario-al-libro",
    nome: "Dal diario al libro",
    tagline: "Il nostro servizio signature: ghostwriting da diari, vocali e appunti.",
    problema:
      "Hai una storia da raccontare — la tua o quella di una persona cara — ma non è ancora un libro. Hai diari, registrazioni vocali, lettere, ricordi sparsi. Serve chi li trasformi in un testo scritto, coerente e da leggere.",
    cosaInclude: [
      "Raccolta e ordinamento dei materiali (diari, vocali, appunti, foto)",
      "Interviste di approfondimento con l'autore o i testimoni",
      "Scrittura integrale del libro (ghostwriting)",
      "Cicli di revisione condivisi con l'autore",
      "Editing, impaginazione, copertina ed EPUB",
      "Pubblicazione su Amazon KDP con ISBN e metadata",
    ],
    processo: [
      {
        titolo: "Ascolto",
        descrizione: "Ci racconti la storia e ci consegni tutti i materiali disponibili.",
      },
      { titolo: "Struttura", descrizione: "Costruiamo l'indice e il filo narrativo del libro." },
      {
        titolo: "Scrittura",
        descrizione: "Scriviamo i capitoli, con la tua voce, sottoponendoli alla tua approvazione.",
      },
      { titolo: "Revisione", descrizione: "Affiniamo insieme, capitolo per capitolo." },
      {
        titolo: "Pubblicazione",
        descrizione: "Impaginiamo, progettiamo la copertina e pubblichiamo.",
      },
    ],
    prezzo: { min: 3000, max: 15000, suffix: "+" },
    faq: [
      {
        domanda: "Il libro sarà scritto con le mie parole?",
        risposta:
          "Sì. Il nostro lavoro è rendere la tua voce, non sostituirla. Approvi ogni capitolo prima di procedere.",
      },
      {
        domanda: "Posso partire solo da registrazioni vocali?",
        risposta:
          "Assolutamente. Diari, vocali, lettere, appunti: qualsiasi materiale è un buon punto di partenza.",
      },
      {
        domanda: "Il mio nome comparirà come autore?",
        risposta:
          "Sì: il ghostwriting è riservato e il libro esce a tuo nome. La riservatezza è totale.",
      },
    ],
    prefillProjectType: "memoir",
    ordine: 3,
  },
  {
    slug: "libro-per-professionisti",
    nome: "Libro per professionisti",
    tagline: "Il libro come strumento di autorevolezza per consulenti e imprenditori.",
    problema:
      "Vuoi un libro che ti posizioni come riferimento nel tuo settore: da consegnare ai clienti, da usare nelle conferenze, da mettere al centro del tuo personal branding. Ma non hai il tempo di scriverlo né un piano di lancio.",
    cosaInclude: [
      "Definizione del posizionamento e del messaggio del libro",
      "Ghostwriting o editing profondo dei tuoi materiali",
      "Impaginazione premium coerente con la tua immagine",
      "Copertina professionale e versione EPUB",
      "Pubblicazione su Amazon KDP con ISBN e metadata",
      "Piano di lancio: scheda Amazon, materiali per LinkedIn, kit stampa",
    ],
    processo: [
      {
        titolo: "Strategia",
        descrizione: "Definiamo obiettivo, lettore ideale e messaggio del libro.",
      },
      {
        titolo: "Contenuti",
        descrizione: "Raccogliamo il tuo know-how e lo trasformiamo in capitoli.",
      },
      { titolo: "Produzione", descrizione: "Editing, impaginazione, copertina, EPUB." },
      {
        titolo: "Lancio",
        descrizione: "Pubblichiamo e prepariamo i materiali per la tua comunicazione.",
      },
    ],
    prezzo: { min: 5000, max: 20000 },
    faq: [
      {
        domanda: "Devo aver già scritto qualcosa?",
        risposta:
          "No. Possiamo partire da tue note, interviste o contenuti esistenti (articoli, talk, corsi) e costruire il libro da lì.",
      },
      {
        domanda: "Cosa comprende il piano di lancio?",
        risposta:
          "Scheda Amazon ottimizzata, testi per i tuoi canali, un kit stampa e le linee guida per usare il libro come leva commerciale.",
      },
      {
        domanda: "Quanto tempo richiede?",
        risposta:
          "In genere dai 3 ai 6 mesi, in funzione della complessità e del tuo coinvolgimento.",
      },
    ],
    prefillProjectType: "professionale",
    ordine: 4,
  },
  {
    slug: "copertina-e-impaginazione",
    nome: "Copertina e impaginazione",
    tagline: "Solo la parte grafica: copertina e layout, fatti bene.",
    problema:
      "Il testo è pronto e curato, ma la veste no. Ti serve una copertina che venda e un'impaginazione professionale, senza pagare per servizi editoriali che non ti servono.",
    cosaInclude: [
      "Progettazione della copertina (fronte, retro, dorso per il cartaceo)",
      "Impaginazione professionale degli interni per la stampa",
      "Versione EPUB impaginata e validata",
      "File pronti per il caricamento su KDP o altra piattaforma",
      "Due cicli di revisione grafica inclusi",
    ],
    processo: [
      { titolo: "Brief", descrizione: "Raccogliamo riferimenti, genere e preferenze visive." },
      {
        titolo: "Proposte",
        descrizione: "Presentiamo concept di copertina e stile di impaginazione.",
      },
      { titolo: "Sviluppo", descrizione: "Realizziamo copertina e interni definitivi." },
      {
        titolo: "Consegna file",
        descrizione: "Ti consegniamo i file pronti per la stampa e per l'ebook.",
      },
    ],
    prezzo: { min: 300, max: 1200 },
    faq: [
      {
        domanda: "Posso avere solo la copertina?",
        risposta: "Sì. Copertina e impaginazione sono acquistabili anche singolarmente.",
      },
      {
        domanda: "Usate immagini con licenza?",
        risposta:
          "Sì: tutte le immagini e i font sono correttamente licenziati per l'uso commerciale.",
      },
      {
        domanda: "In che formato consegnate?",
        risposta:
          "PDF stampa ad alta risoluzione per gli interni e la copertina, più EPUB validato per l'ebook.",
      },
    ],
    prefillProjectType: "grafica",
    ordine: 5,
  },
  {
    slug: "partner-white-label",
    nome: "Partner white label",
    tagline: "Produzione editoriale in outsourcing per agenzie, sotto il tuo marchio.",
    problema:
      "Sei un'agenzia di ghostwriting, comunicazione o personal branding e i tuoi clienti chiedono libri. Non vuoi costruire una redazione interna: vuoi un partner di produzione affidabile, riservato e a marchio tuo.",
    cosaInclude: [
      "Produzione editoriale completa a marchio della tua agenzia",
      "Ghostwriting, editing, impaginazione, copertine, EPUB, KDP",
      "Interlocutore dedicato e flussi di lavoro concordati",
      "Accordo di riservatezza (NDA) e clausole white label",
      "Listino riservato con condizioni per volumi",
    ],
    processo: [
      {
        titolo: "Accordo quadro",
        descrizione: "Firmiamo NDA e definiamo condizioni, marchio e SLA.",
      },
      {
        titolo: "Onboarding",
        descrizione: "Impostiamo template, tono di voce e canali di lavoro.",
      },
      {
        titolo: "Produzione",
        descrizione: "Realizziamo i progetti a tuo nome, tu resti l'unico referente del cliente.",
      },
      {
        titolo: "Consegna e scala",
        descrizione: "Consegniamo, iteriamo e cresciamo sui volumi concordati.",
      },
    ],
    prezzo: null,
    prezzoLabel: "Prezzi riservati — su preventivo con NDA",
    faq: [
      {
        domanda: "I miei clienti sapranno che lavorate voi?",
        risposta:
          "No. Tutto è white label: la produzione avviene sotto il tuo marchio, con piena riservatezza.",
      },
      {
        domanda: "Come funzionano i prezzi?",
        risposta:
          "Con un listino riservato a condizioni dedicate per le agenzie, definito dopo la firma dell'NDA e in base ai volumi.",
      },
      {
        domanda: "Che volumi gestite?",
        risposta: "Dal progetto singolo alla produzione ricorrente di più titoli al mese.",
      },
    ],
    prefillProjectType: null,
    ordine: 6,
  },
];

export function getService(slug: string): Service | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

export function servicesOrdered(): Service[] {
  return [...SERVICES].sort((a, b) => a.ordine - b.ordine);
}
