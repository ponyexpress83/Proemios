/**
 * Genera i documenti revisionati dal corpus e li apre con un lettore OOXML
 * reale (LibreOffice), per verificare che siano documenti Word validi.
 *
 * È la verifica più vicina a «Word li apre senza chiedere di ripararli» che si
 * possa fare senza Word: LibreOffice ha un parser OOXML indipendente e severo,
 * e su un documento malformato la conversione fallisce.
 *
 *   npm run docx:verifica
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const esegui = promisify(execFile);
const RADICE = process.cwd();
const CORPUS = path.join(RADICE, "tests/corpus");
const USCITA = path.join(RADICE, ".docx-verifica");

const { estraiParagrafiDocx } = await import("../lib/docx/estrazione.ts");
const { generaDocumentoRevisionato } = await import("../lib/docx/motore.ts");
const { PacchettoDocx, PARTE_DOCUMENTO } = await import("../lib/docx/pacchetto.ts");
const { accettaTutte, rifiutaTutte, testoParagrafi, idRevisioneDuplicati } =
  await import("../lib/docx/revisioni-simulazione.ts");

await rm(USCITA, { recursive: true, force: true });
await mkdir(USCITA, { recursive: true });

/** Costruisce interventi su tutte le occorrenze di un frammento. */
async function interventiSu(contenuto, coppie) {
  const paragrafi = await estraiParagrafiDocx(contenuto);
  const interventi = [];
  for (const [da, a, commento] of coppie) {
    for (const [i, p] of paragrafi.entries()) {
      const posizione = p.testo.indexOf(da);
      if (posizione === -1) continue;
      interventi.push({
        id: `${da}-${i}`,
        indiceParagrafo: i,
        inizio: posizione,
        fine: posizione + da.length,
        prima: da,
        dopo: a,
        commentoPerAutore: commento,
      });
    }
  }
  return interventi;
}

const CASI = [
  {
    nome: "semplice-revisionato",
    file: "semplice.docx",
    coppie: [
      ["acuqa", "acqua"],
      ["tornato , ma", "tornato, ma"],
      [
        "ne pane ne",
        "né pane né",
        "Accenti: sono congiunzioni negative, vogliono l'accento acuto.",
      ],
      ["Qual'è", "Qual è", "L'apostrofo qui non va."],
    ],
  },
  {
    nome: "ricco-revisionato",
    file: "ricco.docx",
    coppie: [
      ["acuqa", "acqua"],
      ["punto , con", "punto, con", "Spazio prima della virgola."],
      ["rivedere , forse", "rivedere, forse"],
    ],
  },
  {
    nome: "lungo-revisionato",
    file: "lungo.docx",
    coppie: [
      ["acuqa", "acqua"],
      ["tornato , ma", "tornato, ma"],
    ],
  },
];

let problemi = 0;

for (const caso of CASI) {
  const originale = await readFile(path.join(CORPUS, caso.file));
  const interventi = await interventiSu(originale, caso.coppie);

  const esito = await generaDocumentoRevisionato(originale, interventi, {
    autore: "Philippe Marchand",
    data: new Date("2026-09-05T10:00:00Z"),
  });

  const percorso = path.join(USCITA, `${caso.nome}.docx`);
  await writeFile(percorso, esito.contenuto);

  // Controlli strutturali sul documento prodotto.
  const pacchetto = await PacchettoDocx.apri(esito.contenuto);
  const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);
  const duplicati = idRevisioneDuplicati(xml);
  const testoAccettato = testoParagrafi(accettaTutte(xml)).join("\n");
  const testoRifiutato = testoParagrafi(rifiutaTutte(xml)).join("\n");
  const testoOriginale = (await estraiParagrafiDocx(originale)).map((p) => p.testo).join("\n");

  const righe = [
    `${caso.nome}:`,
    `  interventi applicati: ${esito.applicati} / ${interventi.length}`,
    `  saltati: ${esito.saltati.length}`,
    `  id di revisione duplicati: ${duplicati.length}`,
    `  rifiuta tutte ricostruisce l'originale: ${testoRifiutato === testoOriginale ? "sì" : "NO"}`,
    `  accetta tutte cambia il testo: ${testoAccettato !== testoOriginale ? "sì" : "NO"}`,
  ];

  if (duplicati.length > 0) problemi += 1;
  if (testoRifiutato !== testoOriginale) problemi += 1;
  if (testoAccettato === testoOriginale) problemi += 1;

  // Apertura con un lettore OOXML indipendente.
  try {
    await esegui(
      "libreoffice",
      ["--headless", "--convert-to", "txt:Text", "--outdir", USCITA, percorso],
      { timeout: 180_000 },
    );
    const estratto = await readFile(path.join(USCITA, `${caso.nome}.txt`), "utf8");
    righe.push(`  aperto da LibreOffice: sì (${estratto.split("\n").length} righe)`);
    // Il documento revisionato mostra le correzioni: il testo corretto c'è.
    if (!estratto.includes("acqua")) {
      righe.push("  ATTENZIONE: il testo corretto non compare nella conversione");
      problemi += 1;
    }
  } catch (errore) {
    righe.push(`  aperto da LibreOffice: NO — ${errore.message.slice(0, 120)}`);
    problemi += 1;
  }

  console.log(righe.join("\n"));
}

console.log(
  problemi === 0
    ? "\nTutti i documenti revisionati sono validi e apribili."
    : `\n${problemi} problemi rilevati.`,
);
process.exit(problemi === 0 ? 0 : 1);
