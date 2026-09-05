/**
 * Scrittura delle revisioni tracciate dentro il documento originale.
 *
 * Il principio che regge tutto il modulo: **non si costruisce un documento
 * nuovo**. Si prende la stringa XML di `word/document.xml` così com'è e vi si
 * innestano gli elementi `<w:ins>` e `<w:del>` nei punti esatti. Tutto ciò che
 * non viene toccato — stili, numerazioni, tabelle, note, immagini, relazioni,
 * revisioni preesistenti — resta identico byte per byte, perché nessuno lo
 * riscrive.
 *
 * Come Word rappresenta una revisione:
 *  - inserimento: la run è avvolta in `<w:ins w:id w:author w:date>`;
 *  - cancellazione: la run è avvolta in `<w:del …>` e i suoi `<w:t>`
 *    diventano `<w:delText>`;
 *  - sostituzione: le due cose insieme, cancellazione seguita da inserimento.
 *
 * Le proprietà della run originale (`<w:rPr>`) vengono ricopiate in entrambe:
 * senza, una parola corretta dentro un titolo perderebbe il suo stile.
 */
import {
  codificaXml,
  decodificaXml,
  leggiParagrafi,
  type ParagrafoOoxml,
  type RunTesto,
} from "./ooxml";

export type InterventoDaApplicare = {
  /** Indice del paragrafo fra quelli con testo, come lo vede il motore. */
  indiceParagrafo: number;
  /** Offset di inizio e fine nel testo concatenato del paragrafo. */
  inizio: number;
  fine: number;
  /** Testo sostitutivo. Stringa vuota per una cancellazione pura. */
  dopo: string;
  /** Commento facoltativo, ancorato allo stesso punto. */
  commento?: string;
};

export type OpzioniRevisione = {
  autore: string;
  /** Iniziali usate da Word per i commenti. */
  iniziali?: string;
  data?: Date;
};

export type EsitoApplicazione = {
  xml: string;
  applicati: number;
  /** Interventi che non è stato possibile applicare in sicurezza. */
  saltati: { intervento: InterventoDaApplicare; motivo: string }[];
  /** Commenti da scrivere in word/comments.xml. */
  commenti: { id: number; testo: string }[];
};

/**
 * Gli identificativi di revisione devono essere unici nel documento, comprese
 * le revisioni già presenti. Si parte da un valore alto e si cerca comunque il
 * massimo esistente: due revisioni con lo stesso id fanno aprire a Word la
 * finestra di riparazione.
 */
function prossimoId(xml: string): number {
  let massimo = 0;
  const trovati = xml.matchAll(/\sw:id="(\d+)"/g);
  for (const t of trovati) {
    const valore = Number(t[1]);
    if (Number.isFinite(valore) && valore > massimo) massimo = valore;
  }
  return massimo + 1;
}

