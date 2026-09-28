/**
 * Adapter OpenAI.
 *
 * Stesse regole dell'adapter Anthropic: nessun prompt nei log, errori
 * sanitizzati e classificati come ritentabili o no.
 */
import OpenAI from "openai";
import {
  ErroreProvider,
  estraiJson,
  validaRisposta,
  type EsitoProvider,
  type ProviderAi,
  type RichiestaProvider,
} from "./provider";

export class ProviderOpenAi implements ProviderAi {
  readonly nome = "openai";
  private client: OpenAI | null = null;

  configurato(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private ottieniClient(): OpenAI {
    if (!this.configurato()) {
      throw new ErroreProvider("credenziali-mancanti", "OPENAI_API_KEY non impostata.");
    }
    this.client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return this.client;
  }

  async esegui(richiesta: RichiestaProvider): Promise<EsitoProvider> {
    const client = this.ottieniClient();
    const inizio = Date.now();

    try {
      const risposta = await client.chat.completions.create({
        model: richiesta.modello.modello,
        max_completion_tokens: richiesta.massimoToken,
        temperature: richiesta.temperatura ?? 0,
        // Il formato JSON è imposto dal fornitore, non solo chiesto nel prompt:
        // una risposta fuori formato è un Job da rifare.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: richiesta.istruzioniSistema },
          { role: "user", content: richiesta.contenuto },
        ],
      });

      const testo = risposta.choices[0]?.message?.content;
      if (!testo) {
        throw new ErroreProvider("risposta-non-valida", "Risposta senza contenuto.", true);
      }

      return {
        risposta: validaRisposta(estraiJson(testo)),
        tokenInput: risposta.usage?.prompt_tokens ?? 0,
        tokenOutput: risposta.usage?.completion_tokens ?? 0,
        latenzaMs: Date.now() - inizio,
      };
    } catch (errore) {
      throw traduciErrore(errore);
    }
  }
}

function traduciErrore(errore: unknown): ErroreProvider {
  if (errore instanceof ErroreProvider) return errore;

  const stato = (errore as { status?: number }).status;
  if (stato === 401 || stato === 403) {
    return new ErroreProvider("credenziali-mancanti", "Credenziali rifiutate dal provider.");
  }
  if (stato === 429) {
    return new ErroreProvider("limite-richieste", "Limite di richieste raggiunto.", true);
  }
  if (stato === 408 || stato === 504) {
    return new ErroreProvider("timeout", "Il provider non ha risposto in tempo.", true);
  }
  if (typeof stato === "number" && stato >= 500) {
    return new ErroreProvider("provider", `Errore del provider (${stato}).`, true);
  }
  return new ErroreProvider("provider", "Chiamata al provider non riuscita.");
}
