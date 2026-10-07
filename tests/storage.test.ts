import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
