import type { Metadata } from "next";
import { Gabbia, Filetto } from "@/components/ui/primitivi";
import { Configuratore } from "@/components/preventivo/configuratore";
import { serviziPrecompilati } from "@/components/preventivo/opzioni";
import { projectTypeSchema } from "@/lib/validation";
import { PREVENTIVO } from "@/config/copy";
import { BRAND } from "@/config/brand";
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
  searchParams: Promise<{ tipo?: string; servizio?: string; parole?: string }>;
}) {
  const sp = await searchParams;

  const tipoParsed = projectTypeSchema.safeParse(sp.tipo);
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

      {/* Il configuratore vive interamente sul lato "software": fondo notte,
          etichetta tecnico. È il salto di registro che distingue il progetto. */}
      <div className="bg-fondo-alto text-testo  py-14 sm:py-20">
        <Gabbia>
          <div className="mb-10 max-w-2xl">
            <p className="etichetta text-lime">Strumento · gratuito</p>
            <h1 className="mt-4 text-[2.2rem] leading-[1.08] font-medium sm:text-[2.9rem]">
              {PREVENTIVO.titolo}
            </h1>
            <Filetto className="mt-6" />
            <p className="text-lg leading-relaxed text-testo-attenuato text-testo-attenuato mt-6">{PREVENTIVO.occhiello}</p>
          </div>

          <Configuratore precompilato={{ tipo, servizi, parole }} />

          <Filetto className="mt-14" />
          <p className="editoriale mt-6 max-w-2xl text-testo-tenue">{BRAND.aiDisclaimer}</p>
        </Gabbia>
      </div>
    </>
  );
}
