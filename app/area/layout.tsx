import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gabbia } from "@/components/ui/primitivi";
import { BottoneEsci } from "@/components/auth/bottone-esci";
import { attorePerPagina } from "@/lib/auth/sessione";

export const metadata: Metadata = {
  title: { default: "Area riservata", template: "%s · Area riservata" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const VOCI = [
  { href: "/area", titolo: "I miei progetti" },
  { href: "/area/profilo", titolo: "Profilo e accessi" },
] as const;

/**
 * Guscio dell'area cliente. L'autenticazione è verificata qui, lato server, e
 * di nuovo in ogni pagina che legge dati: un layout non è una barriera —
 * Next.js può servire una pagina figlia senza rieseguire il layout.
 */
export default async function LayoutArea({ children }: { children: React.ReactNode }) {
  const attore = await attorePerPagina("/area");
  // Lo staff ha il proprio back-office: qui non ci fa nulla.
  if (attore.ruolo !== "client") redirect("/admin");

  return (
    <div className="min-h-[80dvh]">
      <div className="border-b border-bordo bg-fondo-alto">
        <Gabbia className="flex flex-wrap items-center justify-between gap-4 py-4">
          <nav aria-label="Area riservata" className="flex gap-1">
            {VOCI.map((v) => (
              <Link
                key={v.href}
                href={v.href as Route}
                className="garbo rounded-md px-3 py-2 text-sm text-testo-attenuato hover:bg-superficie hover:text-testo"
              >
                {v.titolo}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-testo-tenue">{attore.email}</span>
            <BottoneEsci />
          </div>
        </Gabbia>
      </div>
      {children}
    </div>
  );
}
