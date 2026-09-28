import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { StorageFilesystem } from "@/lib/storage/filesystem";
import { ChiaveGiaEsistente, OggettoNonTrovato } from "@/lib/storage/tipi";
import { chiaveValida, costruisciChiave, estensionePer, chiavePrompt } from "@/lib/storage/chiavi";

let radice: string;
let deposito: StorageFilesystem;

beforeEach(async () => {
  radice = await mkdtemp(path.join(tmpdir(), "proemios-storage-"));
  deposito = new StorageFilesystem({ radice, segreto: "segreto-di-prova" });
});

afterEach(async () => {
  await rm(radice, { recursive: true, force: true });
});

const CHIAVE = "org/org-1/prog/p-1/originale/abc123.docx";

describe("storage — immutabilità", () => {
  it("scrive e rilegge il contenuto identico", async () => {
    const contenuto = Buffer.from("Nel mezzo del cammin di nostra vita");
    const esito = await deposito.scrivi(CHIAVE, contenuto, { mimeType: "text/plain" });

    expect(esito.dimensioneByte).toBe(contenuto.byteLength);
    expect(esito.hashSha256).toHaveLength(64);
    expect(await deposito.leggi(CHIAVE)).toEqual(contenuto);
  });

  it("rifiuta la sovrascrittura di una chiave esistente", async () => {
    // È la garanzia che rende vera la catena delle versioni: se una chiave
    // potesse essere riscritta, "l'originale non si tocca" sarebbe un auspicio.
    await deposito.scrivi(CHIAVE, Buffer.from("originale"), { mimeType: "text/plain" });
    await expect(
      deposito.scrivi(CHIAVE, Buffer.from("sostituito"), { mimeType: "text/plain" }),
    ).rejects.toThrow(ChiaveGiaEsistente);

    expect((await deposito.leggi(CHIAVE)).toString()).toBe("originale");
  });

  it("lancia OggettoNonTrovato su una chiave inesistente", async () => {
    await expect(deposito.leggi("org/org-1/prog/p-1/originale/nulla.docx")).rejects.toThrow(
      OggettoNonTrovato,
    );
  });

  it("cancellare un oggetto inesistente non è un errore", async () => {
    await expect(deposito.cancella(CHIAVE)).resolves.toBeUndefined();
  });
});

