import type { Metadata } from "next";
import { desc, gte } from "drizzle-orm";
import Link from "next/link";
import type { Route } from "next";
import { db, dbConfigurato } from "@/db";
import { leads, quotes, manuscriptAnalyses, agencyLeads } from "@/db/schema";
import { Gabbia, Filetto, cn } from "@/components/ui/primitivi";
import { euro, numero, dataEstesa } from "@/lib/format";
import { BRAND } from "@/config/brand";
import { demoAttiva, datiAdminDemo } from "@/lib/demo";
import type { QuotePackage } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATO_ETICHETTA: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  deposit_paid: "Acconto pagato",
  won: "Chiuso",
  lost: "Perso",
};

const STATO_TONO: Record<string, string> = {
  draft: "border-bordo text-testo-tenue",
  sent: "border-viola/40 text-viola-chiaro",
  deposit_paid: "border-esito-positivo/50 text-successo",
  won: "border-esito-positivo/50 text-successo",
  lost: "border-errore/40 text-errore",
};

const PERIODI = { "7": 7, "30": 30, "90": 90, tutto: 0 } as const;
type PeriodoKey = keyof typeof PERIODI;

async function carica(giorni: number, statoFiltro: string | null) {
  // In demo il cruscotto mostra i record creati durante la sessione più alcune
  // righe d'esempio: un pannello vuoto non dimostrerebbe nulla.
  if (demoAttiva()) {
    const dati = datiAdminDemo();
    return {
      errore: null as string | null,
      demo: true,
      lead: dati.lead,
      preventivi: statoFiltro
        ? dati.preventivi.filter((p) => p.stato === statoFiltro)
        : dati.preventivi,
      analisi: dati.analisi,
      agenzie: dati.agenzie,
    };
  }

  if (!dbConfigurato()) {
    return {
      errore: "DATABASE_URL non configurata.",
      demo: false,
      lead: [],
      preventivi: [],
      analisi: [],
      agenzie: [],
    };
  }
  try {
    const da = giorni > 0 ? new Date(Date.now() - giorni * 24 * 60 * 60 * 1000) : null;

    const [lead, preventiviTutti, analisi, agenzie] = await Promise.all([
      da
        ? db
            .select()
            .from(leads)
            .where(gte(leads.createdAt, da))
            .orderBy(desc(leads.createdAt))
            .limit(50)
        : db.select().from(leads).orderBy(desc(leads.createdAt)).limit(50),
      da
        ? db
            .select()
            .from(quotes)
            .where(gte(quotes.createdAt, da))
            .orderBy(desc(quotes.createdAt))
            .limit(50)
        : db.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(50),
      da
        ? db
            .select()
            .from(manuscriptAnalyses)
            .where(gte(manuscriptAnalyses.createdAt, da))
            .orderBy(desc(manuscriptAnalyses.createdAt))
            .limit(50)
        : db
            .select()
            .from(manuscriptAnalyses)
            .orderBy(desc(manuscriptAnalyses.createdAt))
            .limit(50),
      db.select().from(agencyLeads).limit(50),
    ]);

    const preventivi = statoFiltro
      ? preventiviTutti.filter((p) => p.stato === statoFiltro)
      : preventiviTutti;

    return { errore: null as string | null, demo: false, lead, preventivi, analisi, agenzie };
  } catch (err) {
    return {
      errore: err instanceof Error ? err.message : "Errore di connessione al database.",
      demo: false,
      lead: [],
      preventivi: [],
      analisi: [],
      agenzie: [],
    };
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; stato?: string }>;
}) {
  const sp = await searchParams;
  const periodoKey: PeriodoKey = (
    sp.periodo && sp.periodo in PERIODI ? sp.periodo : "30"
  ) as PeriodoKey;
  const statoFiltro = sp.stato && sp.stato in STATO_ETICHETTA ? sp.stato : null;

  const { errore, demo, lead, preventivi, analisi, agenzie } = await carica(
    PERIODI[periodoKey],
    statoFiltro,
  );

  const pagati = preventivi.filter((p) => p.stato === "deposit_paid");
  const valorePagato = pagati.reduce((t, p) => t + (p.acconto ?? 0), 0);
  const valorePipeline = preventivi
    .filter((p) => p.stato === "sent")
    .reduce((t, p) => t + (p.prezzoTotale ?? 0), 0);

  return (
    <div className="bg-superficie-alta min-h-dvh py-10">
      <Gabbia>
        <header className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-3xl font-medium">Cruscotto</h1>
          <span className="etichetta text-testo-tenue">{BRAND.name} · uso interno</span>
        </header>

        {demo && (
          <div className="rounded-lg border-lime bg-superficie mt-6 border border-dashed p-4">
            <p className="etichetta text-lime">Cruscotto dimostrativo</p>
            <p className="prosa mt-2 text-sm">
              Le righe con identificativo <code className="font-mono text-[0.9em]">demo-</code> sono
              inventate e non corrispondono ad alcuna persona. Quelle create durante questa sessione
              restano in memoria e spariscono al riavvio: senza{" "}
              <code className="font-mono text-[0.9em]">DATABASE_URL</code> non viene scritto nulla.
            </p>
          </div>
        )}

        {errore && (
          <div className="rounded-lg border-errore/40 bg-superficie mt-6 border p-4">
            <p className="etichetta text-errore">Database non raggiungibile</p>
            <p className="prosa mt-2 text-sm">{errore}</p>
          </div>
        )}

        {/* Filtri */}
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="etichetta text-testo-tenue">Periodo</span>
            {(Object.keys(PERIODI) as PeriodoKey[]).map((k) => (
              <Link
                key={k}
                href={`/admin?periodo=${k}${statoFiltro ? `&stato=${statoFiltro}` : ""}` as Route}
                className={cn(
                  "garbo rounded-md border px-3 py-1.5 font-mono text-xs",
                  periodoKey === k
                    ? "border-viola bg-viola text-testo"
                    : "border-bordo text-testo-tenue hover:border-viola",
                )}
              >
                {k === "tutto" ? "tutto" : `${k}g`}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="etichetta text-testo-tenue">Stato</span>
            <Link
              href={`/admin?periodo=${periodoKey}` as Route}
              className={cn(
                "garbo rounded-md border px-3 py-1.5 font-mono text-xs",
                !statoFiltro
                  ? "border-viola bg-viola text-testo"
                  : "border-bordo text-testo-tenue hover:border-viola",
              )}
            >
              tutti
            </Link>
            {Object.keys(STATO_ETICHETTA).map((s) => (
              <Link
                key={s}
                href={`/admin?periodo=${periodoKey}&stato=${s}` as Route}
                className={cn(
                  "garbo rounded-md border px-3 py-1.5 font-mono text-xs",
                  statoFiltro === s
                    ? "border-viola bg-viola text-testo"
                    : "border-bordo text-testo-tenue hover:border-viola",
                )}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

        {/* Indicatori */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Indicatore etichetta="Lead" valore={numero(lead.length)} />
          <Indicatore etichetta="Preventivi" valore={numero(preventivi.length)} />
          <Indicatore etichetta="Acconti pagati" valore={numero(pagati.length)} />
          <Indicatore etichetta="Incassato (acconti)" valore={euro(valorePagato)} />
          <Indicatore etichetta="In attesa di risposta" valore={euro(valorePipeline)} />
        </div>

        {/* Preventivi */}
        <Riquadro titolo="Preventivi">
          <Tabella intestazioni={["Data", "Stato", "Scelto", "Totale", "Acconto", "Stripe"]}>
            {preventivi.map((p) => {
              const pacchetti = p.pacchettiGenerati as QuotePackage[];
              const consigliato = pacchetti?.find?.((x) => x.recommended);
              return (
                <tr key={p.id} className="border-bordo border-t">
                  <Cella>{dataEstesa(p.createdAt)}</Cella>
                  <Cella>
                    <span
                      className={cn(
                        "etichetta inline-block rounded-full border px-2 py-0.5",
                        STATO_TONO[p.stato] ?? "border-bordo text-testo-tenue",
                      )}
                    >
                      {STATO_ETICHETTA[p.stato] ?? p.stato}
                    </span>
                  </Cella>
                  <Cella>{p.pacchettoScelto ?? "—"}</Cella>
                  <Cella mono>
                    {p.prezzoTotale
                      ? euro(p.prezzoTotale)
                      : consigliato
                        ? euro(consigliato.total)
                        : "—"}
                  </Cella>
                  <Cella mono>{p.acconto ? euro(p.acconto) : "—"}</Cella>
                  <Cella mono className="max-w-[12rem] truncate text-xs">
                    {p.stripeSessionId ?? "—"}
                  </Cella>
                </tr>
              );
            })}
            {preventivi.length === 0 && <Vuoto colonne={6} />}
          </Tabella>
        </Riquadro>

        {/* Analisi */}
        <Riquadro titolo="Analisi manoscritto">
          <Tabella intestazioni={["Data", "File", "Parole", "Gulpease", "Livello", "Scade"]}>
            {analisi.map((a) => {
              const r = a.report as {
                livelloIntervento?: string;
                metriche?: { gulpease?: number };
              };
              return (
                <tr key={a.id} className="border-bordo border-t">
                  <Cella>{dataEstesa(a.createdAt)}</Cella>
                  <Cella className="max-w-[16rem] truncate">{a.filename}</Cella>
                  <Cella mono>{numero(a.wordCount)}</Cella>
                  <Cella mono>{r.metriche?.gulpease ?? "—"}</Cella>
                  <Cella>{r.livelloIntervento ?? "—"}</Cella>
                  <Cella mono className="text-xs">
                    {dataEstesa(a.expiresAt)}
                  </Cella>
                </tr>
              );
            })}
            {analisi.length === 0 && <Vuoto colonne={6} />}
          </Tabella>
        </Riquadro>

        {/* Agenzie */}
        <Riquadro titolo="Richieste white label">
          <Tabella intestazioni={["Agenzia", "Sito", "Esternalizzano", "Volume"]}>
            {agenzie.map((a) => (
              <tr key={a.id} className="border-bordo border-t">
                <Cella>{a.nomeAgenzia}</Cella>
                <Cella className="max-w-[14rem] truncate">{a.sito ?? "—"}</Cella>
                <Cella className="max-w-[20rem] truncate">{a.serviziEsternalizzati ?? "—"}</Cella>
                <Cella>{a.volumeStimato ?? "—"}</Cella>
              </tr>
            ))}
            {agenzie.length === 0 && <Vuoto colonne={4} />}
          </Tabella>
        </Riquadro>

        {/* Lead */}
        <Riquadro titolo="Lead">
          <Tabella intestazioni={["Data", "Nome", "Email", "Fonte", "Marketing"]}>
            {lead.map((l) => (
              <tr key={l.id} className="border-bordo border-t">
                <Cella>{dataEstesa(l.createdAt)}</Cella>
                <Cella>{l.nome}</Cella>
                <Cella className="max-w-[18rem] truncate">{l.email}</Cella>
                <Cella>{l.fonte}</Cella>
                <Cella>{l.consensoMarketing ? "sì" : "no"}</Cella>
              </tr>
            ))}
            {lead.length === 0 && <Vuoto colonne={5} />}
          </Tabella>
        </Riquadro>
      </Gabbia>
    </div>
  );
}

// ── Sotto-componenti ──────────────────────────────────────────────────────

function Indicatore({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="rounded-lg border-bordo bg-superficie border p-5">
      <p className="etichetta text-testo-tenue">{etichetta}</p>
      <p className="cifre text-testo mt-2 text-2xl font-medium">{valore}</p>
    </div>
  );
}

function Riquadro({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium">{titolo}</h2>
      <Filetto className="mt-3" />
      <div className="rounded-lg border-bordo bg-superficie mt-4 overflow-x-auto border">
        {children}
      </div>
    </section>
  );
}

function Tabella({
  intestazioni,
  children,
}: {
  intestazioni: string[];
  children: React.ReactNode;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          {intestazioni.map((h) => (
            <th key={h} className="etichetta text-testo-tenue px-4 py-3">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Cella({
  children,
  className,
  mono = false,
}: {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <td className={cn("text-testo px-4 py-3", mono && "cifre", className)}>{children}</td>
  );
}

function Vuoto({ colonne }: { colonne: number }) {
  return (
    <tr className="border-bordo border-t">
      <td colSpan={colonne} className="text-testo-tenue px-4 py-8 text-center text-sm">
        Nessun dato in questo periodo.
      </td>
    </tr>
  );
}
