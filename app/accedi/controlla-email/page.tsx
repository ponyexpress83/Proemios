import type { Metadata } from "next";
import { PulsanteLink } from "@/components/sito/pulsante";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Controlla l'email",
  descrizione: "Ti abbiamo mandato un link di accesso.",
  path: "/accedi/controlla-email",
  noindex: true,
});

export default function ControllaEmail() {
  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-serif text-t-xl text-balance text-inchiostro">Ti abbiamo mandato il link.</h1>
      <p className="mt-3 text-t-base text-grafite">
        Apri l&rsquo;email e clicca sul link per entrare. Vale una volta sola. Se non arriva entro
        qualche minuto, controlla nello spam.
      </p>
      <div className="mt-8">
        <PulsanteLink href="/accedi" variante="secondario">
          Richiedi un altro link
        </PulsanteLink>
      </div>
    </div>
  );
}
