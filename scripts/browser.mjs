import { existsSync } from "node:fs";

/**
 * Opzioni di avvio del browser per gli script di verifica.
 *
 * In questo ambiente di sviluppo Chromium è già installato in `/opt/pw-browsers`;
 * in CI lo mette `playwright install` al proprio posto, e imporre un percorso
 * lo farebbe fallire con «executable doesn't exist». Perciò si usa il percorso
 * locale **solo se esiste davvero**, altrimenti si lascia decidere a Playwright.
 *
 * `CHROMIUM` permette di forzarne un altro.
 */
const PREINSTALLATO = "/opt/pw-browsers/chromium";

export function opzioniBrowser() {
  const scelto = process.env.CHROMIUM;
  if (scelto) return { executablePath: scelto };
  if (existsSync(PREINSTALLATO)) return { executablePath: PREINSTALLATO };
  return {};
}
