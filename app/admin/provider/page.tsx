import type { Metadata } from "next";
import { Titolo, Nota } from "@/components/ui/primitivi";
import { Avviso } from "@/components/ui/stati";
import { SchedaPolicy } from "@/components/provider/policy";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { elencaPolicy } from "@/lib/dati/provider";
import { PROVIDER } from "@/config/modelli";

export const metadata: Metadata = {
  title: "Provider AI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaginaProvider() {
  const attore = await staffPerPagina("/admin/provider", "provider.vedi_policy");
  const policy = await elencaPolicy(attore);
  const puoApprovare = haPermesso(attore, "provider.approva_policy");

  const perProvider = new Map(policy.map((p) => [p.provider, p]));
  const nessunoApprovato = policy.every((p) => !p.approvatoManoscrittiInediti);

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        sotto="Il cancello che decide se un manoscritto può essere mandato a un fornitore. Non descrive cosa vorremmo: descrive le condizioni contrattuali che qualcuno ha letto e approvato."
      >
        Provider AI
      </Titolo>

      {nessunoApprovato ? (
        <Avviso tono="attenzione" titolo="Nessun fornitore è approvato: le lavorazioni non partono">
          Il router esclude ogni modello finché una policy non è approvata per i manoscritti
          inediti, e i Job falliscono con «nessun modello ammesso». È il comportamento voluto —
          meglio una lavorazione ferma che un manoscritto mandato a un fornitore mai verificato.
          Approva qui sotto, dopo aver letto il contratto.
        </Avviso>
      ) : null}

      <Nota>
        I valori di riferimento in <code>config/modelli.ts</code> sono un promemoria di cosa
        aspettarsi dal contratto, non un&apos;approvazione: fuori dallo sviluppo non vengono nemmeno
        letti.
      </Nota>

      <div className="flex flex-col gap-6">
        {PROVIDER.map((p) => (
          <SchedaPolicy
            key={p}
            provider={p}
            iniziale={perProvider.get(p) ?? null}
            puoApprovare={puoApprovare}
          />
        ))}
      </div>
    </div>
  );
}
