/**
 * Segmentazione del testo per l'elaborazione.
 *
 * Un manoscritto da ottantamila parole non entra in una richiesta sola, e
 * spezzarlo a caso rovina il lavoro: un modello che riceve mezza frase corregge
 * mezza frase. Qui il testo viene diviso **su confini di paragrafo**, in blocchi
 * che stanno nel contesto del modello, con un po' di sovrapposizione perché il
 * modello veda il contesto immediato senza doverlo correggere due volte.
 *
 * Ogni paragrafo conserva il proprio indice: è l'ancora che permette di
 * riportare un intervento nel punto esatto del documento, anche dopo che il
 * testo è passato attraverso più blocchi.
 *
 * Modulo puro.
 */

export type Paragrafo = {
  /** Indice nel documento, stabile: è l'ancora dell'intervento. */
  indice: number;
  testo: string;
  /** Identificativo OOXML del paragrafo, quando il testo viene da un DOCX. */
  idOoxml?: string;
};

export type Segmento = {
  /** Numero progressivo del blocco, per l'ordinamento delle run. */
  numero: number;
  paragrafi: Paragrafo[];
  /** Paragrafi mostrati come contesto ma non da correggere. */
  contestoPrecedente: Paragrafo[];
  caratteri: number;
};

/**
 * Stima dei token. Non è esatta e non deve esserlo: serve a decidere quanti
 * paragrafi stanno in un blocco, con margine. Per l'italiano il rapporto è
 * intorno a 3,5 caratteri per token; usiamo 3 per stare larghi.
 */
export function stimaToken(testo: string): number {
  return Math.ceil(testo.length / 3);
}

export type OpzioniSegmentazione = {
  /** Caratteri massimi per blocco, esclusa la sovrapposizione. */
  caratteriPerSegmento?: number;
  /** Quanti paragrafi precedenti mostrare come contesto. */
  paragrafiDiContesto?: number;
};

const PREDEFINITE: Required<OpzioniSegmentazione> = {
  // ~12.000 caratteri ≈ 4.000 token in ingresso: lascia spazio abbondante per
  // le istruzioni e per una risposta lunga di interventi.
  caratteriPerSegmento: 12_000,
  paragrafiDiContesto: 2,
};

export function segmenta(
  paragrafi: readonly Paragrafo[],
  opzioni: OpzioniSegmentazione = {},
): Segmento[] {
  const { caratteriPerSegmento, paragrafiDiContesto } = { ...PREDEFINITE, ...opzioni };
  const utili = paragrafi.filter((p) => p.testo.trim().length > 0);
  if (utili.length === 0) return [];

  const segmenti: Segmento[] = [];
  let correnti: Paragrafo[] = [];
  let caratteri = 0;

  function chiudi() {
    if (correnti.length === 0) return;
    const primoIndice = correnti[0]!.indice;
    const contesto = utili
      .filter((p) => p.indice < primoIndice)
      .slice(-paragrafiDiContesto);
    segmenti.push({
      numero: segmenti.length,
      paragrafi: correnti,
      contestoPrecedente: contesto,
      caratteri,
    });
    correnti = [];
    caratteri = 0;
  }

  for (const p of utili) {
    // Un paragrafo più lungo del limite non si spezza: spezzarlo darebbe al
    // modello una frase troncata. Va da solo nel suo blocco, e se serve sarà
    // il modello a gestirlo con il proprio contesto.
    if (p.testo.length >= caratteriPerSegmento) {
      chiudi();
      correnti = [p];
      caratteri = p.testo.length;
      chiudi();
      continue;
    }

    if (caratteri + p.testo.length > caratteriPerSegmento) chiudi();
    correnti.push(p);
    caratteri += p.testo.length;
  }

  chiudi();
  return segmenti;
}

/**
 * Compone il testo di un blocco per il modello.
 *
 * Ogni paragrafo è numerato con il suo indice reale: il modello deve poterlo
 * citare per ancorare l'intervento, e gli indici non devono ripartire da zero
 * a ogni blocco, altrimenti gli interventi del secondo blocco finirebbero
 * all'inizio del documento.
 */
export function componiTesto(segmento: Segmento): string {
  const righe: string[] = [];

  if (segmento.contestoPrecedente.length > 0) {
    righe.push("### Contesto precedente (non correggere)");
    for (const p of segmento.contestoPrecedente) {
      righe.push(`[${p.indice}] ${p.testo}`);
    }
    righe.push("");
  }

  righe.push("### Testo da lavorare");
  for (const p of segmento.paragrafi) {
    righe.push(`[${p.indice}] ${p.testo}`);
  }

  return righe.join("\n");
}

/** Numero totale di parole, per il conteggio mostrato ovunque. */
export function contaParole(paragrafi: readonly Paragrafo[]): number {
  return paragrafi.reduce((somma, p) => {
    const parole = p.testo.trim().split(/\s+/).filter(Boolean).length;
    return somma + parole;
  }, 0);
}

/** Divide un testo semplice in paragrafi, per i file .txt. */
export function paragrafiDaTesto(testo: string): Paragrafo[] {
  return testo
    .split(/\r?\n/)
    .map((riga, indice) => ({ indice, testo: riga }))
    .filter((p) => p.testo.trim().length > 0)
    .map((p, i) => ({ ...p, indice: i }));
}
