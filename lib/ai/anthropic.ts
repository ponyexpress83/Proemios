/**
 * Adapter Anthropic.
 *
 * Non registra il prompt né la risposta nei log: contengono il testo dell'opera.
 * Gli errori riportati verso l'alto sono sanitizzati e classificati, così il
 * motore sa se ha senso ritentare.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  ErroreProvider,
  estraiJson,
  validaRisposta,
  type EsitoProvider,
  type ProviderAi,
  type RichiestaProvider,
} from "./provider";

export class ProviderAnthropic implements ProviderAi {
  readonly nome = "anthropic";
  private client: Anthropic | null = null;

  configurato(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  private ottieniClient(): Anthropic {
    if (!this.configurato()) {
      throw new ErroreProvider("credenziali-mancanti", "ANTHROPIC_API_KEY non impostata.");
    }
    this.client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return this.client;
  }

  async esegui(richiesta: RichiestaProvider): Promise<EsitoProvider> {
    const client = this.ottieniClient();
    const inizio = Date.now();

    try {
      const risposta = await client.messages.create({
        model: richiesta.modello.modello,
        max_tokens: richiesta.massimoToken,
        temperature: richiesta.temperatura ?? 0,
        system: richiesta.istruzioniSistema,
        messages: [{ role: "user", content: richiesta.contenuto }],
      });

      const blocco = risposta.content.find((c) => c.type === "text");
      if (!blocco || blocco.type !== "text") {
        throw new ErroreProvider("risposta-non-valida", "Risposta senza contenuto testuale.", true);
      }

      return {
        risposta: validaRisposta(estraiJson(blocco.text)),
        tokenInput: risposta.usage.input_tokens,
        tokenOutput: risposta.usage.output_tokens,
        latenzaMs: Date.now() - inizio,
      };
    } catch (errore) {
      throw traduciErrore(errore);
    }
  }
}

/**
 * Traduce l'errore del fornitore in una forma che il motore capisce, **senza
 * portarsi dietro il corpo della richiesta**: un errore che include il payload
 * finirebbe nei log con dentro il manoscritto.
 */
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
