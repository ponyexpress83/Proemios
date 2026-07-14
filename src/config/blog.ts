/**
 * I 12 articoli commerciali di Fase 1. In questa fase i contenuti sono solo
 * outline (titolo + sezioni TODO): la struttura è pronta per la stesura.
 * Fonte di verità per /blog, /blog/[slug], sitemap e seed del DB.
 */

export interface BlogOutline {
  slug: string;
  titolo: string;
  estratto: string;
  categoria: string;
  /** Sezioni previste dell'articolo (H2), da redigere. */
  outline: string[];
}

export const BLOG_POSTS: BlogOutline[] = [
  {
    slug: "quanto-costa-pubblicare-un-libro",
    titolo: "Quanto costa pubblicare un libro",
    estratto:
      "Una guida trasparente alle voci di costo per portare un manoscritto dalla scrivania ad Amazon.",
    categoria: "Costi e budget",
    outline: [
      "Le voci di costo: editing, impaginazione, copertina, ISBN",
      "Self-publishing vs editore tradizionale",
      "Quanto incide la lunghezza del testo",
      "Esempi di budget reali per fascia",
      "Come ottenere un preventivo preciso",
    ],
  },
  {
    slug: "quanto-costa-un-editor",
    titolo: "Quanto costa un editor",
    estratto:
      "Tariffe, differenze tra i tipi di editing e come capire di quale hai davvero bisogno.",
    categoria: "Costi e budget",
    outline: [
      "Editing, revisione, correzione bozze: non sono la stessa cosa",
      "Tariffe a parola, a cartella e a forfait",
      "Cosa fa lievitare o abbassare il preventivo",
      "Come valutare la qualità di un editor",
    ],
  },
  {
    slug: "come-pubblicare-su-amazon-kdp",
    titolo: "Come pubblicare su Amazon KDP",
    estratto:
      "Il percorso passo passo per pubblicare cartaceo ed ebook su Kindle Direct Publishing.",
    categoria: "Pubblicazione",
    outline: [
      "Cos'è Amazon KDP e come funziona",
      "Preparare i file: interni, copertina, EPUB",
      "Impostare prezzo, royalty e territori",
      "Metadata e categorie che contano",
      "Errori comuni da evitare",
    ],
  },
  {
    slug: "come-ottenere-un-isbn",
    titolo: "Come ottenere un ISBN",
    estratto:
      "Cos'è l'ISBN, a cosa serve e come richiederlo in Italia (o usare quello gratuito di KDP).",
    categoria: "Pubblicazione",
    outline: [
      "Cos'è l'ISBN e perché serve",
      "ISBN a pagamento vs ISBN gratuito di KDP",
      "Come richiederlo in Italia",
      "Chi risulta editore con ciascuna scelta",
    ],
  },
  {
    slug: "isbn-amazon-o-proprio",
    titolo: "ISBN Amazon o proprio: quale scegliere",
    estratto: "Vantaggi e limiti dell'ISBN gratuito di KDP rispetto a un ISBN di tua proprietà.",
    categoria: "Pubblicazione",
    outline: [
      "Cosa cambia davvero tra i due",
      "Chi figura come editore",
      "Distribuzione oltre Amazon",
      "Quando conviene l'uno o l'altro",
    ],
  },
  {
    slug: "come-trasformare-un-diario-in-un-libro",
    titolo: "Come trasformare un diario in un libro",
    estratto: "Dai materiali grezzi al memoir pubblicato: metodo, tempi e ruolo del ghostwriter.",
    categoria: "Memoir e ghostwriting",
    outline: [
      "Da diari, vocali e appunti a una struttura narrativa",
      "Il ruolo del ghostwriter e le interviste",
      "Mantenere la propria voce",
      "Diritti, riservatezza e pubblicazione",
    ],
  },
  {
    slug: "quanto-costa-un-ghostwriter",
    titolo: "Quanto costa un ghostwriter",
    estratto:
      "Fasce di prezzo del ghostwriting e cosa determina il costo di un libro scritto per te.",
    categoria: "Memoir e ghostwriting",
    outline: [
      "Cosa include il lavoro di un ghostwriter",
      "Fasce di prezzo per volume e complessità",
      "Modalità di collaborazione e pagamento",
      "Come riconoscere un servizio serio",
    ],
  },
  {
    slug: "editing-o-correzione-bozze",
    titolo: "Editing o correzione bozze: qual è la differenza",
    estratto:
      "Due interventi diversi, con obiettivi e costi diversi. Come capire di cosa ha bisogno il tuo testo.",
    categoria: "Editing",
    outline: [
      "Cosa fa l'editing",
      "Cosa fa la correzione bozze",
      "Quando serve l'uno, quando l'altra",
      "In che ordine vanno fatti",
    ],
  },
  {
    slug: "come-impaginare-un-libro",
    titolo: "Come impaginare un libro",
    estratto:
      "Principi di impaginazione professionale per interni leggibili e stampabili senza errori.",
    categoria: "Produzione",
    outline: [
      "Formato, margini e gabbia di impaginazione",
      "Scelta dei caratteri e giustezza",
      "Titoli, capitoli e numeri di pagina",
      "Preparare il PDF per la stampa",
    ],
  },
  {
    slug: "formato-epub-spiegato",
    titolo: "Il formato EPUB spiegato",
    estratto: "Cos'è l'EPUB, perché è lo standard degli ebook e come ottenerne uno valido.",
    categoria: "Produzione",
    outline: [
      "EPUB vs PDF vs formato Kindle",
      "Perché l'EPUB è liquido e responsivo",
      "Validazione e compatibilità con i lettori",
      "Errori tipici da evitare",
    ],
  },
  {
    slug: "come-pubblicare-un-memoir",
    titolo: "Come pubblicare un memoir",
    estratto:
      "Dalla stesura alla scheda Amazon: il percorso completo per pubblicare la propria storia.",
    categoria: "Memoir e ghostwriting",
    outline: [
      "Definire il cuore della storia",
      "Scrittura o ghostwriting",
      "Aspetti legali: persone reali e riservatezza",
      "Produzione, pubblicazione e lancio",
    ],
  },
  {
    slug: "come-scrivere-un-libro-professionale",
    titolo: "Come scrivere un libro professionale",
    estratto:
      "Il libro come strumento di autorevolezza: come progettarlo, scriverlo e usarlo nel branding.",
    categoria: "Libro professionale",
    outline: [
      "Definire obiettivo e lettore ideale",
      "Trasformare know-how in capitoli",
      "Scrittura, ghostwriting o co-scrittura",
      "Usare il libro come leva commerciale",
    ],
  },
];

export function getPostOutline(slug: string): BlogOutline | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
