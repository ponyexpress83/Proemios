import { ContactPage } from "@/components/editorial/operational-pages";
import type { Metadata } from "next";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Contatti",
  descrizione:
    "Scrivici o prenota una call con Proemios. Parliamo del tuo progetto editoriale: la prima conversazione è gratuita e senza impegno.",
  path: "/contatti",
});

export default async function ContattiPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; quote?: string }>;
}) {
  const sp = await searchParams;
  const motivo = sp.motivo === "editor" ? "editor" : undefined;
  const quote =
    sp.quote && /^(demo-[a-z]+-\d+|[0-9a-f-]{36})$/.test(sp.quote) ? sp.quote : undefined;
  return <ContactPage motivo={motivo} quote={quote} />;
}
