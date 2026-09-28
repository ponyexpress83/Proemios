/**
 * Modalità demo.
 *
 * Serve a far vedere il sito funzionante — configuratore, analisi del
 * manoscritto, acconto, cruscotto — senza database, senza chiavi API e senza
 * spendere un euro. Si attiva da sola quando manca `DATABASE_URL`: se non c'è
 * un posto dove scrivere, non c'è nulla di reale da proteggere.
 *
 * Regole che la demo rispetta e che non vanno allentate:
 *  - nessun dato inserito viene persistito o inviato a terzi;
 *  - nessun pagamento viene mai aperto: il checkout resta simulato;
 *  - ogni schermata dichiara di essere una demo, così nessuno la scambia
 *    per l'ambiente di produzione.
 *
 * Per disattivarla anche senza database: `DEMO_MODE=off`.
 * Per forzarla anche con il database configurato: `DEMO_MODE=on`.
 */

import { costBandForAnalysis, computeQuote } from "./pricing";
import { etichettaGulpease, type MetricheTesto } from "./metrics";
import { numero } from "./format";
import type { LivelloIntervento, ReportAi, ReportCompleto } from "./ai";
import type { PackageTier, PricingInput, QuotePackage } from "./pricing";

export function demoAttiva(): boolean {
  const forzatura = process.env.DEMO_MODE?.toLowerCase();
  if (forzatura === "off" || forzatura === "0" || forzatura === "false") return false;
  if (forzatura === "on" || forzatura === "1" || forzatura === "true") return true;
  return !process.env.DATABASE_URL;
}

/**
 * Vero solo se la demo è stata **richiesta esplicitamente** con `DEMO_MODE=on`,
 * non se è stata dedotta dall'assenza di `DATABASE_URL`.
 *
 * La distinzione conta per il back-office: dedurre la demo da una variabile
 * mancante significa che un deploy mal configurato aprirebbe il cruscotto senza
 * autenticazione. Le schermate riservate accettano la demo solo quando qualcuno
 * l'ha chiesta apposta.
 */
export function demoEsplicita(): boolean {
  const forzatura = process.env.DEMO_MODE?.toLowerCase();
  return forzatura === "on" || forzatura === "1" || forzatura === "true";
}

/** Avviso mostrato in testa alle schermate che simulano un'operazione. */
export const AVVISO_DEMO =
  "Versione dimostrativa: i dati inseriti non vengono salvati né inviati, e nessun pagamento viene addebitato.";

// ── Archivio di sessione ───────────────────────────────────────────────────
//
// Volutamente in memoria: dura quanto il processo e sparisce al riavvio.
// È la garanzia più semplice che una demo pubblica non accumuli dati di
// persone vere. Il cruscotto mostra questi record sopra a quelli d'esempio.

const MAX_RIGHE = 30;

export interface LeadDemo {
  id: string;
  createdAt: Date;
  nome: string;
  email: string;
  fonte: string;
  consensoMarketing: boolean;
}

export interface PreventivoDemo {
  id: string;
  createdAt: Date;
  stato: string;
  pacchettoScelto: string | null;
  prezzoTotale: number | null;
  acconto: number | null;
  stripeSessionId: string | null;
  pacchettiGenerati: QuotePackage[];
}

export interface AnalisiDemo {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  filename: string;
  wordCount: number;
  report: ReportCompleto;
}

export interface AgenziaDemo {
  id: string;
  nomeAgenzia: string;
  sito: string | null;
  serviziEsternalizzati: string | null;
  volumeStimato: string | null;
}

const sessione = {
  lead: [] as LeadDemo[],
  preventivi: [] as PreventivoDemo[],
  analisi: [] as AnalisiDemo[],
  agenzie: [] as AgenziaDemo[],
};

function aggiungi<T>(elenco: T[], voce: T): void {
  elenco.unshift(voce);
  if (elenco.length > MAX_RIGHE) elenco.length = MAX_RIGHE;
}

