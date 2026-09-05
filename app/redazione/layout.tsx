import type { Metadata } from "next";
import Link from "next/link";
import { Gabbia } from "@/components/ui/primitivi";
import { Badge } from "@/components/ui/badge";
import { Marchio } from "@/components/layout/marchio";
import { BottoneEsci } from "@/components/auth/bottone-esci";
import { staffPerPagina } from "@/lib/auth/sessione";
import { ETICHETTE_RUOLO } from "@/lib/auth/ruoli";

export const metadata: Metadata = {
  title: { default: "Banco di revisione", template: "%s · Banco di revisione" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Guscio del banco di revisione.
 *
 * È una superficie separata dal back-office di proposito: il redattore lavora
 * su un testo per ore, e ogni elemento che non riguarda quel testo — CRM,
 * pagamenti, cruscotti — è rumore. La barra è ridotta al minimo.
 *
 * Il permesso è verificato qui e di nuovo in ogni pagina: un layout non è una
 * barriera, Next.js può servire una pagina figlia senza rieseguirlo.
 */
export default async function LayoutRedazione({ children }: { children: React.ReactNode }) {
  const attore = await staffPerPagina("/redazione", "job.vedi_assegnati");

  return (
    <div className="min-h-[80dvh]">
      <header className="border-bordo bg-fondo/90 sticky top-0 z-40 border-b backdrop-blur-xl">
        <Gabbia className="flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Marchio misura="piccola" />
            <Link
              href="/redazione"
              className="garbo text-testo-attenuato hover:text-testo text-sm font-medium"
            >
              Banco di revisione
            </Link>
            <Badge tono="viola">{ETICHETTE_RUOLO[attore.ruolo]}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="garbo text-testo-tenue hover:text-testo hidden text-sm sm:inline"
            >
              Back-office
            </Link>
            <BottoneEsci />
          </div>
        </Gabbia>
      </header>

      <main id="contenuto" className="gabbia py-8">
        {children}
      </main>
    </div>
  );
}
