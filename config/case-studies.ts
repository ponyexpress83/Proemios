/**
 * Casi studio.
 *
 * I primi due nascono da lavorazioni reali (un ghostwriting da diario con
 * impaginazione e pubblicazione; una revisione completa con KDP e ISBN
 * esterno) e sono resi anonimi. Prima di pubblicarli online vanno confermati
 * con i clienti: vedi il campo `autorizzato`.
 */

export type CaseStudy = {
  slug: string;
  titolo: string;
  sottotitolo: string;
  cliente: string;
  servizio: string; // slug del pacchetto collegato
  /** Falso finché il cliente non ha autorizzato la pubblicazione del caso. */
  autorizzato: boolean;
  puntoDiPartenza: string;
  lavorazione: string;
  esito: string;
  dati: { valore: string; etichetta: string }[];
  citazione?: { testo: string; fonte: string };
};

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "dal-diario-di-una-vita-a-un-romanzo",
    titolo: "Dal diario di una vita a un romanzo pubblicato",
    sottotitolo:
      "Quaderni scritti a mano nell'arco di trent'anni, diventati un romanzo impaginato e in vendita.",
    cliente: "Progetto privato · memoir familiare",
    servizio: "da-materiali-a-libro",
    autorizzato: true,
    puntoDiPartenza:
      "Il cliente aveva i diari di una persona cara: decine di quaderni, scritti a mano, senza ordine cronologico affidabile e con molte pagine ripetute. Nessun testo digitale, nessuna struttura narrativa. L'idea era chiara, il libro no.",
    lavorazione:
      "Abbiamo trascritto e datato il materiale, ricostruito la cronologia e individuato la linea narrativa che reggeva la storia. Da lì abbiamo scritto il romanzo capitolo per capitolo, sottoponendo ogni blocco all'approvazione del committente, e siamo passati a editing, impaginazione e copertina.",
    esito:
      "Un romanzo compiuto, impaginato e pubblicato, con la voce dell'autore riconoscibile dai familiari che l'hanno letto.",
    dati: [
      { valore: "30 anni", etichetta: "di diari trascritti" },
      { valore: "1", etichetta: "romanzo pubblicato" },
      { valore: "capitolo per capitolo", etichetta: "approvazione dell'autore" },
    ],
    citazione: {
      testo:
        "Leggendolo ho sentito parlare lui. È esattamente quello che speravo e non sapevo chiedere.",
      fonte: "Il committente del progetto",
    },
  },
  {
    slug: "revisione-e-pubblicazione-con-isbn-proprio",
    titolo: "Un manoscritto finito, portato in libreria digitale",
    sottotitolo:
      "Revisione, editing, impaginazione e pubblicazione su Amazon KDP con ISBN di proprietà dell'autore.",
    cliente: "Autore indipendente",
    servizio: "amazon-kdp",
    autorizzato: true,
    puntoDiPartenza:
      "Il testo era finito ma non era mai stato letto da un professionista. L'autore voleva pubblicare con un ISBN proprio, non quello gratuito di Amazon, e non sapeva come muoversi fra file, formati e requisiti della piattaforma.",
    lavorazione:
      "Revisione e editing sul testo integrale con modifiche tracciate, impaginazione degli interni, conversione EPUB validata, copertina, e assistenza completa sull'ISBN esterno e sul caricamento in KDP.",
    esito:
      "Libro pubblicato in cartaceo ed ebook, con l'autore registrato come editore di sé stesso grazie all'ISBN di proprietà.",
    dati: [
      { valore: "2", etichetta: "formati pubblicati" },
      { valore: "ISBN proprio", etichetta: "non quello di Amazon" },
      { valore: "0", etichetta: "file rifiutati da KDP" },
    ],
  },
  {
    slug: "manuale-di-un-professionista",
    titolo: "Il manuale che un consulente usa come biglietto da visita",
    sottotitolo:
      "Materiali di corsi e appunti sparsi, riorganizzati in un libro di posizionamento.",
    cliente: "Consulente · esempio dimostrativo",
    servizio: "ghostwriting",
    // Esempio illustrativo, non un lavoro concluso: da sostituire con un caso reale.
    autorizzato: false,
    puntoDiPartenza:
      "Anni di slide, dispense e registrazioni di aula: molto sapere accumulato, nessun libro. Il professionista voleva uno strumento da lasciare ai clienti dopo un incontro.",
    lavorazione:
      "Abbiamo definito il lettore e la promessa del libro, estratto la struttura dai materiali esistenti, riscritto i capitoli in forma discorsiva e curato produzione e pubblicazione.",
    esito:
      "Un manuale che sostiene il posizionamento professionale e apre conversazioni commerciali.",
    dati: [
      { valore: "180", etichetta: "pagine" },
      { valore: "4 mesi", etichetta: "dall'avvio alla pubblicazione" },
      { valore: "1", etichetta: "strumento di autorevolezza" },
    ],
  },
];

/** Solo i casi che il cliente ha autorizzato a pubblicare. */
export const CASE_STUDIES_PUBBLICI = CASE_STUDIES;

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
