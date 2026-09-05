/**
 * Coerenza fra le condizioni contrattuali di un provider e le approvazioni.
 *
 * Modulo **puro**, separato dal livello dati di proposito: lo importa anche il
 * form nel browser, e un import di valore verso `lib/dati/` trascinerebbe
 * Drizzle e il driver Postgres dentro il bundle client. Qui non c'è nessuna
 * dipendenza.
 */
import type { Provider } from "@/config/modelli";

export type DatiPolicy = {
  provider: Provider;
  addestramentoConsentito: boolean;
  zeroDataRetention: boolean;
  giorniConservazione: number | null;
  dpaDisponibile: boolean;
  regioneDati: string;
  subresponsabili: string[];
  approvatoManoscrittiInediti: boolean;
  approvatoProgettiSensibili: boolean;
  note: string;
};

/**
 * Regole di coerenza fra le condizioni dichiarate e le approvazioni.
 *
 * Il router rifiuterebbe comunque una combinazione incoerente, ma lasciarla
 * salvare significherebbe avere in database una riga che dice «approvato» e si
 * comporta da «non approvato»: chi la legge fra sei mesi non capisce perché i
 * Job falliscono. Meglio impedire lo stato che spiegarlo dopo.
 *
 * Modulo puro: nessun database, testabile da solo.
 */
export function incoerenzePolicy(dati: DatiPolicy): string[] {
  const problemi: string[] = [];
  const approvaQualcosa = dati.approvatoManoscrittiInediti || dati.approvatoProgettiSensibili;

  if (approvaQualcosa && !dati.dpaDisponibile) {
    problemi.push("non si approva un fornitore senza un DPA firmato");
  }
  if (approvaQualcosa && dati.addestramentoConsentito) {
    problemi.push(
      "non si approva un fornitore che si riserva di addestrare i propri modelli sui dati",
    );
  }
  // I progetti sensibili sono un sottoinsieme più delicato dei manoscritti
  // inediti: approvare i primi senza i secondi è quasi sempre una svista.
  if (dati.approvatoProgettiSensibili && !dati.approvatoManoscrittiInediti) {
    problemi.push(
      "i progetti sensibili non si approvano senza approvare anche i manoscritti inediti",
    );
  }
  if (
    dati.approvatoProgettiSensibili &&
    !dati.zeroDataRetention &&
    (dati.giorniConservazione ?? Infinity) > 0
  ) {
    problemi.push(
      "un progetto sensibile richiede che il fornitore non conservi i dati (zero data retention)",
    );
  }
  return problemi;
}
