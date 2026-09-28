/**
 * Commenti Word.
 *
 * Un commento non è solo un testo: richiede tre cose coordinate, e se ne manca
 * una Word apre la finestra di riparazione.
 *
 *  1. `word/comments.xml`, con il testo del commento;
 *  2. una relazione verso quella parte in `word/_rels/document.xml.rels`;
 *  3. un `Override` in `[Content_Types].xml` che ne dichiari il tipo.
 *
 * Nel documento, gli ancoraggi (`commentRangeStart/End` e `commentReference`)
 * sono già inseriti da `lib/docx/revisioni.ts`.
 */
import { codificaXml } from "./ooxml";
import {
  PARTE_COMMENTI,
  PARTE_CONTENT_TYPES,
  PARTE_RELAZIONI_DOCUMENTO,
  type PacchettoDocx,
} from "./pacchetto";

const TIPO_COMMENTI =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
const RELAZIONE_COMMENTI =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";

const NAMESPACE =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export type CommentoDaScrivere = {
  id: number;
  testo: string;
  autore: string;
  iniziali: string;
  data: Date;
};

function elementoCommento(c: CommentoDaScrivere): string {
  const data = c.data.toISOString().replace(/\.\d{3}Z$/, "Z");
  // Ogni riga del commento è un paragrafo: un commento su più righe che
  // diventa un paragrafo solo perde la formattazione voluta da chi lo scrive.
  const paragrafi = c.testo
    .split(/\r?\n/)
    .map(
      (riga) =>
        `<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>` +
        `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>` +
        `<w:r><w:t xml:space="preserve">${codificaXml(riga)}</w:t></w:r></w:p>`,
    )
    .join("");

  return (
    `<w:comment w:id="${c.id}" w:author="${codificaXml(c.autore)}" ` +
    `w:initials="${codificaXml(c.iniziali)}" w:date="${data}">${paragrafi}</w:comment>`
  );
}

/**
 * Aggiunge i commenti al pacchetto, creando la parte se non esiste e
 * conservando i commenti già presenti nel documento.
 */
export async function scriviCommenti(
  pacchetto: PacchettoDocx,
  nuovi: readonly CommentoDaScrivere[],
): Promise<void> {
  if (nuovi.length === 0) return;

  const elementi = nuovi.map(elementoCommento).join("");

  if (pacchetto.ha(PARTE_COMMENTI)) {
    // Innesto prima della chiusura, senza toccare i commenti esistenti.
    const esistente = await pacchetto.leggiTesto(PARTE_COMMENTI);
    const chiusura = esistente.lastIndexOf("</w:comments>");
    if (chiusura === -1) {
      throw new Error("word/comments.xml presente ma malformato: manca </w:comments>.");
    }
    pacchetto.scrivi(
      PARTE_COMMENTI,
      esistente.slice(0, chiusura) + elementi + esistente.slice(chiusura),
    );
  } else {
    pacchetto.scrivi(
      PARTE_COMMENTI,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<w:comments ${NAMESPACE}>${elementi}</w:comments>`,
    );
    await registraParte(pacchetto);
  }
}

/** Dichiara la parte nei content types e nelle relazioni del documento. */
async function registraParte(pacchetto: PacchettoDocx): Promise<void> {
  // ── Content types ──
  const tipi = await pacchetto.leggiTesto(PARTE_CONTENT_TYPES);
  if (!tipi.includes(TIPO_COMMENTI)) {
    const chiusura = tipi.lastIndexOf("</Types>");
    if (chiusura === -1) throw new Error("[Content_Types].xml malformato.");
    pacchetto.scrivi(
      PARTE_CONTENT_TYPES,
      tipi.slice(0, chiusura) +
        `<Override PartName="/word/comments.xml" ContentType="${TIPO_COMMENTI}"/>` +
        tipi.slice(chiusura),
    );
  }

  // ── Relazioni ──
  const relazioni = await pacchetto.leggiTesto(PARTE_RELAZIONI_DOCUMENTO);
  if (relazioni.includes('Target="comments.xml"')) return;

  // L'identificativo dev'essere libero: riusarne uno esistente riassegnerebbe
  // un'altra parte del documento.
  let massimo = 0;
  for (const t of relazioni.matchAll(/Id="rId(\d+)"/g)) {
    const v = Number(t[1]);
    if (v > massimo) massimo = v;
  }
  const chiusura = relazioni.lastIndexOf("</Relationships>");
  if (chiusura === -1) throw new Error("word/_rels/document.xml.rels malformato.");

  pacchetto.scrivi(
    PARTE_RELAZIONI_DOCUMENTO,
    relazioni.slice(0, chiusura) +
      `<Relationship Id="rId${massimo + 1}" Type="${RELAZIONE_COMMENTI}" Target="comments.xml"/>` +
      relazioni.slice(chiusura),
  );
}
