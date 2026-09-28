import type { Metadata } from "next";
import { Titolo } from "@/components/ui/primitivi";
import { StatoVuoto } from "@/components/ui/stati";
import { ElencoApprovazioni } from "@/components/progetti/approvazioni";
import { staffPerPagina } from "@/lib/auth/sessione";
import { approvazioniInAttesa } from "@/lib/dati/comunicazioni";

export const metadata: Metadata = {
  title: "Approvazioni",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PaginaApprovazioni() {
  const attore = await staffPerPagina("/admin/approvazioni");
  const elenco = await approvazioniInAttesa(attore);

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello={`${elenco.length} in attesa`}
        sotto="Compaiono solo le decisioni che spettano al tuo ruolo. Chi approva editorialmente non consegna, e chi consegna non approva il contenuto."
      >
        Approvazioni
      </Titolo>

      {elenco.length === 0 ? (
        <StatoVuoto
          titolo="Nulla in attesa"
          descrizione="Non c'è niente che aspetti una tua decisione in questo momento."
        />
      ) : (
        <ElencoApprovazioni voci={elenco} />
      )}
    </div>
  );
}
