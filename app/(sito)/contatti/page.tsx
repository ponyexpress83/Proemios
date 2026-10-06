import type { Metadata } from "next";
import { ContactPage } from "@/components/editorial/operational-pages";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Contatti",
  descrizione:
    "Scrivici o prenota una call con Proemios. Parliamo del tuo progetto editoriale: la prima conversazione è gratuita e senza impegno.",
  path: "/contatti",
});

export default function ContattiPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Contatti", path: "/contatti" },
        ])}
      />
      <ContactPage />
    </>
  );
}
