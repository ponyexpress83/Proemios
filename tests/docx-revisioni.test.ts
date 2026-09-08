import { describe, it, expect, beforeAll } from "vitest";
import { XMLValidator } from "fast-xml-parser";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PacchettoDocx, PARTE_DOCUMENTO, PARTE_COMMENTI } from "@/lib/docx/pacchetto";
import { estraiParagrafiDocx } from "@/lib/docx/estrazione";
import { generaDocumentoRevisionato, type InterventoApprovato } from "@/lib/docx/motore";
import {
  accettaTutte,
  idRevisioneDuplicati,
  rifiutaTutte,
  testoParagrafi,
} from "@/lib/docx/revisioni-simulazione";

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

/** Costruisce un intervento a partire dal testo effettivo del documento. */
async function interventoSu(
  contenuto: Buffer,
  frammento: string,
  sostituto: string,
  commento?: string,
): Promise<InterventoApprovato> {
  const paragrafi = await estraiParagrafiDocx(contenuto);
  const indice = paragrafi.findIndex((p) => p.testo.includes(frammento));
  if (indice === -1) throw new Error(`frammento non trovato nel corpus: ${frammento}`);
  const inizio = paragrafi[indice]!.testo.indexOf(frammento);
  return {
    id: `int-${frammento.slice(0, 5)}`,
    indiceParagrafo: indice,
    inizio,
    fine: inizio + frammento.length,
    prima: frammento,
    dopo: sostituto,
    commentoPerAutore: commento,
  };
}

/**
 * Verifica che l'XML sia ben formato con un parser di terze parti.
 *
 * Il motore lavora per innesti su stringa: un errore di offset produce un tag
 * troncato a metà, e nessuna funzione di questo repository se ne accorgerebbe —
 * le stesse assunzioni sbagliate che hanno scritto l'XML lo rileggerebbero.
 * Serve un lettore che non condivida quelle assunzioni.
 */
function esigiXmlBenFormato(xml: string) {
  const esito = XMLValidator.validate(xml);
  if (esito !== true) {
    const intorno = xml.slice(Math.max(0, (esito.err.col ?? 0) - 200), (esito.err.col ?? 0) + 200);
    throw new Error(`XML malformato: ${esito.err.msg}\n…${intorno}…`);
  }
}