function dataIso(data: Date): string {
  // Word vuole il formato senza millisecondi.
  return data.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Estrae `<w:rPr>` da una run, per riportarlo nelle run generate. */
function proprietaRun(xmlRun: string): string {
  const inizio = xmlRun.indexOf("<w:rPr>");
  if (inizio === -1) {
    const autoChiuso = xmlRun.match(/<w:rPr\s*\/>/);
    return autoChiuso ? autoChiuso[0] : "";
  }
  const fine = xmlRun.indexOf("</w:rPr>", inizio);
  if (fine === -1) return "";
  return xmlRun.slice(inizio, fine + "</w:rPr>".length);
}

/**
 * `xml:space="preserve"` è obbligatorio quando il testo comincia o finisce con
 * uno spazio: senza, Word lo mangia, e una correzione di spaziatura diventa
 * una correzione che sposta le parole.
 */
function tagTesto(nome: "w:t" | "w:delText", testo: string): string {
  const serve = /^\s|\s$/.test(testo);
  return `<${nome}${serve ? ' xml:space="preserve"' : ""}>${codificaXml(testo)}</${nome}>`;
}

function runInserimento(
  id: number,
  opzioni: Required<OpzioniRevisione>,
  rPr: string,
  testo: string,
) {
  return (
    `<w:ins w:id="${id}" w:author="${codificaXml(opzioni.autore)}" w:date="${dataIso(opzioni.data)}">` +
    `<w:r>${rPr}${tagTesto("w:t", testo)}</w:r>` +
    `</w:ins>`
  );
}

function runCancellazione(
  id: number,
  opzioni: Required<OpzioniRevisione>,
  rPr: string,
  testo: string,
) {
  return (
    `<w:del w:id="${id}" w:author="${codificaXml(opzioni.autore)}" w:date="${dataIso(opzioni.data)}">` +
    `<w:r>${rPr}${tagTesto("w:delText", testo)}</w:r>` +
    `</w:del>`
  );
}

/** Run normale, per il testo che resta fuori dall'intervento. */
function runSemplice(rPr: string, testo: string) {
  return testo.length === 0 ? "" : `<w:r>${rPr}${tagTesto("w:t", testo)}</w:r>`;
}

/**
 * Applica gli interventi a un documento.
 *
 * Lavora **per paragrafo e dal fondo verso l'inizio**: ogni sostituzione
 * cambia la lunghezza dell'XML, e procedendo dall'inizio tutti gli offset
 * successivi diventerebbero sbagliati.
 *
 * Un intervento che non si può applicare in sicurezza viene **saltato con un
 * motivo**, non forzato: un documento che Word deve riparare vale meno di un
 * intervento in meno.
 */
export function applicaRevisioni(
  xmlDocumento: string,
  interventi: readonly InterventoDaApplicare[],
  opzioni: OpzioniRevisione,
): EsitoApplicazione {
  const impostazioni: Required<OpzioniRevisione> = {
    autore: opzioni.autore,
    iniziali: opzioni.iniziali ?? iniziali(opzioni.autore),
    data: opzioni.data ?? new Date(),
  };

  const paragrafi = leggiParagrafi(xmlDocumento).filter((p) => p.testo.trim().length > 0);
  const saltati: EsitoApplicazione["saltati"] = [];
  const commenti: EsitoApplicazione["commenti"] = [];

  let idCorrente = prossimoId(xmlDocumento);
  let idCommento = prossimoIdCommento(xmlDocumento);

  // Gli interventi si raggruppano per paragrafo, e i paragrafi si lavorano dal
  // fondo: così le posizioni di quelli precedenti restano valide.
  const perParagrafo = new Map<number, InterventoDaApplicare[]>();
  for (const i of interventi) {
    const lista = perParagrafo.get(i.indiceParagrafo) ?? [];
    lista.push(i);
    perParagrafo.set(i.indiceParagrafo, lista);
  }

  let xml = xmlDocumento;
  const indiciOrdinati = [...perParagrafo.keys()].sort((a, b) => b - a);

  for (const indice of indiciOrdinati) {
    const paragrafo = paragrafi[indice];
    const lista = perParagrafo.get(indice)!;

    if (!paragrafo) {
      for (const i of lista) saltati.push({ intervento: i, motivo: "paragrafo inesistente" });
      continue;
    }

    const esito = applicaAlParagrafo(xml, paragrafo, lista, impostazioni, idCorrente, idCommento);
    xml = esito.xml;
    idCorrente = esito.prossimoId;
    idCommento = esito.prossimoIdCommento;
    saltati.push(...esito.saltati);
    commenti.push(...esito.commenti);
  }

  return {
    xml,
    applicati: interventi.length - saltati.length,
    saltati,
    commenti,
  };
}

function prossimoIdCommento(xml: string): number {
  let massimo = -1;
  for (const t of xml.matchAll(/<w:commentRangeStart\s+w:id="(\d+)"/g)) {
    const v = Number(t[1]);
    if (v > massimo) massimo = v;
  }
  return massimo + 1;
}

function iniziali(nome: string): string {
  return (
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "P"
  );
}

/**
 * Applica gli interventi di un singolo paragrafo.
 *
 * Ogni intervento tocca una o più run. Le run si riscrivono **una sola volta
 * ciascuna**, con dentro tutti gli interventi che le riguardano: riscrivere la
 * stessa run due volte significherebbe, la seconda volta, tagliare un
 * intervallo di byte che nel frattempo ha cambiato lunghezza — e produrre XML
 * troncato a metà di un tag. Il documento resterebbe apribile solo per caso.
 *
 * Un intervento che attraversa più run viene **saltato**: applicarlo
 * richiederebbe di decidere quale formattazione dare al testo inserito quando
 * le run hanno stili diversi, e sbagliare quella scelta significa consegnare un
 * documento con il grassetto nel posto sbagliato. Il Job passa in needs_review
 * e la decisione la prende un redattore.
 */
type InterventoPreparato = {
  intervento: InterventoDaApplicare;
  run: RunTesto;
  /** Offset dentro il testo della run, non del paragrafo. */
  inizioLocale: number;
  fineLocale: number;
};

function applicaAlParagrafo(
  xml: string,
  paragrafo: ParagrafoOoxml,
  interventi: readonly InterventoDaApplicare[],
  opzioni: Required<OpzioniRevisione>,
  idPartenza: number,
  idCommentoPartenza: number,
): {
  xml: string;
  prossimoId: number;
  prossimoIdCommento: number;
  saltati: EsitoApplicazione["saltati"];
  commenti: EsitoApplicazione["commenti"];
} {
  const saltati: EsitoApplicazione["saltati"] = [];
  const commenti: EsitoApplicazione["commenti"] = [];
  let idCorrente = idPartenza;
  let idCommento = idCommentoPartenza;

  // Prima fase: validare gli interventi e legarli alla run che li contiene.
  // Si procede in ordine di testo, così la sovrapposizione si riconosce
  // confrontando ogni intervento con la fine di quello accettato prima.
  const ordinati = [...interventi].sort((a, b) => a.inizio - b.inizio || a.fine - b.fine);
  const preparati: InterventoPreparato[] = [];
  let fineAccettata = -1;

  for (const intervento of ordinati) {
    if (intervento.inizio < 0 || intervento.fine > paragrafo.testo.length) {
      saltati.push({ intervento, motivo: "posizione fuori dal paragrafo" });
      continue;
    }
    if (intervento.inizio >= intervento.fine && intervento.dopo.length === 0) {
      saltati.push({ intervento, motivo: "intervento vuoto" });
      continue;
    }
    // Due interventi che si contendono le stesse parole non si possono
    // applicare entrambi: il secondo cancellerebbe testo già cancellato.
    if (intervento.inizio < fineAccettata) {
      saltati.push({ intervento, motivo: "sovrapposto a un intervento precedente" });
      continue;
    }

    // Quale run contiene l'inizio e quale la fine.
    const runIniziale = paragrafo.run.find(
      (r) =>
        intervento.inizio >= r.offsetNelParagrafo &&
        intervento.inizio < r.offsetNelParagrafo + r.testo.length,
    );
    const runFinale = paragrafo.run.find(
      (r) =>
        intervento.fine > r.offsetNelParagrafo &&
        intervento.fine <= r.offsetNelParagrafo + r.testo.length,
    );

    if (!runIniziale || !runFinale) {
      saltati.push({ intervento, motivo: "posizione non riconducibile a una run" });
      continue;
    }

    if (runIniziale !== runFinale) {
      saltati.push({
        intervento,
        motivo: "l'intervento attraversa run con formattazione diversa",
      });
      continue;
    }

    if (runIniziale.inizioRun === -1 || runIniziale.fineRun === -1) {
      saltati.push({ intervento, motivo: "run non delimitabile" });
      continue;
    }

    preparati.push({
      intervento,
      run: runIniziale,
      inizioLocale: intervento.inizio - runIniziale.offsetNelParagrafo,
      fineLocale: intervento.fine - runIniziale.offsetNelParagrafo,
    });
    fineAccettata = Math.max(fineAccettata, intervento.fine);
  }

  // Seconda fase: raggruppare per run e riscrivere ogni run una volta sola.
  const perRun = new Map<number, InterventoPreparato[]>();
  for (const p of preparati) {
    const lista = perRun.get(p.run.inizioRun) ?? [];
    lista.push(p);
    perRun.set(p.run.inizioRun, lista);
  }

  // Dal fondo del paragrafo verso l'inizio: ogni riscrittura cambia la
  // lunghezza dell'XML, e gli estremi delle run precedenti restano validi solo
  // finché non si tocca nulla prima di loro.
  let risultato = xml;
  const inizi = [...perRun.keys()].sort((a, b) => b - a);

  for (const inizioRun of inizi) {
    const gruppo = perRun.get(inizioRun)!;
    const run = gruppo[0]!.run;

    const xmlRun = risultato.slice(run.inizioRun, run.fineRun);
    // Se l'XML in questa posizione non è più la run attesa, il documento è
    // cambiato sotto i piedi: meglio saltare che sovrascrivere.
    if (!/^<w:r[ >]/.test(xmlRun)) {
      for (const p of gruppo) {
        saltati.push({ intervento: p.intervento, motivo: "la run è già stata modificata" });
      }
      continue;
    }

    const rPr = proprietaRun(xmlRun);
    const testoRun = run.testo;
    const pezzi: string[] = [];
    let cursore = 0;

    for (const p of gruppo.sort((a, b) => a.inizioLocale - b.inizioLocale)) {
      const sostituito = testoRun.slice(p.inizioLocale, p.fineLocale);
      if (sostituito.length === 0 && p.intervento.dopo.length === 0) {
        saltati.push({ intervento: p.intervento, motivo: "nessun testo da sostituire" });
        continue;
      }

      // Testo che precede l'intervento e resta com'è.
      pezzi.push(runSemplice(rPr, testoRun.slice(cursore, p.inizioLocale)));

      let apertura = "";
      let chiusura = "";
      if (p.intervento.commento) {
        apertura = `<w:commentRangeStart w:id="${idCommento}"/>`;
        chiusura =
          `<w:commentRangeEnd w:id="${idCommento}"/>` +
          `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr>` +
          `<w:commentReference w:id="${idCommento}"/></w:r>`;
        commenti.push({ id: idCommento, testo: p.intervento.commento });
        idCommento += 1;
      }

      pezzi.push(apertura);
      if (sostituito.length > 0) {
        pezzi.push(runCancellazione(idCorrente++, opzioni, rPr, sostituito));
      }
      if (p.intervento.dopo.length > 0) {
        pezzi.push(runInserimento(idCorrente++, opzioni, rPr, p.intervento.dopo));
      }
      pezzi.push(chiusura);
      cursore = p.fineLocale;
    }

    // Coda della run, dopo l'ultimo intervento.
    pezzi.push(runSemplice(rPr, testoRun.slice(cursore)));

    risultato = risultato.slice(0, run.inizioRun) + pezzi.join("") + risultato.slice(run.fineRun);
  }

  return {
    xml: risultato,
    prossimoId: idCorrente,
    prossimoIdCommento: idCommento,
    saltati,
    commenti,
  };
}

export { decodificaXml };
