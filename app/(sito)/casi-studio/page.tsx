import type { Metadata } from "next";
import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Casi studio",
  descrizione:
    "Progetti editoriali reali seguiti da Proemios: un memoir nato da trent'anni di diari, una pubblicazione KDP con ISBN proprio, un manuale professionale.",
  path: "/casi-studio",
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Casi studio", path: "/casi-studio" },
        ])}
      />
      <InternalPage route="casi-studio" />
    </>
  );
}