describe("revisioni tracciate — struttura", () => {
  it("produce w:ins e w:del con autore e data", async () => {
    const intervento = await interventoSu(semplice, "acuqa", "acqua");
    const esito = await generaDocumentoRevisionato(semplice, [intervento], {
      autore: "Philippe Marchand",
      data: new Date("2026-09-05T10:00:00Z"),
    });

    expect(esito.applicati).toBe(1);
    expect(esito.saltati).toEqual([]);

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

    expect(xml).toContain("<w:ins ");
    expect(xml).toContain("<w:del ");
    expect(xml).toContain('w:author="Philippe Marchand"');
    expect(xml).toContain('w:date="2026-09-05T10:00:00Z"');
    // Il testo cancellato usa delText, non t: è il requisito di Word.
    expect(xml).toContain("<w:delText");
    expect(xml).toContain("acqua");
  });

  it("non produce identificativi di revisione duplicati", async () => {
    // È il difetto che fa aprire a Word la finestra di riparazione.
    const paragrafi = await estraiParagrafiDocx(semplice);
    const interventi: InterventoApprovato[] = [];
    for (const [i, p] of paragrafi.entries()) {
      const posizione = p.testo.indexOf(" ");
      if (posizione <= 0) continue;
      interventi.push({
        id: `i-${i}`,
        indiceParagrafo: i,
        inizio: 0,
        fine: posizione,
        prima: p.testo.slice(0, posizione),
        dopo: p.testo.slice(0, posizione).toUpperCase(),
      });
    }

    const esito = await generaDocumentoRevisionato(semplice, interventi, { autore: "Redattore" });
    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

    expect(esito.applicati).toBeGreaterThan(3);
    expect(idRevisioneDuplicati(xml)).toEqual([]);
  });

  it("conserva le proprietà della run: una parola corretta nel grassetto resta grassetta", async () => {
    const intervento = await interventoSu(ricco, "grassetto", "GRASSETTO");
    const esito = await generaDocumentoRevisionato(ricco, [intervento], { autore: "R" });

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

    // La run inserita porta le stesse proprietà di quella originale.
    const inserimento = xml.match(/<w:ins [^>]*><w:r>(<w:rPr>[\s\S]*?<\/w:rPr>)?/);
    expect(inserimento?.[1] ?? "").toContain("<w:b");
  });

  it("usa xml:space=preserve quando il testo ha spazi ai bordi", async () => {
    // Senza, Word mangia lo spazio e la correzione sposta le parole.
    const intervento = await interventoSu(semplice, "tornato , ma", "tornato, ma");
    const esito = await generaDocumentoRevisionato(semplice, [intervento], { autore: "R" });
    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    expect(xml).toMatch(/<w:(t|delText) xml:space="preserve">/);
  });

  it("conserva tutte le parti del pacchetto, immagini comprese", async () => {
    const intervento = await interventoSu(ricco, "acuqa", "acqua");
    const esito = await generaDocumentoRevisionato(ricco, [intervento], { autore: "R" });

    const originale = await PacchettoDocx.apri(ricco);
    const revisionato = await PacchettoDocx.apri(esito.contenuto);

    for (const parte of originale.parti()) {
      expect(revisionato.parti(), parte).toContain(parte);
    }

    const media = originale.parti().filter((p) => p.startsWith("word/media/"));
    expect(media.length).toBeGreaterThan(0);
    for (const parte of media) {
      expect(await revisionato.leggiBinario(parte)).toEqual(await originale.leggiBinario(parte));
    }
  });

  it("non tocca gli stili, la numerazione e le impostazioni", async () => {
    const intervento = await interventoSu(ricco, "acuqa", "acqua");
    const esito = await generaDocumentoRevisionato(ricco, [intervento], { autore: "R" });

    const originale = await PacchettoDocx.apri(ricco);
    const revisionato = await PacchettoDocx.apri(esito.contenuto);

    for (const parte of ["word/styles.xml", "word/numbering.xml", "word/settings.xml"]) {
      if (!originale.ha(parte)) continue;
      expect(await revisionato.leggiTesto(parte), parte).toBe(await originale.leggiTesto(parte));
    }
  });
});

describe("accetta e rifiuta", () => {
  it("Accetta tutte produce il testo corretto", async () => {
    const intervento = await interventoSu(semplice, "acuqa", "acqua");
    const esito = await generaDocumentoRevisionato(semplice, [intervento], { autore: "R" });

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    const testo = testoParagrafi(accettaTutte(xml)).join("\n");

    expect(testo).toContain("acqua");
    expect(testo).not.toContain("acuqa");
  });

  it("Rifiuta tutte riporta esattamente al testo di partenza", async () => {
    // È la prova che la revisione non ha alterato nulla di irreversibile.
    const paragrafiPrima = (await estraiParagrafiDocx(semplice)).map((p) => p.testo);

    const interventi = [
      await interventoSu(semplice, "acuqa", "acqua"),
      await interventoSu(semplice, "tornato , ma", "tornato, ma"),
    ];
    const esito = await generaDocumentoRevisionato(semplice, interventi, { autore: "R" });

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

    expect(testoParagrafi(rifiutaTutte(xml))).toEqual(paragrafiPrima);
  });

  it("Accetta e Rifiuta danno risultati diversi quanto gli interventi", async () => {
    const interventi = [
      await interventoSu(semplice, "acuqa", "acqua"),
      await interventoSu(semplice, "ne pane ne", "né pane né"),
    ];
    const esito = await generaDocumentoRevisionato(semplice, interventi, { autore: "R" });
    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

    const accettato = testoParagrafi(accettaTutte(xml)).join("\n");
    const rifiutato = testoParagrafi(rifiutaTutte(xml)).join("\n");

    expect(accettato).not.toBe(rifiutato);
    expect(accettato).toContain("né pane né");
    expect(rifiutato).toContain("ne pane ne");
  });

  it("una cancellazione pura sparisce accettando e resta rifiutando", async () => {
    const paragrafi = await estraiParagrafiDocx(semplice);
    const indice = paragrafi.findIndex((p) => p.testo.includes("anche"));
    const inizio = paragrafi[indice]!.testo.indexOf(" anche");

    const esito = await generaDocumentoRevisionato(
      semplice,
      [
        {
          id: "canc",
          indiceParagrafo: indice,
          inizio,
          fine: inizio + " anche".length,
          prima: " anche",
          dopo: "",
        },
      ],
      { autore: "R" },
    );

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

    expect(testoParagrafi(accettaTutte(xml)).join("\n")).not.toContain("pioveva anche");
    expect(testoParagrafi(rifiutaTutte(xml)).join("\n")).toContain("pioveva anche");
  });
});

