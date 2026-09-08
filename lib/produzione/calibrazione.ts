/**
 * Calibrazione: quanto il modello e il redattore sono d'accordo.
 *
 * È il numero che dice **quando si può allentare un controllo**. Senza, la
 * decisione di automatizzare una categoria resta una sensazione: o non si
 * allenta mai per prudenza, o si allenta tutto dopo una settimana fortunata.
 *
 * La distinzione che regge il modulo è fra due modi di non essere d'accordo:
 *
 *  - **rifiutato**: il modello ha proposto una correzione dove non serviva.
 *    È un errore pieno.
 *  - **modificato**: il modello ha trovato il punto giusto e ha sbagliato le
 *    parole. È un successo parziale, e contarlo come un errore sottostima il
 *    modello in modo grossolano — su un editing, «hai visto il problema ma
 *    l'hai risolto male» vale molto più di «non hai visto niente».
 *
 * Modulo puro: nessun database.
 */

export type DecisionePresa = {
  categoria: string;
  confidenza: number;
  /** `accepted` | `modified` | `rejected`. Le `pending` non si contano. */
  stato: string;
};

export type Accordo = {
  proposti: number;
  accettati: number;
  modificati: number;
  rifiutati: number;
  /** Quota accettata senza toccare una parola. */
  accordoPieno: number;
  /** Quota in cui il punto era giusto, anche se le parole no. */
  accordoSulPunto: number;
};

export type AccordoPerCategoria = Accordo & { categoria: string };

export type FasciaConfidenza = "alta" | "media" | "bassa";

export type AccordoPerFascia = Accordo & { fascia: FasciaConfidenza };

/**
 * Fasce di confidenza.
 *
 * Il taglio a 0,7 è lo stesso del motore (`SOGLIA_DUBBIO`): sotto, un
 * intervento è già stato riclassificato come dubbio. Misurare con un confine
 * diverso da quello che governa il comportamento renderebbe i numeri
 * incomparabili con ciò che succede.
 */
export function fascia(confidenza: number): FasciaConfidenza {
  if (confidenza >= 0.9) return "alta";
  if (confidenza >= 0.7) return "media";
  return "bassa";
}

function conta(righe: readonly DecisionePresa[]): Accordo {
  const decise = righe.filter(
    (r) => r.stato === "accepted" || r.stato === "modified" || r.stato === "rejected",
  );
  const accettati = decise.filter((r) => r.stato === "accepted").length;
  const modificati = decise.filter((r) => r.stato === "modified").length;
  const rifiutati = decise.filter((r) => r.stato === "rejected").length;
  const proposti = decise.length;

  return {
    proposti,
    accettati,
    modificati,
    rifiutati,
    accordoPieno: proposti === 0 ? 0 : accettati / proposti,
    accordoSulPunto: proposti === 0 ? 0 : (accettati + modificati) / proposti,
  };
}

export function accordoPerCategoria(righe: readonly DecisionePresa[]): AccordoPerCategoria[] {
  const categorie = [...new Set(righe.map((r) => r.categoria))].sort();
  return (
    categorie
      .map((categoria) => ({
        categoria,
        ...conta(righe.filter((r) => r.categoria === categoria)),
      }))
      .filter((a) => a.proposti > 0)
      // Prima ciò su cui c'è più materiale: una categoria con tre voci non dice
      // niente, e metterla in cima inviterebbe a decidere su un campione vuoto.
      .sort((a, b) => b.proposti - a.proposti)
  );
}

export function accordoPerFascia(righe: readonly DecisionePresa[]): AccordoPerFascia[] {
  const ordine: FasciaConfidenza[] = ["alta", "media", "bassa"];
  return ordine
    .map((f) => ({ fascia: f, ...conta(righe.filter((r) => fascia(r.confidenza) === f)) }))
    .filter((a) => a.proposti > 0);
}

/**
 * Numero minimo di decisioni prima che un accordo significhi qualcosa.
 *
 * Non è statistica raffinata: è una difesa contro la tentazione di allentare un
 * controllo dopo dieci casi andati bene. Con meno di questi, il cruscotto
 * dichiara il campione insufficiente invece di mostrare una percentuale che
 * sembra un risultato.
 */
export const CAMPIONE_MINIMO = 100;

export type Raccomandazione =
  | { azione: "campione-insufficiente"; mancanti: number }
  | { azione: "continua-a-controllare"; motivo: string }
  | { azione: "puoi-allentare"; motivo: string };

/**
 * Cosa fare di una categoria, dato l'accordo misurato.
 *
 * Deliberatamente conservativa e deliberatamente **non automatica**: propone,
 * non esegue. Chi allenta un controllo deve poterlo scrivere in un verbale.
 */
export function raccomandazione(
  a: Accordo,
  opzioni: { campioneMinimo?: number; sogliaAllentamento?: number } = {},
): Raccomandazione {
  const minimo = opzioni.campioneMinimo ?? CAMPIONE_MINIMO;
  const soglia = opzioni.sogliaAllentamento ?? 0.98;

  if (a.proposti < minimo) {
    return { azione: "campione-insufficiente", mancanti: minimo - a.proposti };
  }
  if (a.accordoPieno >= soglia) {
    return {
      azione: "puoi-allentare",
      motivo: `${percentuale(a.accordoPieno)} accettati senza modifiche su ${a.proposti} decisioni`,
    };
  }
  if (a.rifiutati / a.proposti > 0.1) {
    return {
      azione: "continua-a-controllare",
      motivo: `${percentuale(a.rifiutati / a.proposti)} di proposte respinte: il modello sbaglia bersaglio troppo spesso`,
    };
  }
  return {
    azione: "continua-a-controllare",
    motivo: `accordo pieno al ${percentuale(a.accordoPieno)}, sotto la soglia del ${percentuale(soglia)}`,
  };
}

function percentuale(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
