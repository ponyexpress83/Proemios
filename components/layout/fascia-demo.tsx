import { demoAttiva } from "@/lib/demo";
export function FasciaDemo() {
  if (!demoAttiva() && process.env.VERCEL_ENV === "production" && process.env.PROEMIOS_PRODUCTION_READY === "1") return null;
  if (!demoAttiva()) return <aside className="demo-banner" aria-label="Ambiente di verifica"><strong>ANTEPRIMA</strong>Versione in verifica. I servizi devono essere configurati prima dell’uso reale.</aside>;
  return (
    <aside className="demo-banner" aria-label="Modalità dimostrativa">
      <strong>DEMO</strong>Esplora il sito e l’area autore con dati di prova. Nessuna email o
      pagamento reale.
    </aside>
  );
}
