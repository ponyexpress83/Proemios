/**
 * Modulo unico delle stringhe di interfaccia (brief §6).
 * Tutte le etichette, i micro-testi e la navigazione stanno qui: aggiungere
 * `next-intl` in Fase 3 significherà affiancare un dizionario `en`, non
 * riscrivere le pagine. Nessuna stringa di UI va scritta dentro i componenti.
 */

/** Le due azioni ricorrenti. Stesso nome per la stessa azione, ovunque. */
export const AZIONI = {
  preventivo: "Calcola il preventivo",
  analisi: "Analizza il manoscritto",
  analisiBreve: "Analisi gratuita",
  agenzie: "Richiedi il listino riservato",
  consulenza: "Prenota una call",
  waitlist: "Unisciti alla lista d'attesa",
} as const;

export const UI = {
  saltaAlContenuto: "Vai al contenuto",
  menuApri: "Apri il menu",
  menuChiudi: "Chiudi il menu",
  caricamento: "Un momento…",
  campoObbligatorio: "Questo campo è obbligatorio.",
  emailNonValida: "Controlla l'indirizzo email: manca qualcosa.",
  consensoRichiesto: "Serve il consenso al trattamento per proseguire.",
  erroreGenerico: "Qualcosa non ha funzionato. Riprova tra un momento.",
  indietro: "Indietro",
  avanti: "Avanti",
  passo: "Passo",
  di: "di",
  nessunDato: "Ancora nessun dato.",
} as const;

export const PREVENTIVO = {
  titolo: "Il tuo preventivo, adesso",
  occhiello:
    "Sei domande, due minuti. Ricevi tre percorsi possibili con prezzo, e decidi con i numeri davanti invece che dopo una settimana di attesa.",
  passi: ["Tipo di progetto", "Stato del testo", "Dimensione", "Servizi", "Tempi", "Contatto"],
  disclaimerStima:
    "Questa è una stima costruita sui dati che hai inserito. La confermiamo dopo una call in cui guardiamo il testo: se il lavoro è meno di quanto previsto, il prezzo scende.",
  accontoCta: "Blocca la data — acconto 40%",
  incluso: "Cosa include",
  escluso: "Cosa non include",
} as const;

export const ANALISI = {
  titolo: "Analisi del manoscritto",
  occhiello:
    "Carica il testo e ricevi una prima diagnosi: leggibilità, ritmo, tic ricorrenti, tempi verbali, lettore-tipo, punti di forza e aree su cui intervenire. Con la fascia di costo calcolata sul conteggio parole reale del file.",
  formati: "Accettiamo .docx, .pdf e .txt, fino a 15 MB.",
  gateTitolo: "Dove mandiamo il report",
  gateTesto:
    "Il report compare qui sulla pagina e ti arriva anche via email, così lo ritrovi quando ti serve.",
  inCorso: "Stiamo leggendo il testo. Ci vuole meno di un minuto.",
  erroreEstrazione:
    "Non siamo riusciti a leggere il file. Succede con i PDF fatti da scansione (immagini, non testo) e con i file protetti da password. Prova a esportarlo di nuovo in .docx, oppure incolla il testo in un .txt.",
  erroreBreve: "Il testo è troppo breve per dire qualcosa di sensato: servono almeno 100 parole.",
  erroreLimite:
    "Hai usato le analisi disponibili per oggi. Torna domani, oppure scrivici e la facciamo insieme.",
  conservazione: (giorni: number) =>
    `Del tuo file conserviamo solo il conteggio parole e il report. Il testo non viene archiviato e l'estratto usato per l'analisi è cancellato entro ${giorni} giorni.`,
  ctaPreventivo: "Vuoi il preventivo esatto?",
  ctaPreventivoTesto: "Il configuratore parte già compilato con quello che sappiamo del tuo testo.",
} as const;

export const AGENZIE = {
  titolo: "Capacità produttiva, a marchio vostro",
  occhiello:
    "Il vostro cliente vi chiede un libro. Voi non dovete costruire una redazione: la produzione la facciamo noi, sotto il vostro nome, senza mai comparire.",
} as const;

export const STRUMENTI_AI = {
  titolo: "Strumenti AI",
  occhiello:
    "Gli strumenti che usiamo dentro il nostro processo diventano un abbonamento. Oggi raccogliamo le adesioni: chi entra ora in lista definisce cosa costruiamo per primo.",
  notaFase:
    "Gli abbonamenti aprono a breve. Iscriversi non impegna a nulla e non richiede metodo di pagamento.",
  mensile: "Mensile",
  annuale: "Annuale",
  scontoAnnuale: "due mesi in omaggio",
} as const;
