export const services = [
  {
    slug: "correzione-bozze",
    title: "Correzione bozze",
    group: "Revisione",
    lead: "L’ultima cura, prima di andare in stampa.",
    description:
      "Refusi, punteggiatura e uniformità: una lettura attenta per consegnare un testo pulito, rispettando la tua voce.",
    includes: [
      "Correzione di refusi ed errori grammaticali",
      "Uniformità di punteggiatura e convenzioni editoriali",
      "Verifica finale delle correzioni concordate",
    ],
    needs: "Il testo completo in formato modificabile e, se disponibile, il foglio di stile.",
    result: "Una versione con modifiche tracciate e un testo pulito, nei formati concordati.",
    note: "La correzione bozze non interviene sulla struttura narrativa. Se il testo richiede un lavoro più profondo, lo valutiamo insieme.",
  },
  {
    slug: "editing",
    title: "Editing",
    group: "Revisione",
    lead: "La tua voce, nella sua forma migliore.",
    description:
      "Lavoriamo su ritmo, struttura e chiarezza. Ti aiutiamo a capire cosa funziona, dove il testo perde forza e come far emergere la storia che vuoi raccontare.",
    includes: [
      "Lettura e diagnosi editoriale del testo",
      "Interventi su stile, struttura e coerenza",
      "Confronto sulle revisioni con l’editor",
    ],
    needs: "Il manoscritto, una breve sinossi e una descrizione dei lettori a cui ti rivolgi.",
    result:
      "Un testo revisionato con commenti editoriali e indicazioni per le scelte ancora aperte.",
    note: "Profondità dell’intervento e cicli di revisione vengono definiti nel preventivo, prima di iniziare.",
  },
  {
    slug: "ghostwriting",
    title: "Ghostwriting",
    group: "Scrittura",
    lead: "La tua storia merita di trovare le parole.",
    description:
      "Partiamo dalle tue idee, dai tuoi materiali e dalla tua voce. Un percorso di interviste, ricerca e scrittura per costruire un libro che ti rappresenti.",
    includes: [
      "Brief, interviste e raccolta dei materiali",
      "Proposta di indice e campione di voce",
      "Scrittura e revisioni per fasi concordate",
    ],
    needs:
      "L’idea del libro, l’obiettivo, i materiali disponibili e il tempo che puoi dedicare al confronto.",
    result: "Un manoscritto originale sviluppato insieme a te, secondo quanto concordato.",
    note: "Attribuzione, riservatezza e diritti d’utilizzo sono definiti per iscritto nel contratto.",
  },
  {
    slug: "impaginazione",
    title: "Impaginazione",
    group: "Design e produzione",
    lead: "Un libro bello anche da leggere.",
    description:
      "Trasformiamo il testo in pagine equilibrate, leggibili e coerenti con il progetto. Carta e digitale hanno esigenze diverse: le affrontiamo con cura.",
    includes: [
      "Progetto tipografico e gabbia di pagina",
      "Impaginazione per il formato scelto",
      "Preparazione PDF ed eventuale EPUB",
    ],
    needs: "Il testo definitivo, il formato desiderato e tutte le immagini con i relativi diritti.",
    result:
      "File pronti per la destinazione concordata, con una bozza da approvare prima della consegna.",
    note: "Il testo deve essere stabilizzato: le modifiche sostanziali successive possono richiedere un nuovo intervento.",
  },
  {
    slug: "copertina",
    title: "Copertina",
    group: "Design e produzione",
    lead: "Il primo incontro con la tua storia.",
    description:
      "Una copertina deve esprimere il libro e parlare ai suoi lettori. Costruiamo una direzione visiva coerente con genere, tono e destinazione.",
    includes: [
      "Brief visivo e direzione creativa",
      "Proposta grafica e revisioni concordate",
      "Esecutivi per stampa e formato digitale",
    ],
    needs: "Sinossi, genere, pubblico, formato e specifiche di stampa, se già disponibili.",
    result:
      "Copertina, dorso e quarta secondo le specifiche concordate, più il file per l’ebook se previsto.",
    note: "Immagini, licenze e numero di proposte sono esplicitati nel preventivo.",
  },
  {
    slug: "pubblicazione",
    title: "Pubblicazione",
    group: "Pubblicazione",
    lead: "Dal file pronto al libro disponibile.",
    description:
      "Ti accompagniamo nei passaggi pratici della pubblicazione: formati, metadati, piattaforme e controlli prima dell’uscita.",
    includes: [
      "Preparazione dei materiali per Amazon KDP",
      "Supporto per ISBN e metadati",
      "Verifica delle specifiche e della scheda libro",
    ],
    needs:
      "File editoriali approvati, dati dell’autore e indicazioni sulla modalità di pubblicazione.",
    result:
      "Materiali e impostazioni pronti per il canale scelto, con il tuo controllo sulle decisioni.",
    note: "Costi esterni e condizioni delle piattaforme vengono verificati separatamente. La pubblicazione non garantisce vendite.",
  },
  {
    slug: "promozione",
    title: "Promozione",
    group: "Promozione",
    lead: "Trova i lettori a cui parlare.",
    description:
      "Definiamo un posizionamento e un piano di lancio realistico. Mettiamo in ordine messaggi, canali e materiali per presentare il libro con coerenza.",
    includes: [
      "Posizionamento e pubblico di riferimento",
      "Strategia di lancio e calendario dei contenuti",
      "Materiali di presentazione del libro",
    ],
    needs: "Il libro o la sinossi, gli obiettivi e una panoramica dei canali già attivi.",
    result: "Un piano operativo con priorità, materiali e attività concordate.",
    note: "Budget pubblicitari, acquisto di spazi e servizi esterni non sono inclusi automaticamente.",
  },
];
export const paths = [
  {
    slug: "libro-gia-scritto",
    title: "Ho già scritto il libro",
    short: "Il manoscritto c’è. Ora facciamolo crescere.",
    description:
      "Una prima lettura ci aiuta a capire se serve editing, correzione bozze o un lavoro sulla struttura. Poi prepariamo il testo, il progetto grafico e i file per la pubblicazione.",
    steps: [
      "Valutazione del manoscritto",
      "Editing o correzione, secondo necessità",
      "Copertina e impaginazione",
      "Preparazione alla pubblicazione",
    ],
    color: "peach",
    icon: "book",
  },
  {
    slug: "idea-da-sviluppare",
    title: "Ho un’idea da sviluppare",
    short: "Da un’intuizione alle prime pagine.",
    description:
      "Mettiamo a fuoco l’idea, i lettori e la forma del libro. Costruiamo un indice e un campione di scrittura, poi scegliamo come lavorare insieme: affiancamento o ghostwriting.",
    steps: [
      "Brief e direzione del progetto",
      "Indice e campione di voce",
      "Scrittura per capitoli",
      "Editing e produzione",
    ],
    color: "lavender",
    icon: "pages",
  },
  {
    slug: "memoir",
    title: "Voglio raccontare una storia vera",
    short: "La tua esperienza, con la cura che merita.",
    description:
      "Ricordi, documenti e interviste diventano il materiale di un racconto. Ti aiutiamo a trovare un filo, conservando il tuo punto di vista e concordando come trattare persone e vicende reali.",
    steps: [
      "Raccolta dei ricordi e dei materiali",
      "Interviste e struttura narrativa",
      "Scrittura e confronto",
      "Revisione e realizzazione del libro",
    ],
    color: "sage",
    icon: "bookmark",
  },
  {
    slug: "libro-professionale",
    title: "Insegno, formo, condivido un metodo",
    short: "Trasforma corsi, consulenze e competenze in un manuale utile ai tuoi lettori.",
    description:
      "Se sei un professionista, un consulente o un formatore, partiamo dai tuoi corsi, appunti e materiali didattici per costruire un libro. Organizziamo il tuo metodo in capitoli, esempi ed esercizi: un manuale che trasmette le tue competenze e sostiene il tuo lavoro.",
    steps: [
      "Obiettivo e pubblico",
      "Architettura dei contenuti",
      "Scrittura e revisione specialistica",
      "Design e preparazione al lancio",
    ],
    color: "coral-soft",
    icon: "document",
  },
  {
    slug: "storia-impresa",
    title: "Racconto la mia impresa",
    short: "Persone, intuizioni e sfide: la tua storia di lavoro merita un libro.",
    description:
      "Un’attività nata da un’intuizione, un percorso imprenditoriale o una storia aziendale da tramandare. Partiamo da interviste, documenti e ricordi per raccontare le decisioni, le persone e le svolte che hanno costruito la tua impresa, con una voce autentica.",
    steps: [
      "Obiettivo, lettori e storia da raccontare",
      "Interviste e raccolta dei materiali",
      "Struttura e scrittura condivisa",
      "Revisione, design e pubblicazione",
    ],
    color: "sky",
    icon: "business",
  },
];
export const workflow = [
  ["Raccontaci il progetto", "Partiamo dal testo, dall’idea e dalle tue aspettative."],
  ["Costruiamo il percorso", "Definiamo attività, consegne e preventivo."],
  ["Lavoriamo insieme", "Il team sviluppa il progetto, una fase alla volta."],
  ["Approvi ogni fase", "Leggi, commenti e confermi le scelte editoriali."],
  ["Ricevi il tuo libro pronto", "Trovi tutti i file finali, nei formati concordati."],
];
export const articles = [
  {
    slug: "editing-o-correzione-bozze",
    tag: "Cura del testo",
    title: "Editing o correzione bozze: da dove cominciare?",
    summary: "Due interventi diversi, che arrivano in momenti diversi della vita del manoscritto.",
    paragraphs: [
      "L’editing guarda il testo nel suo insieme: struttura, voce, ritmo e coerenza. Può riguardare l’ordine dei capitoli, la leggibilità di un passaggio o il modo in cui un personaggio cambia nel corso della storia.",
      "La correzione bozze arriva su un testo già stabilizzato. Cerca refusi, errori grammaticali, punteggiatura incoerente e difformità nelle convenzioni editoriali. Non sostituisce il lavoro sulla struttura.",
      "Se non sai quale intervento scegliere, il punto di partenza è una valutazione. Una lettura professionale permette di capire cosa serve davvero senza acquistare servizi che non ti servono.",
    ],
  },
  {
    slug: "preparare-il-manoscritto",
    tag: "Prima di iniziare",
    title: "Come preparare il manoscritto per un editor",
    summary: "Pochi materiali, ordinati bene, rendono il confronto più utile fin dall’inizio.",
    paragraphs: [
      "Prepara una versione completa e modificabile del testo. Usa una formattazione semplice: non serve impaginare il libro prima dell’editing. Mantieni una copia del file originale.",
      "Aggiungi una breve sinossi e racconta a chi vuoi rivolgerti. Segnala dubbi, parti ancora aperte e obiettivi: sono informazioni utili, non imperfezioni da nascondere.",
      "Se il progetto contiene immagini, citazioni o contributi di altre persone, raccogli anche le informazioni sulle fonti e sui diritti. Questi aspetti vanno chiariti prima della produzione.",
    ],
  },
  {
    slug: "dalla-bozza-ai-file-finali",
    tag: "Produzione",
    title: "Dalla bozza ai file finali: le approvazioni che contano",
    summary:
      "Una sequenza chiara aiuta a evitare modifiche costose quando il libro è già impaginato.",
    paragraphs: [
      "Prima si approva il testo. Poi si lavora sulla forma delle pagine. Invertire questi passaggi significa dover rifare l’impaginazione a ogni modifica sostanziale.",
      "Copertina e interni devono rispettare il formato e le specifiche del canale di pubblicazione. Una bozza permette di controllare titoli, indice, immagini e leggibilità prima dell’esportazione.",
      "La consegna finale va definita all’inizio: PDF per la stampa, EPUB o altri formati non sono intercambiabili. Chiedi sempre quali file riceverai e per quale utilizzo.",
    ],
  },
];
