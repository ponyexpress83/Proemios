import { SiteChrome } from "@/components/editorial/site-chrome";

/**
 * Guscio del sito pubblico: navigazione di marketing, piè di pagina, fascia
 * demo.
 *
 * Sta in un route group perché le aree riservate — back-office e portale
 * cliente — non devono portarsi dietro il menu commerciale: chi sta lavorando
 * a un progetto non ha bisogno del bottone «Fai il preventivo» sopra la testa,
 * e un piè di pagina con l'anagrafica societaria in mezzo a un cruscotto è
 * rumore.
 *
 * Il `<main id="contenuto">` lo apre `SiteChrome`, non questo layout: il salto
 * al contenuto definito nel layout radice punta lì.
 */
export default function LayoutSito({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
