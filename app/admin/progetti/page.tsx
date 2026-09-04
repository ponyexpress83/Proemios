import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Titolo } from "@/components/ui/primitivi";
import { Tabella, Riga, Cella } from "@/components/ui/tabella";
import { BadgeStato, Badge } from "@/components/ui/badge";
import { StatoVuoto } from "@/components/ui/stati";
import { Progresso } from "@/components/ui/progresso";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { elencaProgetti } from "@/lib/dati/progetti";
import { numero, dataEstesa } from "@/lib/format";
import { STATO_PROGETTO } from "@/config/back-office";
import type { ProgettoDTO } from "@/lib/dto/progetto";

/**
 * Vista di riga costruita dal DTO **senza cast**.
 *
 * I DTO di progetto hanno forme diverse a seconda del ruolo: quello del
 * redattore non ha `avanzamento`, quello del cliente non ha
 * `conteggioParole`. Forzare tutto a `ProgettoPerStaff` faceva compilare il
 * codice e produceva "NaN%" a schermo, che è il modo peggiore di scoprire che
 * un campo non c'era. Qui i campi opzionali si leggono con un controllo
 * esplicito, e la colonna resta vuota quando il dato non è previsto.
 */
type RigaProgetto = {
  id: string;
  codice: string;
  titolo: string;
  stato: string;
  scadenzaAt: string | null;
  avanzamento: number | null;
  conteggioParole: number | null;
};

function aRiga(p: ProgettoDTO): RigaProgetto {
  return {
    id: p.id,
    codice: p.codice,
    titolo: p.titolo,
    stato: p.stato,
    scadenzaAt: p.scadenzaAt,
    avanzamento: "avanzamento" in p ? p.avanzamento : null,
    conteggioParole: "conteggioParole" in p ? p.conteggioParole : null,
  };
}

export const metadata: Metadata = { title: "Progetti", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const INTESTAZIONI = [
  { chiave: "codice", testo: "Codice" },
  { chiave: "titolo", testo: "Progetto" },
  { chiave: "stato", testo: "Stato" },
  { chiave: "avanzamento", testo: "Avanzamento" },
  { chiave: "parole", testo: "Parole", numerica: true },
  { chiave: "scadenza", testo: "Scadenza" },
] as const;

export default async function PaginaProgetti({
  searchParams,
}: {
  searchParams: Promise<{ stato?: string; ritardo?: string }>;
}) {
  // Il permesso richiesto è quello minimo: `elencaProgetti` restringe da sé
  // l'elenco a ciò che l'attore può vedere — tutti i progetti del tenant per
  // operations, solo quelli di cui è membro per un redattore.
  const attore = await staffPerPagina("/admin/progetti", "progetto.vedi_assegnati");
  const { stato, ritardo } = await searchParams;

  const vedeTutti = haPermesso(attore, "progetto.vedi_tutti");
  const pagina = await elencaProgetti(attore, {
    stato: stato ? [stato] : undefined,
    soloInRitardo: ritardo === "1",
    perPagina: 50,
  });
  const voci = pagina.voci.map(aRiga);

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello={`${numero(pagina.totale)} progetti`}
        sotto={
          vedeTutti
            ? undefined
            : "Vedi i progetti di cui fai parte. Per essere aggiunto a un progetto, chiedi a chi lo coordina."
        }
      >
        Progetti
      </Titolo>

      <nav aria-label="Filtri" className="flex flex-wrap gap-2">
        <FiltroLink href="/admin/progetti" attivo={!stato && ritardo !== "1"}>
          Tutti
        </FiltroLink>
        <FiltroLink href="/admin/progetti?stato=in_corso" attivo={stato === "in_corso"}>
          In corso
        </FiltroLink>
        <FiltroLink
          href="/admin/progetti?stato=in_attesa_cliente"
          attivo={stato === "in_attesa_cliente"}
        >
          Attendono il cliente
        </FiltroLink>
        <FiltroLink href="/admin/progetti?ritardo=1" attivo={ritardo === "1"}>
          In ritardo
        </FiltroLink>
      </nav>

      {voci.length === 0 ? (
        <StatoVuoto
          titolo="Nessun progetto con questi filtri"
          descrizione="Prova a togliere un filtro, oppure crea un progetto da un cliente esistente."
        />
      ) : (
        <Tabella intestazioni={INTESTAZIONI} didascalia="Elenco dei progetti">
          {voci.map((p) => {
            const s = STATO_PROGETTO[p.stato] ?? { etichetta: p.stato, tono: "neutro" as const };
            const inRitardo =
              p.scadenzaAt !== null &&
              new Date(p.scadenzaAt) < new Date() &&
              p.stato !== "concluso";
            return (
              <Riga key={p.id}>
                <Cella>
                  <Link
                    href={`/admin/progetti/${p.id}` as Route}
                    className="cifre garbo text-viola-chiaro hover:underline"
                  >
                    {p.codice}
                  </Link>
                </Cella>
                <Cella intestazione>
                  <span className="text-testo block max-w-xs truncate">{p.titolo}</span>
                </Cella>
                <Cella>
                  <BadgeStato tono={s.tono}>{s.etichetta}</BadgeStato>
                </Cella>
                <Cella className="w-40">
                  {p.avanzamento === null ? (
                    <span className="text-xs text-testo-tenue">—</span>
                  ) : (
                    <Progresso
                      valore={p.avanzamento}
                      etichetta={`Avanzamento di ${p.codice}`}
                      mostraEtichetta={false}
                    />
                  )}
                </Cella>
                <Cella numerica>{p.conteggioParole ? numero(p.conteggioParole) : "—"}</Cella>
                <Cella>
                  {p.scadenzaAt ? (
                    inRitardo ? (
                      <Badge tono="errore">{dataEstesa(p.scadenzaAt)}</Badge>
                    ) : (
                      <span className="cifre text-xs">{dataEstesa(p.scadenzaAt)}</span>
                    )
                  ) : (
                    "—"
                  )}
                </Cella>
              </Riga>
            );
          })}
        </Tabella>
      )}
    </div>
  );
}

function FiltroLink({
  href,
  attivo,
  children,
}: {
  href: string;
  attivo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      aria-current={attivo ? "page" : undefined}
      className={
        attivo
          ? "garbo border-viola bg-viola/12 text-testo rounded-full border px-4 py-1.5 text-sm"
          : "garbo border-bordo bg-superficie text-testo-attenuato hover:border-bordo-forte hover:text-testo rounded-full border px-4 py-1.5 text-sm"
      }
    >
      {children}
    </Link>
  );
}
