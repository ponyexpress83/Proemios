import type { Metadata } from "next";
import { QuotePage } from "@/components/editorial/operational-pages";
import { serviziPrecompilati } from "@/components/preventivo/opzioni";
import { projectTypeSchema } from "@/lib/validation";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";
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
  searchParams: Promise<{ tipo?: string; servizio?: string; parole?: string; percorso?: string }>;
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
  const servizi = serviziPrecompilati(sp.servizio);
  const paroleNum = Number(sp.parole);
  const parole =
    Number.isFinite(paroleNum) && paroleNum > 0 && paroleNum < 2_000_000 ? paroleNum : undefined;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Preventivo", path: "/preventivo" },
        ])}
      />
      <QuotePage precompilato={{ tipo, servizi, parole }} />
    </>
  );
}
