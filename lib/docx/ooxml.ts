/**
 * Lettura mirata dell'OOXML di un documento Word.
 *
 * **Perché non un parser XML generico.** Il vincolo del prodotto è che il
 * documento consegnato sia il documento originale con dentro le revisioni, non
 * un documento ricostruito. Un ciclo parse → modifica → serializza riscrive
 * l'intero XML: normalizza gli spazi, riordina gli attributi, perde i commenti
 * XML, altera i namespace inutilizzati. Word spesso apre il risultato lo
 * stesso, ma "spesso" non è una garanzia che si possa dare a un cliente.
 *
 * Qui si lavora sulla **stringa XML originale**, individuando le posizioni
 * esatte degli elementi che interessano. Tutto ciò che non viene toccato resta
 * identico byte per byte.
 *
 * Questo modulo fa solo lettura. La scrittura delle revisioni tracciate è nella
 * Fase 5 e usa gli stessi indici.
 */

export type RunTesto = {
  /** Posizione del testo dentro `<w:t>`, nella stringa XML completa. */
  inizioTesto: number;
  fineTesto: number;
  /** Estremi dell'elemento `<w:r>` che contiene questo testo. */
  inizioRun: number;
  fineRun: number;
  testo: string;
  /** Offset del testo di questa run dentro il testo concatenato del paragrafo. */
  offsetNelParagrafo: number;
};

export type ParagrafoOoxml = {
  /** Indice progressivo nel documento. */
  indice: number;
  /** `w14:paraId` se presente: è l'identificativo stabile di Word. */
  paraId?: string;
  /** Estremi dell'elemento `<w:p>` nella stringa XML. */
  inizio: number;
  fine: number;
  /** Testo del paragrafo, concatenazione di tutte le run. */
  testo: string;
  run: RunTesto[];
};