describe("commenti", () => {
  it("scrive il commento e i suoi ancoraggi", async () => {
    const intervento = await interventoSu(
      semplice,
      "acuqa",
      "acqua",
      "Refuso evidente, ma confermare che non sia una scelta grafica dell'autore.",
    );
    const esito = await generaDocumentoRevisionato(semplice, [intervento], {
      autore: "Philippe Marchand",
    });

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const documento = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

    expect(documento).toContain("<w:commentRangeStart");
    expect(documento).toContain("<w:commentRangeEnd");
    expect(documento).toContain("<w:commentReference");

    expect(pacchetto.ha(PARTE_COMMENTI)).toBe(true);
    const commenti = await pacchetto.leggiTesto(PARTE_COMMENTI);
    expect(commenti).toContain("Refuso evidente");
    expect(commenti).toContain('w:author="Philippe Marchand"');
  });

  it("dichiara la parte nei content types e nelle relazioni", async () => {
    // Senza queste due dichiarazioni Word chiede di riparare il file.
    const intervento = await interventoSu(semplice, "acuqa", "acqua", "Nota");
    const esito = await generaDocumentoRevisionato(semplice, [intervento], { autore: "R" });
    const pacchetto = await PacchettoDocx.apri(esito.contenuto);

    const tipi = await pacchetto.leggiTesto("[Content_Types].xml");
    expect(tipi).toContain("/word/comments.xml");

    const relazioni = await pacchetto.leggiTesto("word/_rels/document.xml.rels");
    expect(relazioni).toContain('Target="comments.xml"');
    // Nessun identificativo di relazione riusato.
    const id = [...relazioni.matchAll(/Id="(rId\d+)"/g)].map((m) => m[1]);
    expect(new Set(id).size).toBe(id.length);
  });
});

describe("sicurezza del documento", () => {
  it("salta un intervento se il testo non è più quello approvato", async () => {
    // Il documento potrebbe essere cambiato fra l'approvazione e la consegna.
    const intervento = await interventoSu(semplice, "acuqa", "acqua");
    const alterato: InterventoApprovato = { ...intervento, prima: "qualcos'altro" };

    const esito = await generaDocumentoRevisionato(semplice, [alterato], { autore: "R" });
    expect(esito.applicati).toBe(0);
    expect(esito.saltati[0]!.motivo).toMatch(/non è più quello approvato/);
    expect(esito.richiedeVerifica).toBe(true);
    expect(esito.notaVerifica).toBeTruthy();
  });

  it("salta un intervento che attraversa run con formattazione diversa", async () => {
    // Nel documento ricco "Un paragrafo con grassetto" sta su tre run: decidere
    // quale stile dare al testo inserito è una scelta editoriale, non tecnica.
    const paragrafi = await estraiParagrafiDocx(ricco);
    const indice = paragrafi.findIndex((p) => p.testo.includes("paragrafo con grassetto"));
    const testo = paragrafi[indice]!.testo;
    const inizio = testo.indexOf("con grassetto");

    const esito = await generaDocumentoRevisionato(
      ricco,
      [
        {
          id: "attraversa",
          indiceParagrafo: indice,
          inizio,
          fine: inizio + "con grassetto".length,
          prima: "con grassetto",
          dopo: "con neretto",
        },
      ],
      { autore: "R" },
    );

    expect(esito.applicati).toBe(0);
    expect(esito.saltati[0]!.motivo).toMatch(/attraversa run/);
    expect(esito.richiedeVerifica).toBe(true);
  });

  it("un documento senza interventi saltati non richiede verifica", async () => {
    const intervento = await interventoSu(semplice, "acuqa", "acqua");
    const esito = await generaDocumentoRevisionato(semplice, [intervento], { autore: "R" });
    expect(esito.richiedeVerifica).toBe(false);
  });

  it("più interventi nello stesso paragrafo si applicano tutti", async () => {
    const paragrafi = await estraiParagrafiDocx(semplice);
    const indice = paragrafi.findIndex((p) => p.testo.includes("acuqa"));
    const testo = paragrafi[indice]!.testo;

    const esito = await generaDocumentoRevisionato(
      semplice,
      [
        {
          id: "a",
          indiceParagrafo: indice,
          inizio: testo.indexOf("acuqa"),
          fine: testo.indexOf("acuqa") + 5,
          prima: "acuqa",
          dopo: "acqua",
        },
        {
          id: "b",
          indiceParagrafo: indice,
          inizio: testo.indexOf("casa"),
          fine: testo.indexOf("casa") + 4,
          prima: "casa",
          dopo: "dimora",
        },
      ],
      { autore: "R" },
    );

    expect(esito.applicati).toBe(2);
    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    const accettato = testoParagrafi(accettaTutte(xml)).join("\n");
    expect(accettato).toContain("acqua");
    expect(accettato).toContain("dimora");
  });
});

