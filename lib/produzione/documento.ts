/**
 * Dall'approvazione editoriale al documento consegnabile.
 *
 * Questo modulo è il punto in cui gli interventi approvati diventano un file
 * Word vero. Tre vincoli lo governano, e nessuno dei tre è negoziabile:
 *
 *  1. **Si parte dal DOCX originale.** Il documento revisionato è una copia
 *     dell'originale con dentro le revisioni tracciate, non un file nuovo
 *     costruito dal testo estratto. Ricostruire significherebbe perdere stili,
 *     note, immagini e impaginazione di un manoscritto su cui l'autore ha
 *     lavorato per anni.
 *  2. **Nessun intervento resta in sospeso.** Un Job con interventi `pending`
 *     non ha finito la revisione: generare il documento a quel punto
 *     consegnerebbe una decisione che nessuno ha preso.
 *  3. **Un intervento saltato ferma la consegna, non il documento.** Il file
 *     viene comunque prodotto — serve al redattore per capire cosa è successo —
 *     ma nasce in stato `needs_review`, e la macchina a stati non lo lascia
 *     arrivare al cliente finché una persona non lo guarda.
 */
import type { Attore } from "@/lib/auth/attore";
import { esigiPermesso } from "@/lib/auth/guardie";
import { NonTrovato } from "@/lib/auth/errori";
import { generaDocumentoRevisionato, type InterventoApprovato } from "@/lib/docx/motore";
import {
  contenutoVersione,
  registraVersioneRevisionata,
  segnalaDaVerificare,
} from "@/lib/dati/file";
import { registra } from "@/lib/audit";

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Riga di intervento come la legge il generatore. Nessun campo di back-office. */
export type InterventoDeciso = {
  id: string;
  stato: string;
  ancora: { indice?: number; start?: number; end?: number } | null;
  prima: string;
  dopo: string;
  testoModificato: string | null;
  commentoPerAutore: string | null;
};

export type EsitoGenerazione = {
  versioneId: string;
  nomeFile: string;
  applicati: number;
  saltati: { interventoId: string; motivo: string }[];
  richiedeVerifica: boolean;
  notaVerifica?: string;
};

/**
 * Traduce le righe di `editorial_interventions` in interventi da applicare.
 *
 * Un intervento `modified` porta il testo scelto dal revisore, non quello
 * proposto dal modello: è la sostanza dell'anello umano. Un intervento
 * `rejected` non compare nel documento — è come se non fosse mai stato
 * proposto.
 */
export function interventiDaApplicare(righe: readonly InterventoDeciso[]): {
  pronti: InterventoApprovato[];
  pendenti: number;
  scartati: string[];
} {
  const pronti: InterventoApprovato[] = [];
  const scartati: string[] = [];
  let pendenti = 0;

  for (const r of righe) {
    if (r.stato === "pending") {
      pendenti += 1;
      continue;
    }
    if (r.stato !== "accepted" && r.stato !== "modified") continue;

    const indice = r.ancora?.indice;
    const inizio = r.ancora?.start;
    const fine = r.ancora?.end;
    if (
      typeof indice !== "number" ||
      typeof inizio !== "number" ||
      typeof fine !== "number" ||
      !Number.isInteger(indice) ||
      indice < 0
    ) {
      // Un'ancora incompleta non si indovina: senza posizione l'intervento non
      // si può applicare, e inventarne una scriverebbe nel punto sbagliato.
      scartati.push(r.id);
      continue;
    }

    const dopo = r.stato === "modified" ? (r.testoModificato ?? "") : r.dopo;
    if (dopo === r.prima) {
      // Una sostituzione identica non è una revisione: la si lascia fuori
      // invece di sporcare il documento con una modifica che non modifica.
      continue;
    }

    pronti.push({
      id: r.id,
      indiceParagrafo: indice,
      inizio,
      fine,
      prima: r.prima,
      dopo,
      commentoPerAutore: r.commentoPerAutore,
    });
  }

  return { pronti, pendenti, scartati };
}

/** Nome del file consegnato. Niente id interni, niente codici del back-office. */
export function nomeDocumentoRevisionato(nomeOriginale: string): string {
  const punto = nomeOriginale.lastIndexOf(".");
  const base = punto > 0 ? nomeOriginale.slice(0, punto) : nomeOriginale;
  return `${base} — revisionato.docx`;
}

/**
 * Genera la versione revisionata di un Job e la registra come nuova versione
 * del file, senza toccare l'originale.
 *
 * Non cambia lo stato del Job: la transizione è responsabilità del chiamante,
 * e tenerle separate significa che un errore nella generazione non lascia un
 * Job dichiarato approvato con dentro un documento che non esiste.
 */
export async function generaVersioneRevisionata(
  attore: Attore,
  parametri: {
    jobId: string;
    progettoId: string;
    fileVersionOrigineId: string;
    interventi: readonly InterventoDeciso[];
    autore: string;
  },
): Promise<EsitoGenerazione> {
  esigiPermesso(attore, "job.approva_editorialmente");

  const { pronti, pendenti, scartati } = interventiDaApplicare(parametri.interventi);
  if (pendenti > 0) {
    throw new Error(
      `Ci sono ${pendenti} interventi ancora da decidere: il documento si genera a revisione conclusa.`,
    );
  }

  const origine = await contenutoVersione(attore, parametri.fileVersionOrigineId);
  if (origine.mimeType !== MIME_DOCX) {
    throw new Error(
      "La generazione delle revisioni tracciate è disponibile solo per i documenti Word (.docx).",
    );
  }
  if (!origine.nomeFile) throw new NonTrovato("versione di origine senza nome file");

  const esito = await generaDocumentoRevisionato(origine.contenuto, pronti, {
    autore: parametri.autore,
  });

  const saltati = [
    ...esito.saltati,
    ...scartati.map((id) => ({ interventoId: id, motivo: "ancora incompleta o non valida" })),
  ];

  const versione = await registraVersioneRevisionata(attore, {
    progettoId: parametri.progettoId,
    nomeFile: nomeDocumentoRevisionato(origine.nomeFile),
    mimeType: MIME_DOCX,
    contenuto: esito.contenuto,
    precedenteId: parametri.fileVersionOrigineId,
    jobId: parametri.jobId,
    metadati: {
      interventiApplicati: esito.applicati,
      interventiSaltati: saltati.length,
    },
  });

  const richiedeVerifica = esito.richiedeVerifica || saltati.length > 0;
  const notaVerifica = richiedeVerifica
    ? (esito.notaVerifica ??
      `${saltati.length} interventi non sono stati applicati: il documento va controllato prima della consegna.`)
    : undefined;

  if (richiedeVerifica && notaVerifica) {
    await segnalaDaVerificare(attore, versione.id, notaVerifica);
  }

  await registra(attore, {
    azione: "documento.revisionato_generato",
    entita: "job",
    entitaId: parametri.jobId,
    metadati: {
      versioneId: versione.id,
      applicati: esito.applicati,
      saltati: saltati.length,
      richiedeVerifica,
    },
  });

  return {
    versioneId: versione.id,
    nomeFile: versione.nomeFile,
    applicati: esito.applicati,
    saltati,
    richiedeVerifica,
    notaVerifica,
  };
}
