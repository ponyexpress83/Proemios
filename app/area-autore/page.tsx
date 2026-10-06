import { AuthorWorkspace } from "@/components/author/workspace";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Il tuo spazio autore",
  descrizione:
    "Prova l’area autore Proemios: progetto, messaggi, file e approvazioni in una demo con dati di esempio.",
  path: "/area-autore",
  noindex: true,
});
export default function Page() {
  return <AuthorWorkspace />;
}
