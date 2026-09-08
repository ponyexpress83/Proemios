import type { Metadata } from "next";
import { Titolo } from "@/components/ui/primitivi";
import { ModuloNuovoProgetto } from "@/components/progetti/nuovo-progetto";
import { staffPerPagina } from "@/lib/auth/sessione";
import { elencaClienti } from "@/lib/dati/clienti";
import { haIdentita } from "@/lib/dto/cliente";

export const metadata: Metadata = { title: "Nuovo progetto", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PaginaNuovoProgetto({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const attore = await staffPerPagina("/admin/progetti/nuovo", "progetto.crea");
  const { cliente } = await searchParams;
  const pagina = await elencaClienti(attore, { perPagina: 100 });
  const clienti = pagina.voci
    .filter(haIdentita)
    .map((c) => ({
      id: c.id,
      etichetta: c.ragioneSociale ?? `${c.nome} ${c.cognome ?? ""}`.trim(),
    }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Titolo
        livello={1}
        occhiello="Produzione"
        sotto="Crea il progetto operativo, poi assegna redattori e lavorazioni dalla sua scheda."
      >
        Nuovo progetto
      </Titolo>
      <ModuloNuovoProgetto clienti={clienti} clientePreselezionato={cliente} />
    </div>
  );
}
