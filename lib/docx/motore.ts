/**
 * Motore DOCX: produce il documento revisionato.
 *
 * Prende il DOCX originale e gli interventi approvati dal redattore, e
 * restituisce **una copia dell'originale** con dentro le revisioni tracciate di
 * Word e i commenti. Non ricostruisce nulla: apre il pacchetto, modifica
 * `word/document.xml` (e `word/comments.xml` se servono commenti) e richiude.
 *
 * Se una struttura non può essere gestita in sicurezza, l'intervento viene
 * saltato e segnalato: il capitolato è esplicito su questo punto, ed è la
 * scelta giusta anche a prescindere — un documento che Word deve riparare vale
 * meno di un intervento in meno.
 */
import { PacchettoDocx, PARTE_DOCUMENTO } from "./pacchetto";
import { leggiParagrafi } from "./ooxml";
import { applicaRevisioni, type InterventoDaApplicare } from "./revisioni";
import { scriviCommenti } from "./commenti";

export type InterventoApprovato = {
  id: string;
  /** Indice del paragrafo fra quelli con testo. */
  indiceParagrafo: number;
  inizio: number;
  fine: number;
  /** Testo atteso in quella posizione: serve a verificare l'allineamento. */
  prima: string;
  /** Testo sostitutivo, già tenendo conto delle modifiche del revisore. */
  dopo: string;
  commentoPerAutore?: string | null;
};

export type EsitoDocx = {
  contenuto: Buffer;
  applicati: number;
  saltati: { interventoId: string; motivo: string }[];
  /** Vero se il documento richiede una verifica umana prima della consegna. */
  richiedeVerifica: boolean;
  notaVerifica?: string;
};

export async function generaDocumentoRevisionato(
  originale: Buffer,
  interventi: readonly InterventoApprovato[],
  opzioni: { autore: string; data?: Date },
): Promise<EsitoDocx> {
  const pacchetto = await PacchettoDocx.apri(originale);
  const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

  const paragrafi = leggiParagrafi(xml).filter((p) => p.testo.trim().length > 0);
  const saltati: EsitoDocx["saltati"] = [];
  const daApplicare: InterventoDaApplicare[] = [];
  const mappaId = new Map<InterventoDaApplicare, string>();

  for (const i of interventi) {
    const paragrafo = paragrafi[i.indiceParagrafo];
    if (!paragrafo) {
      saltati.push({ interventoId: i.id, motivo: "paragrafo non più presente nel documento" });
      continue;
    }

    // Verifica di allineamento: il testo nel punto indicato dev'essere ancora
    // quello su cui il redattore ha deciso. Se il documento è cambiato — un
    // caricamento successivo, una versione diversa — applicare l'intervento
    // significherebbe correggere qualcosa che nessuno ha letto.
    const trovato = paragrafo.testo.slice(i.inizio, i.fine);
    if (trovato !== i.prima) {
      saltati.push({
        interventoId: i.id,
        motivo: "il testo nel punto indicato non è più quello approvato",
      });
      continue;
    }

    const intervento: InterventoDaApplicare = {
      indiceParagrafo: i.indiceParagrafo,
      inizio: i.inizio,
      fine: i.fine,
      dopo: i.dopo,
      commento: i.commentoPerAutore ?? undefined,
    };
    daApplicare.push(intervento);
    mappaId.set(intervento, i.id);
  }

  const data = opzioni.data ?? new Date();
  const esito = applicaRevisioni(xml, daApplicare, { autore: opzioni.autore, data });

  for (const s of esito.saltati) {
    saltati.push({
      interventoId: mappaId.get(s.intervento) ?? "sconosciuto",
      motivo: s.motivo,
    });
  }

  pacchetto.scrivi(PARTE_DOCUMENTO, esito.xml);

  if (esito.commenti.length > 0) {
    await scriviCommenti(
      pacchetto,
      esito.commenti.map((c) => ({
        id: c.id,
        testo: c.testo,
        autore: opzioni.autore,
        iniziali: opzioni.autore
          .split(/\s+/)
          .slice(0, 3)
          .map((p) => p[0]?.toUpperCase() ?? "")
          .join(""),
        data,
      })),
    );
  }

  const contenuto = await pacchetto.salva();

  // Se qualcosa è stato saltato, il documento va guardato da una persona prima
  // di partire: il cliente riceverebbe meno correzioni di quelle approvate,
  // senza saperlo.
  const richiedeVerifica = saltati.length > 0;

  return {
    contenuto,
    applicati: esito.applicati,
    saltati,
    richiedeVerifica,
    notaVerifica: richiedeVerifica
      ? `${saltati.length} interventi su ${interventi.length} non sono stati applicati al documento. Verificare prima della consegna.`
      : undefined,
  };
}
