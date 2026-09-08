/**
 * Estrazione dei paragrafi da un DOCX, con gli identificativi OOXML.
 *
 * L'identificativo serve al motore Track Changes: senza, si potrebbe solo
 * ricostruire un documento nuovo dal testo, che è ciò che il capitolato vieta.
 */
import type { Paragrafo } from "@/lib/produzione/segmentazione";
import { PacchettoDocx, PARTE_DOCUMENTO } from "./pacchetto";
import { leggiParagrafi } from "./ooxml";

export async function estraiParagrafiDocx(contenuto: Buffer): Promise<Paragrafo[]> {
  const pacchetto = await PacchettoDocx.apri(contenuto);
  const xml = await pacchetto.leggiTesto(PARTE_DOCUMENTO);

  return leggiParagrafi(xml)
    .filter((p) => p.testo.trim().length > 0)
    .map((p, i) => ({
      // L'indice viene rinumerato sui soli paragrafi con testo: è quello che
      // il modello vede e cita, e deve corrispondere a ciò che riceve.
      indice: i,
      testo: p.testo,
      // Se Word non ha assegnato un paraId, l'indice originale nel documento
      // resta comunque un riferimento utilizzabile.
      idOoxml: p.paraId ?? `idx:${p.indice}`,
    }));
}

/** Testo integrale, per il conteggio parole e l'anteprima. */
export async function estraiTestoDocx(contenuto: Buffer): Promise<string> {
  const paragrafi = await estraiParagrafiDocx(contenuto);
  return paragrafi.map((p) => p.testo).join("\n\n");
}
