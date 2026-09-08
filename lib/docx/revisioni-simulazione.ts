/**
 * Simulazione di «Accetta tutte» e «Rifiuta tutte».
 *
 * Serve a due cose:
 *  - **verificare** che un documento revisionato produca esattamente il testo
 *    atteso in entrambi i casi, senza dover aprire Word;
 *  - alimentare l'anteprima «prima / dopo» del workspace del redattore.
 *
 * Non è una reimplementazione di Word: opera sul testo, non sul documento, e
 * ignora tutto ciò che non è una revisione di testo. Per verificare che il
 * *documento* sia valido c'è la verifica con un lettore OOXML reale
 * (scripts/verifica-docx.sh).
 */
import { decodificaXml, fineElemento } from "./ooxml";

/**
 * Rimuove gli elementi `<w:ins>` o `<w:del>` mantenendone o scartandone il
 * contenuto, e restituisce l'XML risultante.
 */
function risolvi(xml: string, elemento: "w:ins" | "w:del", tieniContenuto: boolean): string {
  let risultato = "";
  let posizione = 0;

  while (posizione < xml.length) {
    const inizio = xml.indexOf(`<${elemento} `, posizione);
    if (inizio === -1) {
      risultato += xml.slice(posizione);
      break;
    }

    risultato += xml.slice(posizione, inizio);

    const fine = fineElemento(xml, elemento, inizio);
    if (fine === -1) {
      risultato += xml.slice(inizio);
      break;
    }

    if (tieniContenuto) {
      const corpo = xml.slice(inizio, fine);
      const apertura = corpo.indexOf(">") + 1;
      const chiusura = corpo.lastIndexOf(`</${elemento}>`);
      // Il testo cancellato torna a essere testo normale: `<w:delText>` è
      // valido solo dentro `<w:del>`.
      risultato += corpo
        .slice(apertura, chiusura)
        .replace(/<w:delText(\s[^>]*)?>/g, (m) => m.replace("w:delText", "w:t"))
        .replace(/<\/w:delText>/g, "</w:t>");
    }

    posizione = fine;
  }

  return risultato;
}

/** Accetta tutte le revisioni: gli inserimenti restano, le cancellazioni spariscono. */
export function accettaTutte(xml: string): string {
  return risolvi(risolvi(xml, "w:del", false), "w:ins", true);
}

/** Rifiuta tutte le revisioni: si torna al testo di partenza. */
export function rifiutaTutte(xml: string): string {
  return risolvi(risolvi(xml, "w:ins", false), "w:del", true);
}

/** Estrae il testo per paragrafo da un XML senza più revisioni. */
export function testoParagrafi(xml: string): string[] {
  const paragrafi: string[] = [];
  let posizione = 0;

  while (posizione < xml.length) {
    const inizio = xml.indexOf("<w:p", posizione);
    if (inizio === -1) break;
    const dopo = xml[inizio + 4];
    if (dopo !== " " && dopo !== ">" && dopo !== "/") {
      posizione = inizio + 4;
      continue;
    }
    const fine = fineElemento(xml, "w:p", inizio);
    if (fine === -1) break;

    const corpo = xml.slice(inizio, fine);
    let testo = "";
    for (const t of corpo.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
      testo += decodificaXml(t[1] ?? "");
    }
    if (testo.trim().length > 0) paragrafi.push(testo);

    posizione = fine;
  }

  return paragrafi;
}

/**
 * Identificativi di revisione duplicati: Word li rifiuta e apre la finestra di
 * riparazione. Il controllo è a parte perché è il difetto più facile da
 * introdurre e il più difficile da notare guardando l'XML.
 */
export function idRevisioneDuplicati(xml: string): number[] {
  const visti = new Set<number>();
  const duplicati = new Set<number>();

  for (const t of xml.matchAll(/<w:(?:ins|del)\s+w:id="(\d+)"/g)) {
    const id = Number(t[1]);
    if (visti.has(id)) duplicati.add(id);
    visti.add(id);
  }

  return [...duplicati];
}
