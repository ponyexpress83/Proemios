import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PreventivoWizard } from "@/components/preventivo/PreventivoWizard";
import { prefillServiziForService } from "@/components/preventivo/options";
import { getService, type ProjectType } from "@/config/services";
import { projectTypeSchema } from "@/lib/validation";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Configura un preventivo",
  description:
    "Configuratore di preventivo per il tuo libro: rispondi a poche domande e ottieni subito tre pacchetti con prezzo. Editing, impaginazione, copertina, KDP e ghostwriting.",
  path: "/preventivo",
});

export default async function PreventivoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; servizio?: string }>;
}) {
  const sp = await searchParams;

  const tipoParsed = projectTypeSchema.safeParse(sp.tipo);
  const projectType: ProjectType | undefined = tipoParsed.success ? tipoParsed.data : undefined;
  const service = sp.servizio ? getService(sp.servizio) : undefined;
  const servizi = prefillServiziForService(service);

  return (
    <>
      <section className="bg-carta">
        <Container className="pt-14 pb-6 sm:pt-16">
          <p className="text-bronzo mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
            Preventivo
          </p>
          <h1 className="font-display text-inchiostro max-w-2xl text-3xl leading-[1.1] font-medium text-balance sm:text-4xl">
            Il tuo preventivo, in due minuti
          </h1>
          <p className="text-inchiostro-60 mt-4 max-w-xl leading-relaxed">
            Rispondi a poche domande: calcoliamo subito tre pacchetti su misura. Nessun impegno, l
            {"'"}acconto si versa solo quando decidi di partire.
          </p>
        </Container>
      </section>

      <Container className="pb-24">
        <div className="border-linea bg-carta rounded-xl border p-6 sm:p-10">
          <PreventivoWizard prefill={{ projectType, servizi }} />
        </div>
      </Container>
    </>
  );
}
