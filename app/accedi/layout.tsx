import { Logo } from "@/components/sito/logo";

/**
 * Guscio minimo delle pagine di accesso: il marchio e basta, nessuna
 * navigazione né piè di pagina. Chi sta entrando non deve avere altre strade
 * davanti, e le pagine di accesso non sono indicizzabili.
 *
 * `data-tema="carta"` le mette nel tema chiaro del sito pubblico — l'accesso
 * è l'ultima pagina pubblica, non la prima dell'area riservata.
 * `id="contenuto"` è la destinazione del «Vai al contenuto» del layout radice.
 */
export default function LayoutAccesso({ children }: { children: React.ReactNode }) {
  return (
    <div data-tema="carta" className="flex min-h-dvh flex-col bg-carta text-inchiostro">
      <header className="border-b border-filetto">
        <div className="mx-auto flex h-16 w-full max-w-pagina items-center px-4 md:px-6">
          <Logo />
        </div>
      </header>
      <main id="contenuto" className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-pagina px-4 py-12 md:px-6 lg:py-20">{children}</div>
      </main>
    </div>
  );
}
