import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { quoteAccess } from "./crm";
import { audit, type Actor } from "./access";
import { paymentPolicySchema, moneyBreakdown } from "./config";
import type { QuotePackage } from "@/lib/pricing";

export async function quotePdf(actor: Actor, id: string) {
  const { quote, record } = await quoteAccess(actor, id);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]), y = 792;
  function line(text: string, heading = false) {
    const font = heading ? bold : regular, size = heading ? 15 : 11;
    const safe = text.replace(/[^\x20-\x7e\xa0-\xff€–—’]/g, " ");
    const words = safe.split(/\s+/); let current = "";
    function draw(value: string) {
      if (y < 65) { page = pdf.addPage([595, 842]); y = 792; }
      page.drawText(value, { x: 48, y, size, font, color: rgb(.08,.1,.21) }); y -= heading ? 24 : 18;
    }
    for (const word of words) {
      if (current && font.widthOfTextAtSize(`${current} ${word}`, size) > 490) { draw(current); current = word; }
      else current += `${current ? " " : ""}${word}`;
    }
    if (current) draw(current);
  }
  const euro = (cents: number) => `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
  line("PROEMIOS · Proposta editoriale", true);
  line(`Riferimento ${id} · Versione ${record.version} · Listino ${record.pricingVersion}`);
  line(`Stato: ${record.acceptedAt ? "accettata" : "da esaminare"}`);
  if (record.expiresAt) line(`Validità: ${record.expiresAt.toLocaleDateString("it-IT")}`);
  const policy = paymentPolicySchema.safeParse(record.taxPolicy);
  line(policy.success ? `Condizioni ${policy.data.termsVersion} · IVA ${policy.data.vatRateBps / 100}% (${policy.data.vatMode})` : "Stima indicativa: condizioni economiche da confermare dal team.");
  for (const p of quote.pacchettiGenerati as QuotePackage[]) {
    y -= 15;
    line(p.name, true);
    const money = policy.success ? moneyBreakdown(p.total, policy.data) : null;
    line(`Totale ${euro(money?.grossCents ?? Math.round(p.total * 100))}`);
    if (money) line(`Imponibile ${euro(money.netCents)} · IVA ${euro(money.taxCents)}`);
    const deposit = policy.success ? moneyBreakdown(p.deposit, policy.data).grossCents : Math.round(p.deposit * 100);
    line(`Acconto ${euro(deposit)} · Saldo ${euro((money?.grossCents ?? p.total * 100) - deposit)}`);
    for (const item of p.lineItems) line(`- ${item.label}`);
  }
  y -= 15;
  line("Documento di proposta. Non è una fattura elettronica o una firma qualificata.");
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`Proemios · ${i + 1} / ${pages.length}`, { x: 48, y: 35, size: 9, font: regular }));
  await audit(actor, "quote.pdf-downloaded", "quote", id, { version: record.version });
  return new Response(Buffer.from(await pdf.save()), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=proemios-proposta-v${record.version}.pdf`,
    "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
  } });
}
