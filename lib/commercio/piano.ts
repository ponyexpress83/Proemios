/**
 * Il piano di pagamento di un ordine.
 *
 * Modulo puro: nessun database, nessuna rete, nessuna dipendenza. Tutti gli
 * importi sono **interi in centesimi**. I decimali in virgola mobile sui soldi
 * producono errori che si accumulano — `0.1 + 0.2` non fa `0.3`, e su una rata
 * calcolata in percentuale la differenza arriva in fattura.
 *
 * Il tasso di acconto viene da `config/pricing.ts` e non si cambia da qui: è
 * una decisione commerciale già presa, e questo modulo la applica.
 */
import { DEPOSIT_RATE } from "@/config/pricing";

export type TipoPagamento = "acconto" | "saldo" | "milestone" | "personalizzato";

export type RataPianificata = {
  tipo: TipoPagamento;
  importoCent: number;
  /** Descrizione mostrata al cliente. Nessun riferimento interno. */
  descrizione: string;
  /** Milestone a cui la rata è legata, per i piani a stato avanzamento. */
  riferimentoMilestone?: string;
};

/** Acconto in punti base (4000 = 40%), dal listino approvato. */
export const ACCONTO_PUNTI_BASE = Math.round(DEPOSIT_RATE * 10_000);

/** Aliquota IVA ordinaria italiana, in punti base. */
export const IVA_PUNTI_BASE = 2200;

/**
 * Applica una percentuale espressa in punti base a un importo in centesimi.
 *
 * L'arrotondamento è a metà per eccesso, come in contabilità: l'importante è
 * che sia **una sola** regola, applicata sempre, e che le rate vengano poi
 * riconciliate sul totale (vedi `pianoPagamenti`).
 */
export function applicaPuntiBase(importoCent: number, puntiBase: number): number {
  if (!Number.isInteger(importoCent)) {
    throw new Error("Gli importi si esprimono in centesimi interi.");
  }
  return Math.round((importoCent * puntiBase) / 10_000);
}

/** Scorpora l'IVA da un imponibile. Restituisce imponibile, IVA e totale. */
export function conIva(
  imponibileCent: number,
  puntiBaseIva = IVA_PUNTI_BASE,
): { imponibileCent: number; ivaCent: number; totaleCent: number } {
  const ivaCent = applicaPuntiBase(imponibileCent, puntiBaseIva);
  return { imponibileCent, ivaCent, totaleCent: imponibileCent + ivaCent };
}

export type Milestone = {
  /** Identificativo della tappa a cui la rata è legata. */
  id: string;
  nome: string;
  /** Quota della tappa in punti base sul totale. */
  puntiBase: number;
};

export type RichiestaPiano = {
  totaleCent: number;
  /**
   * `acconto_saldo`: acconto alla firma, saldo alla consegna.
   * `milestone`: acconto e poi una rata per tappa.
   * `unica`: pagamento in una sola volta.
   * `personalizzato`: rate decise a mano, che devono comunque quadrare.
   */
  modalita: "acconto_saldo" | "milestone" | "unica" | "personalizzato";
  accontoPuntiBase?: number;
  milestone?: readonly Milestone[];
  rate?: readonly { importoCent: number; descrizione: string }[];
};

/**
 * Costruisce il piano.
 *
 * La regola che tiene insieme tutto: **la somma delle rate è esattamente il
 * totale**. Le percentuali arrotondate non ci arrivano da sole — 40% e 60% di
 * 33,33 € fanno 13,33 e 20,00, che sommano a 33,33 solo per fortuna. Perciò
 * l'ultima rata assorbe la differenza, e un test lo verifica su migliaia di
 * importi.
 */
