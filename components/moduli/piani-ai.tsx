"use client";

import type { Route } from "next";
import { useState } from "react";
import Link from "next/link";
import { Pulsante } from "@/components/sito/pulsante";
import { Campo, Input, Consenso } from "@/components/sito/campo";
import { Filetto } from "@/components/sito/sezione";
import { cn } from "@/lib/cn";
import {
  AI_PLANS,
  planPrice,
  ANNUAL_DISCOUNT,
  SUBSCRIPTIONS_LIVE,
  type BillingPeriod,
} from "@/config/plans";
import { STRUMENTI_AI, UI } from "@/config/copy";
import { euro } from "@/lib/format";

type Stato = "idle" | "invio" | "iscritto" | "errore";

/**
 * Piani in abbonamento degli Strumenti AI. In Fase 1 la CTA raccoglie la
 * lista d'attesa: `SUBSCRIPTIONS_LIVE` (config/plans.ts) commuta l'interfaccia
 * al checkout ricorrente quando Stripe subscription si accende, senza toccare
 * questo componente. Logica di invio invariata.
 */
export function PianiAi() {
  const [periodo, setPeriodo] = useState<BillingPeriod>("monthly");
  const [pianoScelto, setPianoScelto] = useState<string | null>(null);
  const [stato, setStato] = useState<Stato>("idle");
  const [errore, setErrore] = useState("");
  const [consenso, setConsenso] = useState(false);

  async function iscrivi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consenso) {
      setErrore(UI.consensoRichiesto);
      return;
    }
    setStato("invio");
    setErrore("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/lista-attesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          piano: pianoScelto ?? "pro",
          periodo,
          consensoPrivacy: consenso,
          sito: String(fd.get("sito") ?? ""),
        }),
      });
      const dati = (await res.json()) as { errore?: string };
      if (!res.ok) throw new Error(dati.errore ?? UI.erroreGenerico);
      setStato("iscritto");
    } catch (err) {
      setStato("errore");
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
    }
  }

  const sconto = Math.round(ANNUAL_DISCOUNT * 100);

  return (
    <div>
      {/* Commutatore periodo */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-campo border border-filetto bg-bianco p-1" role="group" aria-label="Periodo di fatturazione">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              aria-pressed={periodo === p}
              className={cn(
                "min-h-10 rounded-campo px-4 text-t-sm transition-colors duration-200 ease-matita",
                periodo === p ? "bg-inchiostro text-carta" : "text-grafite hover:text-inchiostro",
              )}
            >
              {p === "monthly" ? STRUMENTI_AI.mensile : STRUMENTI_AI.annuale}
            </button>
          ))}
        </div>
        {periodo === "annual" && (
          <span className="text-t-sm text-rosso-matita">
            −{sconto} %, {STRUMENTI_AI.scontoAnnuale}
          </span>
        )}
      </div>

      {/* Piani */}
      <ul className="mt-8 grid gap-5 lg:grid-cols-3">
        {AI_PLANS.map((piano) => {
          const prezzo = planPrice(piano, periodo);
          const gratis = prezzo === 0 || prezzo === null;
          return (
            <li
              key={piano.slug}
              className={cn(
                "flex flex-col rounded-foglio bg-bianco p-6 shadow-foglio",
                piano.highlighted && "border-t-4 border-rosso-matita",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-serif text-t-lg text-inchiostro">{piano.name}</h3>
                {piano.highlighted && <span className="maiuscoletto text-t-sm text-rosso-matita">Più scelto</span>}
              </div>
              <p className="mt-2 text-t-sm text-grafite">{piano.claim}</p>

              <Filetto className="my-5" />

              <p className="tabellare font-serif text-t-xl text-inchiostro">
                {gratis ? "Gratis" : euro(prezzo!)}
                {!gratis && (
                  <span className="ml-1 font-sans text-t-sm text-grafite">{periodo === "monthly" ? "al mese" : "all'anno"}</span>
                )}
              </p>
              <p className="mt-1 text-t-sm text-grafite">{piano.limits}</p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {piano.features.map((f, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-3 h-0.5 w-3 shrink-0 rounded-pillola bg-rosso-matita" aria-hidden="true" />
                    <span className="text-t-sm text-inchiostro">{f}</span>
                  </li>
                ))}
              </ul>

              <Pulsante
                variante={piano.highlighted ? "primario" : "secondario"}
                className="mt-6 w-full"
                onClick={() => {
                  setPianoScelto(piano.slug);
                  document.getElementById("lista-attesa")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {SUBSCRIPTIONS_LIVE ? "Attiva il piano" : piano.waitlistCta}
              </Pulsante>
            </li>
          );
        })}
      </ul>

      {/* Lista d'attesa */}
      <div id="lista-attesa" className="mt-12 scroll-mt-24 rounded-foglio bg-bianco p-6 shadow-foglio sm:p-8">
        {stato === "iscritto" ? (
          <div role="status">
            <h3 className="font-serif text-t-lg text-inchiostro">Sei in lista.</h3>
            <p className="mt-3 text-t-base text-grafite">
              Ti scriviamo quando apriamo. Nel frattempo l&rsquo;analisi del manoscritto e il
              configuratore restano gratuiti e senza registrazione.
            </p>
          </div>
        ) : (
          <form onSubmit={iscrivi} className="grid gap-6 lg:grid-cols-[1.2fr_1fr]" noValidate>
            <div>
              <h3 className="font-serif text-t-lg text-inchiostro">
                {pianoScelto
                  ? `Lista d'attesa, piano ${AI_PLANS.find((p) => p.slug === pianoScelto)?.name ?? ""}`
                  : "Lista d'attesa"}
              </h3>
              <p className="mt-2 text-t-sm text-grafite">{STRUMENTI_AI.notaFase}</p>
            </div>

            <div className="space-y-4">
              <Campo id="wl-email" label="Email" obbligatorio>
                {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" />}
              </Campo>

              <div className="hidden" aria-hidden="true">
                <label htmlFor="wl-sito">Non compilare</label>
                <input id="wl-sito" name="sito" tabIndex={-1} autoComplete="off" />
              </div>

              <Consenso id="wl-consenso" name="consensoPrivacy" checked={consenso} onChange={setConsenso}>
                Acconsento al trattamento dei dati per essere avvisato all&rsquo;apertura (
                <Link href={"/privacy" as Route} className="sottolinea-matita text-blu-matita">
                  privacy
                </Link>
                ).
              </Consenso>

              {errore && (
                <p className="text-t-sm text-rosso-matita" role="alert">
                  {errore}
                </p>
              )}

              <Pulsante type="submit" variante="primario" disabled={stato === "invio"} className="w-full">
                {stato === "invio" ? UI.caricamento : "Avvisami all'apertura"}
              </Pulsante>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
