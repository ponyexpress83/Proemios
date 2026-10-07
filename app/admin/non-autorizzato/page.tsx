import type { Metadata } from "next";
import { Gabbia, Occhiello } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { Avviso } from "@/components/ui/stati";

export const metadata: Metadata = {
  title: "Accesso non consentito",
  robots: { index: false, follow: false },
};

/**
 * Mostrata a chi è autenticato ma non ha il permesso per la schermata
 * richiesta. Non dice quale permesso manca né cosa ci sarebbe stato dietro:
 * quella è informazione sul sistema, e va nell'audit, non in pagina.
 */
export default function NonAutorizzato() {
  return (
    <Gabbia className="flex min-h-[60dvh] items-center justify-center py-16">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Occhiello>Area riservata</Occhiello>
        <h1 className="text-3xl font-semibold text-testo">Questa parte non è tua.</h1>
        <Avviso tono="attenzione">
          Il tuo ruolo non comprende questa schermata. Se ti serve per lavorare, chiedilo a chi
          gestisce gli accessi: non è una cosa che puoi attivarti da solo.
        </Avviso>
        <BottoneLink href="/admin" variante="secondario" className="mt-2 self-start">
          Torna al cruscotto
        </BottoneLink>
      </div>
    </Gabbia>
  );
}
