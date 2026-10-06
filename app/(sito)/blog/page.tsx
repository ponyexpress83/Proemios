import type { Metadata } from "next";
import { InternalPage } from "@/components/editorial/internal-pages";
import { metadatiPagina, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Guide sull'autopubblicazione",
  descrizione:
    "Costi, ISBN, Amazon KDP, editing, EPUB, ghostwriting: guide pratiche per chi vuole pubblicare un libro senza dover indovinare.",
  path: "/blog",
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Home", path: "/" },
          { nome: "Blog", path: "/blog" },
        ])}
      />
      <InternalPage route="blog" />
    </>
  );
}
