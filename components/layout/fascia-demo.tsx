import { demoAttiva } from "@/lib/demo";
export function FasciaDemo() {
  if (!demoAttiva()) return null;
  return (
    <aside className="demo-banner" aria-label="Modalità dimostrativa">
      <strong>DEMO</strong>Esplora il sito e l’area autore con dati di prova. Nessuna email o
      pagamento reale.
    </aside>
  );
}