describe("storage — chiavi", () => {
  it("genera chiavi non indovinabili e senza nomi leggibili", () => {
    const a = costruisciChiave({
      organizationId: "org-1",
      projectId: "p-1",
      ruolo: "originale",
      mimeType: "application/pdf",
    });
    const b = costruisciChiave({
      organizationId: "org-1",
      projectId: "p-1",
      ruolo: "originale",
      mimeType: "application/pdf",
    });

    expect(a).not.toBe(b);
    expect(a).toMatch(/^org\/org-1\/prog\/p-1\/originale\/[0-9a-f]{32}\.pdf$/);
  });

  it("mappa i MIME sulle estensioni attese", () => {
    expect(
      estensionePer(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
    expect(estensionePer("application/pdf")).toBe("pdf");
    expect(estensionePer("qualcosa/di-ignoto")).toBe("bin");
  });

  it("tiene i prompt in un prefisso separato", () => {
    // Conservazione più breve e accesso più ristretto: contengono testo integrale.
    expect(chiavePrompt({ organizationId: "org-1", runId: "r-1" })).toBe("prompt/org-1/r-1.json");
  });

  it("rifiuta le chiavi che tentano un traversal", () => {
    expect(chiaveValida(CHIAVE)).toBe(true);
    expect(chiaveValida("org/org-1/../../etc/passwd")).toBe(false);
    expect(chiaveValida("/etc/passwd")).toBe(false);
    expect(chiaveValida("org\\org-1\\file")).toBe(false);
    expect(chiaveValida("altro/prefisso/file")).toBe(false);
  });

  it("il driver rifiuta una chiave che esce dalla radice", async () => {
    await expect(
      deposito.scrivi("org/org-1/../../fuga.txt", Buffer.from("x"), { mimeType: "text/plain" }),
    ).rejects.toThrow(/non valida/);
  });
});

describe("storage — URL firmati", () => {
  it("produce un URL con scadenza e firma", async () => {
    await deposito.scrivi(CHIAVE, Buffer.from("x"), { mimeType: "text/plain" });
    const url = await deposito.urlFirmato(CHIAVE, { secondi: 300, nomeDownload: "opera.docx" });

    expect(url).toContain("/api/file/");
    expect(url).toMatch(/firma=[0-9a-f]{64}/);
    expect(url).toContain("nome=opera.docx");
  });

  it("accetta solo la firma corretta e non scaduta", async () => {
    const scade = Math.floor(Date.now() / 1000) + 300;
    const firma = deposito.firma(CHIAVE, scade);

    expect(deposito.verificaFirma(CHIAVE, scade, firma)).toBe(true);
    expect(deposito.verificaFirma(CHIAVE, scade, "0".repeat(64))).toBe(false);
    // Firma valida per un'altra chiave: non deve valere per questa.
    expect(deposito.verificaFirma("org/org-1/prog/p-1/originale/altro.docx", scade, firma)).toBe(
      false,
    );
  });

  it("rifiuta una firma scaduta", async () => {
    const scaduto = Math.floor(Date.now() / 1000) - 10;
    const firma = deposito.firma(CHIAVE, scaduto);
    expect(deposito.verificaFirma(CHIAVE, scaduto, firma)).toBe(false);
  });
});

describe("il divieto del filesystem vale sul sito vero, non su ogni processo", () => {
  /**
   * Il filesystem di Vercel è effimero e non è un posto dove tenere
   * manoscritti: in produzione serve S3. Ma `next start`, le preview e la CI
   * girano tutti con NODE_ENV=production, e legare il divieto a quella
   * variabile rendeva impossibile caricare un file ovunque tranne che in
   * `next dev` — cioè impossibile provare il prodotto prima di avere un
   * bucket. La discriminante è `ambienteLive()`.
   */
  const ambiente = { ...process.env };

  /** Configurazione completa: senza, il cancello di lib/env.ts scatta prima. */
  const LIVE: Record<string, string> = {
    NODE_ENV: "production",
    DEMO_MODE: "off",
    PROEMIOS_LIVE: "on",
    DATABASE_URL: "postgres://u:p@host/db",
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

  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, ambiente);
  });

  /**
   * `ambienteLive()` legge `DEMO_MODE` dall'env analizzato all'import di
   * `lib/env.ts`: cambiare `process.env` dopo non basta, il modulo va
   * ricaricato con l'ambiente già pronto.
   */
  async function ricarica(valori: Record<string, string | undefined>) {
    for (const k of Object.keys(process.env)) {
      if (k in LIVE || k === "VERCEL_ENV") delete process.env[k];
    }
    for (const [k, v] of Object.entries(valori)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.resetModules();
    return import("@/lib/storage/filesystem");
  }

  it("una preview può usare il filesystem, pur avendo NODE_ENV=production", async () => {
    const { StorageFilesystem: FS } = await ricarica({
      NODE_ENV: "production",
      DEMO_MODE: "off",
      VERCEL_ENV: "preview",
    });
    expect(() => new FS({ radice: "/tmp/x", segreto: "s" })).not.toThrow();
  });

  it("anche un `next start` locale può, se non si dichiara live", async () => {
    const { StorageFilesystem: FS } = await ricarica({
      NODE_ENV: "production",
      DEMO_MODE: "off",
    });
    expect(() => new FS({ radice: "/tmp/x", segreto: "s" })).not.toThrow();
  });

  it("il sito vero rifiuta il filesystem", async () => {
    const { StorageFilesystem: FS } = await ricarica({ ...LIVE });
    expect(() => new FS({ radice: "/tmp/x", segreto: "s" })).toThrow(
      /non è utilizzabile in produzione/,
    );
  });

  it("sul sito vero non si può scegliere il filesystem nemmeno dichiarandolo", async () => {
    // Difesa in profondità: `StorageFilesystem` ha una via d'uscita per
    // STORAGE_DRIVER=filesystem, ma in produzione non è raggiungibile — il
    // cancello di lib/env.ts pretende s3 e non fa nemmeno partire il
    // processo. Le due barriere sono indipendenti apposta.
    await expect(ricarica({ ...LIVE, STORAGE_DRIVER: "filesystem" })).rejects.toThrow(
      /STORAGE_DRIVER=s3/,
    );
  });
});
