import { QuotePage } from "@/components/editorial/operational-pages";
import type { Metadata } from "next";
import { serviziPrecompilati } from "@/components/preventivo/opzioni";
import { projectTypeSchema, textStateSchema, serviceKeySchema } from "@/lib/validation";
import { metadatiPagina } from "@/lib/seo";
import type { ProjectType } from "@/lib/pricing";

export const metadata: Metadata = metadatiPagina({
  titolo: "Calcola il preventivo",
  descrizione:
    "Sei domande e ottieni tre percorsi con il prezzo per pubblicare il tuo libro: editing, impaginazione, copertina, EPUB, ISBN e pubblicazione su Amazon KDP.",
  path: "/preventivo",
});

export default async function PreventivoPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    servizio?: string;
    parole?: string;
    percorso?: string;
    stato?: string;
    tempi?: string;
    servizi?: string;
  }>;
}) {
  const sp = await searchParams;

  const tipoParsed = projectTypeSchema.safeParse(
    sp.tipo ??
      (sp.percorso === "memoir"
        ? "memoir"
        : sp.percorso === "libro-professionale"
          ? "libro-professionale"
          : sp.percorso
            ? "romanzo"
            : undefined),
  );
  const tipo: ProjectType | undefined = tipoParsed.success ? tipoParsed.data : undefined;
  const servizi = [
    ...new Set([
      ...serviziPrecompilati(sp.servizio),
      ...(sp.servizi || "").split(",").flatMap((k) => {
        const p = serviceKeySchema.safeParse(k);
        return p.success ? [p.data] : [];
      }),
    ]),
  ];
  const parsedState = textStateSchema.safeParse(
    sp.stato ||
      (sp.servizio === "ghostwriting" || sp.percorso === "idea-da-sviluppare"
        ? "solo-materiali"
        : undefined),
  );
  const statoTesto = parsedState.success ? parsedState.data : undefined;
  const tempi = sp.tempi === "prioritaria" ? "prioritaria" : "standard";
  const paroleNum = Number(sp.parole);
  const parole =
    Number.isFinite(paroleNum) && paroleNum > 0 && paroleNum < 2_000_000 ? paroleNum : undefined;

  return <QuotePage precompilato={{ tipo, servizi, parole, statoTesto, tempi }} />;
}
