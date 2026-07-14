import Link from "next/link";
import type { Route } from "next";
import { NAV_FOOTER, SITE, AI_DISCLAIMER } from "@/config/site";
import { Wordmark } from "@/components/ui/Wordmark";

export function Footer() {
  const anno = 2026; // aggiornare o rendere dinamico lato build

  return (
    <footer className="bg-inchiostro text-carta">
      <div className="container-editorial py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="max-w-sm">
            <Wordmark tone="light" />
            <p className="text-carta/65 mt-4 text-sm leading-relaxed">{SITE.tagline}</p>
            <p className="text-carta/45 mt-3 text-xs">{SITE.etimologia}.</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {NAV_FOOTER.map((col) => (
              <div key={col.titolo}>
                <h3 className="text-bronzo-chiaro mb-3 text-xs font-semibold tracking-[0.16em] uppercase">
                  {col.titolo}
                </h3>
                <ul className="space-y-2">
                  {col.voci.map((v) => (
                    <li key={v.href}>
                      <Link
                        href={v.href as Route}
                        className="text-carta/70 hover:text-carta text-sm transition-colors"
                      >
                        {v.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Formula legale sull'AI — vincolo non negoziabile */}
        <div className="border-carta/12 bg-carta/[0.03] mt-14 rounded-lg border p-5">
          <p className="text-carta/70 text-sm leading-relaxed">{AI_DISCLAIMER}</p>
        </div>

        <div className="border-carta/12 text-carta/45 mt-10 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {anno} {SITE.nome}. Tutti i diritti riservati.
          </p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-carta/80">
              Privacy
            </Link>
            <Link href="/termini" className="hover:text-carta/80">
              Termini
            </Link>
            <a href={`mailto:${SITE.email}`} className="hover:text-carta/80">
              {SITE.email}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
