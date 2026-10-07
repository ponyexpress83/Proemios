import dynamic from "next/dynamic";

// Il carosello è interattivo solo sul telefono: il suo JavaScript va in un
// pezzo a parte, l'HTML resta reso sul server.
const Carosello = dynamic(() => import("@/components/sito/carosello").then((m) => m.Carosello));
import { Foglio } from "@/components/sito/foglio";
import { ILLUSTRAZIONI, type NomeIllustrazione } from "./illustrazioni";
import { PERCORSI } from "@/config/percorsi";

/**
 * Da dove parti: cinque punti di partenza dal catalogo dei percorsi — quelli
 * che corrispondono a una domanda che un autore si fa davvero. Gli altri tre
 * (ricerca storica, promozione, agenzie) stanno in /percorsi e nella fascia
 * delle agenzie. Nessun numero: non è una sequenza.
 */
const SCELTI: { slug: string; illustrazione: NomeIllustrazione }[] = [
  { slug: "ho-gia-scritto-il-libro", illustrazione: "manoscritto" },
  { slug: "dall-idea-al-libro", illustrazione: "idea" },
  { slug: "memoir-e-storia-familiare", illustrazione: "memoria" },
  { slug: "libro-professionale", illustrazione: "professione" },
  { slug: "voglio-pubblicare", illustrazione: "pubblicazione" },
];

export function PercorsiHome() {
  const fogli = SCELTI.map(({ slug, illustrazione }) => {
    const p = PERCORSI.find((x) => x.slug === slug);
    if (!p) return null;
    return (
      <Foglio key={slug} href={`/percorsi/${slug}`} className="flex w-full flex-col">
        {ILLUSTRAZIONI[illustrazione]}
        <h3 className="mt-5 font-serif text-t-md leading-snug text-inchiostro">{p.nome}</h3>
        <p className="mt-2 text-t-sm text-grafite">{p.claim}</p>
      </Foglio>
    );
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <Carosello etichetta="Punti di partenza" classeGriglia="lg:grid-cols-3 lg:gap-6">
      {fogli}
    </Carosello>
  );
}
