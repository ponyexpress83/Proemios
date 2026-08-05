"use client";

import type { Route } from "next";
import { useState } from "react";
import Link from "next/link";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, Consenso } from "@/components/ui/campi";
import { Filetto, Scheda, Etichetta, cx } from "@/components/ui/primitivi";
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
 * Piani in abbonamento degli Strumenti AI.
 *
 * In Fase 1 la CTA raccoglie la lista d'attesa: `SUBSCRIPTIONS_LIVE` (config/plans.ts)
 * commuta l'interfaccia al checkout ricorrente quando Stripe subscription si accende,
 * senza toccare questo componente.
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
        <div
          className="rounded-campo border-filetto-notte inline-flex border p-1"
          role="group"
          aria-label="Periodo di fatturazione"
        >
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              aria-pressed={periodo === p}
              className={cx(
                "garbo font-ui rounded-[2px] px-4 py-2 text-sm",
                periodo === p ? "bg-carta text-notte" : "text-carta/70 hover:text-carta",
              )}
            >
              {p === "monthly" ? STRUMENTI_AI.mensile : STRUMENTI_AI.annuale}
            </button>
          ))}
        </div>
        {periodo === "annual" && (
          <span className="apparato text-ottone">
            −{sconto}% · {STRUMENTI_AI.scontoAnnuale}
          </span>
        )}
      </div>

      {/* Piani */}
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {AI_PLANS.map((piano) => {
          const prezzo = planPrice(piano, periodo);
          const gratis = prezzo === 0 || prezzo === null;
          return (
            <Scheda
              key={piano.slug}
              tono="notte"
              rilievo={piano.highlighted}
              className="flex flex-col"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-carta text-2xl font-medium">{piano.name}</h3>
                {piano.highlighted && <Etichetta tono="ottone">Più scelto</Etichetta>}
              </div>
              <p className="prosa text-carta/70 mt-2 text-[0.95rem]">{piano.claim}</p>

              <Filetto className="my-5" tono="notte" />

              <p className="cifre text-carta text-3xl font-medium">
                {gratis ? "Gratis" : euro(prezzo!)}
                {!gratis && (
                  <span className="font-ui text-carta/50 ml-1 text-sm font-normal">
                    {periodo === "monthly" ? "/mese" : "/anno"}
                  </span>
                )}
              </p>
              <p className="apparato text-carta/45 mt-2">{piano.limits}</p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {piano.features.map((f, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="bg-ottone mt-2 h-px w-3 shrink-0" aria-hidden />
                    <span className="font-lettura text-carta/80 text-sm leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <Bottone
                variante={piano.highlighted ? "chiaro" : "secondarioNotte"}
                className="mt-6 w-full"
                onClick={() => {
                  setPianoScelto(piano.slug);
                  document.getElementById("lista-attesa")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {SUBSCRIPTIONS_LIVE ? "Attiva il piano" : piano.waitlistCta}
              </Bottone>
            </Scheda>
          );
        })}
      </div>

      {/* Lista d'attesa */}
      <div
        id="lista-attesa"
        className="rounded-scheda border-filetto-notte bg-notte-alta mt-12 scroll-mt-24 border p-6 sm:p-8"
      >
        {stato === "iscritto" ? (
          <div>
            <p className="apparato text-ottone">Sei in lista</p>
            <h3 className="font-display text-carta mt-3 text-xl font-medium">
              Ti scriviamo quando apriamo
            </h3>
            <p className="prosa text-carta/70 mt-3">
              Nel frattempo l&rsquo;analisi del manoscritto e il configuratore restano gratuiti e
              senza registrazione.
            </p>
          </div>
        ) : (
          <form onSubmit={iscrivi} className="grid gap-5 lg:grid-cols-[1.2fr_1fr]" noValidate>
            <div>
              <h3 className="font-display text-carta text-xl font-medium">
                {pianoScelto
                  ? `Lista d'attesa · piano ${AI_PLANS.find((p) => p.slug === pianoScelto)?.name ?? ""}`
                  : "Lista d'attesa"}
              </h3>
              <p className="prosa text-carta/70 mt-2 text-[0.95rem]">{STRUMENTI_AI.notaFase}</p>
            </div>

            <div className="space-y-4">
              <Campo id="wl-email" label="Email" obbligatorio>
                {(p) => (
                  <Input
                    {...p}
                    tono="notte"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                )}
              </Campo>

              <div className="hidden" aria-hidden>
                <label htmlFor="wl-sito">Non compilare</label>
                <input id="wl-sito" name="sito" tabIndex={-1} autoComplete="off" />
              </div>

              <Consenso
                id="wl-consenso"
                name="consensoPrivacy"
                checked={consenso}
                onChange={setConsenso}
                tono="notte"
              >
                Acconsento al trattamento dei dati per essere avvisato all&rsquo;apertura (
                <Link href={"/privacy" as Route} className="hover:text-ottone underline">
                  privacy
                </Link>
                ).
              </Consenso>

              {errore && (
                <p className="text-ottone text-sm" role="alert">
                  {errore}
                </p>
              )}

              <Bottone
                type="submit"
                variante="chiaro"
                disabled={stato === "invio"}
                className="w-full"
              >
                {stato === "invio" ? UI.caricamento : "Avvisami all'apertura"}
              </Bottone>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
