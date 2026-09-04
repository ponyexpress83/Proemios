import type { Route } from "next";
import Link from "next/link";
import { Marchio } from "./marchio";
import { BRAND } from "@/config/brand";
import { NAV_COLOPHON } from "@/config/navigazione";
import { MARCHIO, TITOLARE } from "@/config/legal";

const COLONNE = [
  { titolo: "Offerta", voci: NAV_COLOPHON.offerta },
  { titolo: "Studio", voci: NAV_COLOPHON.studio },
  { titolo: "Legale", voci: NAV_COLOPHON.legale },
] as const;

/**
 * Piè di pagina. Ospita navigazione, anagrafica societaria (obbligo di legge)
 * e la formula sull'uso della tecnologia, che deve comparire dove il cliente
 * possa sempre ritrovarla.
 */
export function Colophon() {
  return (
    <footer className="mt-auto border-t border-bordo bg-fondo-alto">
      <div className="gabbia py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="flex max-w-sm flex-col gap-4">
            <Marchio />
            <p className="editoriale text-xl text-testo-attenuato">{BRAND.payoff}.</p>
            <p className="text-sm leading-relaxed text-testo-tenue">{BRAND.tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLONNE.map((colonna) => (
              <div key={colonna.titolo}>
                <h2 className="etichetta mb-4 text-testo-tenue">{colonna.titolo}</h2>
                <ul className="flex flex-col gap-2.5">
                  {colonna.voci.map((voce) => (
                    <li key={voce.href}>
                      <Link
                        href={voce.href as Route}
                        className="garbo text-sm text-testo-attenuato hover:text-testo"
                      >
                        {voce.titolo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-bordo pt-8">
          <p className="lettura text-xs leading-relaxed text-testo-tenue">{BRAND.aiDisclaimer}</p>
          <div className="flex flex-col gap-2 text-xs text-testo-tenue sm:flex-row sm:items-center sm:justify-between">
            <p>
              {MARCHIO.attribuzione} · P. IVA {TITOLARE.partitaIva} · {TITOLARE.sedeLegale}
            </p>
            <p className="cifre">© {new Date().getFullYear()} {TITOLARE.ragioneSociale}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
