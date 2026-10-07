import { demoAttiva } from "@/lib/demo";
import { publicEnv } from "@/lib/env";

/**
 * Fascia mostrata solo in modalità demo. Resta in cima a ogni pagina: chi
 * guarda deve sapere in ogni momento che non è l'ambiente di produzione.
 *
 * `NEXT_PUBLIC_DEMO_MODE=off` la toglie senza toccare la demo vera; `on` la
 * forza. Vuota: segue `demoAttiva()`.
 */
export function FasciaDemo() {
  const forzatura = publicEnv.NEXT_PUBLIC_DEMO_MODE;
  const visibile = forzatura === "off" ? false : forzatura === "on" ? true : demoAttiva();
  if (!visibile) return null;

  return (
    <div className="fascia-demo border-b border-viola/35 bg-viola/12">
      <div className="gabbia flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <span className="etichetta text-viola-chiaro">Demo</span>
        <p className="text-xs leading-relaxed text-testo-attenuato">
          Il sito è navigabile per intero. I dati che inserisci non vengono salvati né inviati,
          nessun pagamento viene addebitato e l&rsquo;analisi del manoscritto è simulata.
        </p>
      </div>
    </div>
  );
}
