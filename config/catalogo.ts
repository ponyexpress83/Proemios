/**
 * Catalogo dell'offerta su due livelli.
 *
 *  1. PERCORSI  — come il cliente descrive il proprio problema ("ho già scritto
 *     il libro", "voglio pubblicare"). Sono l'ingresso commerciale.
 *  2. SERVIZI   — le singole lavorazioni acquistabili, raggruppate per area.
 *
 * REGOLA SUI PREZZI: l'unica fonte di verità delle tariffe è config/pricing.ts.
 * Qui non compare nessun numero letterale: ogni prezzo indicativo è derivato da
 * quelle costanti. Un servizio per cui non esiste una tariffa già approvata è
 * `{ tipo: "preventivo" }` — non si inventano cifre.
 */

import {
  EDITING_BANDS,
  PROOFREADING_BANDS,
  LAYOUT_PAGE_TIERS,
  FLAT_SERVICES,
  GHOSTWRITING,
  SIGNATURE_EXTRAS,
} from "./pricing";

// ───────────────────────────── Tipi ─────────────────────────────

export type AreaServizio =
  | "testo"
  | "scrittura"
  | "produzione"
  | "pubblicazione"
  | "lingue"
  | "promozione"
  | "b2b";

export const AREE: Record<AreaServizio, { nome: string; sommario: string }> = {
  testo: {
    nome: "Testo",
    sommario: "Chi legge, corregge e migliora quello che hai scritto.",
  },
  scrittura: {
    nome: "Scrittura",
    sommario: "Chi scrive con te, o al posto tuo, partendo da quello che hai.",
  },
  produzione: {
    nome: "Produzione",
    sommario: "Il libro come oggetto: interno impaginato, copertina, file.",
  },
  pubblicazione: {
    nome: "Pubblicazione",
    sommario: "Portare il libro sugli store, con i metadati giusti.",
  },
  lingue: {
    nome: "Lingue",
    sommario: "Traduzione e revisione specialistica, con voce preservata.",
  },
  promozione: {
    nome: "Promozione",
    sommario: "Far incontrare il libro con i suoi lettori.",
  },
  b2b: {
    nome: "B2B e white label",
    sommario: "Capacità editoriale per agenzie, editori e partner.",
  },
};

/**
 * Prezzo mostrato al pubblico. Deliberatamente povero di varianti: o c'è una
 * tariffa approvata, o si passa dal preventivo.
 */
export type PrezzoPubblico =
  | { tipo: "a-parola"; da: number; a: number; minimo?: number }
  | { tipo: "forfait"; importo: number }
  | { tipo: "fascia"; da: number; a: number }
  | { tipo: "preventivo"; motivo: string };

export type Servizio = {
  slug: string;
  nome: string;
  area: AreaServizio;
  /** Una riga: cosa ottiene il cliente. */
  sommario: string;
  /** Il problema, nelle parole del cliente. */
  problema: string;
  /** Cosa comprende, concreto e verificabile. */
  include: string[];
  /** Cosa NON comprende. Dirlo prima evita contestazioni dopo. */
  esclude?: string[];
  perChi: string;
  prezzo: PrezzoPubblico;
  /** Cosa fa variare il prezzo o il tempo. */
  variabili: string;
  /** Slug di servizi che si comprano tipicamente insieme. */
  correlati?: string[];
  /** Precompila il configuratore di preventivo. */
  prefillPreventivo?: string;
};

export type Percorso = {
  slug: string;
  nome: string;
  /** Come lo direbbe il cliente, in prima persona. */
  claim: string;
  perChi: string;
  problema: string;
  /** Le tappe del percorso, in ordine. */
  tappe: { titolo: string; descrizione: string }[];
  /** Servizi tipicamente inclusi (slug). Sono un contenuto, non un vincolo. */
  servizi: string[];
  prezzo: PrezzoPubblico;
  faq: { domanda: string; risposta: string }[];
  prefillPreventivo?: string;
};

// ─────────────────── Prezzi derivati da config/pricing.ts ───────────────────