export function pianoPagamenti(richiesta: RichiestaPiano): RataPianificata[] {
  const { totaleCent } = richiesta;
  if (!Number.isInteger(totaleCent) || totaleCent <= 0) {
    throw new Error("Il totale dev'essere un importo positivo in centesimi.");
  }

  const accontoPuntiBase = richiesta.accontoPuntiBase ?? ACCONTO_PUNTI_BASE;
  if (accontoPuntiBase < 0 || accontoPuntiBase > 10_000) {
    throw new Error("L'acconto dev'essere fra 0 e 100%.");
  }

  if (richiesta.modalita === "unica") {
    return [{ tipo: "saldo", importoCent: totaleCent, descrizione: "Pagamento del progetto" }];
  }

  if (richiesta.modalita === "personalizzato") {
    const rate = richiesta.rate ?? [];
    if (rate.length === 0)
      throw new Error("Un piano personalizzato ha bisogno di almeno una rata.");
    const somma = rate.reduce((t, r) => t + r.importoCent, 0);
    // Un piano personalizzato non si aggiusta da solo: se non quadra è un
    // errore di chi lo ha scritto, e va corretto prima di andare al cliente.
    if (somma !== totaleCent) {
      throw new Error(
        `Le rate sommano a ${somma} centesimi invece di ${totaleCent}: il piano non quadra.`,
      );
    }
    return rate.map((r) => ({
      tipo: "personalizzato" as const,
      importoCent: r.importoCent,
      descrizione: r.descrizione,
    }));
  }

  const accontoCent = applicaPuntiBase(totaleCent, accontoPuntiBase);
  const rate: RataPianificata[] = [];

  if (accontoCent > 0) {
    rate.push({
      tipo: "acconto",
      importoCent: accontoCent,
      descrizione: `Acconto ${(accontoPuntiBase / 100).toLocaleString("it-IT")}%`,
    });
  }

  if (richiesta.modalita === "milestone") {
    const tappe = richiesta.milestone ?? [];
    if (tappe.length === 0) {
      throw new Error("Un piano a milestone ha bisogno di almeno una tappa.");
    }
    const sommaPunti = tappe.reduce((t, m) => t + m.puntiBase, 0);
    if (sommaPunti !== 10_000) {
      throw new Error(`Le quote delle tappe sommano a ${sommaPunti} punti base invece di 10000.`);
    }
    const residuo = totaleCent - accontoCent;
    for (const tappa of tappe) {
      rate.push({
        tipo: "milestone",
        importoCent: applicaPuntiBase(residuo, tappa.puntiBase),
        descrizione: tappa.nome,
        riferimentoMilestone: tappa.id,
      });
    }
  } else {
    rate.push({
      tipo: "saldo",
      importoCent: totaleCent - accontoCent,
      descrizione: "Saldo alla consegna",
    });
  }

  return riconcilia(rate, totaleCent);
}

/**
 * Porta la somma delle rate esattamente sul totale, correggendo l'ultima.
 *
 * La differenza è al massimo di pochi centesimi e viene da arrotondamenti
 * successivi. Distribuirla su tutte le rate darebbe importi più "giusti" e
 * numeri illeggibili: metterla sull'ultima è la convenzione contabile normale,
 * ed è quella che il cliente si aspetta di vedere.
 */
function riconcilia(rate: RataPianificata[], totaleCent: number): RataPianificata[] {
  if (rate.length === 0) return rate;
  const somma = rate.reduce((t, r) => t + r.importoCent, 0);
  const differenza = totaleCent - somma;
  if (differenza === 0) return rate;

  const ultima = rate[rate.length - 1]!;
  const corretta = { ...ultima, importoCent: ultima.importoCent + differenza };
  if (corretta.importoCent < 0) {
    throw new Error("La riconciliazione produrrebbe una rata negativa: il piano non è valido.");
  }
  return [...rate.slice(0, -1), corretta];
}

/**
 * Quanto resta da incassare su un ordine.
 *
 * Un rimborso torna a essere dovuto: `importoRimborsatoCent` si sottrae
 * dall'incassato, non si somma al residuo come se fosse un pagamento nuovo.
 */
export function residuoDaIncassare(
  totaleCent: number,
  pagamenti: readonly {
    stato: string;
    importoCent: number;
    importoRimborsatoCent?: number | null;
  }[],
): number {
  const incassato = pagamenti
    .filter((p) => p.stato === "pagato")
    .reduce((t, p) => t + p.importoCent - (p.importoRimborsatoCent ?? 0), 0);
  return Math.max(0, totaleCent - incassato);
}

/** Un ordine è saldato quando non resta niente da incassare. */
export function ordineSaldato(
  totaleCent: number,
  pagamenti: readonly {
    stato: string;
    importoCent: number;
    importoRimborsatoCent?: number | null;
  }[],
): boolean {
  return residuoDaIncassare(totaleCent, pagamenti) === 0;
}