/** Decodifica le cinque entità XML predefinite. Nessuna altra è ammessa in OOXML. */
export function decodificaXml(testo: string): string {
  return testo
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function codificaXml(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Trova la fine di un elemento, gestendo l'annidamento.
 *
 * Serve perché `<w:p>` può contenere altri `<w:p>` (dentro una tabella o un
 * campo): cercare il primo `</w:p>` chiuderebbe il paragrafo sbagliato.
 */
export function fineElemento(xml: string, nome: string, inizio: number): number {
  const apertura = `<${nome}`;
  const chiusura = `</${nome}>`;
  let profondita = 0;
  let posizione = inizio;

  while (posizione < xml.length) {
    const prossimaApertura = xml.indexOf(apertura, posizione);
    const prossimaChiusura = xml.indexOf(chiusura, posizione);

    if (prossimaChiusura === -1) return -1;

    // Un'apertura conta solo se è davvero l'elemento cercato e non un prefisso
    // (`<w:pPr>` non apre un `<w:p>`).
    const aperturaValida =
      prossimaApertura !== -1 &&
      prossimaApertura < prossimaChiusura &&
      /[\s/>]/.test(xml[prossimaApertura + apertura.length] ?? "");

    if (aperturaValida) {
      // Un elemento auto-chiuso (`<w:p/>`) non apre nulla.
      const fineTag = xml.indexOf(">", prossimaApertura);
      const autoChiuso = fineTag !== -1 && xml[fineTag - 1] === "/";
      if (!autoChiuso) profondita += 1;
      posizione = fineTag + 1;
      continue;
    }

    profondita -= 1;
    if (profondita === 0) return prossimaChiusura + chiusura.length;
    posizione = prossimaChiusura + chiusura.length;
  }

  return -1;
}

function attributo(tag: string, nome: string): string | undefined {
  const trovato = tag.match(new RegExp(`\\s${nome}="([^"]*)"`));
  return trovato?.[1];
}

/**
 * Scorre `word/document.xml` e restituisce i paragrafi con le loro posizioni.
 *
 * Le run dentro `<w:del>` sono ignorate: sono testo già cancellato in una
 * revisione precedente e non fa parte del testo corrente. Quelle dentro
 * `<w:ins>` invece contano: sono testo inserito e presente.
 */
export function leggiParagrafi(xml: string): ParagrafoOoxml[] {
  const paragrafi: ParagrafoOoxml[] = [];
  let posizione = 0;
  let indice = 0;

  while (posizione < xml.length) {
    const inizio = xml.indexOf("<w:p", posizione);
    if (inizio === -1) break;

    // `<w:pPr>`, `<w:pStyle>` e simili cominciano con `<w:p`: non sono paragrafi.
    const carattereDopo = xml[inizio + 4];
    if (carattereDopo !== " " && carattereDopo !== ">" && carattereDopo !== "/") {
      posizione = inizio + 4;
      continue;
    }

    const fineTagApertura = xml.indexOf(">", inizio);
    if (fineTagApertura === -1) break;
    const tagApertura = xml.slice(inizio, fineTagApertura + 1);

    // Paragrafo vuoto auto-chiuso.
    if (tagApertura.endsWith("/>")) {
      paragrafi.push({
        indice: indice++,
        paraId: attributo(tagApertura, "w14:paraId"),
        inizio,
        fine: fineTagApertura + 1,
        testo: "",
        run: [],
      });
      posizione = fineTagApertura + 1;
      continue;
    }

    const fine = fineElemento(xml, "w:p", inizio);
    if (fine === -1) break;

    const corpo = xml.slice(inizio, fine);
    const run = leggiRun(corpo, inizio);

    paragrafi.push({
      indice: indice++,
      paraId: attributo(tagApertura, "w14:paraId"),
      inizio,
      fine,
      testo: run.map((r) => r.testo).join(""),
      run,
    });

    posizione = fine;
  }

  return paragrafi;
}

/**
 * Estrae le run di testo di un paragrafo.
 *
 * `scostamento` riporta le posizioni all'inizio del documento: dentro questa
 * funzione gli indici sono relativi al corpo del paragrafo.
 */
function leggiRun(corpoParagrafo: string, scostamento: number): RunTesto[] {
  const run: RunTesto[] = [];
  let posizione = 0;
  let offsetTesto = 0;

  // Intervalli di testo cancellato in revisioni precedenti: non fanno parte
  // del testo corrente e non devono essere né letti né corretti.
  const cancellati: [number, number][] = [];
  let daCercare = 0;
  while (true) {
    const inizioDel = corpoParagrafo.indexOf("<w:del ", daCercare);
    if (inizioDel === -1) break;
    const fineDel = fineElemento(corpoParagrafo, "w:del", inizioDel);
    if (fineDel === -1) break;
    cancellati.push([inizioDel, fineDel]);
    daCercare = fineDel;
  }
  const dentroCancellato = (p: number) => cancellati.some(([a, b]) => p >= a && p < b);

  while (posizione < corpoParagrafo.length) {
    const inizioT = corpoParagrafo.indexOf("<w:t", posizione);
    if (inizioT === -1) break;

    const carattereDopo = corpoParagrafo[inizioT + 4];
    if (carattereDopo !== " " && carattereDopo !== ">" && carattereDopo !== "/") {
      posizione = inizioT + 4;
      continue;
    }

    const fineTagApertura = corpoParagrafo.indexOf(">", inizioT);
    if (fineTagApertura === -1) break;

    // `<w:t/>` vuoto.
    if (corpoParagrafo[fineTagApertura - 1] === "/") {
      posizione = fineTagApertura + 1;
      continue;
    }

    const chiusura = corpoParagrafo.indexOf("</w:t>", fineTagApertura);
    if (chiusura === -1) break;

    if (dentroCancellato(inizioT)) {
      posizione = chiusura + 6;
      continue;
    }

    const testo = decodificaXml(corpoParagrafo.slice(fineTagApertura + 1, chiusura));

    // Estremi della `<w:r>` che contiene questo `<w:t>`: servono alla Fase 5,
    // che deve avvolgere o duplicare la run intera, non il solo testo.
    const inizioRun = corpoParagrafo.lastIndexOf("<w:r", inizioT);
    const fineRun = inizioRun === -1 ? -1 : fineElemento(corpoParagrafo, "w:r", inizioRun);

    run.push({
      inizioTesto: scostamento + fineTagApertura + 1,
      fineTesto: scostamento + chiusura,
      inizioRun: inizioRun === -1 ? -1 : scostamento + inizioRun,
      fineRun: fineRun === -1 ? -1 : scostamento + fineRun,
      testo,
      offsetNelParagrafo: offsetTesto,
    });

    offsetTesto += testo.length;
    posizione = chiusura + 6;
  }

  return run;
}
