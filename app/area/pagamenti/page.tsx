import type { Metadata } from "next";
import { Titolo, Nota, Dato } from "@/components/ui/primitivi";
import { Avviso, StatoVuoto } from "@/components/ui/stati";
import { Scheda, SchedaCorpo, SchedaTestata } from "@/components/ui/scheda";
import { BottoneLink } from "@/components/ui/bottone";
import { Rata } from "@/components/commercio/rata";
import { attorePerPagina } from "@/lib/auth/sessione";
import { elencaOrdini, leggiOrdine } from "@/lib/dati/ordini";
import { euroDaCentesimi, dataEstesa } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pagamenti",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ESITO: Record<string, { tono: "successo" | "attenzione"; titolo: string; testo: string }> = {
  ok: {
    tono: "successo",
    titolo: "Pagamento ricevuto",
    testo:
      "Grazie. La conferma può metterci qualche istante ad arrivare: se lo stato qui sotto è ancora «da saldare», ricarica fra un minuto.",
  },
  annullato: {
    tono: "attenzione",
    titolo: "Pagamento annullato",
    testo: "Non è stato addebitato nulla. Puoi riprovare quando vuoi.",
  },
};

export default async function PaginaPagamenti({
  searchParams,
}: {
  searchParams: Promise<{ esito?: string }>;
}) {
  const attore = await attorePerPagina("/area/pagamenti");
  const { esito } = await searchParams;
  const { voci } = await elencaOrdini(attore, { perPagina: 50 });

  // Un ordine per volta con le sue rate: il cliente ragiona per progetto, non
  // per riga contabile.
  const dettagli = await Promise.all(voci.map((o) => leggiOrdine(attore, o.id)));
  const avviso = esito ? ESITO[esito] : undefined;

  return (
    <div className="gabbia flex flex-col gap-8 py-10">
      <Titolo
        livello={1}
        sotto="Qui trovi gli ordini, le rate e le fatture. Nient'altro: nessun addebito automatico, nessun rinnovo."
      >
        Pagamenti
      </Titolo>

      {avviso ? (
        <Avviso tono={avviso.tono} titolo={avviso.titolo}>
          {avviso.testo}
        </Avviso>
      ) : null}

      {dettagli.length === 0 ? (
        <StatoVuoto
          titolo="Nessun ordine"
          descrizione="Quando un preventivo diventa un ordine lo trovi qui, con il suo piano di pagamento."
        />
      ) : (
        dettagli.map((d) => (
          <Scheda key={d.ordine.id} variante="sollevata">
            <SchedaTestata
              titolo={`Ordine ${d.ordine.codice}`}
              sotto={
                d.ordine.confermatoAt
                  ? `Confermato il ${dataEstesa(d.ordine.confermatoAt)}`
                  : "In attesa di conferma"
              }
            />
            <SchedaCorpo className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Dato etichetta="Totale" numerico>
                  {euroDaCentesimi(d.ordine.totaleCent)}
                </Dato>
                <Dato etichetta="Di cui IVA" numerico>
                  {euroDaCentesimi(d.ordine.ivaCent)}
                </Dato>
                <Dato etichetta="Ancora da saldare" numerico>
                  {euroDaCentesimi(d.residuoCent)}
                </Dato>
              </div>

              <div className="flex flex-col gap-3">
                {d.rate.map((r) => (
                  <Rata key={r.id} rata={r} />
                ))}
              </div>

              {d.fatture.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="etichetta text-testo-tenue">Fatture</p>
                  {d.fatture.map((f) =>
                    f.urlDocumento ? (
                      <BottoneLink
                        key={f.id}
                        href={f.urlDocumento}
                        variante="quieto"
                        misura="piccola"
                        className="self-start"
                      >
                        {f.numeroDocumento ?? "Fattura"} ·{" "}
                        {f.dataDocumento ? dataEstesa(f.dataDocumento) : ""}
                      </BottoneLink>
                    ) : (
                      <Nota key={f.id}>{f.numeroDocumento ?? "Fattura"} — in preparazione.</Nota>
                    ),
                  )}
                </div>
              ) : null}
            </SchedaCorpo>
          </Scheda>
        ))
      )}
    </div>
  );
}
