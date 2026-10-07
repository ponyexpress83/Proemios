import type { Metadata } from "next";
import { Titolo } from "@/components/ui/primitivi";
import { SchedaMetrica } from "@/components/ui/scheda";
import { StatoVuoto } from "@/components/ui/stati";
import { RigaIncasso } from "@/components/commercio/riga-incasso";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { elencaIncassi, riepilogoIncassi } from "@/lib/dati/pagamenti";
import { euroDaCentesimi } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pagamenti",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaginaPagamentiAdmin() {
  const attore = await staffPerPagina("/admin/pagamenti", "pagamento.vedi");
  const [riepilogo, { voci }] = await Promise.all([
    riepilogoIncassi(attore),
    elencaIncassi(attore, { perPagina: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        sotto="Incassi, rimborsi e fatture. Ogni operazione lascia traccia di chi l'ha fatta."
      >
        Pagamenti
      </Titolo>

      <div className="grid gap-4 sm:grid-cols-3">
        <SchedaMetrica
          etichetta="Incassato netto"
          valore={euroDaCentesimi(riepilogo.incassatoCent)}
          tono="positivo"
        />
        <SchedaMetrica
          etichetta="Atteso"
          valore={euroDaCentesimi(riepilogo.attesoCent)}
          tono={riepilogo.attesoCent > 0 ? "attenzione" : "neutro"}
        />
        <SchedaMetrica
          etichetta="Rimborsato"
          valore={euroDaCentesimi(riepilogo.rimborsatoCent)}
          tono={riepilogo.rimborsatoCent > 0 ? "critico" : "neutro"}
        />
      </div>

      {voci.length === 0 ? (
        <StatoVuoto
          titolo="Nessun incasso"
          descrizione="Le rate compaiono qui appena un ordine viene confermato."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {voci.map((v) => (
            <li key={v.rata.id}>
              <RigaIncasso
                rata={v.rata}
                ordineCodice={v.ordineCodice ?? undefined}
                cliente={v.clienteNome ?? undefined}
                puoRegistrare={haPermesso(attore, "pagamento.registra")}
                puoRimborsare={haPermesso(attore, "pagamento.rimborsa")}
                puoFatturare={haPermesso(attore, "fattura.emetti") && !v.fatturata}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
