import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * L'analisi gratuita gira su un modello economico, separato dal motore, e la
 * richiesta non porta parametri che i modelli recenti rifiutano. Gli SDK sono
 * sostituiti: qui si prova cosa viene chiesto, non cosa risponde un fornitore.
 */
const { createAnthropic, createOpenAi } = vi.hoisted(() => ({
  createAnthropic: vi.fn(),
  createOpenAi: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    messages = { create: createAnthropic };
  }
  return { default: Anthropic };
});

vi.mock("openai", () => {
  class APIError extends Error {
    status?: number;
  }
  class OpenAI {
    static APIError = APIError;
    chat = { completions: { create: createOpenAi } };
  }
  return { default: OpenAI };
});

import { aiConfigurata, analizza, modelloAnalisi, providerAnalisi } from "@/lib/ai";

const report = {
  sintesi: "Un romanzo di formazione ambientato in provincia, con una voce sicura da sfoltire.",
  ritmo: { giudizio: "Procede bene nei dialoghi, rallenta nelle descrizioni.", periodareLungo: true },
  ripetizioni: ["«in realtà»"],
  cliche: ["«un brivido lungo la schiena»"],
  coerenza: { tempiVerbali: "Passato remoto costante.", puntoDiVista: "Terza persona limitata." },
  genere: "Narrativa di formazione",
  lettoreTipo: "Lettori adulti di narrativa italiana contemporanea.",
  puntiForza: ["Dialoghi credibili", "Ambientazione concreta", "Incipit efficace"],
  areeIntervento: ["Sfoltire le descrizioni", "Uniformare i tempi", "Tagliare il capitolo 9"],
  livelloIntervento: "editing-leggero",
};

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("ANALISI_PROVIDER", "");
  vi.stubEnv("ANALISI_MODEL", "");
  createAnthropic.mockReset();
  createOpenAi.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("scelta di provider e modello", () => {
  it("senza configurazione usa Anthropic con un modello economico", () => {
    expect(providerAnalisi()).toBe("anthropic");
    expect(modelloAnalisi()).toBe("claude-haiku-5-5");
  });

  it("ANALISI_MODEL sovrascrive il predefinito", () => {
    vi.stubEnv("ANALISI_MODEL", "claude-sonnet-5-5");
    expect(modelloAnalisi()).toBe("claude-sonnet-5-5");
  });

  it("con ANALISI_PROVIDER=openai cambia predefinito e chiave richiesta", () => {
    vi.stubEnv("ANALISI_PROVIDER", "openai");
    expect(providerAnalisi()).toBe("openai");
    expect(modelloAnalisi()).toBe("gpt-4.1-mini");
    expect(aiConfigurata()).toBe(true);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(aiConfigurata()).toBe(false);
  });

  it("un valore sconosciuto di ANALISI_PROVIDER ricade su Anthropic", () => {
    vi.stubEnv("ANALISI_PROVIDER", "gemini");
    expect(providerAnalisi()).toBe("anthropic");
  });
});

describe("richiesta ad Anthropic", () => {
  it("usa il modello configurato, senza parametri di campionamento", async () => {
    createAnthropic.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(report) }] });

    const esito = await analizza("Parola ".repeat(200));

    expect(esito.livelloIntervento).toBe("editing-leggero");
    expect(createAnthropic).toHaveBeenCalledTimes(1);
    const corpo = createAnthropic.mock.calls[0]![0] as Record<string, unknown>;
    expect(corpo.model).toBe("claude-haiku-5-5");
    expect(corpo).not.toHaveProperty("temperature");
    expect(corpo).not.toHaveProperty("top_p");
    expect(corpo.max_tokens).toBeGreaterThanOrEqual(4_000);
  });

  it("invia solo l'estratto, non il testo intero", async () => {
    createAnthropic.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(report) }] });
    await analizza("parola ".repeat(20_000));
    const corpo = createAnthropic.mock.calls[0]![0] as { messages: { content: string }[] };
    const parole = corpo.messages[0]!.content.split(/\s+/).length;
    expect(parole).toBeLessThan(8_100);
  });
});

describe("richiesta a OpenAI", () => {
  it("impone il JSON dal fornitore e non manda temperature", async () => {
    vi.stubEnv("ANALISI_PROVIDER", "openai");
    createOpenAi.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(report) } }] });

    await analizza("Parola ".repeat(200));

    expect(createAnthropic).not.toHaveBeenCalled();
    const corpo = createOpenAi.mock.calls[0]![0] as Record<string, unknown>;
    expect(corpo.model).toBe("gpt-4.1-mini");
    expect(corpo.response_format).toEqual({ type: "json_object" });
    expect(corpo).not.toHaveProperty("temperature");
  });
});
