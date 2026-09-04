/**
 * DTO di progetto.
 *
 * Il redattore riceve un oggetto costruito attorno al lavoro: codice, servizio,
 * istruzioni, scadenza. Non ha campi per il cliente, il prezzo o l'attribuzione
 * — non li ha nascosti, non li ha proprio.
 */
import type { Progetto } from "@/db/schema/progetti";
import type { Attore } from "@/lib/auth/attore";
import { haPermesso } from "@/lib/auth/attore";
import { iso, sigilla } from "./comuni";

/** Ciò che vede il redattore. */
export type ProgettoPerRedattore = {
  id: string;
  codice: string;
  /** Titolo di lavorazione: l'alias se c'è, altrimenti il titolo. */
  titolo: string;
  serviziSlug: string[];
  stato: string;
  conteggioParole: number | null;
  scadenzaAt: string | null;
  prioritaria: boolean;
  istruzioniEditoriali: string | null;
};

/** Ciò che vede il cliente sul proprio progetto. */
export type ProgettoPerCliente = {
  id: string;
  codice: string;
  titolo: string;
  percorsoSlug: string | null;
  serviziSlug: string[];
  stato: string;
  avanzamento: number;
  scadenzaAt: string | null;
  conclusoAt: string | null;
  createdAt: string | null;
};

/** Ciò che vede il back-office operativo. */
export type ProgettoPerStaff = ProgettoPerCliente & {
  clientId: string;
  organizationId: string;
  orderId: string | null;
  titoloAlias: string | null;
  projectManagerId: string | null;
  conteggioParole: number | null;
  prioritaria: boolean;
  istruzioniEditoriali: string | null;
  noteInterne: string | null;
  briefVerificatoAt: string | null;
};

export type ProgettoDTO = ProgettoPerRedattore | ProgettoPerCliente | ProgettoPerStaff;

export function progettoPerRedattore(p: Progetto): ProgettoPerRedattore {
  return sigilla({
    id: p.id,
    codice: p.codice,
    // Se esiste un alias, al redattore va quello: il titolo vero di un memoir
    // può identificare la famiglia di cui parla.
    titolo: p.titoloAlias ?? p.titolo,
    serviziSlug: p.serviziSlug ?? [],
    stato: p.stato,
    conteggioParole: p.conteggioParole,
    scadenzaAt: iso(p.scadenzaAt),
    prioritaria: p.prioritaria,
    istruzioniEditoriali: p.istruzioniEditoriali,
  });
}

export function progettoPerCliente(p: Progetto): ProgettoPerCliente {
  return sigilla({
    id: p.id,
    codice: p.codice,
    titolo: p.titolo,
    percorsoSlug: p.percorsoSlug,
    serviziSlug: p.serviziSlug ?? [],
    stato: p.stato,
    avanzamento: p.avanzamento,
    scadenzaAt: iso(p.scadenzaAt),
    conclusoAt: iso(p.conclusoAt),
    createdAt: iso(p.createdAt),
  });
}

export function progettoPerStaff(p: Progetto): ProgettoPerStaff {
  return sigilla({
    ...progettoPerCliente(p),
    clientId: p.clientId,
    organizationId: p.organizationId,
    orderId: p.orderId,
    titoloAlias: p.titoloAlias,
    projectManagerId: p.projectManagerId,
    conteggioParole: p.conteggioParole,
    prioritaria: p.prioritaria,
    istruzioniEditoriali: p.istruzioniEditoriali,
    noteInterne: p.noteInterne,
    briefVerificatoAt: iso(p.briefVerificatoAt),
  });
}

export function progettoDTO(attore: Attore, p: Progetto): ProgettoDTO {
  if (attore.ruolo === "client") return progettoPerCliente(p);
  if (attore.ruolo === "editor_reviewer") return progettoPerRedattore(p);
  if (haPermesso(attore, "progetto.vedi_tutti")) return progettoPerStaff(p);
  return progettoPerRedattore(p);
}
