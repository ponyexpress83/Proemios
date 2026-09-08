/**
 * Registro degli adapter. Unico punto in cui un provider viene istanziato.
 */
import type { Provider } from "@/config/modelli";
import type { ProviderAi } from "./provider";
import { ProviderAnthropic } from "./anthropic";
import { ProviderOpenAi } from "./openai";

const registro = new Map<Provider, ProviderAi>([
  ["anthropic", new ProviderAnthropic()],
  ["openai", new ProviderOpenAi()],
]);

export function providerPer(nome: Provider): ProviderAi {
  const provider = registro.get(nome);
  if (!provider) throw new Error(`Provider non registrato: ${nome}`);
  return provider;
}

/** Sostituisce un adapter. Solo per i test: il motore non deve chiamare la rete. */
export function registraProviderPerTest(nome: Provider, provider: ProviderAi | null): void {
  if (provider) registro.set(nome, provider);
  else registro.delete(nome);
}

export function providerConfigurati(): Provider[] {
  return [...registro.entries()].filter(([, p]) => p.configurato()).map(([nome]) => nome);
}
