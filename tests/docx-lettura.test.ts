import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PacchettoDocx, PARTE_DOCUMENTO, PacchettoNonValido } from "@/lib/docx/pacchetto";
import { leggiParagrafi, fineElemento, decodificaXml, codificaXml } from "@/lib/docx/ooxml";
import { estraiParagrafiDocx, estraiTestoDocx } from "@/lib/docx/estrazione";
import { contaParole } from "@/lib/produzione/segmentazione";

const CORPUS = path.join(process.cwd(), "tests/corpus");

let semplice: Buffer;
let ricco: Buffer;
let lungo: Buffer;

beforeAll(async () => {
  [semplice, ricco, lungo] = await Promise.all([
    readFile(path.join(CORPUS, "semplice.docx")),
    readFile(path.join(CORPUS, "ricco.docx")),
    readFile(path.join(CORPUS, "lungo.docx")),
  ]);
});

describe("pacchetto DOCX", () => {
  it("apre un documento e ne elenca le parti", async () => {
    const pacchetto = await PacchettoDocx.apri(ricco);
    const parti = pacchetto.parti();
    expect(parti).toContain(PARTE_DOCUMENTO);
    expect(parti).toContain("[Content_Types].xml");
    expect(parti.some((p) => p.startsWith("word/media/"))).toBe(true);
  });

  it("rifiuta un file che non è un archivio", async () => {
    await expect(PacchettoDocx.apri(Buffer.from("non sono uno zip"))).rejects.toThrow(
      PacchettoNonValido,
    );
  });

  it("rifiuta un archivio senza document.xml", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("qualcosa.txt", "ciao");
    const finto = await zip.generateAsync({ type: "nodebuffer" });
    await expect(PacchettoDocx.apri(finto)).rejects.toThrow(/document\.xml/);
  });

  it("riscrive il pacchetto conservando tutte le parti", async () => {
    // È la promessa centrale: ciò che non tocchiamo esce com'è entrato.
    const pacchetto = await PacchettoDocx.apri(ricco);
    const partiPrima = pacchetto.parti().sort();
    const riscritto = await pacchetto.salva();

    const riaperto = await PacchettoDocx.apri(riscritto);
    expect(riaperto.parti().sort()).toEqual(partiPrima);

    // Anche i binari: l'immagine deve uscire identica.
    const originale = await PacchettoDocx.apri(ricco);
    const media = partiPrima.filter((p) => p.startsWith("word/media/"));
    expect(media.length).toBeGreaterThan(0);
    for (const parte of media) {
      expect(await riaperto.leggiBinario(parte)).toEqual(await originale.leggiBinario(parte));
    }
  });

  it("dopo un salvataggio senza modifiche il documento resta interpretabile", async () => {
    const pacchetto = await PacchettoDocx.apri(ricco);
    const riscritto = await pacchetto.salva();
    const paragrafiPrima = await estraiParagrafiDocx(ricco);
    const paragrafiDopo = await estraiParagrafiDocx(riscritto);
    expect(paragrafiDopo.map((p) => p.testo)).toEqual(paragrafiPrima.map((p) => p.testo));
  });
});

