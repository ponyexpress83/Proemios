import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { AnalysisFlow } from "@/components/analisi/AnalysisFlow";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Analisi gratuita del manoscritto",
  description:
    "Carica il tuo manoscritto e ricevi un'analisi immediata: leggibilità, ritmo, tic stilistici, target di lettori e livello di intervento consigliato, con una stima di costo.",
  path: "/analisi-manoscritto",
});

export default function AnalisiManoscritto() {
  return (
    <>
      <section className="bg-carta">
        <Container className="pt-14 pb-8 sm:pt-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-bronzo mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
              Strumento gratuito
            </p>
            <h1 className="font-display text-inchiostro text-3xl leading-[1.1] font-medium text-balance sm:text-4xl">
              Analisi del manoscritto in pochi minuti
            </h1>
            <p className="text-inchiostro-60 mx-auto mt-4 max-w-xl leading-relaxed">
              Carica il tuo testo e ottieni subito un report editoriale: punti di forza, aree di
              intervento e una stima di costo. Il report ti arriva anche via email.
            </p>
          </div>
        </Container>
      </section>

      <Container className="pb-24">
        <AnalysisFlow />
      </Container>
    </>
  );
}
