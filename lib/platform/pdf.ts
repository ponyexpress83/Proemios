import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

/**
 * Impaginatore minimo per i documenti generati dal server (proposta, contratto):
 * testo a capo automatico, pagine A4, numerazione. Nessun font esterno, così
 * la generazione non dipende da file o rete.
 */
export class SimplePdf {
  private pdf!: PDFDocument;
  private regular!: PDFFont;
  private bold!: PDFFont;
  private page!: PDFPage;
  private y = 792;
  static async create() {
    const doc = new SimplePdf();
    doc.pdf = await PDFDocument.create();
    doc.regular = await doc.pdf.embedFont(StandardFonts.Helvetica);
    doc.bold = await doc.pdf.embedFont(StandardFonts.HelveticaBold);
    doc.page = doc.pdf.addPage([595, 842]);
    return doc;
  }
  space(points = 15) { this.y -= points; }
  line(text: string, options: { heading?: boolean; size?: number; indent?: number } = {}) {
    const font = options.heading ? this.bold : this.regular, size = options.size ?? (options.heading ? 14 : 10.5);
    const indent = options.indent ?? 0;
    const safe = text.replace(/[^\x20-\x7e\xa0-\xff€–—’‘“”…]/g, " ").replace(/€/g, "EUR");
    const words = safe.split(/\s+/); let current = "";
    const draw = (value: string) => {
      if (this.y < 65) { this.page = this.pdf.addPage([595, 842]); this.y = 792; }
      this.page.drawText(value, { x: 48 + indent, y: this.y, size, font, color: rgb(0.08, 0.1, 0.21) });
      this.y -= options.heading ? 22 : size + 5.5;
    };
    for (const word of words) {
      if (current && font.widthOfTextAtSize(`${current} ${word}`, size) > 490 - indent) { draw(current); current = word; }
      else current += `${current ? " " : ""}${word}`;
    }
    if (current) draw(current);
  }
  async finish(footer: string) {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => p.drawText(`${footer} · ${i + 1} / ${pages.length}`, { x: 48, y: 35, size: 8.5, font: this.regular, color: rgb(0.35, 0.35, 0.4) }));
    return Buffer.from(await this.pdf.save());
  }
}
export const euroCents = (cents: number) => `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
