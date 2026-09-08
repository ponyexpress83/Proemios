/**
 * Macchina a stati del Job editoriale.
 *
 * Il vincolo di prodotto che questa macchina rende impossibile da violare:
 * **nessun Job raggiunge `delivered` senza passare da `editorially_approved`
 * e `approved`**. Non è una raccomandazione nel codice della pipeline: è una
 * transizione che non esiste.
 *
 * Modulo puro, testato per intero.
 */

export const STATI_JOB = [
  "queued",
  "running",
  "needs_review",
  "needs_input",
  "editorially_approved",
  "approved",
  "delivered",
  "failed",
  "cancelled",
] as const;

export type StatoJob = (typeof STATI_JOB)[number];

export const TRANSIZIONI_JOB: Record<StatoJob, readonly StatoJob[]> = {
  // In coda: parte, o viene annullato prima di partire.
  queued: ["running", "cancelled"],
  // In esecuzione: finisce in revisione, chiede un'informazione, o fallisce.
  running: ["needs_review", "needs_input", "failed", "cancelled"],
  // In revisione: il redattore approva editorialmente, chiede un chiarimento,
  // o rimanda in lavorazione (rigenerazione).
  needs_review: ["editorially_approved", "needs_input", "running", "cancelled"],
  // In attesa di una risposta: torna in lavorazione o in revisione.
  needs_input: ["running", "needs_review", "cancelled"],
  // Approvato editorialmente: manca l'approvazione operativa. Può tornare
  // indietro se in revisione operativa emerge un problema.
  editorially_approved: ["approved", "needs_review", "cancelled"],
  // Approvato: si consegna, oppure si torna indietro prima di consegnare.
  approved: ["delivered", "needs_review", "cancelled"],
  // Consegnato: stato terminale. Un rifacimento è un Job nuovo, non questo
  // riaperto: la storia di ciò che è stato consegnato non si riscrive.
  delivered: [],
  // Fallito: si può ritentare.
  failed: ["queued", "cancelled"],
  cancelled: [],
} as const;

export function transizioneAmmessa(da: StatoJob, a: StatoJob): boolean {
  return TRANSIZIONI_JOB[da].includes(a);
}

export function statiRaggiungibili(da: StatoJob): readonly StatoJob[] {
  return TRANSIZIONI_JOB[da];
}

export function isTerminale(stato: StatoJob): boolean {
  return TRANSIZIONI_JOB[stato].length === 0;
}

/**
 * Chi può portare il Job in un certo stato, espresso come permesso richiesto.
 * `null` significa che la transizione è compiuta dal sistema (il worker), non
 * da una persona.
 */
export const PERMESSO_PER_TRANSIZIONE: Record<StatoJob, string | null> = {
  queued: "job.assegna",
  running: null,
  needs_review: null,
  needs_input: "job.richiedi_chiarimento",
  editorially_approved: "job.approva_editorialmente",
  approved: "progetto.approva_consegna",
  delivered: "progetto.consegna_al_cliente",
  failed: null,
  cancelled: "job.assegna",
};

/**
 * Verifica che il percorso verso la consegna sia stato percorso per intero.
 * Serve come cintura di sicurezza sopra la macchina a stati, nel punto in cui
 * la consegna viene effettivamente eseguita.
 */
export function puoEssereConsegnato(job: {
  stato: StatoJob;
  approvatoEditorialmenteAt: Date | string | null;
  approvatoAt: Date | string | null;
}): { ok: true } | { ok: false; motivo: string } {
  if (job.stato !== "approved") {
    return { ok: false, motivo: `il Job è in stato ${job.stato}, non "approved"` };
  }
  if (!job.approvatoEditorialmenteAt) {
    return { ok: false, motivo: "manca l'approvazione editoriale" };
  }
  if (!job.approvatoAt) {
    return { ok: false, motivo: "manca l'approvazione operativa" };
  }
  return { ok: true };
}

/** Etichette per il back-office. Al cliente arrivano da lib/dto/job.ts. */
export const ETICHETTA_STATO_JOB: Record<StatoJob, string> = {
  queued: "In coda",
  running: "In elaborazione",
  needs_review: "Da rivedere",
  needs_input: "Attende un chiarimento",
  editorially_approved: "Approvato editorialmente",
  approved: "Approvato",
  delivered: "Consegnato",
  failed: "Fallito",
  cancelled: "Annullato",
};