describe("lettura dell'OOXML", () => {
  it("gestisce l'annidamento nel trovare la fine di un elemento", () => {
    // È il caso che rompe una ricerca ingenua del primo tag di chiusura: un
    // paragrafo dentro una cella di tabella dentro un paragrafo.
    const xml = "<w:p><w:tbl><w:p>interno</w:p></w:tbl>esterno</w:p>";
    const fine = fineElemento(xml, "w:p", 0);
    expect(xml.slice(0, fine)).toBe(xml);
  });

  it("non confonde w:pPr con w:p", () => {
    const xml = '<w:p><w:pPr><w:pStyle w:val="Titolo"/></w:pPr><w:r><w:t>ciao</w:t></w:r></w:p>';
    const paragrafi = leggiParagrafi(xml);
    expect(paragrafi).toHaveLength(1);
    expect(paragrafi[0]!.testo).toBe("ciao");
  });

  it("concatena le run di uno stesso paragrafo", () => {
    const xml =
      "<w:p><w:r><w:t>Un paragrafo con </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>grassetto</w:t></w:r><w:r><w:t> dentro.</w:t></w:r></w:p>";
    const [p] = leggiParagrafi(xml);
    expect(p!.testo).toBe("Un paragrafo con grassetto dentro.");
    expect(p!.run).toHaveLength(3);
    expect(p!.run[1]!.offsetNelParagrafo).toBe("Un paragrafo con ".length);
  });

  it("registra le posizioni esatte del testo nell'XML", () => {
    const xml = "<w:p><w:r><w:t>parola</w:t></w:r></w:p>";
    const [p] = leggiParagrafi(xml);
    const run = p!.run[0]!;
    expect(xml.slice(run.inizioTesto, run.fineTesto)).toBe("parola");
    expect(xml.slice(run.inizioRun, run.fineRun)).toBe("<w:r><w:t>parola</w:t></w:r>");
  });

  it("ignora il testo già cancellato in una revisione precedente", () => {
    // Il testo dentro <w:del> non fa parte del testo corrente: correggerlo
    // significherebbe correggere qualcosa che il lettore non vede.
    const xml =
      '<w:p><w:r><w:t>resta </w:t></w:r><w:del w:id="1" w:author="X"><w:r><w:delText>sparito </w:delText><w:t>anche questo</w:t></w:r></w:del><w:r><w:t>e finisce</w:t></w:r></w:p>';
    const [p] = leggiParagrafi(xml);
    expect(p!.testo).toBe("resta e finisce");
  });

  it("conta il testo inserito in una revisione precedente", () => {
    // Il testo dentro <w:ins> invece è presente e va letto.
    const xml =
      '<w:p><w:r><w:t>prima </w:t></w:r><w:ins w:id="2" w:author="X"><w:r><w:t>aggiunto </w:t></w:r></w:ins><w:r><w:t>dopo</w:t></w:r></w:p>';
    const [p] = leggiParagrafi(xml);
    expect(p!.testo).toBe("prima aggiunto dopo");
  });

  it("legge il paraId di Word quando c'è", () => {
    const xml = '<w:p w14:paraId="1A2B3C4D"><w:r><w:t>x</w:t></w:r></w:p>';
    expect(leggiParagrafi(xml)[0]!.paraId).toBe("1A2B3C4D");
  });

  it("gestisce i paragrafi vuoti auto-chiusi", () => {
    const xml = "<w:p/><w:p><w:r><w:t>testo</w:t></w:r></w:p>";
    const paragrafi = leggiParagrafi(xml);
    expect(paragrafi).toHaveLength(2);
    expect(paragrafi[0]!.testo).toBe("");
  });

  it("decodifica e codifica le entità XML", () => {
    expect(decodificaXml("&lt;tag&gt; &amp; &quot;virgolette&quot;")).toBe('<tag> & "virgolette"');
    expect(codificaXml('<tag> & "x"')).toBe("&lt;tag&gt; &amp; &quot;x&quot;");
    // L'ordine conta: &amp;lt; deve tornare &lt;, non <.
    expect(decodificaXml("&amp;lt;")).toBe("&lt;");
  });
});

describe("estrazione dal corpus", () => {
  it("legge un documento semplice", async () => {
    const paragrafi = await estraiParagrafiDocx(semplice);
    expect(paragrafi.length).toBeGreaterThan(5);
    expect(paragrafi.some((p) => p.testo.includes("acuqa"))).toBe(true);
  });

  it("legge titoli, elenchi, tabelle, didascalie e link di un documento ricco", async () => {
    const testo = await estraiTestoDocx(ricco);
    expect(testo).toContain("Titolo dell'opera");
    expect(testo).toContain("Capitolo primo");
    expect(testo).toContain("Primo punto");
    expect(testo).toContain("Numero uno");
    // Il testo dentro le celle di tabella non deve sparire.
    expect(testo).toContain("Capitolo 1");
    expect(testo).toContain("Didascalia dell'immagine");
    // Il testo dentro un hyperlink è testo del paragrafo.
    expect(testo).toContain("il sito dello studio");
  });

  it("assegna a ogni paragrafo un identificativo utilizzabile", async () => {
    const paragrafi = await estraiParagrafiDocx(ricco);
    for (const p of paragrafi) {
      expect(p.idOoxml, `paragrafo ${p.indice}`).toBeTruthy();
    }
    expect(new Set(paragrafi.map((p) => p.idOoxml)).size).toBe(paragrafi.length);
  });

  it("gli indici sono consecutivi e corrispondono all'ordine di lettura", async () => {
    const paragrafi = await estraiParagrafiDocx(semplice);
    expect(paragrafi.map((p) => p.indice)).toEqual(paragrafi.map((_, i) => i));
  });

  it("regge un manoscritto da ottantamila parole", async () => {
    const inizio = Date.now();
    const paragrafi = await estraiParagrafiDocx(lungo);
    const durata = Date.now() - inizio;

    const parole = contaParole(paragrafi);
    expect(parole).toBeGreaterThan(80_000);
    // L'estrazione non deve essere il collo di bottiglia di un Job.
    expect(durata).toBeLessThan(5_000);
  });
});
