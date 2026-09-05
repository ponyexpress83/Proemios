/**
 * Validazione dei file in ingresso.
 *
 * Modulo puro: nessun accesso a rete o database, così è testabile e utilizzabile
 * anche lato client per dare un errore immediato — restando inteso che il
 * controllo che conta è quello del server, perché il client può mentire.
 */

export const DIMENSIONE_MASSIMA_BYTE = 60 * 1024 * 1024; // 60 MB

/**
 * Tipi accettati, con la firma binaria attesa.
 *
 * Il `Content-Type` dichiarato dal browser non è una prova: un eseguibile
 * rinominato in `.docx` arriva con il MIME del DOCX. Per i formati che hanno
 * una firma riconoscibile la verifichiamo sui primi byte.
 */
export const TIPI_AMMESSI: Record<
  string,
  { estensioni: string[]; firma?: number[]; etichetta: string }
> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    estensioni: ["docx"],
    // DOCX è un pacchetto ZIP: "PK\x03\x04".
    firma: [0x50, 0x4b, 0x03, 0x04],
    etichetta: "Documento Word",
  },
  "application/pdf": {
    estensioni: ["pdf"],
    firma: [0x25, 0x50, 0x44, 0x46], // "%PDF"
    etichetta: "PDF",
  },
  "text/plain": { estensioni: ["txt", "md"], etichetta: "Testo semplice" },
  "application/epub+zip": {
    estensioni: ["epub"],
    firma: [0x50, 0x4b, 0x03, 0x04],
    etichetta: "EPUB",
  },
  "image/jpeg": {
    estensioni: ["jpg", "jpeg"],
    firma: [0xff, 0xd8, 0xff],
    etichetta: "Immagine JPEG",
  },
  "image/png": {
    estensioni: ["png"],
    firma: [0x89, 0x50, 0x4e, 0x47],
    etichetta: "Immagine PNG",
  },
  "image/webp": { estensioni: ["webp"], etichetta: "Immagine WebP" },
};

export type EsitoValidazione = { ok: true; mimeType: string } | { ok: false; motivo: string };

function estensioneDi(nome: string): string {
  const punto = nome.lastIndexOf(".");
  return punto === -1 ? "" : nome.slice(punto + 1).toLowerCase();
}

export function validaFile(params: {
  nomeFile: string;
  mimeDichiarato: string;
  dimensioneByte: number;
  /** I primi byte del contenuto. Bastano 16. */
  primiByte?: Uint8Array;
}): EsitoValidazione {
  if (params.dimensioneByte <= 0) {
    return { ok: false, motivo: "Il file è vuoto." };
  }
  if (params.dimensioneByte > DIMENSIONE_MASSIMA_BYTE) {
    const mb = Math.round(DIMENSIONE_MASSIMA_BYTE / (1024 * 1024));
    return { ok: false, motivo: `Il file supera i ${mb} MB.` };
  }

  const tipo = TIPI_AMMESSI[params.mimeDichiarato];
  if (!tipo) {
    const ammessi = [...new Set(Object.values(TIPI_AMMESSI).flatMap((t) => t.estensioni))];
    return { ok: false, motivo: `Formato non accettato. Accettiamo: ${ammessi.join(", ")}.` };
  }

  const estensione = estensioneDi(params.nomeFile);
  if (estensione && !tipo.estensioni.includes(estensione)) {
    return {
      ok: false,
      motivo: `L'estensione .${estensione} non corrisponde al tipo di file dichiarato.`,
    };
  }

  // Il controllo che conta: la firma binaria. Un eseguibile rinominato in
  // .docx passa il controllo del MIME e si ferma qui.
  if (tipo.firma && params.primiByte) {
    const combacia = tipo.firma.every((byte, i) => params.primiByte![i] === byte);
    if (!combacia) {
      return { ok: false, motivo: "Il contenuto del file non corrisponde al formato dichiarato." };
    }
  }

  return { ok: true, mimeType: params.mimeDichiarato };
}

/**
 * Ripulisce il nome del file per la visualizzazione e per l'intestazione di
 * download. Toglie separatori di percorso e caratteri di controllo, che in un
 * `Content-Disposition` permetterebbero di iniettare intestazioni.
 */
export function nomeSicuro(nome: string): string {
  const base = nome.split(/[/\\]/).pop() ?? "file";
  const ripulito = Array.from(base)
    .filter((c) => {
      const codice = c.codePointAt(0) ?? 0;
      return codice > 0x1f && codice !== 0x7f && c !== '"' && c !== "\\";
    })
    .join("")
    .trim()
    .slice(0, 200);
  return ripulito || "file";
}
