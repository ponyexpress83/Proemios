/**
 * Catalogo delle notifiche.
 *
 * Ogni tipo dichiara qui il proprio testo e la rotta a cui porta. Modulo puro:
 * nessun database, nessuna rete, interamente testabile.
 *
 * Due regole che il catalogo fa rispettare per costruzione:
 *
 *  1. **Il testo di una notifica al cliente non contiene lavorazione interna.**
 *     Niente nomi di modelli, niente conteggi di interventi, niente stati
 *     tecnici: al cliente si dice cosa è successo al suo libro.
 *  2. **La rotta è sempre interna.** Il campo è un percorso, mai un URL: una
 *     notifica che porta fuori dal prodotto è un vettore di phishing con il
 *     nostro nome sopra.
 */

export const TIPI_NOTIFICA = [
  "progetto.avviato",
  "consegna.pronta",
  "approvazione.richiesta",
  "messaggio.ricevuto",
  "chiarimento.richiesto",
  "pagamento.dovuto",
  "pagamento.ricevuto",
  "fattura.disponibile",
  "job.da_rivedere",
  "job.approvato_editorialmente",
] as const;

export type TipoNotifica = (typeof TIPI_NOTIFICA)[number];

export type Destinazione = "cliente" | "staff";

export type ModelloNotifica = {
  /** Chi la riceve: decide anche quale linguaggio si usa. */
  destinazione: Destinazione;
  titolo: string;
  corpo: string;
  percorso: string;
  /** Vero se merita anche un'email, oltre alla campanella. */
  email: boolean;
};

export type ContestoNotifica = {
  progettoTitolo?: string;
  progettoId?: string;
  ordineCodice?: string;
  ordineId?: string;
  pagamentoId?: string;
  jobId?: string;
  importo?: string;
  mittente?: string;
  scadenza?: string;
};

/** Un percorso interno: mai un URL assoluto, mai uno schema. */
function percorsoInterno(p: string): string {
  if (!p.startsWith("/") || p.startsWith("//")) {
    throw new Error(`Percorso di notifica non interno: ${p}`);
  }
  return p;
}

/**
 * Costruisce la notifica. Il contesto mancante non fa fallire nulla: si
 * degrada a un testo generico, perché una notifica un po' vaga è meglio di una
 * notifica non inviata.
 */
export function componiNotifica(tipo: TipoNotifica, c: ContestoNotifica = {}): ModelloNotifica {
  const libro = c.progettoTitolo ?? "il tuo progetto";
  const progetto = c.progettoId ? `/area/progetti/${c.progettoId}` : "/area";
  const progettoStaff = c.progettoId ? `/admin/progetti/${c.progettoId}` : "/admin/progetti";

  const modelli: Record<TipoNotifica, ModelloNotifica> = {
    "progetto.avviato": {
      destinazione: "cliente",
      titolo: "Il lavoro è cominciato",
      corpo: `Abbiamo aperto la lavorazione di ${libro}. Da qui puoi seguirne l'avanzamento.`,
      percorso: progetto,
      email: true,
    },
    "consegna.pronta": {
      destinazione: "cliente",
      titolo: "C'è una consegna da guardare",
      corpo: `Il documento revisionato di ${libro} è disponibile nella tua area.`,
      percorso: progetto,
      email: true,
    },
    "approvazione.richiesta": {
      destinazione: "cliente",
      titolo: "Serve una tua approvazione",
      corpo: `Per andare avanti con ${libro} abbiamo bisogno che tu confermi un passaggio.`,
      percorso: progetto,
      email: true,
    },
    "messaggio.ricevuto": {
      destinazione: "cliente",
      titolo: "Hai un messaggio",
      corpo: c.mittente
        ? `${c.mittente} ti ha scritto a proposito di ${libro}.`
        : `C'è un messaggio nuovo su ${libro}.`,
      percorso: progetto,
      email: false,
    },
    "chiarimento.richiesto": {
      destinazione: "cliente",
      titolo: "Una domanda sul testo",
      corpo: `Su ${libro} c'è un punto su cui vorremmo la tua indicazione prima di procedere.`,
      percorso: progetto,
      email: true,
    },
    "pagamento.dovuto": {
      destinazione: "cliente",
      titolo: "Una rata da saldare",
      corpo: c.importo
        ? `È in scadenza una rata di ${c.importo}${c.ordineCodice ? ` sull'ordine ${c.ordineCodice}` : ""}.`
        : "C'è una rata da saldare nella tua area.",
      percorso: "/area/pagamenti",
      email: true,
    },
    "pagamento.ricevuto": {
      destinazione: "cliente",
      titolo: "Pagamento ricevuto",
      corpo: c.importo
        ? `Abbiamo ricevuto ${c.importo}. Grazie.`
        : "Abbiamo ricevuto il tuo pagamento. Grazie.",
      percorso: "/area/pagamenti",
      email: true,
    },
    "fattura.disponibile": {
      destinazione: "cliente",
      titolo: "La fattura è disponibile",
      corpo: "Trovi la fattura nella sezione pagamenti della tua area.",
      percorso: "/area/pagamenti",
      email: false,
    },
    "job.da_rivedere": {
      destinazione: "staff",
      titolo: "Una lavorazione aspetta la revisione",
      corpo: "L'elaborazione è finita: gli interventi proposti sono pronti da decidere.",
      percorso: c.jobId ? `/redazione/${c.jobId}` : "/redazione",
      email: false,
    },
    "job.approvato_editorialmente": {
      destinazione: "staff",
      titolo: "Approvazione editoriale completata",
      corpo: "Il documento revisionato è pronto: manca l'approvazione alla consegna.",
      percorso: progettoStaff,
      email: false,
    },
  };

  const modello = modelli[tipo];
  return { ...modello, percorso: percorsoInterno(modello.percorso) };
}
