import { demoAttiva } from "@/lib/demo";

/**
 * Fascia di testa mostrata solo in modalità demo.
 *
 * Sta in cima a ogni pagina e resta lì: chi guarda deve sapere in ogni momento
 * che quello che vede non è l'ambiente di produzione. La misura è quella di un
 * occhiello di giornale — presente, non invadente.
 */
export function FasciaDemo() {
  if (!demoAttiva()) return null;

  return (
    <div className="bg-notte text-carta su-notte border-ottone/40 border-b">
      <div className="gabbia flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
        <span className="apparato text-ottone">Demo</span>
        <p className="font-ui text-carta/70 text-xs leading-relaxed">
          Il sito è navigabile per intero. I dati che inserisci non vengono salvati né inviati,
          nessun pagamento viene addebitato e l&rsquo;analisi del manoscritto è simulata.
        </p>
      </div>
    </div>
  );
}
