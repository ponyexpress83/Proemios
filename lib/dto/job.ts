/**
 * DTO di Job editoriale e interventi.
 *
 * Qui passa il confine più delicato del prodotto: **nessuna informazione sulla
 * run AI raggiunge il cliente**. Il DTO cliente non ha campi per provider,
 * modello, costi, token, confidenza o motivazioni interne: non serve filtrarli,
 * perché non esistono in quell'oggetto.
 *
 * Simmetricamente, il DTO del redattore non ha campi commerciali.
 */
import type { InterventoEditoriale, JobEditoriale, RunAi } from "@/db/schema/produzione";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { NonAutorizzato } from "@/lib/auth/errori";
import { iso, sigilla } from "./comuni";

/**
 * Ciò che il cliente vede di una lavorazione: uno stato editoriale, non una
 * pipeline. Gli stati tecnici sono tradotti in avanzamento comprensibile.
 */
export type LavorazionePerCliente = {
  id: string;
  progettoId: string;
  servizio: string;
  /** Stato in linguaggio editoriale: in lavorazione | in revisione | consegnata… */
  fase: string;
  scadenzaAt: string | null;
  consegnataAt: string | null;
};

/** Ciò che vede il redattore nella sua lista e nel dettaglio Job. */
export type JobPerRedattore = {
  id: string;
  codice: string;
  progettoId: string;
  progettoCodice: string;
  livelloServizio: string;
  stato: string;
  conteggioParole: number | null;
  conteggioInterventi: number;
  conteggioDaVerificare: number;
  istruzioni: string | null;
  scadenzaAt: string | null;
  prioritaria: boolean;
  assegnatoAId: string | null;
  approvatoEditorialmenteAt: string | null;
};

/** Il responsabile editoriale vede in più il lato tecnico delle run. */
export type JobPerResponsabile = JobPerRedattore & {
  modalitaRevisione: string;
  fileVersionOrigineId: string | null;
  fileVersionEsitoId: string | null;
  erroreMessaggio: string | null;
  approvatoAt: string | null;
  consegnatoAt: string | null;
};

/** Traduzione degli stati tecnici in linguaggio editoriale per il cliente. */
const FASE_CLIENTE: Record<string, string> = {
  queued: "In coda",
  running: "In lavorazione",
  needs_review: "In revisione",
  needs_input: "In attesa di una tua risposta",
  editorially_approved: "In revisione",
  approved: "Pronta per la consegna",
  delivered: "Consegnata",
  failed: "In verifica",
  cancelled: "Annullata",
};

export function lavorazionePerCliente(job: JobEditoriale): LavorazionePerCliente {
  return sigilla({
    id: job.id,
    progettoId: job.projectId,
    servizio: job.livelloServizio,
    // `failed` diventa "In verifica": al cliente non serve sapere che una
    // elaborazione interna è fallita, gli serve sapere che ce ne stiamo occupando.
    fase: FASE_CLIENTE[job.stato] ?? "In lavorazione",
    scadenzaAt: iso(job.scadenzaAt),
    consegnataAt: iso(job.consegnatoAt),
  });
}

export function jobPerRedattore(job: JobEditoriale, progettoCodice: string): JobPerRedattore {
  return sigilla({
    id: job.id,
    codice: job.codice,
    progettoId: job.projectId,
    progettoCodice,
    livelloServizio: job.livelloServizio,
    stato: job.stato,
    conteggioParole: job.conteggioParole,
    conteggioInterventi: job.conteggioInterventi,
    conteggioDaVerificare: job.conteggioDaVerificare,
    istruzioni: job.istruzioni,
    scadenzaAt: iso(job.scadenzaAt),
    prioritaria: job.prioritaria,
    assegnatoAId: job.assegnatoAId,
    approvatoEditorialmenteAt: iso(job.approvatoEditorialmenteAt),
  });
}

export function jobPerResponsabile(job: JobEditoriale, progettoCodice: string): JobPerResponsabile {
  return sigilla({
    ...jobPerRedattore(job, progettoCodice),
    modalitaRevisione: job.modalitaRevisione,
    fileVersionOrigineId: job.fileVersionOrigineId,
    fileVersionEsitoId: job.fileVersionEsitoId,
    erroreMessaggio: job.erroreMessaggio,
    approvatoAt: iso(job.approvatoAt),
    consegnatoAt: iso(job.consegnatoAt),
  });
}

/* ── Interventi ───────────────────────────────────────────────────────── */

/**
 * L'intervento come lo vede il redattore. `confidenza` e `motivazioneInterna`
 * ci sono: gli servono per decidere in fretta su millequattrocento voci.
 */
export type InterventoPerRedattore = {
  id: string;
  categoria: string;
  ancora: InterventoEditoriale["ancora"];
  prima: string;
  dopo: string;
  confidenza: number;
  motivazioneInterna: string;
  commentoPerAutore: string | null;
  stato: string;
  testoModificato: string | null;
  rivistoAt: string | null;
};

export function interventoPerRedattore(i: InterventoEditoriale): InterventoPerRedattore {
  return sigilla({
    id: i.id,
    categoria: i.categoria,
    ancora: i.ancora,
    prima: i.prima,
    dopo: i.dopo,
    confidenza: i.confidenza,
    motivazioneInterna: i.motivazioneInterna,
    commentoPerAutore: i.commentoPerAutore,
    stato: i.stato,
    testoModificato: i.testoModificato,
    rivistoAt: iso(i.rivistoAt),
  });
}

/* ── Run AI ───────────────────────────────────────────────────────────── */

/**
 * La run come la vede il back-office. Non esiste una versione cliente di
 * questo DTO, di proposito: se un giorno servisse, andrebbe scritta da zero
 * con una decisione esplicita, non ottenuta togliendo campi da questa.
 */
export type RunPerBackOffice = {
  id: string;
  jobId: string;
  ruolo: string;
  stato: string;
  provider: string;
  modello: string;
  versionePrompt: string | null;
  motivazioniRouting: string[];
  tokenInput: number | null;
  tokenOutput: number | null;
  latenzaMs: number | null;
  tentativo: number;
  interventiProdotti: number;
  erroreMessaggio: string | null;
  iniziataAt: string | null;
  conclusaAt: string | null;
};

export function runDTO(attore: Attore, run: RunAi): RunPerBackOffice {
  if (!haPermesso(attore, "job.vedi_run_ai")) {
    throw new NonAutorizzato(`job.vedi_run_ai mancante per ruolo ${attore.ruolo}`);
  }
  const base = {
    id: run.id,
    jobId: run.jobId,
    ruolo: run.ruolo,
    stato: run.stato,
    provider: run.provider,
    modello: run.modello,
    versionePrompt: run.versionePrompt,
    motivazioniRouting: run.motivazioniRouting ?? [],
    tokenInput: run.tokenInput,
    tokenOutput: run.tokenOutput,
    latenzaMs: run.latenzaMs,
    tentativo: run.tentativo,
    interventiProdotti: run.interventiProdotti,
    erroreMessaggio: run.erroreMessaggio,
    iniziataAt: iso(run.iniziataAt),
    conclusaAt: iso(run.conclusaAt),
  };
  // Il costo ha un permesso suo: il responsabile editoriale guarda la qualità,
  // non il budget.
  return sigilla(
    haPermesso(attore, "job.vedi_costi_ai")
      ? { ...base, costoMicroCent: run.costoMicroCent }
      : base,
  );
}