/** Identificativo leggibile: si distingue a colpo d'occhio da un UUID vero. */
export function idDemo(prefisso: string): string {
  contatore += 1;
  return `demo-${prefisso}-${String(contatore).padStart(4, "0")}`;
}
let contatore = 0;

export function registraLead(dati: {
  nome: string;
  email: string;
  fonte: string;
  consensoMarketing: boolean;
}): LeadDemo {
  const lead: LeadDemo = { id: idDemo("lead"), createdAt: new Date(), ...dati };
  aggiungi(sessione.lead, lead);
  return lead;
}

export function registraPreventivo(dati: {
  pacchetti: QuotePackage[];
  prezzoTotale: number;
  acconto: number;
}): PreventivoDemo {
  const preventivo: PreventivoDemo = {
    id: idDemo("prev"),
    createdAt: new Date(),
    stato: "sent",
    pacchettoScelto: null,
    prezzoTotale: dati.prezzoTotale,
    acconto: dati.acconto,
    stripeSessionId: null,
    pacchettiGenerati: dati.pacchetti,
  };
  aggiungi(sessione.preventivi, preventivo);
  return preventivo;
}

/** Segna un preventivo come "acconto pagato" dopo il checkout simulato. */
export function segnaAccontoPagato(quoteId: string, pacchetto: string): void {
  const trovato = sessione.preventivi.find((p) => p.id === quoteId);
  if (!trovato) return;
  const scelto = trovato.pacchettiGenerati.find((p) => p.tier === pacchetto);
  trovato.stato = "deposit_paid";
  trovato.pacchettoScelto = pacchetto;
  trovato.stripeSessionId = idDemo("cs");
  if (scelto) {
    trovato.prezzoTotale = scelto.total;
    trovato.acconto = scelto.deposit;
  }
}

/** Cerca un preventivo creato in questa sessione. Null se il processo è cambiato. */
export function trovaPreventivo(quoteId: string): PreventivoDemo | null {
  return sessione.preventivi.find((p) => p.id === quoteId) ?? null;
}

export function registraAnalisi(dati: {
  filename: string;
  wordCount: number;
  report: ReportCompleto;
}): void {
  aggiungi(sessione.analisi, {
    id: idDemo("an"),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...dati,
  });
}

export function registraAgenzia(dati: {
  nomeAgenzia: string;
  sito: string | null;
  serviziEsternalizzati: string | null;
  volumeStimato: string | null;
}): void {
  aggiungi(sessione.agenzie, { id: idDemo("ag"), ...dati });
}

// ── Righe d'esempio per il cruscotto ───────────────────────────────────────
//
// Un cruscotto vuoto non dimostra niente. Queste righe sono inventate e
// dichiarate tali dal prefisso "demo-": nessuna corrisponde a una persona.