const tariffaEditing = {
  min: Math.min(...EDITING_BANDS.map((b) => b.ratePerWord)),
  max: Math.max(...EDITING_BANDS.map((b) => b.ratePerWord)),
};
const tariffaCorrezione = {
  min: Math.min(...PROOFREADING_BANDS.map((b) => b.ratePerWord)),
  max: Math.max(...PROOFREADING_BANDS.map((b) => b.ratePerWord)),
};
const tariffaImpaginazione = {
  min: Math.min(...LAYOUT_PAGE_TIERS.map((t) => t.price)),
  max: Math.max(...LAYOUT_PAGE_TIERS.map((t) => t.price)),
};
const moltiplicatoriGhostwriting = Object.values(GHOSTWRITING.materialMultiplier);
const tariffaGhostwriting = {
  min: GHOSTWRITING.baseRatePerFinalWord * Math.min(...moltiplicatoriGhostwriting),
  max: GHOSTWRITING.baseRatePerFinalWord * Math.max(...moltiplicatoriGhostwriting),
};

const PREZZO_EDITING: PrezzoPubblico = {
  tipo: "a-parola",
  da: tariffaEditing.min,
  a: tariffaEditing.max,
};
const PREZZO_CORREZIONE: PrezzoPubblico = {
  tipo: "a-parola",
  da: tariffaCorrezione.min,
  a: tariffaCorrezione.max,
};
const PREZZO_GHOSTWRITING: PrezzoPubblico = {
  tipo: "a-parola",
  da: tariffaGhostwriting.min,
  a: tariffaGhostwriting.max,
  minimo: GHOSTWRITING.minimum,
};

/** Un servizio senza tariffa deliberata non riceve un prezzo inventato. */
function suPreventivo(motivo: string): PrezzoPubblico {
  return { tipo: "preventivo", motivo };
}

// ───────────────────────────── Servizi ─────────────────────────────

