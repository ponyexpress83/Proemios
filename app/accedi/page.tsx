import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModuloAccesso } from "@/components/auth/modulo-accesso";
import { attoreCorrente } from "@/lib/auth/sessione";
import { metadatiPagina } from "@/lib/seo";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = metadatiPagina({
  titolo: "Area autori",
  descrizione: "Entra nell'area autore di Proemios con un link inviato via email.",
  path: "/accedi",
  noindex: true,
});

export default async function PaginaAccesso({
  searchParams,
}: {
  searchParams: Promise<{ da?: string; errore?: string }>;
}) {
  const { da, errore } = await searchParams;

  // Chi è già dentro non deve vedere la pagina di accesso.
  const attore = await attoreCorrente();
  if (attore) redirect(attore.ruolo === "client" ? "/area" : "/admin");

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-serif text-t-xl text-balance text-inchiostro">Entra nell&rsquo;area autore</h1>
      <p className="mt-3 text-t-base text-grafite">
        Ti mandiamo un link di accesso via email. Non serve una password: il link vale una volta
        sola e scade dopo poco.
      </p>

      {errore ? (
        <div className="mt-6 rounded-foglio border-2 border-rosso-matita bg-bianco p-4 text-t-sm" role="alert">
          <p className="font-bold text-inchiostro">Accesso non riuscito.</p>
          <p className="mt-1 text-grafite">
            Il link potrebbe essere scaduto o già usato. Richiedine uno nuovo qui sotto.
          </p>
        </div>
      ) : null}

      <ModuloAccesso destinazione={da} className="mt-8" />

      <p className="mt-8 text-t-sm text-grafite">
        L&rsquo;accesso è su invito: se stai lavorando con {BRAND.name} e non hai ancora un account,
        scrivi al tuo referente. Da questa pagina non ci si può registrare.
      </p>
    </div>
  );
}
