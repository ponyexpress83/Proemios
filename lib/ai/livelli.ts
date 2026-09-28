/**
 * I livelli di intervento editoriale e i loro limiti.
 *
 * Il livello acquistato non è un'etichetta: è un **vincolo sul motore**. Chi
 * compra una correzione bozze non deve ricevere un testo riscritto, e non
 * perché il prompt lo chiede gentilmente — perché gli interventi fuori
 * categoria vengono scartati prima di arrivare al revisore.
 *
 * Modulo puro: nessuna dipendenza, testabile per intero.
 */
import type { InterventoEditoriale } from "@/db/schema/produzione";

export const LIVELLI = [
  "correzione-bozze",
  "revisione-linguistica",
  "editing-stilistico",
  "editing-narrativo",
] as const;

export type LivelloServizio = (typeof LIVELLI)[number];

export const CATEGORIE = [
  "refuso",
  "ortografia",
  "punteggiatura",
  "grammatica",
  "sintassi",
  "ripetizione",
  "uniformita-tipografica",
  "stile",
  "dubbio-da-verificare",
] as const;

export type CategoriaIntervento = (typeof CATEGORIE)[number];

/**
 * Categorie ammesse per livello. Sono cumulative: ogni livello comprende il
 * precedente e aggiunge qualcosa.
 */
export const CATEGORIE_AMMESSE: Record<LivelloServizio, readonly CategoriaIntervento[]> = {
  "correzione-bozze": [
    "refuso",
    "ortografia",
    "punteggiatura",
    "grammatica",
    "uniformita-tipografica",
    "dubbio-da-verificare",
  ],
  "revisione-linguistica": [
    "refuso",
    "ortografia",
    "punteggiatura",
    "grammatica",
    "uniformita-tipografica",
    "sintassi",
    "ripetizione",
    "dubbio-da-verificare",
  ],
  "editing-stilistico": [
    "refuso",
    "ortografia",
    "punteggiatura",
    "grammatica",
    "uniformita-tipografica",
    "sintassi",
    "ripetizione",
    "stile",
    "dubbio-da-verificare",
  ],
  "editing-narrativo": CATEGORIE,
};

/**
 * Invasività massima per livello, come rapporto fra lunghezza del testo
 * sostituito e lunghezza dell'originale.
 *
 * Una correzione bozze che allunga o accorcia una frase del 60% non è una
 * correzione: è una riscrittura travestita. La soglia è generosa perché una
 * singola parola corretta può cambiare molto in proporzione, ma taglia i casi
 * in cui il modello ha "migliorato" un periodo intero.
 */
export const INVASIVITA_MASSIMA: Record<LivelloServizio, number> = {
  "correzione-bozze": 0.35,
  "revisione-linguistica": 0.8,
  "editing-stilistico": 2.5,
  "editing-narrativo": Number.POSITIVE_INFINITY,
};

/** Lunghezza massima, in caratteri, di un singolo intervento per livello. */
export const LUNGHEZZA_MASSIMA_INTERVENTO: Record<LivelloServizio, number> = {
  "correzione-bozze": 120,
  "revisione-linguistica": 400,
  "editing-stilistico": 1_500,
  "editing-narrativo": 6_000,
};

export const ETICHETTA_LIVELLO: Record<LivelloServizio, string> = {
  "correzione-bozze": "Correzione bozze",
  "revisione-linguistica": "Revisione linguistica",
  "editing-stilistico": "Editing stilistico",
  "editing-narrativo": "Editing narrativo",
};

export const ETICHETTA_CATEGORIA: Record<CategoriaIntervento, string> = {
  refuso: "Refuso",
  ortografia: "Ortografia",
  punteggiatura: "Punteggiatura",
  grammatica: "Grammatica",
  sintassi: "Sintassi",
  ripetizione: "Ripetizione",
  "uniformita-tipografica": "Uniformità tipografica",
  stile: "Stile",
  "dubbio-da-verificare": "Da verificare",
};

export type InterventoGrezzo = {
  categoria: string;
  prima: string;
  dopo: string;
  confidenza: number;
  motivazioneInterna: string;
  ancora?: Record<string, unknown>;
};

export type EsitoFiltro = {
  ammessi: InterventoGrezzo[];
  scartati: { intervento: InterventoGrezzo; motivo: string }[];
};

/**
 * Applica i limiti del livello. Restituisce anche gli scarti con il motivo:
 * servono al responsabile editoriale per capire se il modello sta lavorando
 * fuori mandato, e a decidere se il livello acquistato è quello giusto.
 */
export function applicaLimiti(
  livello: LivelloServizio,
  interventi: readonly InterventoGrezzo[],
): EsitoFiltro {
  const ammesse = new Set<string>(CATEGORIE_AMMESSE[livello]);
  const invasivitaMax = INVASIVITA_MASSIMA[livello];
  const lunghezzaMax = LUNGHEZZA_MASSIMA_INTERVENTO[livello];

  const ammessi: InterventoGrezzo[] = [];
  const scartati: EsitoFiltro["scartati"] = [];

  for (const i of interventi) {
    if (!ammesse.has(i.categoria)) {
      scartati.push({
        intervento: i,
        motivo: `categoria "${i.categoria}" fuori dal livello ${livello}`,
      });
      continue;
    }

    if (i.prima === i.dopo) {
      scartati.push({ intervento: i, motivo: "intervento nullo: prima e dopo coincidono" });
      continue;
    }

    if (i.dopo.length > lunghezzaMax) {
      scartati.push({
        intervento: i,
        motivo: `sostituzione di ${i.dopo.length} caratteri, oltre il limite di ${lunghezzaMax}`,
      });
      continue;
    }

    // Su interventi molto brevi il rapporto è poco significativo: correggere
    // "e" in "è" è un cambiamento del 100% che nessuno definirebbe invasivo.
    if (i.prima.length >= 12 && Number.isFinite(invasivitaMax)) {
      const scostamento = Math.abs(i.dopo.length - i.prima.length) / i.prima.length;
      if (scostamento > invasivitaMax) {
        scartati.push({
          intervento: i,
          motivo: `scostamento del ${Math.round(scostamento * 100)}% oltre il limite del livello`,
        });
        continue;
      }
    }

    if (i.confidenza < 0 || i.confidenza > 1 || !Number.isFinite(i.confidenza)) {
      scartati.push({ intervento: i, motivo: "confidenza fuori intervallo" });
      continue;
    }

    ammessi.push(i);
  }

  return { ammessi, scartati };
}

/**
 * Un intervento a bassa confidenza non viene scartato: diventa un dubbio da
 * verificare, che è esattamente il modo in cui un redattore vuole vederlo.
 * Sotto questa soglia il revisore deve guardarlo per forza.
 */
export const SOGLIA_DUBBIO = 0.7;

export function riclassificaDubbi(
  interventi: readonly InterventoGrezzo[],
): InterventoGrezzo[] {
  return interventi.map((i) =>
    i.confidenza < SOGLIA_DUBBIO && i.categoria !== "dubbio-da-verificare"
      ? { ...i, categoria: "dubbio-da-verificare" }
      : i,
  );
}

export type { InterventoEditoriale };
