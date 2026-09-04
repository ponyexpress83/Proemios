import { Gabbia, Filetto } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";

export default function NonTrovata() {
  return (
    <Gabbia className="py-24 sm:py-32">
      <div className="mx-auto max-w-lg">
        <p className="etichetta text-lime">Errore 404</p>
        <h1 className="mt-5 text-[2.2rem] leading-[1.1] font-medium sm:text-[2.8rem]">
          Questa pagina non esiste
        </h1>
        <Filetto className="mt-6" />
        <p className="prosa mt-6">
          Il link è sbagliato oppure la pagina è stata spostata. Da qui puoi tornare indietro senza
          perdere niente.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <BottoneLink href="/" misura="grande">
            Torna alla home
          </BottoneLink>
          <BottoneLink href="/servizi" variante="secondario" misura="grande">
            Vedi i servizi
          </BottoneLink>
        </div>
      </div>
    </Gabbia>
  );
}