describe("scala", () => {
  it("regge millequattrocento interventi su un manoscritto da ottantamila parole", async () => {
    const paragrafi = await estraiParagrafiDocx(lungo);
    const interventi: InterventoApprovato[] = [];

    for (const [i, p] of paragrafi.entries()) {
      const posizione = p.testo.indexOf("acuqa");
      if (posizione === -1) continue;
      interventi.push({
        id: `i-${i}`,
        indiceParagrafo: i,
        inizio: posizione,
        fine: posizione + 5,
        prima: "acuqa",
        dopo: "acqua",
      });
      if (interventi.length >= 1_427) break;
    }

    expect(interventi.length).toBeGreaterThan(500);

    const inizio = Date.now();
    const esito = await generaDocumentoRevisionato(lungo, interventi, { autore: "R" });
    const durata = Date.now() - inizio;

    expect(esito.applicati).toBe(interventi.length);
    expect(esito.saltati).toEqual([]);
    // Un Job non deve restare bloccato minuti sulla sola generazione del file.
    expect(durata).toBeLessThan(30_000);

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    expect(idRevisioneDuplicati(xml)).toEqual([]);
    expect(testoParagrafi(accettaTutte(xml)).join("\n")).not.toContain("acuqa");
  }, 60_000);
});

describe("più interventi nella stessa run", () => {
  // Il caso che rompeva il motore: due correzioni dentro la stessa `<w:r>`.
  // La prima riscrittura cambia la lunghezza dell'XML, e la seconda tagliava
  // un intervallo di byte ormai sbagliato — producendo un tag mozzato. Word
  // avrebbe chiesto di riparare il documento; LibreOffice si rifiutava di
  // aprirlo. Ora le run si riscrivono una volta sola, con tutti gli interventi
  // dentro.
  it("applica due correzioni nella stessa run senza rompere l'XML", async () => {
    // «Non aveva ne pane ne companatico»: due accenti da mettere nello stesso
    // paragrafo, e nella stessa run.
    const paragrafi = await estraiParagrafiDocx(semplice);
    const indice = paragrafi.findIndex((p) => p.testo.includes("ne pane ne companatico"));
    expect(indice).toBeGreaterThanOrEqual(0);
    const testo = paragrafi[indice]!.testo;

    const primo = testo.indexOf("ne pane");
    const secondo = testo.indexOf("ne companatico");
    expect(secondo).toBeGreaterThan(primo);

    const esito = await generaDocumentoRevisionato(
      semplice,
      [
        {
          id: "a",
          indiceParagrafo: indice,
          inizio: primo,
          fine: primo + 2,
          prima: "ne",
          dopo: "né",
        },
        {
          id: "b",
          indiceParagrafo: indice,
          inizio: secondo,
          fine: secondo + 2,
          prima: "ne",
          dopo: "né",
        },
      ],
      { autore: "Philippe Marchand", data: new Date("2026-09-05T10:00:00Z") },
    );

    expect(esito.applicati).toBe(2);
    expect(esito.saltati).toEqual([]);

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    esigiXmlBenFormato(xml);
    expect(idRevisioneDuplicati(xml)).toEqual([]);

    // Due revisioni distinte, non una sola: il redattore deve poterle
    // accettare separatamente.
    expect([...xml.matchAll(/<w:ins /g)]).toHaveLength(2);
    expect([...xml.matchAll(/<w:del /g)]).toHaveLength(2);

    const accettato = testoParagrafi(accettaTutte(xml));
    expect(accettato[indice]).toBe("Non aveva né pane né companatico, eppure sorrideva.");

    // E rifiutando tutto si torna esattamente al testo di partenza.
    expect(testoParagrafi(rifiutaTutte(xml))[indice]).toBe(testo);
  });

  it("salta il secondo di due interventi sovrapposti", async () => {
    const paragrafi = await estraiParagrafiDocx(semplice);
    const indice = paragrafi.findIndex((p) => p.testo.includes("acuqa"));
    const testo = paragrafi[indice]!.testo;
    const posizione = testo.indexOf("acuqa");

    const esito = await generaDocumentoRevisionato(
      semplice,
      [
        {
          id: "largo",
          indiceParagrafo: indice,
          inizio: posizione,
          fine: posizione + "acuqa".length,
          prima: "acuqa",
          dopo: "acqua",
        },
        {
          id: "dentro",
          indiceParagrafo: indice,
          inizio: posizione + 1,
          fine: posizione + 3,
          prima: testo.slice(posizione + 1, posizione + 3),
          dopo: "XX",
        },
      ],
      { autore: "R" },
    );

    expect(esito.applicati).toBe(1);
    expect(esito.saltati).toHaveLength(1);
    expect(esito.saltati[0]!.motivo).toMatch(/sovrappost/);
    expect(esito.richiedeVerifica).toBe(true);

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    esigiXmlBenFormato(await pacchetto.leggiTesto(PARTE_DOCUMENTO));
  });

  it("mantiene l'XML ben formato con millenovecento interventi ammassati", async () => {
    // Su un manoscritto vero le correzioni si accumulano nelle stesse run:
    // è la situazione che il documento lungo riproduce.
    const paragrafi = await estraiParagrafiDocx(lungo);
    const interventi: InterventoApprovato[] = [];

    for (const [i, p] of paragrafi.entries()) {
      for (const [da, a] of [
        ["acuqa", "acqua"],
        ["tornato , ma", "tornato, ma"],
      ] as const) {
        const posizione = p.testo.indexOf(da);
        if (posizione === -1) continue;
        interventi.push({
          id: `${da}-${i}`,
          indiceParagrafo: i,
          inizio: posizione,
          fine: posizione + da.length,
          prima: da,
          dopo: a,
        });
      }
    }

    expect(interventi.length).toBeGreaterThan(1_000);

    const esito = await generaDocumentoRevisionato(lungo, interventi, { autore: "R" });
    expect(esito.applicati).toBe(interventi.length);

    const pacchetto = await PacchettoDocx.apri(esito.contenuto);
    const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
    esigiXmlBenFormato(xml);
    expect(idRevisioneDuplicati(xml)).toEqual([]);

    // Rifiutando tutto si ricostruisce il manoscritto originale, parola per
    // parola: è la prova che nessun byte è andato perso per strada.
    const originale = (await estraiParagrafiDocx(lungo)).map((p) => p.testo);
    expect(testoParagrafi(rifiutaTutte(xml))).toEqual(originale);
  }, 60_000);
});

