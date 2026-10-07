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
    <div className="border-b border-filetto bg-carta-ombra">
      <p className="mx-auto flex w-full max-w-pagina flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-t-xs text-grafite md:px-6">
        <span className="maiuscoletto font-bold text-rosso-matita">Demo</span>
        <span>
          Il sito è navigabile per intero. I dati che inserisci non vengono salvati né inviati,
          nessun pagamento viene addebitato e l&rsquo;analisi del manoscritto è simulata.
        </span>
      </p>
    </div>
  );
}
