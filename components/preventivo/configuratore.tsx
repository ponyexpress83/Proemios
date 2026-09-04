"use client";

import type { Route } from "next";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, AreaTesto, Consenso } from "@/components/ui/campi";
import { Filetto, cn } from "@/components/ui/primitivi";
import { RisultatoPreventivo } from "./risultato";
import {
  TIPI_PROGETTO,
  STATI_TESTO,
  QUANTITA_MATERIALE,
  PRESET_PAROLE,
  SERVIZI,
  TEMPI,
} from "./opzioni";
import {
  computeQuote,
  type ProjectType,
  type TextState,
  type ServiceKey,
  type QuoteResult,
} from "@/lib/pricing";
import type { MaterialAmount } from "@/config/pricing";
import { PREVENTIVO, UI } from "@/config/copy";
import { euro, numero } from "@/lib/format";

interface Stato {
  tipo: ProjectType | null;
  statoTesto: TextState | null;
  parole: number;
  materiale: MaterialAmount;
  servizi: ServiceKey[];
  tempi: "standard" | "prioritaria";
  nome: string;
  email: string;
  telefono: string;
  note: string;
  consensoPrivacy: boolean;
  consensoMarketing: boolean;
}

const TOTALE_PASSI = 6;

export function Configuratore({
  precompilato,
}: {
  precompilato?: { tipo?: ProjectType; servizi?: ServiceKey[]; parole?: number };
}) {
  const [passo, setPasso] = useState(0);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState("");
  const [risultato, setRisultato] = useState<{ esito: QuoteResult; quoteId: string } | null>(null);

  const [s, setS] = useState<Stato>({
    tipo: precompilato?.tipo ?? null,
    statoTesto: precompilato?.tipo === "memoir" ? "solo-materiali" : null,
    parole: precompilato?.parole ?? 50_000,
    materiale: "parziale",
    servizi: precompilato?.servizi ?? [],
    tempi: "standard",
    nome: "",
    email: "",
    telefono: "",
    note: "",
    consensoPrivacy: false,
    consensoMarketing: false,
  });

  function agg<K extends keyof Stato>(k: K, v: Stato[K]) {
    setS((prec) => ({ ...prec, [k]: v }));
  }

  const soloMateriali = s.statoTesto === "solo-materiali";
  const soloGrafica = s.tipo === "solo-grafica";

  // Anteprima calcolata in locale: stesso motore puro del server.
  const anteprima: QuoteResult | null = useMemo(() => {
    if (!s.tipo || !s.statoTesto || s.parole < 1) return null;
    try {
      return computeQuote({
        projectType: s.tipo,
        textState: s.statoTesto,
        wordCount: s.parole,
        materialAmount: soloMateriali ? s.materiale : undefined,
        requestedServices: s.servizi,
        urgency: s.tempi,
      });
    } catch {
      return null;
    }
  }, [s, soloMateriali]);

  const puoAvanzare = useMemo(() => {
    switch (passo) {
      case 0:
        return s.tipo !== null;
      case 1:
        return s.statoTesto !== null;
      case 2:
        return s.parole > 0;
      case 3:
      case 4:
        return true;
      case 5:
        return s.nome.trim().length >= 2 && /.+@.+\..+/.test(s.email) && s.consensoPrivacy;
      default:
        return false;
    }
  }, [passo, s]);

  async function calcola() {
    if (!s.tipo || !s.statoTesto) return;
    setInvio(true);
    setErrore("");
    try {
      const res = await fetch("/api/preventivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            projectType: s.tipo,
            textState: s.statoTesto,
            wordCount: s.parole,
            materialAmount: soloMateriali ? s.materiale : undefined,
            requestedServices: s.servizi,
            urgency: s.tempi,
          },
          contatto: {
            nome: s.nome,
            email: s.email,
            telefono: s.telefono,
            note: s.note,
            consensoPrivacy: s.consensoPrivacy,
            consensoMarketing: s.consensoMarketing,
          },
        }),
      });
      const dati = (await res.json()) as {
        quoteId?: string;
        preventivo?: QuoteResult;
        errore?: string;
      };
      if (!res.ok || !dati.quoteId || !dati.preventivo) {
        throw new Error(dati.errore ?? UI.erroreGenerico);
      }
      setRisultato({ esito: dati.preventivo, quoteId: dati.quoteId });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : UI.erroreGenerico);
    } finally {
      setInvio(false);
    }
  }

  // ── Risultato ──────────────────────────────────────────────────────────
  if (risultato) {
    return (
      <div>
        <div className="mb-10">
          <p className="etichetta text-lime">Preventivo</p>
          <h2 className="text-testo mt-3 text-3xl font-medium">
            Tre modi di fare questo libro
          </h2>
          <p className="prosa text-testo-attenuato mt-3 max-w-2xl">
            Te li abbiamo mandati anche via email. Se vuoi partire, l&rsquo;acconto blocca la data;
            se prima vuoi parlarne, rispondi a quella email.
          </p>
        </div>
        <RisultatoPreventivo esito={risultato.esito} quoteId={risultato.quoteId} />
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
      <div>
        {/* Avanzamento */}
        <div className="mb-8">
          <div className="flex items-baseline justify-between">
            <span className="etichetta text-lime">
              {UI.passo} {passo + 1} {UI.di} {TOTALE_PASSI}
            </span>
            <span className="etichetta text-testo-tenue">{PREVENTIVO.passi[passo]}</span>
          </div>
          <div className="bg-filetto-notte mt-3 h-px w-full">
            <div
              className="bg-lime h-px transition-all duration-300"
              style={{ width: `${((passo + 1) / TOTALE_PASSI) * 100}%` }}
            />
          </div>
        </div>

        <div className="min-h-[22rem]">
          {/* 1 — Tipo di progetto */}
          {passo === 0 && (
            <Griglia>
              {TIPI_PROGETTO.map((o) => (
                <Opzione
                  key={o.valore}
                  scelta={s.tipo === o.valore}
                  label={o.label}
                  nota={o.nota}
                  onClick={() => {
                    agg("tipo", o.valore);
                    if (o.valore === "memoir" && !s.statoTesto) agg("statoTesto", "solo-materiali");
                    if (o.valore === "solo-grafica") agg("statoTesto", "finito-revisionato");
                  }}
                />
              ))}
            </Griglia>
          )}

          {/* 2 — Stato del testo */}
          {passo === 1 && (
            <Griglia>
              {STATI_TESTO.map((o) => (
                <Opzione
                  key={o.valore}
                  scelta={s.statoTesto === o.valore}
                  label={o.label}
                  nota={o.nota}
                  onClick={() => agg("statoTesto", o.valore)}
                />
              ))}
            </Griglia>
          )}

          {/* 3 — Dimensione */}
          {passo === 2 && (
            <div>
              <p className="text-testo text-xl">
                {soloMateriali
                  ? "Quanto lungo pensi debba essere il libro finito?"
                  : "Quante parole ha il testo?"}
              </p>
              <p className="editoriale text-testo-tenue mt-2">
                {soloMateriali
                  ? "Una stima basta: la definiamo insieme guardando il materiale."
                  : "Il conteggio esatto lo trovi in fondo al documento Word."}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {PRESET_PAROLE.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => agg("parole", p)}
                    className={cn(
                      "garbo cifre rounded-md border px-4 py-2 text-sm",
                      s.parole === p
                        ? "border-lime bg-lime/15 text-testo"
                        : "border-bordo text-testo-attenuato hover:border-lime",
                    )}
                  >
                    {numero(p)}
                  </button>
                ))}
              </div>

              <div className="mt-5 max-w-xs">
                <Campo id="parole" label="Oppure indica il numero preciso">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={s.parole || ""}
                      onChange={(e) => agg("parole", Number(e.target.value))}
                      className="cifre text-lg"
                    />
                  )}
                </Campo>
              </div>

              {soloMateriali && (
                <div className="mt-8">
                  <p className="text-testo text-lg">Quanto materiale hai già?</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {QUANTITA_MATERIALE.map((o) => (
                      <Opzione
                        key={o.valore}
                        scelta={s.materiale === o.valore}
                        label={o.label}
                        nota={o.nota}
                        onClick={() => agg("materiale", o.valore)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4 — Servizi */}
          {passo === 3 && (
            <div>
              <p className="editoriale text-testo-tenue mb-5">
                {soloGrafica
                  ? "Per la sola grafica contano copertina, impaginazione ed EPUB."
                  : "Seleziona quello che ti serve. Se non sei sicuro, lascia stare: i tre pacchetti propongono comunque una composizione sensata."}
              </p>
              <Griglia>
                {SERVIZI.map((o) => (
                  <Opzione
                    key={o.valore}
                    scelta={s.servizi.includes(o.valore)}
                    label={o.label}
                    nota={o.nota}
                    casella
                    onClick={() =>
                      agg(
                        "servizi",
                        s.servizi.includes(o.valore)
                          ? s.servizi.filter((x) => x !== o.valore)
                          : [...s.servizi, o.valore],
                      )
                    }
                  />
                ))}
              </Griglia>
            </div>
          )}

          {/* 5 — Tempi */}
          {passo === 4 && (
            <Griglia>
              {TEMPI.map((o) => (
                <Opzione
                  key={o.valore}
                  scelta={s.tempi === o.valore}
                  label={o.label}
                  nota={o.nota}
                  onClick={() => agg("tempi", o.valore)}
                />
              ))}
            </Griglia>
          )}

          {/* 6 — Contatto */}
          {passo === 5 && (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo id="pv-nome" label="Nome" obbligatorio>
                  {(p) => (
                    <Input
                      {...p}
                      value={s.nome}
                      onChange={(e) => agg("nome", e.target.value)}
                      autoComplete="name"
                    />
                  )}
                </Campo>
                <Campo id="pv-email" label="Email" obbligatorio>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      value={s.email}
                      onChange={(e) => agg("email", e.target.value)}
                      autoComplete="email"
                    />
                  )}
                </Campo>
              </div>

              <Campo id="pv-tel" label="Telefono" hint="Facoltativo">
                {(p) => (
                  <Input
                    {...p}
                    value={s.telefono}
                    onChange={(e) => agg("telefono", e.target.value)}
                    autoComplete="tel"
                  />
                )}
              </Campo>

              <Campo id="pv-note" label="Qualcosa che dovremmo sapere" hint="Facoltativo">
                {(p) => (
                  <AreaTesto
                    {...p}
                    rows={3}
                    value={s.note}
                    onChange={(e) => agg("note", e.target.value)}
                  />
                )}
              </Campo>

              <Filetto />

              <Consenso
                id="pv-privacy"
                name="consensoPrivacy"
                checked={s.consensoPrivacy}
                onChange={(v) => agg("consensoPrivacy", v)}
              >
                Ho letto la{" "}
                <Link href={"/privacy" as Route} className="hover:text-lime underline">
                  privacy policy
                </Link>{" "}
                e acconsento al trattamento dei dati per ricevere il preventivo. *
              </Consenso>

              <Consenso
                id="pv-marketing"
                name="consensoMarketing"
                checked={s.consensoMarketing}
                onChange={(v) => agg("consensoMarketing", v)}
              >
                Voglio ricevere anche le guide sull&rsquo;autopubblicazione. Facoltativo, niente
                spam.
              </Consenso>

              {errore && (
                <p className="text-lime text-sm" role="alert">
                  {errore}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigazione */}
        <div className="border-bordo mt-10 flex items-center justify-between border-t pt-6">
          <Bottone
            variante="secondario"
            onClick={() => setPasso((p) => Math.max(0, p - 1))}
            disabled={passo === 0 || invio}
          >
            ← {UI.indietro}
          </Bottone>

          {passo < TOTALE_PASSI - 1 ? (
            <Bottone
              variante="identita"
              onClick={() => setPasso((p) => p + 1)}
              disabled={!puoAvanzare}
            >
              {UI.avanti} →
            </Bottone>
          ) : (
            <Bottone
              variante="identita"
              misura="grande"
              onClick={calcola}
              disabled={!puoAvanzare || invio}
            >
              {invio ? UI.caricamento : PREVENTIVO.passi[5] && "Calcola il preventivo"}
            </Bottone>
          )}
        </div>
      </div>

      {/* Anteprima live */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-lg border-bordo bg-superficie border p-6">
          <p className="etichetta text-lime">Anteprima</p>
          {anteprima ? (
            <>
              <div className="mt-4 space-y-2">
                {anteprima.packages.map((p) => (
                  <div
                    key={p.tier}
                    className={cn(
                      "flex items-baseline justify-between gap-3 rounded-[2px] px-3 py-2.5",
                      p.recommended ? "bg-lime/15" : "bg-fondo-alto",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm",
                        p.recommended ? "text-testo" : "text-testo/65",
                      )}
                    >
                      {p.name}
                    </span>
                    <span className="cifre text-testo text-sm">{euro(p.total)}</span>
                  </div>
                ))}
              </div>
              <Filetto className="my-4" />
              <dl className="flex justify-between text-xs">
                <dt className="etichetta text-testo-tenue">Pagine stimate</dt>
                <dd className="cifre text-testo-attenuato">{numero(anteprima.estimatedPages)}</dd>
              </dl>
              <p className="editoriale text-testo-tenue mt-4">
                Si aggiorna mentre rispondi. Il preventivo definitivo arriva anche via email.
              </p>
            </>
          ) : (
            <p className="prosa text-testo-tenue mt-4 text-sm">
              Rispondi alle prime domande e qui compaiono i tre percorsi con il prezzo.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Sotto-componenti ──────────────────────────────────────────────────────

function Griglia({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Opzione({
  scelta,
  label,
  nota,
  onClick,
  casella = false,
}: {
  scelta: boolean;
  label: string;
  nota?: string;
  onClick: () => void;
  casella?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={scelta}
      className={cn(
        "garbo rounded-lg flex items-start gap-3 border p-4 text-left",
        scelta
          ? "border-lime bg-lime/10"
          : "border-bordo bg-superficie hover:border-lime/50",
      )}
    >
      <span
        className={cn(
          "text-fondo mt-0.5 grid size-4 shrink-0 place-items-center border",
          casella ? "rounded-[2px]" : "rounded-full",
          scelta ? "border-lime bg-lime" : "border-bordo-forte",
        )}
        aria-hidden
      >
        {scelta && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5.2 4 7.2l4-4.4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>
        <span className="text-testo block text-[0.95rem] font-medium">{label}</span>
        {nota && <span className="text-testo-tenue mt-0.5 block text-sm">{nota}</span>}
      </span>
    </button>
  );
}
