import { describe, it, expect } from "vitest";
import {
  DIMENSIONE_MASSIMA_BYTE,
  TIPI_AMMESSI,
  nomeSicuro,
  validaFile,
} from "@/lib/file/validazione";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const FIRMA_ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const FIRMA_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const FIRMA_ELF = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);

describe("validazione dei file", () => {
  it("accetta un DOCX con la firma giusta", () => {
    const esito = validaFile({
      nomeFile: "manoscritto.docx",
      mimeDichiarato: DOCX,
      dimensioneByte: 1_000_000,
      primiByte: FIRMA_ZIP,
    });
    expect(esito.ok).toBe(true);
  });

  it("rifiuta un eseguibile rinominato in .docx", () => {
    // È il caso che il controllo sul solo Content-Type non intercetta: il
    // browser dichiara ciò che gli si dice.
    const esito = validaFile({
      nomeFile: "innocuo.docx",
      mimeDichiarato: DOCX,
      dimensioneByte: 1_000,
      primiByte: FIRMA_ELF,
    });
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/non corrisponde al formato/);
  });

  it("rifiuta un'estensione che non combacia con il tipo dichiarato", () => {
    const esito = validaFile({
      nomeFile: "manoscritto.pdf",
      mimeDichiarato: DOCX,
      dimensioneByte: 1_000,
      primiByte: FIRMA_ZIP,
    });
    expect(esito.ok).toBe(false);
  });

  it("rifiuta un formato non ammesso", () => {
    const esito = validaFile({
      nomeFile: "script.js",
      mimeDichiarato: "application/javascript",
      dimensioneByte: 100,
    });
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.motivo).toMatch(/Formato non accettato/);
  });

  it("rifiuta un file vuoto e uno troppo grande", () => {
    expect(validaFile({ nomeFile: "a.txt", mimeDichiarato: "text/plain", dimensioneByte: 0 }).ok).toBe(false);
    expect(
      validaFile({
        nomeFile: "a.txt",
        mimeDichiarato: "text/plain",
        dimensioneByte: DIMENSIONE_MASSIMA_BYTE + 1,
      }).ok,
    ).toBe(false);
  });

  it("accetta il PDF e riconosce la sua firma", () => {
    expect(
      validaFile({
        nomeFile: "bozza.pdf",
        mimeDichiarato: "application/pdf",
        dimensioneByte: 500,
        primiByte: FIRMA_PDF,
      }).ok,
    ).toBe(true);
    expect(
      validaFile({
        nomeFile: "bozza.pdf",
        mimeDichiarato: "application/pdf",
        dimensioneByte: 500,
        primiByte: FIRMA_ZIP,
      }).ok,
    ).toBe(false);
  });

  it("copre i formati richiesti dal capitolato", () => {
    const estensioni = Object.values(TIPI_AMMESSI).flatMap((t) => t.estensioni);
    for (const e of ["docx", "pdf", "txt", "jpg", "png"]) {
      expect(estensioni, e).toContain(e);
    }
  });
});

describe("nomi di file", () => {
  it("toglie i percorsi", () => {
    expect(nomeSicuro("../../etc/passwd")).toBe("passwd");
    expect(nomeSicuro("C:\\Users\\tizio\\opera.docx")).toBe("opera.docx");
  });

  it("toglie i caratteri che permetterebbero di iniettare intestazioni", () => {
    // Un nome con virgolette o a capo finisce in Content-Disposition.
    const nome = nomeSicuro('opera".docx\r\nX-Iniettato: si');
    expect(nome).not.toContain('"');
    expect(nome).not.toContain("\r");
    expect(nome).not.toContain("\n");
  });

  it("non restituisce mai una stringa vuota", () => {
    expect(nomeSicuro("")).toBe("file");
    expect(nomeSicuro("///")).toBe("file");
  });

  it("limita la lunghezza", () => {
    expect(nomeSicuro("a".repeat(500)).length).toBeLessThanOrEqual(200);
  });
});
