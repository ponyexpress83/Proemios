import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Il cancello fail-closed deve distinguere tre situazioni che si somigliano
 * molto dall'interno del processo:
 *
 *  - il sito vero, che senza configurazione completa non deve partire;
 *  - una preview o una CI, che gira con `NODE_ENV=production` e con la demo
 *    spenta per esercitare i percorsi reali, e deve poter partire;
 *  - lo sviluppo, dove non si verifica nulla.
 *
 * Il modulo `lib/env.ts` esegue il controllo all'import, quindi ogni caso
 * ricarica il modulo con l'ambiente già preparato.
 */

const originale = { ...process.env };

const COMPLETO: Record<string, string> = {
  NODE_ENV: "production",
  DEMO_MODE: "off",
  DATABASE_URL: "postgres://utente:segreto@host/db",
  AUTH_SECRET: "chiave-di-test-lunga-almeno-trentadue-caratteri",
  AUTH_URL: "https://proemios.it",
  RESEND_API_KEY: "re_test",
  AUTH_EMAIL_FROM: "Proemios <noreply@proemios.it>",
  EMAIL_FROM: "Proemios <noreply@proemios.it>",
  EMAIL_INTERNAL: "preventivi@proemios.it",
  S3_BUCKET: "proemios",
  S3_REGION: "eu-central-1",
  S3_ACCESS_KEY_ID: "chiave",
  S3_SECRET_ACCESS_KEY: "segreto",
  STORAGE_DRIVER: "s3",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test",
  INNGEST_EVENT_KEY: "evento",
  INNGEST_SIGNING_KEY: "firma",
  NEXT_PUBLIC_SITE_URL: "https://proemios.it",
  ANTHROPIC_API_KEY: "sk-ant-test",
};

function ambiente(valori: Record<string, string | undefined>) {
  for (const chiave of Object.keys(process.env)) {
    if (chiave in COMPLETO || chiave === "VERCEL_ENV" || chiave === "PROEMIOS_LIVE") {
      delete process.env[chiave];
    }
  }
  for (const [k, v] of Object.entries(valori)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function caricaEnv(): Promise<typeof import("@/lib/env")> {
  vi.resetModules();
  return import("@/lib/env");
}

beforeEach(() => ambiente({}));
afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, originale);
});

describe("cancello fail-closed", () => {
  it("non parte in produzione vera se manca la configurazione", async () => {
    ambiente({ NODE_ENV: "production", DEMO_MODE: "off", PROEMIOS_LIVE: "on" });
    await expect(caricaEnv()).rejects.toThrow(/Configurazione produzione incompleta/);
  });

  it("parte in produzione vera quando la configurazione è completa", async () => {
    ambiente({ ...COMPLETO, PROEMIOS_LIVE: "on" });
    const m = await caricaEnv();
    expect(m.ambienteLive()).toBe(true);
  });

  it("pretende il dominio canonico in produzione vera", async () => {
    ambiente({ ...COMPLETO, PROEMIOS_LIVE: "on", NEXT_PUBLIC_SITE_URL: "https://anteprima.vercel.app" });
    await expect(caricaEnv()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("lascia partire la CI, che usa DEMO_MODE=off per provare i percorsi reali", async () => {
    // È il caso che rompeva la suite end-to-end: produzione, demo spenta,
    // nessun segreto vero, e nessuna dichiarazione di essere il sito live.
    ambiente({
      NODE_ENV: "production",
      DEMO_MODE: "off",
      DATABASE_URL: "postgres://postgres@localhost:5433/proemios_test",
      AUTH_SECRET: "chiave-di-test-lunga-almeno-trentadue-caratteri",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3210",
    });
    const m = await caricaEnv();
    expect(m.ambienteLive()).toBe(false);
  });

  it("lascia partire una preview Vercel, che ha comunque NODE_ENV=production", async () => {
    ambiente({ NODE_ENV: "production", DEMO_MODE: "off", VERCEL_ENV: "preview" });
    const m = await caricaEnv();
    expect(m.ambienteLive()).toBe(false);
  });

  it("su Vercel di produzione il cancello scatta senza bisogno di PROEMIOS_LIVE", async () => {
    ambiente({ NODE_ENV: "production", DEMO_MODE: "off", VERCEL_ENV: "production" });
    await expect(caricaEnv()).rejects.toThrow(/Configurazione produzione incompleta/);
  });

  it("su Vercel di produzione PROEMIOS_LIVE non può spegnere il cancello", async () => {
    // La piattaforma vince sulla variabile: chi imposta PROEMIOS_LIVE=off su
    // un deploy di produzione non deve poter aggirare il controllo.
    ambiente({
      NODE_ENV: "production",
      DEMO_MODE: "off",
      VERCEL_ENV: "production",
      PROEMIOS_LIVE: "off",
    });
    await expect(caricaEnv()).rejects.toThrow(/Configurazione produzione incompleta/);
  });

  it("in sviluppo non verifica nulla", async () => {
    ambiente({ NODE_ENV: "development", DEMO_MODE: "off" });
    const m = await caricaEnv();
    expect(m.ambienteLive()).toBe(false);
  });

  it("con la demo accesa non verifica nulla, nemmeno dichiarandosi live", async () => {
    ambiente({ NODE_ENV: "production", DEMO_MODE: "on", PROEMIOS_LIVE: "on" });
    const m = await caricaEnv();
    expect(m.ambienteLive()).toBe(false);
  });
});