export const SERVIZI: Servizio[] = [
  // ── AREA TESTO ──
  {
    slug: "correzione-bozze",
    nome: "Correzione bozze",
    area: "testo",
    sommario: "Il testo senza errori, con la tua voce intatta.",
    problema:
      "Il libro è finito e ti convince, ma sai che ci sono refusi e incertezze che una lettura tua non intercetta più.",
    include: [
      "Refusi, ortografia, accenti e apostrofi",
      "Punteggiatura e spaziature",
      "Grammatica certa e concordanze",
      "Uniformità tipografica (virgolette, corsivi, maiuscole, numeri)",
      "Consegna in DOCX con revisioni tracciate, da accettare o rifiutare",
    ],
    esclude: [
      "Riscrittura di frasi, cambi di stile o di struttura",
      "Verifica dei contenuti e delle fonti",
    ],
    perChi: "Chi ha un testo già rivisto nel merito e vuole solo la pulizia finale.",
    prezzo: PREZZO_CORREZIONE,
    variabili: "La tariffa a parola scende al crescere della lunghezza del testo.",
    correlati: ["revisione-linguistica", "impaginazione"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "revisione-linguistica",
    nome: "Revisione linguistica",
    area: "testo",
    sommario: "Correzione bozze più sintassi, chiarezza e ripetizioni.",
    problema:
      "Il testo è corretto ma faticoso: frasi che si aggrovigliano, parole che tornano troppo spesso, passaggi ambigui.",
    include: [
      "Tutto quello che comprende la correzione bozze",
      "Sintassi e costruzione del periodo",
      "Chiarezza e scioglimento delle ambiguità locali",
      "Ripetizioni ravvicinate e zeppe",
      "Consegna in DOCX con revisioni tracciate e commenti",
    ],
    esclude: ["Interventi su struttura, personaggi o arco narrativo"],
    perChi: "Chi vuole un testo che scorra, senza che gli venga cambiata la voce.",
    prezzo: suPreventivo(
      "La tariffa dipende dallo stato del testo: la quotiamo dopo aver letto un campione.",
    ),
    variabili: "Lunghezza del testo e quanto lavoro serve davvero sulla sintassi.",
    correlati: ["correzione-bozze", "editing-stilistico"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "editing-stilistico",
    nome: "Editing stilistico",
    area: "testo",
    sommario: "Ritmo, lessico e voce: il testo diventa la sua versione migliore.",
    problema:
      "Quello che vuoi dire c'è, ma non suona come lo senti tu. Il ritmo è piatto, il lessico è approssimativo.",
    include: [
      "Tutto quello che comprende la revisione linguistica",
      "Ritmo del periodo e alternanza delle lunghezze",
      "Lessico: precisione e coerenza di registro",
      "Voce narrante e tenuta dello stile",
      "Leggibilità complessiva",
      "Lettera editoriale con le scelte fatte e il perché",
    ],
    esclude: ["Ristrutturazione dell'opera e riscrittura di capitoli interi"],
    perChi: "Chi ha una storia che funziona e vuole una scrittura all'altezza.",
    prezzo: PREZZO_EDITING,
    variabili: "Tariffa a parola decrescente per fasce di lunghezza.",
    correlati: ["editing-narrativo", "scheda-valutazione-editoriale"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "editing-narrativo",
    nome: "Editing narrativo",
    area: "testo",
    sommario: "Struttura, personaggi, punto di vista, arco: il libro nel suo insieme.",
    problema:
      "Qualcosa non tiene: il centro si affloscia, un personaggio sparisce, il finale arriva senza essere stato preparato.",
    include: [
      "Tutto quello che comprende l'editing stilistico",
      "Struttura dell'opera e architettura dei capitoli",
      "Personaggi, motivazioni e coerenza",
      "Punto di vista e gestione della distanza narrativa",
      "Dialoghi e loro funzione",
      "Arco narrativo, ritmo e coerenza globale",
      "Lettera editoriale e piano di intervento",
    ],
    perChi: "Chi vuole che il libro funzioni, non solo che sia scritto bene.",
    prezzo: PREZZO_EDITING,
    variabili:
      "Tariffa a parola decrescente per fasce. Un intervento strutturale profondo si quota a parte.",
    correlati: ["editing-stilistico", "scheda-valutazione-editoriale"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "scheda-valutazione-editoriale",
    nome: "Scheda di valutazione editoriale",
    area: "testo",
    sommario: "Un giudizio professionale scritto, per sapere dove intervenire.",
    problema:
      "Hai un testo ma non sai se è pronto, cosa funziona e cosa no. Ti serve un parere competente, non quello di un amico.",
    include: [
      "Lettura professionale integrale",
      "Relazione scritta su struttura, stile, voce e ritmo",
      "Punti di forza e priorità di intervento",
      "Livello di lavorazione consigliato, con motivazione",
      "Call di restituzione",
    ],
    esclude: ["Correzioni sul testo: la scheda analizza, non interviene"],
    perChi: "Chi deve decidere il passo successivo prima di spendere in lavorazioni.",
    prezzo: { tipo: "fascia", da: 149, a: 349 },
    variabili: "Lunghezza del manoscritto e profondità della relazione.",
    correlati: ["editing-narrativo", "editing-stilistico"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "fact-checking",
    nome: "Fact checking e controllo coerenza",
    area: "testo",
    sommario: "Date, nomi, fonti e coerenza interna verificati uno per uno.",
    problema:
      "Il libro tocca fatti, persone o periodi reali e un errore verificabile ti costerebbe la credibilità.",
    include: [
      "Verifica di date, nomi, luoghi e riferimenti",
      "Controllo delle fonti citate",
      "Coerenza interna (cronologia, dettagli ricorrenti, continuità)",
      "Elenco puntuale dei rilievi con la fonte di riscontro",
    ],
    perChi: "Saggistica, memoir, ricerca storica, libri professionali.",
    prezzo: suPreventivo(
      "Dipende dal numero di riferimenti da verificare e dalla loro reperibilità.",
    ),
    variabili: "Densità di fatti verificabili e accessibilità delle fonti.",
    correlati: ["ricerca-documentale", "editing-narrativo"],
    prefillPreventivo: "saggio",
  },

  // ── AREA SCRITTURA ──
  {
    slug: "ghostwriting",
    nome: "Ghostwriting",
    area: "scrittura",
    sommario: "Il libro scritto per te, nella tua voce. L'autore resti tu.",
    problema:
      "Hai la storia, l'esperienza o il metodo, ma non il tempo o il mestiere per farne un libro.",
    include: [
      "Interviste per catturare voce, contenuti e memoria",
      "Struttura narrativa condivisa prima della stesura",
      "Stesura capitolo per capitolo con consegne progressive",
      "Due giri di revisione sui testi consegnati",
      "Accordo di riservatezza: la paternità è interamente tua",
    ],
    perChi: "Chi vuole un libro proprio senza scriverlo materialmente.",
    prezzo: PREZZO_GHOSTWRITING,
    variabili:
      "Parole finali stimate e quantità di materiale già disponibile: più materiale c'è, meno costa la creazione.",
    correlati: ["interviste", "strutturazione-opera", "da-materiali-a-libro"],
    prefillPreventivo: "memoir",
  },
  {
    slug: "co-writing",
    nome: "Co-writing",
    area: "scrittura",
    sommario: "Scriviamo insieme: tu la sostanza, noi il mestiere.",
    problema:
      "Vuoi scrivere tu, ma da solo ti blocchi: non sai come impostare i capitoli né come tenere il ritmo per trecento pagine.",
    include: [
      "Impostazione condivisa dell'opera",
      "Sessioni di lavoro ricorrenti su capitoli e materiali",
      "Riscrittura assistita dei passaggi che non tengono",
      "Editing progressivo mentre l'opera cresce",
    ],
    perChi: "Chi vuole imparare scrivendo, con un professionista accanto.",
    prezzo: suPreventivo("Si quota sul numero di sessioni e sulla durata del progetto."),
    variabili: "Durata, frequenza delle sessioni e quantità di testo prodotto.",
    correlati: ["strutturazione-opera", "editing-stilistico"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "strutturazione-opera",
    nome: "Strutturazione dell'opera",
    area: "scrittura",
    sommario: "L'impianto del libro prima di scriverlo: indice, capitoli, arco.",
    problema:
      "Hai contenuti e appunti sparsi ma nessun ordine: non sai da dove si comincia né dove si arriva.",
    include: [
      "Analisi dei materiali disponibili",
      "Definizione di tesi, obiettivo e lettore di riferimento",
      "Indice ragionato con funzione di ogni capitolo",
      "Scaletta operativa per la stesura",
    ],
    perChi: "Chi sta per iniziare a scrivere e vuole partire con una mappa.",
    prezzo: suPreventivo("Dipende dall'ampiezza dell'opera e dai materiali già esistenti."),
    variabili: "Quantità di materiale da analizzare e complessità dell'opera.",
    correlati: ["co-writing", "ghostwriting"],
    prefillPreventivo: "saggio",
  },
  {
    slug: "interviste",
    nome: "Interviste",
    area: "scrittura",
    sommario: "Sessioni registrate e trascritte che diventano materia prima del libro.",
    problema:
      "Quello che sai raccontare a voce non riesci a metterlo per iscritto, e nessuno te lo ha mai chiesto nel modo giusto.",
    include: [
      "Sessioni di intervista condotte da un redattore",
      "Registrazione e trascrizione",
      "Estrazione dei nuclei narrativi utilizzabili",
      "Nota di sintesi per la stesura",
    ],
    perChi: "Memoir, storie familiari, libri d'impresa, biografie.",
    prezzo: suPreventivo("Si quota sul numero e sulla durata delle sessioni."),
    variabili: "Numero di sessioni, durata, eventuale trasferta.",
    correlati: ["ghostwriting", "da-materiali-a-libro"],
    prefillPreventivo: "memoir",
  },
  {
    slug: "da-materiali-a-libro",
    nome: "Da diari, appunti e vocali a libro",
    area: "scrittura",
    sommario: "Materiale grezzo, anche disordinato, trasformato in un'opera compiuta.",
    problema:
      "Hai quaderni, registrazioni, mail e appunti accumulati negli anni. C'è un libro dentro, ma è sepolto.",
    include: [
      "Raccolta e inventario dei materiali",
      "Trascrizione dei contenuti audio",
      "Ordinamento cronologico e tematico",
      "Struttura narrativa e stesura",
      "Editing del testo finale",
    ],
    perChi: "Chi ha molto materiale e nessun tempo per metterlo in ordine.",
    prezzo: PREZZO_GHOSTWRITING,
    variabili:
      "Quantità di materiale disponibile e lunghezza del libro finale. Più materiale c'è, più bassa è la tariffa a parola.",
    correlati: ["ghostwriting", "interviste"],
    prefillPreventivo: "memoir",
  },
  {
    slug: "ricerca-documentale",
    nome: "Ricerca documentale e d'archivio",
    area: "scrittura",
    sommario: "Fonti, archivi e documenti reperiti e ordinati per il tuo libro.",
    problema:
      "Il tuo libro poggia su fatti che vanno documentati e non hai né gli accessi né il tempo per gli archivi.",
    include: [
      "Definizione delle domande di ricerca",
      "Reperimento fonti in archivi, biblioteche e banche dati",
      "Schedatura dei documenti con riferimenti completi",
      "Relazione di sintesi utilizzabile in stesura",
    ],
    perChi: "Ricerca storica, saggistica, storie familiari e d'impresa.",
    prezzo: suPreventivo(
      "Dipende dagli archivi coinvolti, dagli accessi necessari e dall'ampiezza della ricerca.",
    ),
    variabili: "Numero e tipo di archivi, eventuali diritti di riproduzione, trasferte.",
    correlati: ["fact-checking", "ghostwriting"],
    prefillPreventivo: "saggio",
  },

  // ── AREA PRODUZIONE ──
  {
    slug: "impaginazione",
    nome: "Impaginazione",
    area: "produzione",
    sommario: "L'interno del libro composto come un libro vero.",
    problema:
      "Il testo è pronto ma un Word esportato in PDF si vede lontano un miglio, e la stampa lo rifiuta.",
    include: [
      "Gabbia, gerarchia e scelta tipografica",
      "Composizione dell'interno con controllo di righe isolate e sillabazione",
      "Frontespizio, colophon, indice",
      "Un giro di revisione sull'impaginato",
      "PDF esecutivo per la stampa",
    ],
    perChi: "Chi ha il testo definitivo e va verso la stampa.",
    prezzo: { tipo: "fascia", da: tariffaImpaginazione.min, a: tariffaImpaginazione.max },
    variabili: "Numero di pagine finali e complessità (tabelle, immagini, note).",
    correlati: ["copertina", "file-stampa", "epub"],
    prefillPreventivo: "solo-grafica",
  },
  {
    slug: "copertina",
    nome: "Copertina",
    area: "produzione",
    sommario: "Una copertina originale, progettata per il tuo libro.",
    problema:
      "In una griglia di miniature Amazon la copertina è tutto ciò che hai, e un template si riconosce.",
    include: [
      "Brief su genere, riferimenti e posizionamento",
      "Proposte di concept da valutare insieme",
      "Realizzazione per cartaceo ed ebook",
      "Quarta di copertina e dorso calcolati sulle pagine reali",
      "File finali per stampa e store",
    ],
    perChi: "Chiunque pubblichi, in qualunque formato.",
    prezzo: { tipo: "forfait", importo: FLAT_SERVICES.cover },
    variabili: "Complessità del concept ed eventuali licenze di immagini.",
    correlati: ["impaginazione", "file-stampa"],
    prefillPreventivo: "solo-grafica",
  },
  {
    slug: "epub",
    nome: "EPUB",
    area: "produzione",
    sommario: "Un ebook validato che si legge bene su tutti i dispositivi.",
    problema:
      "Le conversioni automatiche producono ebook che si rompono: indice assente, capitoli attaccati, corsivi persi.",
    include: [
      "Conversione EPUB 3 con struttura semantica",
      "Indice navigabile e metadati corretti",
      "Validazione formale del file",
      "Prova di lettura su più dispositivi",
    ],
    perChi: "Chi pubblica in digitale, da solo o insieme al cartaceo.",
    prezzo: { tipo: "forfait", importo: FLAT_SERVICES.epub },
    variabili: "Complessità del testo (note, tabelle, immagini).",
    correlati: ["impaginazione", "amazon-kdp"],
    prefillPreventivo: "solo-grafica",
  },
  {
    slug: "file-stampa",
    nome: "Preparazione file di stampa",
    area: "produzione",
    sommario: "Esecutivi che la tipografia accetta al primo invio.",
    problema:
      "Il tuo PDF viene respinto per margini, abbondanze, profilo colore o font non incorporati.",
    include: [
      "Verifica di margini, abbondanze e crocini",
      "Conversione colore e incorporamento font",
      "Calcolo del dorso sulla carta scelta",
      "Preflight e consegna degli esecutivi",
    ],
    perChi: "Chi stampa in tipografia o su print-on-demand con specifiche precise.",
    prezzo: suPreventivo(
      "Dipende dalle specifiche del fornitore di stampa: le verifichiamo prima di quotare.",
    ),
    variabili: "Specifiche della tipografia, formato, tipo di carta.",
    correlati: ["impaginazione", "copertina"],
    prefillPreventivo: "solo-grafica",
  },

  // ── AREA PUBBLICAZIONE ──
  {
    slug: "amazon-kdp",
    nome: "Pubblicazione Amazon KDP",
    area: "pubblicazione",
    sommario: "Il libro online, configurato correttamente la prima volta.",
    problema:
      "KDP ti chiede decine di scelte irreversibili e ogni errore costa giorni di revisione.",
    include: [
      "Configurazione di formati, prezzi e territori",
      "Caricamento e verifica degli esecutivi",
      "Anteprima e controllo prima della pubblicazione",
      "Assistenza fino alla messa online",
    ],
    esclude: ["Garanzie di vendita o di posizionamento: nessuno può darle"],
    perChi: "Chi autopubblica su Amazon, da solo o come parte di un percorso.",
    prezzo: { tipo: "forfait", importo: FLAT_SERVICES.kdpPublishing },
    variabili: "Numero di formati ed eventuali mercati aggiuntivi.",
    correlati: ["isbn", "scheda-amazon", "metadata"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "isbn",
    nome: "Assistenza ISBN",
    area: "pubblicazione",
    sommario: "Il codice giusto per il tuo caso, senza scelte irreversibili sbagliate.",
    problema:
      "ISBN gratuito di Amazon o ISBN proprio? La differenza pesa sulla distribuzione e non si torna indietro.",
    include: [
      "Analisi del caso e scelta motivata",
      "Assistenza nella richiesta e nell'attribuzione",
      "Registrazione dei dati identificativi dell'opera",
    ],
    esclude: ["Il costo dell'ISBN esterno, che resta a carico dell'editore"],
    perChi: "Chi pubblica e vuole capire cosa sta scegliendo.",
    prezzo: { tipo: "forfait", importo: FLAT_SERVICES.isbn },
    variabili: "Numero di formati da identificare.",
    correlati: ["amazon-kdp", "metadata"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "metadata",
    nome: "Metadata editoriali",
    area: "pubblicazione",
    sommario: "I dati che decidono se il libro viene trovato.",
    problema:
      "Il libro è online ma non lo trova nessuno: categorie sbagliate, parole chiave a caso, descrizione piatta.",
    include: [
      "Ricerca delle categorie e delle parole chiave pertinenti",
      "Impostazione dei metadati su tutti i formati",
      "Coerenza fra store e formati",
      "Nota di manutenzione dei metadati nel tempo",
    ],
    perChi: "Chi ha già pubblicato e non ottiene visibilità.",
    prezzo: suPreventivo(
      "Si quota sul numero di formati e store da coprire; spesso è compresa nella scheda Amazon.",
    ),
    variabili: "Numero di store e formati.",
    correlati: ["scheda-amazon", "amazon-kdp"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "scheda-amazon",
    nome: "Scheda Amazon",
    area: "pubblicazione",
    sommario: "Descrizione, categorie e parole chiave scritte per vendere.",
    problema:
      "La tua descrizione racconta la trama a chi non sa ancora perché dovrebbe interessargli.",
    include: [
      "Descrizione scritta in ottica di conversione",
      "Selezione delle categorie e delle parole chiave",
      "Biografia autore",
      "Formattazione della scheda",
    ],
    perChi: "Chi pubblica su Amazon e vuole una vetrina all'altezza.",
    prezzo: { tipo: "forfait", importo: FLAT_SERVICES.amazonListing },
    variabili: "Nessuna: è un forfait.",
    correlati: ["metadata", "strategia-di-lancio"],
    prefillPreventivo: "romanzo",
  },

  // ── AREA LINGUE ──
  {
    slug: "traduzione-editoriale",
    nome: "Traduzione editoriale",
    area: "lingue",
    sommario: "Il libro in un'altra lingua, con la voce che aveva nella sua.",
    problema:
      "Una traduzione letterale distrugge il ritmo, e una traduzione automatica si sente dalla prima pagina.",
    include: [
      "Traduzione da parte di un traduttore editoriale madrelingua",
      "Revisione linguistica sulla lingua d'arrivo",
      "Glossario dei termini ricorrenti",
      "Nota del traduttore sulle scelte non ovvie",
    ],
    perChi: "Chi porta la propria opera su un altro mercato.",
    prezzo: suPreventivo(
      "La tariffa dipende dalla combinazione linguistica e dal genere: la quotiamo caso per caso.",
    ),
    variabili: "Coppia di lingue, lunghezza, difficoltà del testo.",
    correlati: ["revisione-specialistica", "traduzione-accademica"],
    prefillPreventivo: "romanzo",
  },
  {
    slug: "traduzione-accademica",
    nome: "Traduzione accademica",
    area: "lingue",
    sommario: "Testi scientifici tradotti con terminologia e apparato corretti.",
    problema:
      "Un articolo tradotto male viene respinto dalla rivista prima ancora di essere letto nel merito.",
    include: [
      "Traduzione con terminologia disciplinare verificata",
      "Trattamento corretto di citazioni, note e bibliografia",
      "Adeguamento allo stile della rivista o dell'editore",
      "Revisione madrelingua",
    ],
    perChi: "Ricercatori, dipartimenti, editori scientifici.",
    prezzo: suPreventivo(
      "Dipende da disciplina, combinazione linguistica e norme editoriali richieste.",
    ),
    variabili: "Disciplina, lingua, apparato di note e bibliografia.",
    correlati: ["revisione-specialistica", "fact-checking"],
    prefillPreventivo: "saggio",
  },
  {
    slug: "revisione-specialistica",
    nome: "Revisione linguistica specialistica",
    area: "lingue",
    sommario: "Un testo già tradotto reso pubblicabile nella lingua d'arrivo.",
    problema:
      "Hai una traduzione, tua o di terzi, che si capisce ma non suona scritta da un madrelingua.",
    include: [
      "Revisione madrelingua sul testo d'arrivo",
      "Controllo di terminologia e coerenza",
      "Verifica a campione rispetto all'originale",
      "Consegna con revisioni tracciate",
    ],
    perChi: "Chi ha già una traduzione e vuole portarla a livello editoriale.",
    prezzo: suPreventivo("La tariffa dipende dalla qualità della traduzione di partenza."),
    variabili: "Stato del testo di partenza e lingua.",
    correlati: ["traduzione-editoriale", "traduzione-accademica"],
    prefillPreventivo: "romanzo",
  },

  // ── AREA PROMOZIONE ──
  {
    slug: "strategia-di-lancio",
    nome: "Strategia di lancio",
    area: "promozione",
    sommario: "Un piano con date, canali e materiali, non un elenco di buoni propositi.",
    problema:
      "Il libro esce e non succede niente, perché nessuno sapeva che stava per uscire.",
    include: [
      "Analisi del pubblico e del posizionamento",
      "Piano di lancio con calendario e canali",
      "Testi per annuncio, presentazione e comunicati",
      "Kit materiali per social e mailing",
      "Briefing operativo per l'esecuzione",
    ],
    esclude: ["Acquisto di spazi pubblicitari, che resta a budget dell'autore"],
    perChi: "Chi pubblica e vuole che l'uscita abbia un effetto.",
    prezzo: { tipo: "forfait", importo: SIGNATURE_EXTRAS.launchStrategy },
    variabili: "Ampiezza dei canali e quantità di materiali richiesti.",
    correlati: ["materiali-promozionali", "post-pubblicazione"],
    prefillPreventivo: "libro-professionale",
  },
  {
    slug: "materiali-promozionali",
    nome: "Materiali promozionali",
    area: "promozione",
    sommario: "Grafiche, testi e schede pronti per essere pubblicati.",
    problema:
      "Sai cosa vorresti dire ma non hai né i formati né il tempo per prepararli.",
    include: [
      "Grafiche per social nei formati richiesti",
      "Testi per post, newsletter e comunicati",
      "Scheda libro per librerie e stampa",
      "File modificabili dove possibile",
    ],
    perChi: "Chi ha un piano e gli mancano gli asset.",
    prezzo: suPreventivo("Si quota sull'elenco effettivo dei materiali richiesti."),
    variabili: "Numero e tipo di materiali.",
    correlati: ["strategia-di-lancio", "scheda-amazon"],
    prefillPreventivo: "libro-professionale",
  },
  {
    slug: "guida-promozione",
    nome: "Guida alla promozione",
    area: "promozione",
    sommario: "Formazione operativa per promuovere il libro da solo.",
    problema:
      "Vuoi occupartene tu, ma non sai da dove cominciare né cosa conta davvero.",
    include: [
      "Sessione di formazione sul tuo caso specifico",
      "Documento operativo con priorità e tempi",
      "Modelli riutilizzabili",
      "Una sessione di verifica a distanza di settimane",
    ],
    perChi: "Autori che vogliono autonomia, non un servizio ricorrente.",
    prezzo: suPreventivo("Si quota sul numero di sessioni concordate."),
    variabili: "Numero di sessioni e materiali consegnati.",
    correlati: ["strategia-di-lancio", "post-pubblicazione"],
    prefillPreventivo: "libro-professionale",
  },
  {
    slug: "post-pubblicazione",
    nome: "Assistenza post-pubblicazione",
    area: "promozione",
    sommario: "I mesi dopo l'uscita, seguiti invece che lasciati al caso.",
    problema:
      "Dopo il lancio le recensioni non arrivano, i metadati invecchiano e nessuno tiene d'occhio la scheda.",
    include: [
      "Monitoraggio della scheda e dei metadati",
      "Manutenzione di categorie e parole chiave",
      "Indicazioni per la raccolta di recensioni",
      "Punto periodico sull'andamento",
    ],
    esclude: ["Acquisto o sollecitazione a pagamento di recensioni: è vietato dagli store"],
    perChi: "Chi ha pubblicato e non vuole fermarsi lì.",
    prezzo: { tipo: "forfait", importo: SIGNATURE_EXTRAS.postPublishing },
    variabili: "Durata del periodo di assistenza.",
    correlati: ["strategia-di-lancio", "metadata"],
    prefillPreventivo: "romanzo",
  },

  // ── AREA B2B ──
  {
    slug: "produzione-white-label",
    nome: "Produzione white label",
    area: "b2b",
    sommario: "Il nostro reparto editoriale, con il tuo marchio davanti.",
    problema:
      "Ti servono capacità produttiva nei picchi senza assumere e senza mostrare un fornitore ai tuoi clienti.",
    include: [
      "Lavorazioni editoriali complete in white label",
      "Nessun contatto con il tuo cliente finale",
      "Portale con il tuo marchio e i tuoi utenti",
      "Progetti e file separati per cliente",
      "NDA e SLA sui tempi",
    ],
    perChi: "Agenzie, editori, studi di comunicazione.",
    prezzo: suPreventivo("Listino riservato, definito su volume e ricorrenza."),
    variabili: "Volumi, ricorrenza, SLA richiesti.",
    correlati: ["agenzie", "partner-editoriali"],
  },
  {
    slug: "agenzie",
    nome: "Agenzie",
    area: "b2b",
    sommario: "Un reparto editoriale esterno per agenzie di comunicazione e personal branding.",
    problema:
      "I tuoi clienti chiedono libri e contenuti lunghi e il tuo team non è attrezzato per produrli.",
    include: [
      "Referente dedicato",
      "Accesso al portale con i tuoi progetti",
      "Preventivazione rapida sui tuoi brief",
      "Riservatezza contrattuale",
    ],
    perChi: "Agenzie che vendono libri senza produrli internamente.",
    prezzo: suPreventivo("Accordo quadro, con condizioni legate al volume."),
    variabili: "Volume annuo e tipologia di lavorazioni.",
    correlati: ["produzione-white-label", "ghostwriting-agencies"],
  },
  {
    slug: "ghostwriting-agencies",
    nome: "Ghostwriting per agenzie",
    area: "b2b",
    sommario: "Capacità di scrittura su commessa, con firma della tua agenzia.",
    problema:
      "Hai venduto libri che non riesci a scrivere nei tempi promessi.",
    include: [
      "Redattori assegnati ai tuoi progetti",
      "Stesura secondo il tuo brief e il tuo tono",
      "Consegne progressive verificabili",
      "Riservatezza totale sul cliente finale",
    ],
    perChi: "Agenzie di ghostwriting e personal branding.",
    prezzo: suPreventivo("Tariffa concordata per progetto o per volume annuo."),
    variabili: "Lunghezza, complessità e tempi.",
    correlati: ["produzione-white-label", "ghostwriting"],
  },
  {
    slug: "partner-editoriali",
    nome: "Partner editoriali",
    area: "b2b",
    sommario: "Lavorazioni esternalizzate per case editrici e service.",
    problema:
      "Hai picchi di catalogo e una redazione dimensionata sulla media, non sul picco.",
    include: [
      "Correzione, revisione ed editing su commessa",
      "Impaginazione e produzione file",
      "Rispetto delle vostre norme redazionali",
      "SLA e tracciamento delle consegne",
    ],
    perChi: "Case editrici, service editoriali, università.",
    prezzo: suPreventivo("Listino a volume, definito nell'accordo quadro."),
    variabili: "Volume, norme redazionali, tempi.",
    correlati: ["produzione-white-label", "agenzie"],
  },
];

export const SERVIZI_PER_AREA = (Object.keys(AREE) as AreaServizio[]).map((area) => ({
  area,
  ...AREE[area],
  servizi: SERVIZI.filter((s) => s.area === area),
}));

export const SLUG_SERVIZI = SERVIZI.map((s) => s.slug);

export function getServizio(slug: string): Servizio | undefined {
  return SERVIZI.find((s) => s.slug === slug);
}
