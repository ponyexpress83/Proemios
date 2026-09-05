import { Testata } from "@/components/layout/testata";
import { Colophon } from "@/components/layout/colophon";
import { FasciaDemo } from "@/components/layout/fascia-demo";

/**
 * Guscio del sito pubblico: navigazione di marketing, piè di pagina, fascia
 * demo.
 *
 * Sta in un route group perché le aree riservate — back-office e portale
 * cliente — non devono portarsi dietro il menu commerciale: chi sta lavorando
 * a un progetto non ha bisogno del bottone «Fai il preventivo» sopra la testa,
 * e un piè di pagina con l'anagrafica societaria in mezzo a un cruscotto è
 * rumore.
 */
export default function LayoutSito({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FasciaDemo />
      <Testata />
      <main id="contenuto" className="flex-1">
        {children}
      </main>
      <Colophon />
    </>
  );
}