function giorniFa(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const LEAD_ESEMPIO: LeadDemo[] = [
  {
    id: "demo-seed-1",
    createdAt: giorniFa(1),
    nome: "Chiara Benvenuti",
    email: "chiara.b@esempio.it",
    fonte: "preventivo",
    consensoMarketing: true,
  },
  {
    id: "demo-seed-2",
    createdAt: giorniFa(2),
    nome: "Marco Terenzi",
    email: "m.terenzi@esempio.it",
    fonte: "analisi",
    consensoMarketing: false,
  },
  {
    id: "demo-seed-3",
    createdAt: giorniFa(4),
    nome: "Studio Legale Ferri",
    email: "info@esempio.it",
    fonte: "contatto",
    consensoMarketing: false,
  },
  {
    id: "demo-seed-4",
    createdAt: giorniFa(6),
    nome: "Agenzia Pluteo",
    email: "produzione@esempio.it",
    fonte: "agenzie",
    consensoMarketing: true,
  },
  {
    id: "demo-seed-5",
    createdAt: giorniFa(9),
    nome: "Anna Ruggeri",
    email: "anna.ruggeri@esempio.it",
    fonte: "preventivo",
    consensoMarketing: true,
  },
];

/**
 * I preventivi d'esempio passano dal motore di prezzo vero: le cifre che si
 * vedono nel cruscotto sono quelle che il configuratore produrrebbe davvero
 * con quegli input, non numeri inventati che poi non tornano.
 */
function preventivoEsempio(
  id: string,
  giorni: number,
  stato: string,
  input: PricingInput,
  scelto: PackageTier | null,
): PreventivoDemo {
  const risultato = computeQuote(input);
  const pacchetti = risultato.packages;
  const attivo =
    (scelto ? pacchetti.find((p) => p.tier === scelto) : undefined) ??
    pacchetti.find((p) => p.recommended) ??
    pacchetti[1];
  return {
    id,
    createdAt: giorniFa(giorni),
    stato,
    pacchettoScelto: scelto,
    prezzoTotale: attivo.total,
    acconto: attivo.deposit,
    stripeSessionId: stato === "deposit_paid" || stato === "won" ? `demo-cs-${id.slice(-2)}` : null,
    pacchettiGenerati: [...pacchetti],
  };
}

// Calcolati alla prima richiesta del cruscotto, non all'import: in produzione
// (demo spenta) questo modulo non deve costare nulla.
let preventiviEsempio: PreventivoDemo[] | null = null;

function PREVENTIVI_ESEMPIO(): PreventivoDemo[] {
  if (preventiviEsempio) return preventiviEsempio;
  preventiviEsempio = [
    preventivoEsempio(
      "demo-seed-p1",
      1,
      "sent",
      { projectType: "romanzo", textState: "finito-da-revisionare", wordCount: 78_000 },
      null,
    ),
    preventivoEsempio(
      "demo-seed-p2",
      3,
      "deposit_paid",
      { projectType: "memoir", textState: "bozza-incompleta", wordCount: 52_000 },
      "consigliato",
    ),
    preventivoEsempio(
      "demo-seed-p3",
      8,
      "won",
      { projectType: "libro-professionale", textState: "finito-revisionato", wordCount: 34_000 },
      "essenziale",
    ),
    preventivoEsempio(
      "demo-seed-p4",
      12,
      "lost",
      {
        projectType: "saggio",
        textState: "finito-da-revisionare",
        wordCount: 96_000,
        urgency: "prioritaria",
      },
      null,
    ),
  ];
  return preventiviEsempio;
}

const AGENZIE_ESEMPIO: AgenziaDemo[] = [
  {
    id: "demo-seed-a1",
    nomeAgenzia: "Agenzia Pluteo",
    sito: "https://esempio.it",
    serviziEsternalizzati: "Editing e impaginazione per la collana di narrativa",
    volumeStimato: "4-6 titoli l'anno",
  },
  {
    id: "demo-seed-a2",
    nomeAgenzia: "Comunicazione Vermiglio",
    sito: "https://esempio.it",
    serviziEsternalizzati: "Copertine ed EPUB",
    volumeStimato: "1-2 titoli al trimestre",
  },
];

/** Righe mostrate dal cruscotto in demo: prima quelle della sessione. */
export function datiAdminDemo() {
  return {
    lead: [...sessione.lead, ...LEAD_ESEMPIO],
    preventivi: [...sessione.preventivi, ...PREVENTIVI_ESEMPIO()],
    analisi: [...sessione.analisi],
    agenzie: [...sessione.agenzie, ...AGENZIE_ESEMPIO],
  };
}

// ── Report di analisi simulato ─────────────────────────────────────────────

/**
 * Costruisce un report senza chiamare il modello.
 *
 * Le parti misurabili (parole, Gulpease, periodare, fascia di costo) restano
 * quelle vere, calcolate sul file caricato: è la stessa pipeline della
 * produzione, manca solo il giudizio del modello. Le osservazioni qualitative
 * sono scritte a mano e scelte in base alle metriche, così la demo reagisce al
 * testo invece di dire sempre la stessa cosa.
 */
export function reportDemo(metriche: MetricheTesto): ReportCompleto {
  const livello = livelloDaMetriche(metriche);
  const giudizio = giudizioDaMetriche(metriche, livello);
  return {
    ...giudizio,
    metriche,
    fasciaCosto: costBandForAnalysis(metriche.parole, livello),
    generatoIl: new Date().toISOString(),
  };
}

/** Regola trasparente: leggibilità bassa e periodi lunghi chiedono più lavoro. */
export function livelloDaMetriche(m: MetricheTesto): LivelloIntervento {
  const difficile = m.gulpease < 45 || m.parolePerFrase > 30 || m.quotaFrasiLunghe > 25;
  const scorrevole = m.gulpease >= 60 && m.parolePerFrase <= 22 && m.quotaFrasiLunghe <= 8;
  if (difficile) return "editing-profondo";
  if (scorrevole) return "correzione-bozze";
  return "editing-leggero";
}

function giudizioDaMetriche(m: MetricheTesto, livello: LivelloIntervento): ReportAi {
  const periodareLungo = m.parolePerFrase > 25 || m.quotaFrasiLunghe > 15;
  const etichetta = etichettaGulpease(m.gulpease).toLowerCase();

  const sintesi =
    `Il testo conta ${numero(m.parole)} parole, circa ${numero(m.pagineStimate)} pagine di libro finito, ` +
    `con una media di ${m.parolePerFrase} parole per frase e un indice Gulpease di ${m.gulpease}: una lettura ${etichetta}. ` +
    (livello === "editing-profondo"
      ? "L'impianto c'è, ma la resa sulla pagina chiede ancora un passaggio strutturale prima della pubblicazione."
      : livello === "correzione-bozze"
        ? "La scrittura è già in ordine: quel che resta è il lavoro fine di pulizia e uniformazione."
        : "La base è solida e il lavoro che manca è di rifinitura, non di ricostruzione.");

  return {
    sintesi,
    ritmo: {
      giudizio: periodareLungo
        ? `Il periodare è ampio: ${m.quotaFrasiLunghe}% delle frasi supera le 35 parole e la media si attesta a ${m.parolePerFrase}. Spezzare le subordinate più lunghe restituirebbe respiro alla lettura senza togliere niente al contenuto.`
        : `Il ritmo è controllato: frasi di ${m.parolePerFrase} parole in media e solo il ${m.quotaFrasiLunghe}% oltre le 35 parole. La lettura procede senza inciampi.`,
      periodareLungo,
    },
    ripetizioni: [
      "avverbi in -mente ravvicinati nello stesso paragrafo",
      "attacchi di frase con la stessa congiunzione",
      "verbi generici (fare, dire, andare) dove ne servirebbe uno preciso",
    ],
    cliche: [
      "immagini di repertorio nelle descrizioni d'ambiente",
      "formule di passaggio già lette molte volte",
    ],
    coerenza: {
      tempiVerbali:
        "L'impianto dei tempi regge; qualche oscillazione fra passato remoto e imperfetto nei brani di racconto retrospettivo va uniformata.",
      puntoDiVista:
        "Il punto di vista resta stabile, con un paio di scivolate in cui la voce narrante sa più di quanto il personaggio possa sapere.",
    },
    genere: "narrativa contemporanea",
    lettoreTipo:
      "Lettore adulto abituato alla narrativa italiana di ricerca, che accetta un ritmo lento se la lingua lo ripaga.",
    puntiForza: [
      "Una voce riconoscibile, che non somiglia a quella di altri.",
      "I dialoghi reggono il peso della scena senza bisogno di didascalie.",
      "Il materiale di partenza è più che sufficiente per un libro intero.",
    ],
    areeIntervento:
      livello === "correzione-bozze"
        ? [
            "Uniformare la punteggiatura del discorso diretto in tutto il testo.",
            "Normalizzare accenti, apostrofi e virgolette secondo un'unica norma redazionale.",
            "Rileggere i numeri e le date, dove le incongruenze si nascondono meglio.",
          ]
        : [
            "Ridurre il periodare nei brani descrittivi, dove la frase si allunga di più.",
            "Alleggerire gli aggettivi in coppia: quasi sempre ne basta uno.",
            "Rivedere gli attacchi e le chiuse di capitolo, che oggi si somigliano troppo.",
          ],
    livelloIntervento: livello,
  };
}
