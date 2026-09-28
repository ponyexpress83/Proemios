import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Gabbia, Occhiello } from "@/components/ui/primitivi";
import { Avviso } from "@/components/ui/stati";
import { ModuloAccesso } from "@/components/auth/modulo-accesso";
import { attoreCorrente } from "@/lib/auth/sessione";
import { metadatiPagina } from "@/lib/seo";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = metadatiPagina({
  titolo: "Accedi",
  descrizione: "Accedi all'area riservata di Proemios.",
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
    <Gabbia className="flex min-h-[70dvh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-3">
          <Occhiello>Area riservata</Occhiello>
          <h1 className="text-3xl font-semibold text-testo">Accedi a {BRAND.name}</h1>
          <p className="text-sm leading-relaxed text-testo-attenuato">
            Ti mandiamo un link di accesso via email. Non serve una password: il link vale una
            volta sola e scade dopo poco.
          </p>
        </div>

        {errore ? (
          <Avviso tono="errore" titolo="Accesso non riuscito" className="mt-6">
            Il link potrebbe essere scaduto o già usato. Richiedine uno nuovo qui sotto.
          </Avviso>
        ) : null}

        <ModuloAccesso destinazione={da} className="mt-8" />

        <p className="mt-8 text-xs leading-relaxed text-testo-tenue">
          L&rsquo;accesso è su invito. Se non hai ancora un account e stai lavorando con noi,
          scrivi al tuo referente: non è possibile registrarsi da questa pagina.
        </p>
      </div>
    </Gabbia>
  );
}
