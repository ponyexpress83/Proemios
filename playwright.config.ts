import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * Configurazione dei test end-to-end.
 *
 * Girano contro un'applicazione **costruita**, non contro il server di
 * sviluppo: la CSP, le intestazioni e il comportamento del middleware
 * cambiano fra i due, e provare quello sbagliato darebbe una sicurezza falsa.
 *
 * Il database è quello di test: `TEST_DATABASE_URL` viene passata come
 * `DATABASE_URL` al server avviato qui sotto.
 */
const PORTA = Number(process.env.E2E_PORT ?? 3210);
const BASE = `http://localhost:${PORTA}`;

/**
 * In questo ambiente di sviluppo Chromium è preinstallato; in CI lo mette
 * `playwright install` al proprio posto, e imporre un percorso lo farebbe
 * fallire. Si usa quello locale solo se esiste davvero.
 */
const PREINSTALLATO = "/opt/pw-browsers/chromium";
const eseguibile =
  process.env.PLAYWRIGHT_CHROMIUM ||
  (existsSync(PREINSTALLATO) ? PREINSTALLATO : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: eseguibile ? { executablePath: eseguibile } : {},
      },
    },
  ],

  webServer: {
    command: `npx next start -p ${PORTA}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DEMO_MODE: "off",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://postgres@localhost:5433/proemios_test?sslmode=disable",
      NEXT_PUBLIC_SITE_URL: BASE,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "chiave-di-test-lunga-almeno-trentadue-caratteri",
    },
  },
});
