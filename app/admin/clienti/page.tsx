import type { Metadata } from "next";
import { Titolo } from "@/components/ui/primitivi";
import { Tabella, Riga, Cella } from "@/components/ui/tabella";
import { StatoVuoto } from "@/components/ui/stati";
import { Badge } from "@/components/ui/badge";
import { BottoneLink } from "@/components/ui/bottone";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { elencaClienti } from "@/lib/dati/clienti";
import { haDatiFatturazione, haIdentita } from "@/lib/dto/cliente";
import { numero, dataEstesa } from "@/lib/format";

export const metadata: Metadata = { title: "Clienti", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const INTESTAZIONI = [
  { chiave: "nome", testo: "Cliente" },
  { chiave: "tipo", testo: "Tipo" },
  { chiave: "contatti", testo: "Contatti" },
  { chiave: "fiscali", testo: "Dati fiscali" },
  { chiave: "dal", testo: "Cliente dal" },
] as const;

export default async function PaginaClienti({
  searchParams,
}: {
  searchParams: Promise<{ cerca?: string }>;
}) {
  const attore = await staffPerPagina("/admin/clienti", "cliente.vedi_identita");
  const { cerca } = await searchParams;
  const pagina = await elencaClienti(attore, { cerca, perPagina: 50 });
  const puoCreare = haPermesso(attore, "cliente.modifica");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Titolo livello={1} occhiello={`${numero(pagina.totale)} clienti`}>
          Clienti
        </Titolo>
        {puoCreare ? (
          <BottoneLink href="/admin/clienti/nuovo" variante="identita">
            Inserisci cliente attuale
          </BottoneLink>
        ) : null}
      </div>

      {pagina.voci.length === 0 ? (
        <StatoVuoto
          titolo="Nessun cliente"
          descrizione="Converti un lead dal CRM oppure inserisci direttamente un cliente già acquisito."
        />
      ) : (
        <Tabella intestazioni={INTESTAZIONI} didascalia="Elenco dei clienti">
          {pagina.voci.map((c) => (
            <Riga key={c.id}>
              <Cella intestazione>
                {haIdentita(c) ? (
                  <>
                    <span className="block text-testo">
                      {c.ragioneSociale ?? `${c.nome} ${c.cognome ?? ""}`.trim()}
                    </span>
                    <span className="cifre block text-xs text-testo-tenue">{c.riferimento}</span>
                  </>
                ) : (
                  <span className="text-testo">{c.riferimento}</span>
                )}
              </Cella>
              <Cella>{haIdentita(c) ? <Badge>{c.tipo}</Badge> : "—"}</Cella>
              <Cella>
                {haIdentita(c) ? (
                  <span className="flex flex-col">
                    <span className="text-xs">{c.email}</span>
                    {c.telefono ? (
                      <span className="cifre text-xs text-testo-tenue">{c.telefono}</span>
                    ) : null}
                  </span>
                ) : (
                  "—"
                )}
              </Cella>
              <Cella>
                {haDatiFatturazione(c) ? (
                  c.partitaIva ? (
                    <span className="cifre text-xs">{c.partitaIva}</span>
                  ) : (
                    <Badge tono="attenzione">Da completare</Badge>
                  )
                ) : (
                  <span className="text-xs text-testo-tenue">Non visibili al tuo ruolo</span>
                )}
              </Cella>
              <Cella>
                {haIdentita(c) && c.createdAt ? (
                  <span className="cifre text-xs">{dataEstesa(c.createdAt)}</span>
                ) : (
                  "—"
                )}
              </Cella>
            </Riga>
          ))}
        </Tabella>
      )}
    </div>
  );
}