describe("documenti prodotti", () => {
  it("scrive i file di prova per la verifica con un lettore OOXML reale", async () => {
    // I file finiscono in una cartella temporanea e vengono verificati da
    // scripts/verifica-docx.sh, che li apre con LibreOffice: un consumatore
    // indipendente dal parser di questo repository.
    const cartella = await mkdtemp(path.join(tmpdir(), "proemios-docx-"));

    const casi: [string, Buffer, InterventoApprovato[]][] = [
      ["semplice-revisionato", semplice, [await interventoSu(semplice, "acuqa", "acqua")]],
      [
        "ricco-revisionato",
        ricco,
        [
          await interventoSu(ricco, "acuqa", "acqua"),
          await interventoSu(ricco, "punto , con", "punto, con", "Spazio prima della virgola."),
        ],
      ],
    ];

    for (const [nome, originale, interventi] of casi) {
      const esito = await generaDocumentoRevisionato(originale, interventi, {
        autore: "Philippe Marchand",
      });
      await writeFile(path.join(cartella, `${nome}.docx`), esito.contenuto);
    }

    // Il percorso viene stampato: lo script di verifica lo usa.
    console.log(`documenti di prova in ${cartella}`);
    expect(cartella).toBeTruthy();
    await rm(cartella, { recursive: true, force: true });
  });
});
