import { QuotePage } from "@/components/editorial/operational-pages";
import type { Metadata } from "next";
import { quotePrefill } from "@/lib/quote-brief";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Calcola il preventivo",
  descrizione:
    "Un percorso guidato e ottieni tre percorsi con il prezzo per pubblicare il tuo libro: editing, impaginazione, copertina, EPUB, ISBN e pubblicazione su Amazon KDP.",
  path: "/preventivo",
});

export default async function PreventivoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <QuotePage precompilato={quotePrefill(await searchParams)} />;
}
