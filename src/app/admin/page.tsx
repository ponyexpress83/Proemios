import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, quotes, manuscriptAnalyses } from "@/db/schema";
import { Container } from "@/components/ui/Container";
import { euro } from "@/lib/format";
import { dataEstesa } from "@/lib/format";
import type { QuotePackage } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Sempre dati freschi: nessuna cache.
export const dynamic = "force-dynamic";

const STATO_LABEL: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  deposit_paid: "Acconto pagato",
  rejected: "Rifiutato",
};

const STATO_TONE: Record<string, string> = {
  draft: "bg-carta-3 text-inchiostro-60",
  sent: "bg-bronzo/10 text-bronzo-scuro",
  deposit_paid: "bg-successo/15 text-successo",
  rejected: "bg-errore/15 text-errore",
};

async function loadData() {
  try {
    const db = getDb();
    const [ultimiLead, ultimiQuote, ultimeAnalisi] = await Promise.all([
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(25),
      db.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(25),
      db.select().from(manuscriptAnalyses).orderBy(desc(manuscriptAnalyses.createdAt)).limit(25),
    ]);
    return { ultimiLead, ultimiQuote, ultimeAnalisi, error: null as string | null };
  } catch (err) {
    return {
      ultimiLead: [],
      ultimiQuote: [],
      ultimeAnalisi: [],
      error: err instanceof Error ? err.message : "Errore di connessione al database.",
    };
  }
}

export default async function AdminPage() {
  const { ultimiLead, ultimiQuote, ultimeAnalisi, error } = await loadData();
  const ordiniPagati = ultimiQuote.filter((q) => q.stato === "deposit_paid");

  return (
    <div className="bg-carta-2 min-h-dvh py-10">
      <Container>
        <header className="mb-8 flex items-baseline justify-between">
          <h1 className="font-display text-inchiostro text-3xl font-medium">Dashboard interna</h1>
          <span className="text-inchiostro-40 text-sm">Kalamos Studio · Fase 1</span>
        </header>

        {error && (
          <div className="border-errore/40 bg-errore/5 text-errore mb-8 rounded-lg border p-4 text-sm">
            Database non raggiungibile: {error}
          </div>
        )}

        {/* KPI */}
        <div className="mb-10 grid gap-4 sm:grid-cols-4">
          <Kpi label="Lead totali (recenti)" value={ultimiLead.length} />
          <Kpi label="Preventivi" value={ultimiQuote.length} />
          <Kpi label="Ordini pagati" value={ordiniPagati.length} />
          <Kpi label="Analisi effettuate" value={ultimeAnalisi.length} />
        </div>

        {/* Ordini pagati */}
        <Panel titolo="Ordini con acconto pagato">
          <Table headers={["Data", "Pacchetto", "Totale", "Sessione Stripe"]}>
            {ordiniPagati.map((q) => {
              const pkgs = q.pacchetti as QuotePackage[];
              const scelto = pkgs.find((p) => p.key === q.pacchettoScelto);
              return (
                <tr key={q.id} className="border-linea border-t">
                  <Td>{dataEstesa(q.createdAt)}</Td>
                  <Td>{scelto?.nome ?? q.pacchettoScelto ?? "—"}</Td>
                  <Td className="nums-tabular">{scelto ? euro(scelto.totale) : "—"}</Td>
                  <Td className="font-mono text-xs">{q.stripeSessionId ?? "—"}</Td>
                </tr>
              );
            })}
            {ordiniPagati.length === 0 && <EmptyRow cols={4} />}
          </Table>
        </Panel>

        {/* Preventivi */}
        <Panel titolo="Ultimi preventivi">
          <Table headers={["Data", "Stato", "Consigliato", "Pacchetto scelto"]}>
            {ultimiQuote.map((q) => {
              const pkgs = q.pacchetti as QuotePackage[];
              const consigliato = pkgs.find((p) => p.inEvidenza);
              return (
                <tr key={q.id} className="border-linea border-t">
                  <Td>{dataEstesa(q.createdAt)}</Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATO_TONE[q.stato]}`}
                    >
                      {STATO_LABEL[q.stato] ?? q.stato}
                    </span>
                  </Td>
                  <Td className="nums-tabular">{consigliato ? euro(consigliato.totale) : "—"}</Td>
                  <Td>{q.pacchettoScelto ?? "—"}</Td>
                </tr>
              );
            })}
            {ultimiQuote.length === 0 && <EmptyRow cols={4} />}
          </Table>
        </Panel>

        {/* Analisi */}
        <Panel titolo="Analisi manoscritto">
          <Table headers={["Data", "File", "Parole", "Livello"]}>
            {ultimeAnalisi.map((a) => {
              const report = a.report as { livelloIntervento?: string };
              return (
                <tr key={a.id} className="border-linea border-t">
                  <Td>{dataEstesa(a.createdAt)}</Td>
                  <Td className="max-w-xs truncate">{a.filename}</Td>
                  <Td className="nums-tabular">{a.wordCount.toLocaleString("it-IT")}</Td>
                  <Td>{report.livelloIntervento ?? "—"}</Td>
                </tr>
              );
            })}
            {ultimeAnalisi.length === 0 && <EmptyRow cols={4} />}
          </Table>
        </Panel>

        {/* Lead */}
        <Panel titolo="Ultimi lead">
          <Table headers={["Data", "Nome", "Email", "Fonte"]}>
            {ultimiLead.map((l) => (
              <tr key={l.id} className="border-linea border-t">
                <Td>{dataEstesa(l.createdAt)}</Td>
                <Td>{l.nome}</Td>
                <Td>{l.email}</Td>
                <Td>{l.fonte}</Td>
              </tr>
            ))}
            {ultimiLead.length === 0 && <EmptyRow cols={4} />}
          </Table>
        </Panel>
      </Container>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-linea bg-carta rounded-lg border p-5">
      <p className="text-inchiostro-40 text-sm">{label}</p>
      <p className="font-display text-inchiostro nums-tabular mt-1 text-3xl font-medium">{value}</p>
    </div>
  );
}

function Panel({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-inchiostro mb-3 text-xl font-medium">{titolo}</h2>
      <div className="border-linea bg-carta overflow-x-auto rounded-lg border">{children}</div>
    </section>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-inchiostro-40 text-xs tracking-wider uppercase">
          {headers.map((h) => (
            <th key={h} className="px-4 py-3 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`text-inchiostro-80 px-4 py-3 ${className}`}>{children}</td>;
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr className="border-linea border-t">
      <td colSpan={cols} className="text-inchiostro-40 px-4 py-6 text-center text-sm">
        Nessun dato.
      </td>
    </tr>
  );
}
