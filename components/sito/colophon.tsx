import Link from "next/link";
import type { Route } from "next";
import { Logo } from "./logo";
import { BRAND } from "@/config/brand";
import { TITOLARE } from "@/config/legal";

/**
 * Il piè di pagina composto come il colophon di un libro: chi siamo in due
 * righe, contatti, sede, partita IVA, i link legali e il carattere usato.
 * Niente griglia di link a cinque colonne.
 */
const LEGALI: { nome: string; href: string }[] = [
  { nome: "Privacy", href: "/privacy" },
  { nome: "Termini", href: "/termini" },
  { nome: "Cookie", href: "/cookie" },
];
const SITO: { nome: string; href: string }[] = [
  { nome: "Chi siamo", href: "/chi-siamo" },
  { nome: "Contatti", href: "/contatti" },
  { nome: "Casi studio", href: "/casi-studio" },
  { nome: "Area autori", href: "/accedi" },
];

function Voce({ nome, href }: { nome: string; href: string }) {
  return (
    <Link
      href={href as Route}
      className="sottolinea-matita -my-2.5 inline-flex min-h-11 items-center rounded-campo py-2.5 text-inchiostro"
    >
      {nome}
    </Link>
  );
}

export function Colophon() {
  return (
    <footer className="border-t border-filetto bg-carta-ombra">
      <div className="mx-auto w-full max-w-pagina px-4 py-12 md:px-6 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-giustezza">
            <Logo comeLink={false} />
            <p className="mt-4 text-t-sm text-grafite">
              {BRAND.name} è il marchio con cui {TITOLARE.ragioneSociale} accompagna chi scrive
              dall&rsquo;idea al libro pubblicato: editing, impaginazione, copertina, pubblicazione.
            </p>
            <p className="mt-3 text-t-xs text-grafite">{BRAND.aiDisclaimer}</p>
          </div>

          <dl className="text-t-sm">
            <dt className="maiuscoletto text-grafite">Contatti</dt>
            <dd className="mt-2 flex flex-col gap-1">
              <a href={`mailto:${BRAND.email.general}`} className="sottolinea-matita text-inchiostro">
                {BRAND.email.general}
              </a>
              <a href={`mailto:${BRAND.email.agencies}`} className="sottolinea-matita text-inchiostro">
                {BRAND.email.agencies}
              </a>
            </dd>
            <dt className="maiuscoletto mt-5 text-grafite">Sede</dt>
            <dd className="mt-2 text-grafite">
              {TITOLARE.ragioneSociale}
              <br />
              {TITOLARE.sedeLegale}
              <br />
              P.&nbsp;IVA {TITOLARE.partitaIva}
            </dd>
          </dl>

          <nav aria-label="Pagine del sito" className="text-t-sm">
            <ul className="flex flex-col gap-1">
              {SITO.map((v) => (
                <li key={v.href}>
                  <Voce {...v} />
                </li>
              ))}
            </ul>
            <ul className="mt-5 flex flex-col gap-1">
              {LEGALI.map((v) => (
                <li key={v.href}>
                  <Voce {...v} />
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-filetto pt-6 text-t-xs text-grafite md:flex-row md:justify-between">
          <p>
            © {new Date().getFullYear()} {TITOLARE.ragioneSociale} — {BRAND.payoff}.
          </p>
          <p>Composto in Editorial e Interface.</p>
        </div>
      </div>
    </footer>
  );
}
