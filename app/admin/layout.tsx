import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Gabbia } from "@/components/ui/primitivi";
import { Marchio } from "@/components/layout/marchio";
import { BottoneEsci } from "@/components/auth/bottone-esci";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { ETICHETTE_RUOLO } from "@/lib/auth/ruoli";
import { ETICHETTE_GRUPPO, NAV_BACK_OFFICE, type VoceBackOffice } from "@/config/back-office";
import { demoEsplicita } from "@/lib/demo";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s · Back-office" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Guscio del back-office. Verifica l'accesso lato server e costruisce la barra
 * dai permessi dell'attore: una sezione nuova non può comparire a un ruolo per
 * dimenticanza, perché la voce dichiara il proprio permesso.
 *
 * La verifica è ripetuta in ogni pagina: un layout non è una barriera, Next.js
 * può servire una pagina figlia senza rieseguirlo.
 */
export default async function LayoutBackOffice({ children }: { children: React.ReactNode }) {
  // In demo esplicita non c'è database dietro: il cruscotto è navigabile con
  // dati d'esempio. Non basta l'assenza di DATABASE_URL — vedi lib/demo.ts.
  if (demoEsplicita()) {
    return <div className="min-h-[80dvh]">{children}</div>;
  }

  const attore = await staffPerPagina("/admin");
  const gruppi = new Map<VoceBackOffice["gruppo"], VoceBackOffice[]>();
  for (const voce of NAV_BACK_OFFICE) {
    if (!haPermesso(attore, voce.permesso)) continue;
    const lista = gruppi.get(voce.gruppo) ?? [];
    lista.push(voce);
    gruppi.set(voce.gruppo, lista);
  }

  return (
    <div className="min-h-[80dvh]">
      <header className="sticky top-0 z-40 border-b border-bordo bg-fondo/90 backdrop-blur-xl">
        <Gabbia className="flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Marchio misura="piccola" />
            <Badge tono="viola">{ETICHETTE_RUOLO[attore.ruolo]}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-testo-tenue sm:inline">{attore.email}</span>
            <BottoneEsci />
          </div>
        </Gabbia>
      </header>

      <div className="gabbia flex flex-col gap-8 py-6 lg:flex-row lg:gap-10">
        <nav aria-label="Back-office" className="shrink-0 lg:w-52">
          <div className="flex flex-row gap-6 overflow-x-auto lg:flex-col lg:gap-7">
            {[...gruppi.entries()].map(([gruppo, voci]) => (
              <div key={gruppo} className="flex shrink-0 flex-col gap-1">
                <p className="etichetta mb-1 text-testo-tenue">{ETICHETTE_GRUPPO[gruppo]}</p>
                {voci.map((v) => (
                  <Link
                    key={v.href}
                    href={v.href as Route}
                    className="garbo -mx-2 rounded-md px-2 py-1.5 text-sm whitespace-nowrap text-testo-attenuato hover:bg-superficie hover:text-testo"
                  >
                    {v.titolo}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </nav>

        <main id="contenuto" className="min-w-0 flex-1">
            {children}
          </main>
      </div>
    </div>
  );
}
