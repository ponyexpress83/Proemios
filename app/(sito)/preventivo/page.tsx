import type { Metadata } from "next";
import { Configuratore } from "@/components/preventivo/configuratore";
import { serviziPrecompilati } from "@/components/preventivo/opzioni";
import { Contenitore, Sezione } from "@/components/sito/sezione";
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
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <div className="mb-8 max-w-giustezza lg:mb-12">
            <h1 className="font-serif text-t-display text-balance text-inchiostro">
              Quanto costa il tuo libro?
            </h1>
            <p className="mt-4 text-t-md text-grafite">
              Sei domande. La stima compare mentre rispondi e non chiede dati personali; alla fine
              lasci un&rsquo;email per ricevere il preventivo.
            </p>
          </div>
          <Configuratore precompilato={{ tipo, servizi, parole }} />
        </Contenitore>
      </Sezione>
    </>
  );
}
