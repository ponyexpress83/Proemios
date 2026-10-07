"use client";

import { useEffect, useState } from "react";
import { Pulsante, PulsanteLink } from "@/components/sito/pulsante";
import { Filetto } from "@/components/sito/sezione";
import { cn } from "@/lib/cn";
import { euro, numero } from "@/lib/format";
import { trackEvent } from "@/lib/analytics";
import { PREVENTIVO, UI } from "@/config/copy";
import type { QuoteResult, PackageTier } from "@/lib/pricing";

/*
 * Tracciamento e avvio del pagamento sono quelli di sempre: qui cambia solo
 * la presentazione dei tre pacchetti, come tre fogli, con il consigliato
 * segnato dal filetto rosso in testa.
 */
export function RisultatoPreventivo({ esito, quoteId }: { esito: QuoteResult; quoteId: string }) {
  const [inCorso, setInCorso] = useState<PackageTier | null>(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    const consigliato = esito.packages.find((p) => p.recommended);
    trackEvent("quote_generated", {
      quoteId,
      // In centesimi: la conversione in euro avviene nel payload, una volta sola.
      valoreCent: consigliato ? Math.round(consigliato.total * 100) : undefined,
      extra: { word_count: esito.wordCount },
    });
  }, [esito, quoteId]);

  async function pagaAcconto(pacchetto: PackageTier) {
    setInCorso(pacchetto);
    setErrore("");
    const scelto = esito.packages.find((p) => p.tier === pacchetto);
    trackEvent("checkout_started", {
      quoteId,
      valoreCent: scelto ? Math.round(scelto.deposit * 100) : undefined,
      extra: { package: pacchetto },
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, pacchetto }),
      });
      const dati = (await res.json()) as { url?: string; errore?: string };
      if (!res.ok || !dati.url) throw new Error(dati.errore ?? UI.erroreGenerico);
      window.location.assign(dati.url);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
      setInCorso(null);
    }
  }

  return (
    <div>
      <div className="mb-8 rounded-foglio border border-filetto bg-carta-ombra p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-giustezza">
          <h3 className="font-serif text-t-lg text-inchiostro">Vuoi verificare insieme il preventivo?</h3>
          <p className="mt-2 text-t-sm text-grafite">
            Per i progetti editoriali la call resta gratuita: guardiamo il testo, capiamo cosa serve
            davvero e, se il lavoro è più semplice della stima, adeguiamo il prezzo.
          </p>
        </div>
        <div className="mt-5 shrink-0 sm:mt-0">
          <PulsanteLink
            href={`/contatti?quote=${encodeURIComponent(quoteId)}`}
            variante="secondario"
            freccia
            onClick={() => trackEvent("consultation_clicked", { quoteId })}
          >
            Prenota una call
          </PulsanteLink>
        </div>
      </div>

      <ul className="grid gap-5 lg:grid-cols-3">
        {esito.packages.map((p) => (
          <li
            key={p.tier}
            className={cn(
              "flex flex-col rounded-foglio bg-bianco p-6 shadow-foglio",
              p.recommended && "border-t-4 border-rosso-matita",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-t-lg text-inchiostro">{p.name}</h3>
              {p.recommended && <span className="maiuscoletto text-t-sm text-rosso-matita">Consigliato</span>}
            </div>
            <p className="mt-2 text-t-sm text-grafite">{p.headline}</p>

            <Filetto className="my-5" />

            <p className="tabellare font-serif text-t-xl text-inchiostro">{euro(p.total)}</p>
            <p className="mt-1 text-t-sm text-grafite">
              Acconto {euro(p.deposit)}, saldo alla consegna
            </p>

            <Filetto className="my-5" />

            <p className="maiuscoletto text-t-sm text-grafite">{PREVENTIVO.incluso}</p>
            <ul className="mt-3 space-y-2">
              {p.lineItems.map((v) => (
                <li key={v.key} className="flex items-baseline justify-between gap-3 text-t-sm">
                  <span className="text-inchiostro">{v.label}</span>
                  <span className="tabellare shrink-0 text-grafite">{euro(v.amount)}</span>
                </li>
              ))}
            </ul>

            {p.excludes.length > 0 && (
              <>
                <p className="maiuscoletto mt-5 text-t-sm text-grafite">{PREVENTIVO.escluso}</p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {p.excludes.map((v, i) => (
                    <li key={i} className="text-t-sm text-grafite">
                      {v}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {p.excludes.length === 0 && <div className="flex-1" />}

            <Pulsante
              variante={p.recommended ? "primario" : "secondario"}
              className="mt-6 w-full"
              disabled={inCorso !== null}
              onClick={() => pagaAcconto(p.tier)}
            >
              {inCorso === p.tier ? UI.caricamento : PREVENTIVO.accontoCta}
            </Pulsante>
          </li>
        ))}
      </ul>

      {errore && (
        <p className="mt-6 text-center text-t-sm text-rosso-matita" role="alert">
          {errore}
        </p>
      )}

      <Filetto className="mt-10" />
      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-10">
        <dl className="flex gap-8">
          <div>
            <dt className="maiuscoletto text-t-sm text-grafite">Parole</dt>
            <dd className="tabellare mt-1 text-inchiostro">{numero(esito.wordCount)}</dd>
          </div>
          <div>
            <dt className="maiuscoletto text-t-sm text-grafite">Pagine stimate</dt>
            <dd className="tabellare mt-1 text-inchiostro">{numero(esito.estimatedPages)}</dd>
          </div>
        </dl>
        <p className="text-t-sm text-grafite">{PREVENTIVO.disclaimerStima}</p>
      </div>
    </div>
  );
}
