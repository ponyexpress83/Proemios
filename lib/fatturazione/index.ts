/**
 * Scelta del provider di fatturazione.
 *
 * Senza credenziali si usa `ProviderManuale`, che non emette e lo dichiara: la
 * riga resta `da_emettere` e l'amministrazione la vede. Un prodotto che finge
 * di aver emesso una fattura è peggio di uno che dice di non poterlo fare.
 */
import { FattureInCloud } from "./fatture-in-cloud";
import { ProviderManuale, type ProviderFatturazione } from "./provider";
import { env } from "@/lib/env";

let sostituto: ProviderFatturazione | null = null;

/** Inietta un provider nei test. `null` ripristina la scelta normale. */
export function impostaProviderFatturazionePerTest(p: ProviderFatturazione | null) {
  sostituto = p;
}

export function providerFatturazione(): ProviderFatturazione {
  if (sostituto) return sostituto;

  const provider = new FattureInCloud({
    token: env.FATTURE_IN_CLOUD_TOKEN,
    aziendaId: env.FATTURE_IN_CLOUD_AZIENDA_ID,
  });
  return provider.configurato() ? provider : new ProviderManuale();
}

export * from "./provider";
