/**
 * Metriche oggettive calcolate in locale.
 *
 * Il brief è esplicito: conteggio parole e metriche misurabili NON si chiedono
 * al modello (che non conta bene). Qui si calcolano deterministicamente; al
 * modello resta il giudizio editoriale, che è il suo mestiere.
 */

export interface MetricheTesto {
  parole: number;
  frasi: number;
  lettere: number;
  parolePerFrase: number;
  /** Indice Gulpease: leggibilità tarata sull'italiano, 0-100. */
  gulpease: number;
  /** Pagine stimate del libro finito. */
  pagineStimate: number;
  /** Quota di frasi oltre 35 parole: proxy del "periodare lungo". */
  quotaFrasiLunghe: number;
}

const PAROLE_PER_PAGINA = 300;

export function contaParole(testo: string): number {
  const t = testo.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function spezzaFrasi(testo: string): string[] {
  return testo
    .split(/[.!?…]+(?:\s|$)/u)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

/**
 * Indice Gulpease (Lucisano-Piemontese), l'equivalente italiano del Flesch.
 *   89 + (300 × frasi − 10 × lettere) / parole
 * Sopra 80: molto facile. 60-80: facile. 40-60: medio. Sotto 40: difficile.
 */
export function gulpease(parole: number, frasi: number, lettere: number): number {
  if (parole === 0) return 0;
  const indice = 89 + (300 * frasi - 10 * lettere) / parole;
  return Math.max(0, Math.min(100, Math.round(indice)));
}

export function calcolaMetriche(testo: string): MetricheTesto {
  const parole = contaParole(testo);
  const listaFrasi = spezzaFrasi(testo);
  const frasi = Math.max(1, listaFrasi.length);
  const lettere = (testo.match(/\p{L}/gu) ?? []).length;

  const frasiLunghe = listaFrasi.filter((f) => contaParole(f) > 35).length;

  return {
    parole,
    frasi,
    lettere,
    parolePerFrase: parole === 0 ? 0 : Math.round((parole / frasi) * 10) / 10,
    gulpease: gulpease(parole, frasi, lettere),
    pagineStimate: Math.max(1, Math.ceil(parole / PAROLE_PER_PAGINA)),
    quotaFrasiLunghe:
      listaFrasi.length === 0 ? 0 : Math.round((frasiLunghe / listaFrasi.length) * 100),
  };
}

/** Etichetta leggibile per l'indice Gulpease. */
export function etichettaGulpease(valore: number): string {
  if (valore >= 80) return "Molto scorrevole";
  if (valore >= 60) return "Scorrevole";
  if (valore >= 40) return "Impegnativo";
  return "Molto impegnativo";
}
