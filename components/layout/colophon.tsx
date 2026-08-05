import type { Route } from "next";
import Link from "next/link";
import { Marchio } from "./marchio";
import { Filetto } from "@/components/ui/primitivi";
import { BRAND } from "@/config/brand";
import { NAV_COLOPHON } from "@/config/copy";
import { MARCHIO, TITOLARE } from "@/config/legal";

/**
 * Colophon: in un libro è la pagina che dichiara come è stato prodotto.
 * Qui ospita la navigazione, i metadati e — per obbligo — la formula sull'AI.
 */
export function Colophon() {
  return (
    <footer className="bg-notte text-carta su-notte">
      <div className="gabbia py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-xs">
            <Marchio tono="notte" />
            <p className="glossa text-carta/60 mt-4">{BRAND.payoff}</p>
            <p className="font-lettura text-carta/70 mt-4 text-sm leading-relaxed">
              {BRAND.tagline}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {NAV_COLOPHON.map((colonna) => (
              <div key={colonna.titolo}>
                <h2 className="apparato text-ottone mb-3">{colonna.titolo}</h2>
                <ul className="space-y-2">
                  {colonna.voci.map((voce) => (
                    <li key={voce.href}>
                      <Link
                        href={voce.href as Route}
                        className="garbo font-ui text-carta/70 hover:text-carta text-sm"
                      >
                        {voce.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Formula vincolante sull'AI (brief §3.9) */}
        <div className="border-ottone/60 mt-14 border-l-2 pl-5">
          <p className="font-lettura text-carta/70 text-sm leading-relaxed">{BRAND.aiDisclaimer}</p>
        </div>

        <Filetto className="mt-10" tono="notte" />

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
          {/* Il marchio è Proemios, la controparte contrattuale è la società.
              La dichiarazione in maiuscoletto, i dati di registro in tondo:
              quattro righe tutte spaziate non si leggerebbero. */}
          <div className="max-w-md">
            <p className="apparato text-carta/45">{MARCHIO.attribuzione}</p>
            <p className="font-ui text-carta/40 mt-2 text-xs leading-relaxed">
              {TITOLARE.sedeLegale} · P. IVA {TITOLARE.partitaIva} · {TITOLARE.registroImprese} ·
              PEC {TITOLARE.pec}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a
              href={`mailto:${BRAND.email.general}`}
              className="garbo font-ui text-carta/60 hover:text-carta text-sm"
            >
              {BRAND.email.general}
            </a>
            <Link
              href={"/contatti" as Route}
              className="garbo font-ui text-carta/60 hover:text-carta text-sm"
            >
              Contatti
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
