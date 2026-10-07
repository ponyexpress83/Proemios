import { GuscioSito } from "@/components/sito/guscio";
import "../sito.css";

/**
 * Sito pubblico: navigazione di marketing, colophon, fascia demo.
 *
 * Sta in un route group perché le aree riservate — back-office e portale
 * cliente — non devono portarsi dietro il menu commerciale: chi sta lavorando
 * a un progetto non ha bisogno del pulsante «Calcola il preventivo» sopra la
 * testa, e un piè di pagina con l'anagrafica societaria in mezzo a un cruscotto
 * è rumore.
 */
export default function LayoutSito({ children }: { children: React.ReactNode }) {
  return <GuscioSito>{children}</GuscioSito>;
}
