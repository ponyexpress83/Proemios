import type { Metadata } from "next";
import { Gabbia, Occhiello } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Controlla l'email",
  descrizione: "Ti abbiamo mandato un link di accesso.",
  path: "/accedi/controlla-email",
  noindex: true,
});

export default function ControllaEmail() {
  return (
    <Gabbia className="flex min-h-[70dvh] items-center justify-center py-16">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Occhiello>Controlla la posta</Occhiello>
        <h1 className="text-3xl font-semibold text-testo">Ti abbiamo mandato il link.</h1>
        <p className="text-sm leading-relaxed text-testo-attenuato">
          Apri l&rsquo;email e clicca sul link per entrare. Vale una volta sola. Se non arriva
          entro qualche minuto, controlla nello spam.
        </p>
        <BottoneLink href="/accedi" variante="secondario" className="mt-2 self-start">
          Richiedi un altro link
        </BottoneLink>
      </div>
    </Gabbia>
  );
}
