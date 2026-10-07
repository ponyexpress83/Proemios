/**
 * Ancoraggio degli interventi al testo.
 *
 * Il modello dice «sostituisci "acuqa" con "acqua" nel paragrafo 12». Qui si
 * verifica che quel frammento **esista davvero** in quel paragrafo, e a quale
 * posizione esatta. Senza questa verifica un intervento allucinato — un
 * frammento che il modello ha ricordato male, o inventato — finirebbe nel
 * documento come una sostituzione che non trova niente, o peggio, che trova
 * qualcos'altro.
 *
 * Modulo puro.
 */
import type { Paragrafo } from "./segmentazione";

export type Ancora = {
  indiceParagrafo: number;
  /** Posizione di inizio nel testo del paragrafo. */
  inizio: number;
  fine: number;
  idOoxml?: string;
};

export type EsitoAncoraggio =
  | { ok: true; ancora: Ancora }
  | { ok: false; motivo: string };

/**
 * Trova un frammento in un paragrafo.
 *
 * `occorrenza` conta le apparizioni: in un paragrafo che dice «la casa era la
 * casa di sempre», correggere la seconda "la casa" e non la prima cambia il
 * risultato. Se l'occorrenza indicata non esiste, l'intervento viene rifiutato
 * invece di essere applicato alla prima disponibile — applicarlo altrove è
 * peggio che non applicarlo.
 */
export function ancora(
  paragrafi: readonly Paragrafo[],
  richiesta: { paragrafo?: number; prima: string; occorrenza?: number },
): EsitoAncoraggio {
  const frammento = richiesta.prima;
  if (frammento.length === 0) return { ok: false, motivo: "frammento vuoto" };

  const candidati =
    typeof richiesta.paragrafo === "number"
      ? paragrafi.filter((p) => p.indice === richiesta.paragrafo)
      : paragrafi;

  if (candidati.length === 0) {
    return { ok: false, motivo: `paragrafo ${richiesta.paragrafo} inesistente` };
  }

  for (const p of candidati) {
    const posizioni: number[] = [];
    let da = p.testo.indexOf(frammento);
    while (da !== -1) {
      posizioni.push(da);
      da = p.testo.indexOf(frammento, da + 1);
    }
    if (posizioni.length === 0) continue;

    const indiceOccorrenza = richiesta.occorrenza ?? 0;
    const inizio = posizioni[indiceOccorrenza];
    if (inizio === undefined) {
      return {
        ok: false,
        motivo: `occorrenza ${indiceOccorrenza} non trovata: il frammento compare ${posizioni.length} volte`,
      };
    }

    return {
      ok: true,
      ancora: {
        indiceParagrafo: p.indice,
        inizio,
        fine: inizio + frammento.length,
        idOoxml: p.idOoxml,
      },
    };
  }

  return {
    ok: false,
    motivo:
      typeof richiesta.paragrafo === "number"
        ? `frammento non presente nel paragrafo ${richiesta.paragrafo}`
        : "frammento non presente nel testo",
  };
}

/**
 * Rileva le sovrapposizioni fra interventi sullo stesso paragrafo.
 *
 * Due interventi che insistono sugli stessi caratteri non possono essere
 * applicati entrambi: il secondo lavorerebbe su un testo che il primo ha già
 * cambiato. Vengono segnalati al revisore, che sceglie quale tenere — non
 * risolti d'ufficio, perché quale dei due sia quello giusto è una decisione
 * editoriale.
 */
export function trovaSovrapposizioni<T extends { ancora: Ancora }>(
  interventi: readonly T[],
): { conflitti: [T, T][]; indipendenti: T[] } {
  const conflitti: [T, T][] = [];
  const inConflitto = new Set<T>();

  const perParagrafo = new Map<number, T[]>();
  for (const i of interventi) {
    const lista = perParagrafo.get(i.ancora.indiceParagrafo) ?? [];
    lista.push(i);
    perParagrafo.set(i.ancora.indiceParagrafo, lista);
  }

  for (const lista of perParagrafo.values()) {
    const ordinati = [...lista].sort((a, b) => a.ancora.inizio - b.ancora.inizio);
    for (let i = 0; i < ordinati.length - 1; i++) {
      const a = ordinati[i]!;
      const b = ordinati[i + 1]!;
      if (b.ancora.inizio < a.ancora.fine) {
        conflitti.push([a, b]);
        inConflitto.add(a);
        inConflitto.add(b);
      }
    }
  }

  return {
    conflitti,
    indipendenti: interventi.filter((i) => !inConflitto.has(i)),
  };
}

/**
 * Applica gli interventi a un paragrafo, dal fondo verso l'inizio.
 *
 * L'ordine è essenziale: applicando dall'inizio, ogni sostituzione sposta le
 * posizioni di tutte quelle successive. Partendo dalla fine, gli offset dei
 * restanti restano validi.
 */
export function applicaAlParagrafo(
  testo: string,
  interventi: readonly { ancora: Ancora; dopo: string }[],
): string {
  const ordinati = [...interventi].sort((a, b) => b.ancora.inizio - a.ancora.inizio);
  let risultato = testo;
  for (const i of ordinati) {
    risultato = risultato.slice(0, i.ancora.inizio) + i.dopo + risultato.slice(i.ancora.fine);
  }
  return risultato;
}
