/**
 * Percorsi: il primo livello dell'offerta. Il cliente non cerca "editing
 * stilistico", cerca "ho già scritto il libro e non so cosa farne".
 *
 * Ogni percorso raggruppa servizi che esistono davvero in config/catalogo.ts
 * (`tests/catalogo.test.ts` verifica che nessuno slug sia orfano) e non porta
 * prezzi propri: eredita quelli dei servizi o passa dal preventivo.
 */

import type { Percorso } from "./catalogo";

export const PERCORSI: Percorso[] = [
  {
    slug: "ho-gia-scritto-il-libro",
    nome: "Ho già scritto il libro",
    claim: "Il manoscritto è finito. Adesso serve chi lo porti al livello di un libro pubblicato.",
    perChi: "Autori con un testo completo, dalla prima bozza al file quasi pronto.",
    problema:
      "Hai finito di scrivere e non sai più giudicarlo. Non sai se serve una correzione o un editing vero, se il finale funziona, se sei pronto per pubblicare o se stai per bruciare l'unica prima impressione che avrai.",
    tappe: [
      {
        titolo: "Lettura e diagnosi",
        descrizione:
          "Un editor legge il testo e dice a che punto è davvero, con una scheda scritta.",
      },
      {
        titolo: "Livello di intervento",
        descrizione:
          "Decidiamo insieme se serve correzione, revisione linguistica o editing, e perché.",
      },
      {
        titolo: "Lavorazione",
        descrizione:
          "Interveniamo sul testo con revisioni tracciate: vedi ogni modifica e decidi tu.",
      },
      {
        titolo: "Chiusura",
        descrizione: "Approvi il testo finale e hai un file pulito, pronto per la produzione.",
      },
    ],
    servizi: [
      "scheda-valutazione-editoriale",
      "correzione-bozze",
      "revisione-linguistica",
      "editing-stilistico",
      "editing-narrativo",
    ],
    prezzo: { tipo: "preventivo", motivo: "Dipende dal livello di intervento e dalla lunghezza." },
    faq: [
      {
        domanda: "Come faccio a sapere quale livello mi serve?",
        risposta:
          "È esattamente quello che stabilisce la scheda di valutazione. Se hai un budget stretto, parti da lì: costa poco e ti evita di comprare un servizio sbagliato.",
      },
      {
        domanda: "Mi cambiate la voce?",
        risposta:
          "No. Ogni intervento arriva come revisione tracciata da accettare o rifiutare: se una modifica non ti somiglia, la rifiuti.",
      },
      {
        domanda: "Quanto ci vuole?",
        risposta:
          "La scheda in 7-10 giorni lavorativi. Le lavorazioni sul testo dipendono dalla lunghezza: le date esatte sono nel preventivo.",
      },
    ],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "dall-idea-al-libro",
    nome: "Ho un'idea o del materiale grezzo",
    claim: "Da appunti, registrazioni e idee sparse a un'opera compiuta.",
    perChi: "Chi ha contenuti ma non un libro, e non ha tempo o mestiere per scriverlo.",
    problema:
      "Sai cosa vuoi raccontare. Hai persino del materiale. Ma tra quello che hai e un libro c'è un lavoro che non sai fare, e ogni volta che ci provi ti fermi al terzo capitolo.",
    tappe: [
      {
        titolo: "Ascolto",
        descrizione: "Raccogliamo materiali e facciamo le prime interviste per capire l'opera.",
      },
      {
        titolo: "Struttura",
        descrizione: "Costruiamo l'indice e l'arco prima di scrivere una riga.",
      },
      {
        titolo: "Stesura",
        descrizione: "Scriviamo per capitoli, con consegne progressive che approvi mano a mano.",
      },
      { titolo: "Editing", descrizione: "Il testo completo viene rivisto come un manoscritto." },
      {
        titolo: "Produzione",
        descrizione: "Impaginazione, copertina e file pronti, se vuoi arrivare fin lì.",
      },
    ],
    servizi: [
      "strutturazione-opera",
      "interviste",
      "da-materiali-a-libro",
      "ghostwriting",
      "co-writing",
      "editing-narrativo",
    ],
    prezzo: {
      tipo: "preventivo",
      motivo: "Dipende dalla lunghezza finale e da quanto materiale esiste già.",
    },
    faq: [
      {
        domanda: "L'autore chi è?",
        risposta:
          "Tu. Il ghostwriting è riservato per contratto: nessuna nostra firma compare sull'opera.",
      },
      {
        domanda: "Devo avere già del materiale?",
        risposta:
          "No, ma cambia il preventivo: più materiale grezzo esiste, meno lavoro di creazione serve e più bassa è la tariffa.",
      },
      {
        domanda: "Posso fermarmi a metà?",
        risposta:
          "Sì. Si procede per fasi approvate: quello che è stato consegnato resta tuo, il resto non parte.",
      },
    ],
    prefillPreventivo: "memoir",
  },
  {
    slug: "memoir-e-storia-familiare",
    nome: "Memoir, autobiografia, storia familiare",
    claim: "Una storia che esiste in una sola testa, messa al sicuro in un libro.",
    perChi: "Chi vuole tramandare la propria storia o quella della propria famiglia.",
    problema:
      "C'è una storia che solo tu conosci, e ogni anno che passa se ne perde un pezzo. Vorresti lasciarla scritta ma non sai da dove cominciare, e temi che venga fuori un elenco di date.",
    tappe: [
      {
        titolo: "Interviste",
        descrizione: "Sessioni registrate con un redattore che sa cosa chiedere.",
      },
      {
        titolo: "Materiali",
        descrizione: "Lettere, foto, diari e documenti vengono inventariati e ordinati.",
      },
      {
        titolo: "Ricerca",
        descrizione: "Dove serve, verifichiamo date e fatti negli archivi.",
      },
      { titolo: "Stesura", descrizione: "Il racconto prende forma di libro, capitolo per capitolo." },
      {
        titolo: "Il libro",
        descrizione: "Editing, impaginazione, copertina. Anche in tiratura privata.",
      },
    ],
    servizi: [
      "interviste",
      "da-materiali-a-libro",
      "ricerca-documentale",
      "ghostwriting",
      "impaginazione",
      "copertina",
    ],
    prezzo: {
      tipo: "preventivo",
      motivo: "Dipende dalle sessioni di intervista, dai materiali e dalla lunghezza.",
    },
    faq: [
      {
        domanda: "Deve finire su Amazon?",
        risposta:
          "No. Molti memoir restano privati: stampiamo poche copie per la famiglia, senza pubblicazione.",
      },
      {
        domanda: "Come trattate le cose delicate?",
        risposta:
          "Con un accordo di riservatezza e la regola che nulla entra nel libro senza la tua approvazione esplicita.",
      },
      {
        domanda: "Si può fare a distanza?",
        risposta: "Sì, le interviste si fanno in videochiamata. Di persona dove è possibile.",
      },
    ],
    prefillPreventivo: "memoir",
  },
  {
    slug: "libro-professionale",
    nome: "Libro professionale o d'impresa",
    claim: "Il libro come strumento di autorevolezza, non come hobby.",
    perChi: "Consulenti, formatori, professionisti, imprenditori.",
    problema:
      "Nel tuo settore sei bravo, ma quando ti presenti sei uno dei tanti. Un libro ti posizionerebbe come riferimento — se avessi il tempo di scriverlo e un modo per farlo arrivare a qualcuno.",
    tappe: [
      {
        titolo: "Posizionamento",
        descrizione: "Definiamo tesi, lettore e obiettivo commerciale del libro.",
      },
      { titolo: "Indice", descrizione: "L'architettura dei contenuti, prima della scrittura." },
      {
        titolo: "Contenuto",
        descrizione: "Scriviamo noi da interviste e materiali, o revisioniamo quello che hai.",
      },
      { titolo: "Produzione", descrizione: "Editing, impaginazione e copertina professionali." },
      { titolo: "Lancio", descrizione: "Piano, materiali e scheda per farlo esistere sul mercato." },
    ],
    servizi: [
      "strutturazione-opera",
      "ghostwriting",
      "editing-stilistico",
      "impaginazione",
      "copertina",
      "scheda-amazon",
      "strategia-di-lancio",
    ],
    prezzo: {
      tipo: "preventivo",
      motivo: "Dipende dal fatto che il contenuto esista già e dall'ampiezza del lancio.",
    },
    faq: [
      {
        domanda: "Non ho tempo di scrivere.",
        risposta:
          "È il caso normale. Lavoriamo con interviste e materiali che già produci: alla scrittura pensiamo noi, nella tua voce.",
      },
      {
        domanda: "Il libro mi porterà clienti?",
        risposta:
          "Non lo garantiamo, e diffida da chi lo fa. Un libro ti dà autorevolezza e un motivo per essere cercato: quello che ci costruisci sopra dipende da te.",
      },
      {
        domanda: "Si può fare a nome dell'azienda?",
        risposta: "Sì, con firma aziendale o di un dirigente. Cambia il taglio, non il metodo.",
      },
    ],
    prefillPreventivo: "libro-professionale",
  },
  {
    slug: "ricerca-storica-e-archivistica",
    nome: "Ricerca storica e archivistica",
    claim: "Fonti, archivi e documenti, e poi il libro che ne nasce.",
    perChi: "Studiosi, istituzioni, aziende con un archivio, famiglie con una storia da ricostruire.",
    problema:
      "Il libro che hai in mente poggia su fatti che vanno documentati. Gli archivi ci sono, ma richiedono accessi, metodo e mesi di lavoro che non hai.",
    tappe: [
      {
        titolo: "Domande di ricerca",
        descrizione: "Definiamo cosa cercare e cosa conta come risposta.",
      },
      { titolo: "Reperimento", descrizione: "Archivi, biblioteche e banche dati, con schedatura." },
      { titolo: "Verifica", descrizione: "Ogni riferimento viene riscontrato su fonte." },
      { titolo: "Sintesi", descrizione: "Una relazione utilizzabile direttamente in stesura." },
      { titolo: "Opera", descrizione: "Se serve, dalla ricerca costruiamo il libro." },
    ],
    servizi: ["ricerca-documentale", "fact-checking", "ghostwriting", "editing-narrativo"],
    prezzo: {
      tipo: "preventivo",
      motivo: "Dipende dagli archivi coinvolti e dall'ampiezza della ricerca.",
    },
    faq: [
      {
        domanda: "Gestite gli accessi agli archivi?",
        risposta:
          "Sì, dove è possibile. Alcuni archivi richiedono autorizzazioni intestate al committente: in quel caso ti guidiamo nella richiesta.",
      },
      {
        domanda: "Consegnate anche i documenti?",
        risposta:
          "Consegniamo le schede con i riferimenti completi. Le riproduzioni dipendono dai diritti dell'archivio e si trattano a parte.",
      },
      {
        domanda: "E se la ricerca non trova nulla?",
        risposta:
          "È un esito possibile e lo mettiamo per iscritto. Paghi il lavoro di ricerca, non un risultato che nessuno può promettere.",
      },
    ],
    prefillPreventivo: "saggio",
  },
  {
    slug: "voglio-pubblicare",
    nome: "Voglio pubblicare",
    claim: "Dal file finito al libro online, senza sei interlocutori diversi.",
    perChi: "Chi ha il testo definitivo e deve affrontare la produzione e gli store.",
    problema:
      "Il testo è pronto. Ora servono impaginazione, copertina, EPUB, KDP, ISBN e metadati: sei fornitori, sei preventivi, e ogni errore lo scopri quando è online.",
    tappe: [
      { titolo: "Verifica", descrizione: "Controlliamo che il testo sia davvero pronto." },
      { titolo: "Produzione", descrizione: "Interno impaginato, copertina, EPUB validato." },
      { titolo: "Esecutivi", descrizione: "File di stampa conformi alle specifiche del fornitore." },
      { titolo: "Pubblicazione", descrizione: "KDP, ISBN, categorie e scheda." },
      { titolo: "Controllo", descrizione: "Verifica su store prima di dichiarare chiuso." },
    ],
    servizi: [
      "impaginazione",
      "copertina",
      "epub",
      "file-stampa",
      "amazon-kdp",
      "isbn",
      "scheda-amazon",
      "metadata",
    ],
    prezzo: {
      tipo: "preventivo",
      motivo: "Somma dei servizi scelti: il configuratore calcola il totale esatto.",
    },
    faq: [
      {
        domanda: "Pubblicate sul mio account?",
        risposta:
          "Come preferisci: possiamo affiancarti sul tuo account o gestire noi la pubblicazione. Il libro resta comunque tuo.",
      },
      {
        domanda: "E se il testo non fosse pronto?",
        risposta:
          "Te lo diciamo prima di produrre. Impaginare un testo da correggere significa rifare l'impaginazione dopo.",
      },
      {
        domanda: "Posso comprare un servizio solo?",
        risposta: "Sì. Ogni servizio di produzione è acquistabile singolarmente.",
      },
    ],
    prefillPreventivo: "solo-grafica",
  },
  {
    slug: "voglio-promuovere-il-libro",
    nome: "Voglio promuovere il libro",
    claim: "Il libro esiste. Adesso deve incontrare i suoi lettori.",
    perChi: "Chi ha pubblicato, da poco o da tempo, e non ottiene visibilità.",
    problema:
      "Il libro è online e non succede niente. Non sai se il problema è la scheda, le categorie, la copertina o il fatto che nessuno sa che esiste.",
    tappe: [
      { titolo: "Diagnosi", descrizione: "Guardiamo scheda, metadati, copertina e posizionamento." },
      { titolo: "Correzioni", descrizione: "Sistemiamo ciò che frena la conversione." },
      { titolo: "Piano", descrizione: "Calendario, canali e messaggi, con date reali." },
      { titolo: "Materiali", descrizione: "Grafiche e testi pronti da pubblicare." },
      { titolo: "Seguito", descrizione: "Monitoraggio nei mesi successivi." },
    ],
    servizi: [
      "scheda-amazon",
      "metadata",
      "strategia-di-lancio",
      "materiali-promozionali",
      "guida-promozione",
      "post-pubblicazione",
    ],
    prezzo: {
      tipo: "preventivo",
      motivo: "Dipende da cosa serve davvero: spesso il primo intervento è sulla scheda.",
    },
    faq: [
      {
        domanda: "Garantite le vendite?",
        risposta:
          "No. Nessuno può garantirle onestamente. Garantiamo un piano fatto bene e materiali all'altezza.",
      },
      {
        domanda: "Comprate recensioni?",
        risposta:
          "Mai. È vietato dagli store e mette a rischio la tua scheda. Ti spieghiamo come raccoglierle correttamente.",
      },
      {
        domanda: "Funziona anche per un libro uscito anni fa?",
        risposta:
          "Sì. Spesso su un libro vecchio l'intervento sui metadati è il più redditizio in assoluto.",
      },
    ],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "agenzie-e-white-label",
    nome: "Agenzie e white label",
    claim: "Il tuo reparto editoriale esterno. Invisibile ai tuoi clienti.",
    perChi: "Agenzie, editori, service editoriali, studi di comunicazione.",
    problema:
      "Vendi libri e contenuti lunghi ma non hai la redazione per produrli. Assumere per i picchi non ha senso, e mostrare un fornitore al cliente finale nemmeno.",
    tappe: [
      { titolo: "Accordo", descrizione: "NDA e perimetro della collaborazione." },
      { titolo: "Onboarding", descrizione: "Referente dedicato, portale con il tuo marchio, SLA." },
      { titolo: "Produzione", descrizione: "Lavoriamo come tuo reparto interno, in background." },
      { titolo: "Consegna", descrizione: "Consegniamo a te. Al cliente finale ci parli tu." },
    ],
    servizi: ["produzione-white-label", "agenzie", "ghostwriting-agencies", "partner-editoriali"],
    prezzo: { tipo: "preventivo", motivo: "Listino riservato, su volume e ricorrenza." },
    faq: [
      {
        domanda: "I nostri clienti sapranno di voi?",
        risposta:
          "No. White label totale: nessun contatto e nessuna menzione. Il portale può portare il tuo marchio.",
      },
      {
        domanda: "I nostri progetti sono separati?",
        risposta:
          "Sì, a livello di piattaforma: la tua organizzazione ha i propri utenti, progetti e file, e nessun altro può vederli.",
      },
      {
        domanda: "Reggete i picchi?",
        risposta:
          "È il motivo per cui esiste il servizio. SLA e capacità si concordano nell'accordo quadro.",
      },
    ],
  },
];

export const SLUG_PERCORSI = PERCORSI.map((p) => p.slug);

export function getPercorso(slug: string): Percorso | undefined {
  return PERCORSI.find((p) => p.slug === slug);
}
