/**
 * Tappe predefinite di un progetto editoriale.
 *
 * Sono ciò che il cliente vede come avanzamento, quindi sono descritte in
 * termini editoriali e non di pipeline interna: «Revisione» e non
 * «needs_review», «Consegna» e non «delivered».
 *
 * Modulo puro: lo importano sia il livello dati sia i componenti client.
 */
export type TappaPredefinita = { nome: string; descrizione: string };

export const TAPPE_PREDEFINITE: readonly TappaPredefinita[] = [
  {
    nome: "Avvio",
    descrizione: "Raccogliamo i materiali e verifichiamo che sia tutto quello che serve.",
  },
  {
    nome: "Analisi",
    descrizione: "Leggiamo il testo e definiamo il piano di lavorazione.",
  },
  {
    nome: "Lavorazione",
    descrizione: "Il lavoro editoriale vero e proprio, con revisioni tracciate.",
  },
  {
    nome: "Revisione",
    descrizione: "Un redattore verifica ogni intervento, uno per uno.",
  },
  {
    nome: "Approvazione",
    descrizione: "Guardi il risultato e decidi se procedere.",
  },
  {
    nome: "Consegna",
    descrizione: "Ricevi i file finali.",
  },
];
