"use client";

import { useEffect, useState } from "react";
import { Bottone, BottoneLink } from "@/components/ui/bottone";
import { Filetto, Etichetta, cx } from "@/components/ui/primitivi";
import { euro, numero } from "@/lib/format";
import { trackEvent } from "@/lib/analytics";
import { PREVENTIVO, UI } from "@/config/copy";
import type { QuoteResult, PackageTier } from "@/lib/pricing";

export function RisultatoPreventivo({ esito, quoteId }: { esito: QuoteResult; quoteId: string }) {
  const [inCorso, setInCorso] = useState<PackageTier | null>(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    const consigliato = esito.packages.find((p) => p.recommended);
    trackEvent("quote_generated", {
      quote_id: quoteId,
      value: consigliato?.total,
      currency: "EUR",
      word_count: esito.wordCount,
    });
  }, [esito, quoteId]);

  async function pagaAcconto(pacchetto: PackageTier) {
    setInCorso(pacchetto);
    setErrore("");
    const scelto = esito.packages.find((p) => p.tier === pacchetto);
    trackEvent("checkout_started", {
      quote_id: quoteId,
      package: pacchetto,
      value: scelto?.deposit,
      currency: "EUR",
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
      <div className="mb-8 rounded-scheda border border-ottone/50 bg-notte-alta p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <p className="apparato text-ottone">Prima di scegliere</p>
          <h3 className="font-display text-carta mt-2 text-2xl font-medium">
            Vuoi verificare insieme il preventivo?
          </h3>
          <p className="prosa text-carta/65 mt-2 max-w-2xl text-sm">
            Per i progetti editoriali la call resta gratuita: guardiamo il testo, capiamo cosa serve
            davvero e, se il lavoro è più semplice della stima, adeguiamo il prezzo.
          </p>
        </div>
        <div
          className="mt-5 shrink-0 sm:mt-0"
          onClick={() => trackEvent("consultation_clicked", { quote_id: quoteId })}
        >
          <BottoneLink href={`/contatti?quote=${encodeURIComponent(quoteId)}`} variante="chiaro">
            Prenota una call
          </BottoneLink>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {esito.packages.map((p) => (
          <div
            key={p.tier}
            className={cx(
              "rounded-scheda flex flex-col border p-6",
              p.recommended
                ? "border-ottone bg-notte-alta ring-ottone/25 ring-1"
                : "border-filetto-notte bg-notte-alta",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-carta text-2xl font-medium">{p.name}</h3>
              {p.recommended && <Etichetta tono="ottone">Consigliato</Etichetta>}
            </div>
            <p className="prosa text-carta/70 mt-2 text-[0.95rem]">{p.headline}</p>

            <Filetto className="my-5" tono="notte" />

            <p className="cifre text-carta text-3xl font-medium">{euro(p.total)}</p>
            <p className="apparato text-carta/45 mt-2">
              Acconto {euro(p.deposit)} · saldo a consegna
            </p>

            <Filetto className="my-5" tono="notte" />

            <p className="apparato text-ottone">{PREVENTIVO.incluso}</p>
            <ul className="mt-3 space-y-2">
              {p.lineItems.map((v) => (
                <li key={v.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-lettura text-carta/85">{v.label}</span>
                  <span className="cifre text-carta/45 shrink-0">{euro(v.amount)}</span>
                </li>
              ))}
            </ul>

            {p.excludes.length > 0 && (
              <>
                <p className="apparato text-carta/45 mt-5">{PREVENTIVO.escluso}</p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {p.excludes.map((v, i) => (
                    <li key={i} className="font-lettura text-carta/45 text-sm">
                      {v}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {p.excludes.length === 0 && <div className="flex-1" />}

            <Bottone
              variante={p.recommended ? "chiaro" : "secondarioNotte"}
              className="mt-6 w-full"
              disabled={inCorso !== null}
              onClick={() => pagaAcconto(p.tier)}
            >
              {inCorso === p.tier ? UI.caricamento : PREVENTIVO.accontoCta}
            </Bottone>
          </div>
        ))}
      </div>

      {errore && (
        <p className="text-ottone mt-6 text-center text-sm" role="alert">
          {errore}
        </p>
      )}

      <Filetto className="mt-10" tono="notte" />
      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-10">
        <dl className="flex gap-8">
          <div>
            <dt className="apparato text-carta/45">Parole</dt>
            <dd className="cifre text-carta mt-1">{numero(esito.wordCount)}</dd>
          </div>
          <div>
            <dt className="apparato text-carta/45">Pagine stimate</dt>
            <dd className="cifre text-carta mt-1">{numero(esito.estimatedPages)}</dd>
          </div>
        </dl>
        <p className="font-lettura text-carta/60 text-sm leading-relaxed">
          {PREVENTIVO.disclaimerStima}
        </p>
      </div>
    </div>
  );
}
