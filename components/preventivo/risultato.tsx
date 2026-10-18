"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { BottoneLink } from "@/components/ui/bottone";
import { Filetto, Etichetta, cx } from "@/components/ui/primitivi";
import { euro, numero } from "@/lib/format";
import { PREVENTIVO } from "@/config/copy";
import type { QuoteResult } from "@/lib/pricing";

/**
 * Il risultato salvato. Il pacchetto scelto viene conservato sulla proposta e
 * riproposto dopo registrazione o accesso; il percorso interno di ritorno
 * porta alla pagina di conferma con la scelta ancora presente.
 */
export function RisultatoPreventivo({ esito, quoteId, commercialState = "estimate", expiresAt = null, demo = false }: { esito: QuoteResult; quoteId: string; commercialState?: "estimate" | "offer"; expiresAt?: string | null; demo?: boolean }) {
  const [chosen, setChosen] = useState<string | null>(esito.packages.find((p) => p.recommended)?.tier ?? null);
  const offer = commercialState === "offer";
  const ritorno = (tier: string) => `/area-autore/conferma/${quoteId}?pacchetto=${tier}`;
  const registration = (tier: string) => `/registrati?ritorno=${encodeURIComponent(ritorno(tier))}` as Route;
  const login = (tier: string) => `/accedi?ritorno=${encodeURIComponent(ritorno(tier))}` as Route;
  function choose(tier: string) {
    setChosen(tier);
    if (!demo) void fetch("/api/preventivo/scelta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId, tier }), keepalive: true }).catch(() => {});
  }
  return (
    <div>
      <div className="rounded-scheda border-ottone/50 bg-carta-alta mb-8 border p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <p className="apparato text-ottone">{offer ? "Pronta da confermare" : "Prima di scegliere"}</p>
          <h3 className="font-display text-inchiostro mt-2 text-2xl font-medium">{offer ? "Scegli il pacchetto e conferma dalla tua area." : "Vuoi verificare insieme il preventivo?"}</h3>
          <p className="prosa text-stampa mt-2 max-w-2xl text-sm">
            {offer
              ? `Crea l'account (o accedi): ritrovi questa proposta con il pacchetto scelto e paghi l'acconto in una pagina sola.${expiresAt ? ` La proposta vale fino al ${new Date(expiresAt).toLocaleDateString("it-IT")}.` : ""}`
              : "Per i progetti editoriali la call resta gratuita: guardiamo il testo, capiamo cosa serve davvero e, se il lavoro è più semplice della stima, adeguiamo il prezzo."}
          </p>
        </div>
        <BottoneLink href={`/contatti?quote=${encodeURIComponent(quoteId)}`} variante={offer ? "secondario" : "primario"} className="mt-5 shrink-0 sm:mt-0">Richiedi una call</BottoneLink>
      </div>

      <div className="grid gap-5 lg:grid-cols-3" role="group" aria-label="I pacchetti">
        {esito.packages.filter((p, i, all) => all.findIndex((o) => o.tier === p.tier) === i).map((p) => (
          <div key={p.tier} className={cx("rounded-scheda flex flex-col border p-6", chosen === p.tier ? "border-ottone bg-carta-alta ring-ottone/25 ring-1" : "border-filetto bg-carta-alta")}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-inchiostro text-2xl font-medium">{p.name}</h3>
              {p.recommended && <Etichetta tono="ottone">Consigliato</Etichetta>}
            </div>
            <p className="prosa text-stampa mt-2 text-[0.95rem]">{p.headline}</p>
            <Filetto className="my-5" tono="carta" />
            <p className="cifre text-inchiostro text-3xl font-medium">{euro(p.total)}</p>
            <p className="apparato text-stampa mt-2">Acconto {euro(p.deposit)}, saldo a consegna. IVA esclusa: il totale con IVA lo vedi prima di confermare.</p>
            <Filetto className="my-5" tono="carta" />
            <p className="apparato text-ottone">{PREVENTIVO.incluso}</p>
            <ul className="mt-3 space-y-2">{p.lineItems.map((v) => <li key={v.key} className="flex items-baseline justify-between gap-3 text-sm"><span className="font-lettura text-stampa">{v.label}</span><span className="cifre text-stampa shrink-0">{euro(v.amount)}</span></li>)}</ul>
            {p.excludes.length > 0 ? (
              <><p className="apparato text-stampa mt-5">{PREVENTIVO.escluso}</p><ul className="mt-3 flex-1 space-y-1.5">{p.excludes.map((v, i) => <li key={i} className="font-lettura text-stampa text-sm">{v}</li>)}</ul></>
            ) : <div className="flex-1" />}
            <button type="button" className={cx("garbo rounded-campo mt-6 border px-4 py-2 text-sm", chosen === p.tier ? "border-ottone bg-ottone/15 text-inchiostro" : "border-filetto text-stampa hover:border-ottone")} aria-pressed={chosen === p.tier} onClick={() => choose(p.tier)}>{chosen === p.tier ? "Pacchetto scelto" : "Scegli questo pacchetto"}</button>
            <BottoneLink href={registration(p.tier)} className="mt-3 w-full" onClick={() => choose(p.tier)}>{offer ? "Crea l’account e conferma →" : "Crea l’account e chiedi la proposta →"}</BottoneLink>
          </div>
        ))}
      </div>

      <p className="prosa mt-6">
        Abbiamo registrato la richiesta e ti abbiamo scritto. Crea l’account con lo stesso indirizzo email: appena lo verifichi, ritrovi questa proposta con il pacchetto scelto.{" "}
        <Link href={chosen ? login(chosen) : ("/accedi" as Route)} className="hover:text-ottone underline">Hai già un account? Accedi.</Link>
      </p>

      <Filetto className="mt-10" tono="carta" />
      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-10">
        <dl className="flex gap-8">
          <div><dt className="apparato text-stampa">Parole</dt><dd className="cifre text-inchiostro mt-1">{numero(esito.wordCount)}</dd></div>
          <div><dt className="apparato text-stampa">Pagine stimate</dt><dd className="cifre text-inchiostro mt-1">{numero(esito.estimatedPages)}</dd></div>
        </dl>
        <p className="font-lettura text-stampa text-sm leading-relaxed">{offer ? "Prezzo di listino per il servizio scelto: diventa definitivo con la conferma. Eventuali extra facoltativi si concordano con il team." : PREVENTIVO.disclaimerStima}</p>
      </div>
    </div>
  );
}
