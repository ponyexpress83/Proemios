import { ContactPage } from "@/components/editorial/operational-pages";
import type { Metadata } from "next";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Contatti",
  descrizione:
    "Scrivici o prenota una call con Proemios. Parliamo del tuo progetto editoriale: la prima conversazione è gratuita e senza impegno.",
  path: "/contatti",
});

export default function ContattiPage() {
  return <ContactPage />;
}
