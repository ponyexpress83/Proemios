/**
 * Estrazione dei paragrafi da un file.
 *
 * Per il testo semplice è banale. Per il DOCX questa funzione restituisce i
 * paragrafi **con il loro identificativo OOXML**, che serve al motore Track
 * Changes della Fase 5 per riportare gli interventi nel documento originale:
 * senza l'identificativo si potrebbe solo ricostruire un DOCX nuovo dal testo,
 * che è esattamente ciò che il capitolato vieta.
 */
import type { Paragrafo } from "./segmentazione";
import { paragrafiDaTesto } from "./segmentazione";

export async function estraiParagrafi(
  contenuto: Buffer,
  mimeType: string,
): Promise<Paragrafo[]> {
  if (mimeType === "text/plain") {
    return paragrafiDaTesto(contenuto.toString("utf8"));
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    // L'estrazione OOXML vive nel motore DOCX, importato dinamicamente per non
    // trascinare le sue dipendenze nei percorsi che lavorano solo testo.
    const { estraiParagrafiDocx } = await import("@/lib/docx/estrazione");
    return estraiParagrafiDocx(contenuto);
  }

  throw new Error(
    `Formato non lavorabile dal motore editoriale: ${mimeType}. Sono lavorabili DOCX e testo semplice.`,
  );
}
