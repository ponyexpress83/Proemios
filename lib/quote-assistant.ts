import type { ProjectType, TextState, PricingInput } from "./pricing";
export function projectFromText(text: string): ProjectType | undefined {
  const t = text.toLowerCase();
  if (/memoir|autobiograf|storia (vera|di vita)|ricordi|diario/.test(t)) return "memoir";
  if (/profession|azienda|metodo/.test(t)) return "libro-professionale";
  if (/saggio|manuale|divulg/.test(t)) return "saggio";
  if (/romanzo|raccont[oi]|narrativ/.test(t)) return "romanzo";
  if (/grafica|solo copertina/.test(t)) return "solo-grafica";
}
export function stateFromText(text: string): TextState | undefined {
  const t = text.toLowerCase();
  if (/idea|material|appunti|registraz|non.*scritto/.test(t)) return "solo-materiali";
  if (/incomplet|bozza|metà/.test(t)) return "bozza-incompleta";
  if (/già revision|gia revision|già edit|gia edit/.test(t)) return "finito-revisionato";
  if (/finit|scritto|revision|editing|editare/.test(t)) return "finito-da-revisionare";
}
export function wordsFromText(text: string): number | undefined {
  const t = text
    .toLowerCase()
    .replace(
      /(venti|cinquanta|ottanta|centoventi)mila/g,
      (_, v: string) =>
        ({ venti: "20000", cinquanta: "50000", ottanta: "80000", centoventi: "120000" })[v]!,
    );
  if (/-\s*\d/.test(t)) return;
  const m = t.match(/(\d+(?:[.,]\d+)*(?:\s+\d{3})*)\s*(mila|k)?/);
  if (!m) return;
  const multiplier = m[2] ? 1000 : 1;
  const raw = m[1]!.replace(/\s/g, "");
  const grouped = /^\d{1,3}([.,]\d{3})+$/.test(raw);
  const numeric = grouped ? raw.replace(/[.,]/g, "") : raw.replace(",", ".");
  const value = Number(numeric) * multiplier;
  return Number.isInteger(value) && value >= 1 && value <= 2_000_000 ? value : undefined;
}
export function quoteWizardUrl(input: PricingInput): string {
  const params = new URLSearchParams({
    tipo: input.projectType,
    stato: input.textState,
    parole: String(input.wordCount),
    tempi: input.urgency || "standard",
    servizi: (input.requestedServices || []).join(","),
  });
  return "/preventivo?" + params.toString();
}
