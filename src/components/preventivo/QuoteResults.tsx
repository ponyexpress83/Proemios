"use client";

import { useState } from "react";
import type { QuoteResult, PackageKey } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import { euro } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PRICING } from "@/config/pricing";

/** Mostra i tre pacchetti calcolati e avvia il checkout dell'acconto 40%. */
export function QuoteResults({ result, quoteId }: { result: QuoteResult; quoteId: string }) {
  const [loadingKey, setLoadingKey] = useState<PackageKey | null>(null);
  const [error, setError] = useState<string>("");

  async function checkout(pacchetto: PackageKey) {
    setLoadingKey(pacchetto);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, pacchetto }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Impossibile avviare il pagamento.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
      setLoadingKey(null);
    }
  }

  const accontoPct = Math.round(PRICING.accontoFrazione * 100);

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-3">
        {result.pacchetti.map((p) => (
          <div
            key={p.key}
            className={cn(
              "bg-carta flex flex-col rounded-lg border p-6 sm:p-7",
              p.inEvidenza ? "border-bronzo ring-bronzo/30 ring-1" : "border-linea",
            )}
          >
            {p.inEvidenza && (
              <span className="bg-bronzo/10 text-bronzo-scuro mb-3 self-start rounded-full px-2.5 py-1 text-xs font-semibold tracking-wider uppercase">
                Consigliato
              </span>
            )}
            <h3 className="font-display text-inchiostro text-2xl font-medium">{p.nome}</h3>
            <p className="text-inchiostro-60 mt-1 text-sm leading-relaxed">{p.descrizione}</p>

            <div className="border-linea mt-5 border-t pt-5">
              <p className="font-display text-inchiostro nums-tabular text-3xl font-medium">
                {euro(p.totale)}
              </p>
              <p className="text-inchiostro-40 mt-1 text-xs">
                Acconto {accontoPct}%: <span className="font-medium">{euro(p.acconto)}</span>
              </p>
            </div>

            <ul className="mt-5 flex-1 space-y-2.5">
              {p.componenti.map((c, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-inchiostro-80">{c.label}</span>
                  <span className="text-inchiostro-40 nums-tabular shrink-0">{euro(c.prezzo)}</span>
                </li>
              ))}
            </ul>

            <Button
              className="mt-6 w-full"
              variant={p.inEvidenza ? "primary" : "secondary"}
              size="lg"
              disabled={loadingKey !== null}
              onClick={() => checkout(p.key)}
            >
              {loadingKey === p.key ? "Reindirizzamento…" : `Conferma — acconto ${euro(p.acconto)}`}
            </Button>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-errore mt-6 text-center text-sm" role="alert">
          {error}
        </p>
      )}

      <p className="text-inchiostro-40 mt-8 text-center text-xs">
        Testo stimato: {result.paroleEffettive.toLocaleString("it-IT")} parole ·{" "}
        {result.pagineStimate.toLocaleString("it-IT")} pagine
        {result.maggiorazionePrioritaria && " · tempistica prioritaria"}. Prezzi indicativi,
        confermati dopo la valutazione di un professionista.
      </p>
    </div>
  );
}
