/**
 * Contratto degli adapter di provider AI.
 *
 * Il motore editoriale non conosce nessun SDK: chiede a un `ProviderAi` di
 * eseguire una richiesta strutturata e riceve interventi già validati. Questo
 * permette di aggiungere un fornitore senza toccare la pipeline, e di far
 * girare i test senza rete né chiavi.
 *
 * Nessun adapter registra il prompt nei log: il testo dell'opera passa da qui
 * ed è la cosa più delicata che la piattaforma tratti.
 */
import { z } from "zod";
import type { DefinizioneModello } from "@/config/modelli";
import { CATEGORIE } from "./livelli";

/** Ciò che il modello deve restituire. Nessun testo libero fuori da questo schema. */
export const schemaInterventoAi = z.object({
  categoria: z.enum(CATEGORIE),
  /** Il frammento esatto da sostituire, così com'è nel testo. */
  prima: z.string().min(1).max(8_000),
  dopo: z.string().max(8_000),
  confidenza: z.number().min(0).max(1),
  motivazione: z.string().min(1).max(1_000),
  /** Indice di paragrafo, per ritrovare l'ancora nel documento. */
  paragrafo: z.number().int().nonnegative().optional(),
  /** Occorrenza del frammento dentro il paragrafo, se ripetuto. */
  occorrenza: z.number().int().nonnegative().optional(),
});

export type InterventoAi = z.infer<typeof schemaInterventoAi>;

export const schemaRispostaAi = z.object({
  interventi: z.array(schemaInterventoAi).max(20_000),
  /** Nota complessiva del modello. Non esce mai verso il cliente. */
  notaInterna: z.string().max(4_000).optional(),
});

export type RispostaAi = z.infer<typeof schemaRispostaAi>;

export type RichiestaProvider = {
  modello: DefinizioneModello;
  istruzioniSistema: string;
  /** Il testo da lavorare, già segmentato. */
  contenuto: string;
  /** Limite di token in uscita. */
  massimoToken: number;
  temperatura?: number;
};

export type EsitoProvider = {
  risposta: RispostaAi;
  tokenInput: number;
  tokenOutput: number;
  latenzaMs: number;
};

export class ErroreProvider extends Error {
  readonly tipo:
    | "credenziali-mancanti"
    | "limite-richieste"
    | "risposta-non-valida"
    | "timeout"
    | "provider";
  readonly ritentabile: boolean;

  constructor(
    tipo: ErroreProvider["tipo"],
    messaggio: string,
    ritentabile = false,
  ) {
    super(messaggio);
    this.name = "ErroreProvider";
    this.tipo = tipo;
    this.ritentabile = ritentabile;
  }
}

export interface ProviderAi {
  readonly nome: string;
  /** Vero se le credenziali sono configurate. Il router non lo sa: lo sa qui. */
  configurato(): boolean;
  esegui(richiesta: RichiestaProvider): Promise<EsitoProvider>;
}

/**
 * Estrae il JSON da una risposta che potrebbe contenere testo attorno.
 * I modelli, nonostante le istruzioni, ogni tanto premettono una riga di
 * cortesia: preferisco recuperarla piuttosto che far fallire un Job da
 * ottantamila parole per una frase di troppo.
 */
export function estraiJson(testo: string): unknown {
  const pulito = testo.trim();
  try {
    return JSON.parse(pulito);
  } catch {
    // Blocco recintato con ```json.
    const recinto = pulito.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (recinto?.[1]) {
      try {
        return JSON.parse(recinto[1].trim());
      } catch {
        /* si prova l'ultima strada */
      }
    }
    const inizio = pulito.indexOf("{");
    const fine = pulito.lastIndexOf("}");
    if (inizio !== -1 && fine > inizio) {
      return JSON.parse(pulito.slice(inizio, fine + 1));
    }
    throw new ErroreProvider(
      "risposta-non-valida",
      "Il modello non ha restituito JSON interpretabile.",
    );
  }
}

/** Valida la risposta con lo schema. Un modello fuori formato è un errore ritentabile. */
export function validaRisposta(grezza: unknown): RispostaAi {
  const esito = schemaRispostaAi.safeParse(grezza);
  if (!esito.success) {
    throw new ErroreProvider(
      "risposta-non-valida",
      `Risposta fuori schema: ${esito.error.issues[0]?.message ?? "struttura non valida"}`,
      true,
    );
  }
  return esito.data;
}
