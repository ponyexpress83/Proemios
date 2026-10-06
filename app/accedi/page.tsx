import { DemoLogin } from "@/components/author/demo-login";
import { metadatiPagina } from "@/lib/seo";
export const metadata = metadatiPagina({
  titolo: "Accedi all’area autori",
  descrizione:
    "Entra nello spazio Proemios e prova la demo autore: stato del libro, messaggi, revisioni e consegne.",
  path: "/accedi",
  noindex: true,
});
export default function Page() {
  return <DemoLogin />;
}
