import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * L'adapter del motore editoriale non deve mandare `temperature`: i modelli
 * Claude recenti lo rifiutano con un 400, e un 400 su ogni Job è un motore
 * che non lavora mai. La regressione va coperta sul corpo della richiesta.
 */
const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    messages = { create };
  }
  return { default: Anthropic };
});

import { ProviderAnthropic } from "@/lib/ai/anthropic";
import { ErroreProvider } from "@/lib/ai/provider";
import { MODELLI } from "@/config/modelli";

const modello = MODELLI.find((m) => m.id === "anthropic-standard")!;

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
  create.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("ProviderAnthropic", () => {
  it("non manda parametri di campionamento, anche se la richiesta ne porta uno", async () => {
    create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ interventi: [] }) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const esito = await new ProviderAnthropic().esegui({
      modello,
      istruzioniSistema: "Correggi.",
      contenuto: "Testo.",
      massimoToken: 8_000,
      temperatura: 0,
    });

    expect(esito.risposta.interventi).toEqual([]);
    const corpo = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(corpo.model).toBe(modello.modello);
    expect(corpo.max_tokens).toBe(8_000);
    expect(corpo).not.toHaveProperty("temperature");
    expect(corpo).not.toHaveProperty("top_p");
    expect(corpo).not.toHaveProperty("top_k");
  });

  it("senza chiave si ferma prima di chiamare la rete", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(
      new ProviderAnthropic().esegui({
        modello,
        istruzioniSistema: "Correggi.",
        contenuto: "Testo.",
        massimoToken: 8_000,
      }),
    ).rejects.toBeInstanceOf(ErroreProvider);
    expect(create).not.toHaveBeenCalled();
  });
});
