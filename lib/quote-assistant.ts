import type { ProjectType, TextState, PricingInput, ServiceKey } from "./pricing";
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

/** Precompila soltanto i dettagli espliciti: la persona li conferma nel form. */
export function briefFromText(text: string): Partial<PricingInput> {
  const result: Partial<PricingInput> = {};
  const project = projectFromText(text);
  const state = /finit|scritto|incomplet|bozza|metà|idea|material|appunti|registraz/i.test(text)
    ? stateFromText(text)
    : undefined;
  if (project) result.projectType = project;
  if (state) result.textState = state;
  // Non scambiare un anno, un'età o un numero di capitoli per il conteggio.
  const wordPhrase = text.match(
    /(?:-?\d[\d.,\s]*\s*(?:mila|k)?|(?:venti|cinquanta|ottanta|centoventi)\s*mila)\s+parole/i,
  );
  if (wordPhrase) {
    const words = wordsFromText(
      wordPhrase[0].replace(/(venti|cinquanta|ottanta|centoventi)\s+mila/i, "$1mila"),
    );
    if (words) result.wordCount = words;
  }
  const patterns: [ServiceKey, RegExp][] = [
    ["editing", /\bediting\b|editare/i],
    ["proofreading", /correzione (?:delle )?bozze|refusi/i],
    ["layout", /impaginazione|impaginare/i],
    ["epub", /\bepub\b|\bebook\b/i],
    ["cover", /copertina/i],
    ["kdp", /\bkdp\b|pubblicare su amazon|pubblicazione amazon/i],
    ["isbn", /\bisbn\b/i],
    ["amazonListing", /scheda amazon/i],
  ];
  // Evita di aggiungere servizi quando il frammento li nega.
  const clauses = text.split(/[.!?;,]|\b(?:ma|però)\b/i);
  const services = patterns
    .filter(([, regex]) =>
      clauses.some((clause) => !/\b(non|nessun|senza|no)\b/i.test(clause) && regex.test(clause)),
    )
    .map(([service]) => service);
  if (services.length) result.requestedServices = services;
  return result;
}
