import type { ProcessStep } from "@/config/services";

/** Elenco numerato del processo (4-5 step), con numeri old-style in serif. */
export function ProcessList({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol className="border-linea bg-linea grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
      {steps.map((step, i) => (
        <li key={i} className="bg-carta p-6 sm:p-8">
          <span className="font-display text-bronzo nums-tabular text-3xl font-medium">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="font-display text-inchiostro mt-3 text-lg font-medium">{step.titolo}</h3>
          <p className="text-inchiostro-60 mt-2 text-sm leading-relaxed">{step.descrizione}</p>
        </li>
      ))}
    </ol>
  );
}
