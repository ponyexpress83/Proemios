import { serviziPrecompilati } from "@/components/preventivo/opzioni";
import { projectTypeSchema, textStateSchema, serviceKeySchema } from "./validation";
import type { PricingInput, ProjectType, ServiceKey, TextState } from "./pricing";
import type { MaterialAmount } from "@/config/pricing";
export type QuotePrefill = {
  tipo?: ProjectType;
  servizi?: ServiceKey[];
  parole?: number;
  statoTesto?: TextState;
  tempi?: "standard" | "prioritaria";
  materiale?: MaterialAmount;
  contesto?: string;
};
export function quotePrefill(sp: Record<string, string | undefined>): QuotePrefill {
  const mapping: Record<string, ProjectType> = {
    memoir: "memoir",
    "libro-professionale": "libro-professionale",
    "storia-impresa": "libro-professionale",
    "libro-gia-scritto": "romanzo",
    "idea-da-sviluppare": "romanzo",
  };
  const type = projectTypeSchema.safeParse(sp.tipo ?? mapping[sp.percorso ?? ""]);
  const state = textStateSchema.safeParse(
    sp.stato ||
      (sp.servizio === "ghostwriting" || sp.percorso === "idea-da-sviluppare"
        ? "solo-materiali"
        : undefined),
  );
  const n = Number(sp.parole);
  const services = [
    ...new Set([
      ...serviziPrecompilati(sp.servizio),
      ...(sp.servizi || "").split(",").flatMap((k) => {
        const p = serviceKeySchema.safeParse(k);
        return p.success ? [p.data] : [];
      }),
    ]),
  ];
  const material = ["scarso", "parziale", "abbondante"].includes(sp.materiale ?? "")
    ? (sp.materiale as MaterialAmount)
    : undefined;
  return {
    tipo: type.success ? type.data : undefined,
    statoTesto: state.success ? state.data : undefined,
    parole: Number.isInteger(n) && n > 0 && n <= 2_000_000 ? n : undefined,
    servizi: services,
    tempi: sp.tempi === "prioritaria" ? "prioritaria" : "standard",
    materiale: material,
    contesto:
      sp.percorso === "storia-impresa"
        ? "Storia della mia impresa o del mio percorso di lavoro."
        : undefined,
  };
}
export function hasManuscript(input: Pick<PricingInput, "textState" | "projectType">): boolean {
  return input.textState !== "solo-materiali" && input.projectType !== "solo-grafica";
}
export function quoteStep(step: number, direction: 1 | -1, manuscript: boolean): number {
  const next = Math.max(0, Math.min(6, step + direction));
  return next === 3 && !manuscript ? next + direction : next;
}
export function applyAnalysisWords<T extends { parole: number }>(brief: T, words: number): T {
  return Number.isInteger(words) && words > 0 && words <= 2_000_000
    ? { ...brief, parole: words }
    : brief;
}
