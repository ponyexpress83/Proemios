/**
 * Case study (casi studio). Contenuti dimostrativi di Fase 1: nomi e dati sono
 * di esempio e vanno sostituiti con casi reali autorizzati.
 * Fonte di verità per /casi-studio, /casi-studio/[slug] e sitemap.
 */

export interface CaseStudy {
  slug: string;
  titolo: string;
  sottotitolo: string;
  cliente: string;
  servizio: string; // slug del pacchetto collegato
  sfida: string;
  soluzione: string;
  risultato: string;
  metriche: { valore: string; etichetta: string }[];
  citazione?: { testo: string; autore: string };
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "memoir-di-famiglia-da-vocali-a-libro",
    titolo: "Da 40 ore di vocali a un memoir di famiglia",
    sottotitolo: "Il racconto di una vita trasformato in un libro da regalare ai nipoti.",
    cliente: "Progetto privato — memoir familiare",
    servizio: "dal-diario-al-libro",
    sfida:
      "Il cliente aveva registrato decine di ore di ricordi vocali del padre, senza alcun testo scritto e senza tempo per organizzarli.",
    soluzione:
      "Abbiamo trascritto e ordinato i materiali, condotto interviste di approfondimento e scritto il libro capitolo per capitolo, con approvazione dell'autore a ogni passaggio.",
    risultato:
      "Un memoir di 210 pagine, impaginato e stampato in tiratura privata, consegnato in tempo per un anniversario importante.",
    metriche: [
      { valore: "40h", etichetta: "di vocali lavorati" },
      { valore: "210", etichetta: "pagine finali" },
      { valore: "12", etichetta: "settimane di produzione" },
    ],
    citazione: {
      testo: "Ho ritrovato la voce di mio padre in ogni pagina. Non pensavo fosse possibile.",
      autore: "Cliente, memoir familiare",
    },
  },
  {
    slug: "libro-autorevolezza-consulente-finanziario",
    titolo: "Un libro che ha aperto le porte delle conferenze",
    sottotitolo:
      "Come un consulente ha trasformato il suo metodo in uno strumento di posizionamento.",
    cliente: "Consulente finanziario indipendente",
    servizio: "libro-per-professionisti",
    sfida:
      "Il cliente voleva distinguersi in un mercato affollato e usare un libro come biglietto da visita autorevole, ma non aveva mai scritto nulla di lungo.",
    soluzione:
      "Abbiamo definito il posizionamento, raccolto il suo know-how in interviste strutturate e prodotto il libro con ghostwriting, copertina premium e piano di lancio.",
    risultato:
      "Il libro è diventato il fulcro della sua comunicazione: usato negli eventi, inviato ai prospect e leva per inviti a parlare in pubblico.",
    metriche: [
      { valore: "180", etichetta: "pagine" },
      { valore: "4", etichetta: "mesi dall'idea alla pubblicazione" },
      { valore: "#1", etichetta: "categoria Amazon di nicchia" },
    ],
    citazione: {
      testo:
        "Non vendo più me stesso: lascio parlare il libro. Cambia completamente le conversazioni.",
      autore: "Consulente finanziario",
    },
  },
  {
    slug: "romanzo-esordiente-editing-e-pubblicazione",
    titolo: "L'esordio di una romanziera, curato in ogni dettaglio",
    sottotitolo: "Dal manoscritto grezzo alla pubblicazione su Amazon con scheda ottimizzata.",
    cliente: "Autrice esordiente — narrativa",
    servizio: "revisione-e-pubblicazione",
    sfida:
      "Un primo romanzo promettente ma non ancora pronto: servivano editing, una veste professionale e una pubblicazione fatta a regola d'arte.",
    soluzione:
      "Editing completo con revisioni condivise, impaginazione, copertina, EPUB, pubblicazione KDP con ISBN e scheda Amazon ottimizzata.",
    risultato:
      "Un romanzo pubblicato con una veste all'altezza delle librerie, pronto per le prime campagne di visibilità.",
    metriche: [
      { valore: "82k", etichetta: "parole editate" },
      { valore: "9", etichetta: "settimane di lavorazione" },
      { valore: "2", etichetta: "formati pubblicati (carta + ebook)" },
    ],
    citazione: {
      testo: "Il mio libro sembra finalmente un vero libro. La differenza si vede in ogni pagina.",
      autore: "Autrice esordiente",
    },
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
